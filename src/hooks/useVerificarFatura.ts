import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Lancamento } from '../types'

// ============================================================================
// TYPES
// ============================================================================

interface ItemFatura {
  data: string
  descricao: string
  valor: number
}

interface ItemDivergente {
  descricao: string
  valor_app: number
  valor_pdf: number
  diferenca: number
}

export interface ResultadoVerificacao {
  total_pdf: number | null
  diferenca_total: number | null
  no_pdf_nao_no_app: ItemFatura[]
  no_app_nao_no_pdf: ItemFatura[]
  valores_divergentes: ItemDivergente[]
  resumo: string
  fonte: 'excel'
}

interface UseVerificarFaturaState {
  isExtraindo: boolean
  isAnalisando: boolean
  resultado: ResultadoVerificacao | null
  error: string | null
}

interface UseVerificarFaturaActions {
  verificar: (params: {
    arquivo: File
    senha?: string
    transacoes: Lancamento[]
    totalFatura: number
    cartaoNome: string
    periodo: string
    getCategoryName: (categoriaId: string | null) => string
  }) => Promise<void>
  limpar: () => void
}

export type UseVerificarFaturaReturn = UseVerificarFaturaState & UseVerificarFaturaActions

// ============================================================================
// HELPERS
// ============================================================================

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// ============================================================================
// HOOK
// ============================================================================

export function useVerificarFatura(): UseVerificarFaturaReturn {
  const [isExtraindo, setIsExtraindo] = useState(false)
  const [isAnalisando, setIsAnalisando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoVerificacao | null>(null)
  const [error, setError] = useState<string | null>(null)

  const verificar = useCallback(
    async ({
      arquivo,
      senha,
      transacoes,
      totalFatura,
      cartaoNome,
      periodo,
      getCategoryName,
    }: {
      arquivo: File
      senha?: string
      transacoes: Lancamento[]
      totalFatura: number
      cartaoNome: string
      periodo: string
      getCategoryName: (categoriaId: string | null) => string
    }) => {
      setError(null)
      setResultado(null)

      const transacoesSimples = transacoes.map((t: Lancamento) => ({
        data: t.data,
        descricao: t.observacao || getCategoryName(t.categoria_id),
        valor: Math.abs(t.valor),
        ...(t.parcela_atual && t.parcela_total
          ? { parcela: `${t.parcela_atual}/${t.parcela_total}` }
          : {}),
      }))

      // Encode Excel as base64
      setIsExtraindo(true)
      let base64: string
      try {
        base64 = await fileToBase64(arquivo)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao ler o arquivo.')
        return
      } finally {
        setIsExtraindo(false)
      }

      const body = {
        excel_base64: base64,
        excel_senha: senha || null,
        transacoes: transacoesSimples,
        total_app: totalFatura,
        cartao_nome: cartaoNome,
        periodo,
      }

      setIsAnalisando(true)
      try {
        const { data, error: fnError } = await supabase!.functions.invoke<{
          analise: ResultadoVerificacao
          error?: string
          code?: string
        }>('verificar-fatura', { body })

        if (fnError) {
          let errMsg = 'Erro ao conectar com o servidor. Tente novamente.'
          try {
            const response = (fnError as any).context as Response | undefined
            if (response) {
              const text = await response.text()
              try {
                const errBody = JSON.parse(text)
                if (errBody?.code === 'FEATURE_NOT_ENABLED') {
                  errMsg = 'Esta funcionalidade de IA não está disponível para sua conta.'
                } else if (errBody?.code === 'MONTHLY_LIMIT_REACHED') {
                  errMsg = errBody.error
                } else if (errBody?.code === 'EXCEL_PASSWORD_PROTECTED') {
                  errMsg = 'EXCEL_PASSWORD_PROTECTED'
                } else if (errBody?.error) {
                  errMsg = errBody.error
                }
              } catch {
                console.error('[verificar-fatura] resposta de erro não-JSON:', text.slice(0, 300))
              }
            } else {
              console.error('[verificar-fatura] fnError sem context:', fnError)
            }
          } catch (e) {
            console.error('[verificar-fatura] falha ao ler corpo do erro:', e)
          }
          setError(errMsg)
          return
        }

        if (!data) {
          setError('Resposta vazia do servidor. Tente novamente.')
          return
        }

        if (data.error) {
          if (data.code === 'FEATURE_NOT_ENABLED') {
            setError('Esta funcionalidade de IA não está disponível para sua conta.')
          } else if (data.code === 'MONTHLY_LIMIT_REACHED') {
            setError(data.error)
          } else if (data.code === 'EXCEL_PASSWORD_PROTECTED') {
            setError('EXCEL_PASSWORD_PROTECTED')
          } else {
            setError(data.error)
          }
          return
        }

        setResultado({ ...data.analise, fonte: 'excel' })
      } catch (err) {
        console.error('Erro ao verificar fatura:', err)
        setError('Erro inesperado ao analisar a fatura. Tente novamente.')
      } finally {
        setIsAnalisando(false)
      }
    },
    []
  )

  const limpar = useCallback(() => {
    setResultado(null)
    setError(null)
    setIsExtraindo(false)
    setIsAnalisando(false)
  }, [])

  return { isExtraindo, isAnalisando, resultado, error, verificar, limpar }
}
