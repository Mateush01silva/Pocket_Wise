import { useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import * as XLSX from 'xlsx'
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
  fonte: 'pdf' | 'excel'
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

function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls')
}

/**
 * Converts an Excel file to a tab-separated text representation.
 * All rows are preserved so the AI can understand the full sheet structure
 * (header rows, totals, account info, etc.) regardless of where data starts.
 */
function excelParaTexto(arrayBuffer: ArrayBuffer, senha?: string): string {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      password: senha || undefined,
      cellDates: false, // keep dates as formatted strings
      raw: false,       // use formatted cell values
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.toLowerCase() : ''
    if (msg.includes('password') || msg.includes('encrypted') || msg.includes('cfb')) {
      throw new Error(senha
        ? 'Senha incorreta. Verifique a senha do arquivo e tente novamente.'
        : 'Este arquivo está protegido por senha. Informe a senha para continuar.')
    }
    throw new Error('Não foi possível abrir o arquivo Excel. Verifique se é um arquivo .xlsx ou .xls válido.')
  }

  // Use the sheet with the most rows (likely the transactions sheet)
  let sheetName = workbook.SheetNames[0]
  let maxRows = 0
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet['!ref']) continue
    const range = XLSX.utils.decode_range(sheet['!ref'])
    const rows = range.e.r - range.s.r
    if (rows > maxRows) { maxRows = rows; sheetName = name }
  }

  const sheet = workbook.Sheets[sheetName]
  // Convert to CSV preserving all rows — AI will identify the structure
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', blankrows: false })

  // Limit to ~24k chars so we stay within token budget
  return csv.length > 24000 ? csv.substring(0, 24000) + '\n[... planilha truncada ...]' : csv
}

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

      const excel = isExcelFile(arquivo)

      const transacoesSimples = transacoes.map((t: Lancamento) => ({
        data: t.data,
        descricao: t.observacao || getCategoryName(t.categoria_id),
        valor: t.valor,
        ...(t.parcela_atual && t.parcela_total
          ? { parcela: `${t.parcela_atual}/${t.parcela_total}` }
          : {}),
      }))

      // ------------------------------------------------------------------
      // Step 1: Extract text content from the file
      // ------------------------------------------------------------------
      setIsExtraindo(true)
      let textoExtraido: string
      try {
        if (excel) {
          const arrayBuffer = await arquivo.arrayBuffer()
          textoExtraido = excelParaTexto(arrayBuffer, senha)
        } else {
          textoExtraido = await extrairTextoPDF(arquivo)
          if (!textoExtraido.trim()) {
            setError('Não foi possível extrair texto do PDF. Verifique se o arquivo não é uma imagem escaneada.')
            return
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao ler o arquivo.')
        return
      } finally {
        setIsExtraindo(false)
      }

      // ------------------------------------------------------------------
      // Step 2: Send to edge function (AI extraction + value-based matching)
      // ------------------------------------------------------------------
      setIsAnalisando(true)
      try {
        const body = excel
          ? { excel_texto: textoExtraido, transacoes: transacoesSimples, total_app: totalFatura, cartao_nome: cartaoNome, periodo }
          : { pdf_texto: textoExtraido, transacoes: transacoesSimples, total_app: totalFatura, cartao_nome: cartaoNome, periodo }

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
          } else {
            setError(data.error)
          }
          return
        }

        setResultado({ ...data.analise, fonte: excel ? 'excel' : 'pdf' })
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
