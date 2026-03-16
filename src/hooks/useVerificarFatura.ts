import { useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '../lib/supabase'
import type { Lancamento } from '../types'

// Configurar worker do pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

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
// HOOK
// ============================================================================

export function useVerificarFatura(): UseVerificarFaturaReturn {
  const [isExtraindo, setIsExtraindo] = useState(false)
  const [isAnalisando, setIsAnalisando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoVerificacao | null>(null)
  const [error, setError] = useState<string | null>(null)

  const extrairTextoPDF = useCallback(async (arquivo: File): Promise<string> => {
    const arrayBuffer = await arquivo.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const textos: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const textosPagina = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      textos.push(textosPagina)
    }

    return textos.join('\n')
  }, [])

  const verificar = useCallback(
    async ({
      arquivo,
      transacoes,
      totalFatura,
      cartaoNome,
      periodo,
      getCategoryName,
    }: {
      arquivo: File
      transacoes: Lancamento[]
      totalFatura: number
      cartaoNome: string
      periodo: string
      getCategoryName: (categoriaId: string | null) => string
    }) => {
      setError(null)
      setResultado(null)

      // Etapa 1: Extrair texto do PDF
      setIsExtraindo(true)
      let pdfTexto: string
      try {
        pdfTexto = await extrairTextoPDF(arquivo)
        if (!pdfTexto.trim()) {
          setError('Não foi possível extrair texto do PDF. Verifique se o arquivo não é uma imagem escaneada.')
          setIsExtraindo(false)
          return
        }
      } catch (err) {
        console.error('Erro ao extrair texto do PDF:', err)
        setError('Erro ao ler o arquivo PDF. Verifique se é um PDF válido.')
        setIsExtraindo(false)
        return
      } finally {
        setIsExtraindo(false)
      }

      // Etapa 2: Preparar transações para envio
      const transacoesSimples = transacoes.map((t: Lancamento) => {
        const descricao = t.observacao || getCategoryName(t.categoria_id)
        const parcela =
          t.parcela_atual && t.parcela_total
            ? `${t.parcela_atual}/${t.parcela_total}`
            : undefined
        return {
          data: t.data,
          descricao,
          valor: t.valor,
          ...(parcela ? { parcela } : {}),
        }
      })

      // Etapa 3: Chamar Edge Function
      setIsAnalisando(true)
      try {
        const { data, error: fnError } = await supabase!.functions.invoke<{
          analise: ResultadoVerificacao
          error?: string
          code?: string
        }>('verificar-fatura', {
          body: {
            pdf_texto: pdfTexto,
            transacoes: transacoesSimples,
            total_app: totalFatura,
            cartao_nome: cartaoNome,
            periodo,
          },
        })

        if (fnError) {
          // Try to extract structured error from edge function response
          try {
            const errBody = await (fnError as any).context?.json?.()
            if (errBody?.code === 'FEATURE_NOT_ENABLED') {
              setError('Esta funcionalidade de IA não está disponível para sua conta.')
            } else if (errBody?.code === 'MONTHLY_LIMIT_REACHED') {
              setError(errBody.error)
            } else if (errBody?.error) {
              setError(errBody.error)
            } else {
              setError('Erro ao conectar com o servidor. Tente novamente.')
            }
          } catch {
            setError('Erro ao conectar com o servidor. Tente novamente.')
          }
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
          } else {
            setError(data.error)
          }
          return
        }

        setResultado(data.analise)
      } catch (err) {
        console.error('Erro ao verificar fatura:', err)
        setError('Erro inesperado ao analisar a fatura. Tente novamente.')
      } finally {
        setIsAnalisando(false)
      }
    },
    [extrairTextoPDF]
  )

  const limpar = useCallback(() => {
    setResultado(null)
    setError(null)
    setIsExtraindo(false)
    setIsAnalisando(false)
  }, [])

  return { isExtraindo, isAnalisando, resultado, error, verificar, limpar }
}
