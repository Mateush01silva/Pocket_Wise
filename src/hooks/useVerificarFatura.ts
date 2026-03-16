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

interface TransacaoSimples {
  data: string
  descricao: string
  valor: number
  parcela?: string
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
// HELPERS: Excel parsing
// ============================================================================

function parseValorExcel(cell: unknown): number | null {
  if (cell === undefined || cell === null || cell === '') return null
  if (typeof cell === 'number') return Math.abs(cell)
  const str = cell.toString().replace(/[R$\s%]/g, '').trim()
  if (!str) return null
  // Brazilian format: "1.234,56"
  if (/^-?[\d.]+,\d{1,2}$/.test(str)) {
    return Math.abs(parseFloat(str.replace(/\./g, '').replace(',', '.')))
  }
  // International format: "1234.56" or "1,234.56"
  if (/^-?[\d,]+\.?\d*$/.test(str)) {
    return Math.abs(parseFloat(str.replace(/,/g, '')))
  }
  return null
}

function formatarDataExcel(cell: unknown): string {
  if (!cell) return ''
  if (cell instanceof Date) {
    const d = cell
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }
  return cell.toString().trim()
}

function detectarColunas(headers: string[]): {
  dataIdx: number
  descricaoIdx: number
  valorIdx: number
} | null {
  const h = headers.map((s) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() ?? '')

  const find = (patterns: string[]) =>
    h.findIndex((col) => patterns.some((p) => col.includes(p)))

  const dataIdx = find(['data', 'dt.', 'date', 'vencimento', 'competencia'])
  const descricaoIdx = find(['lancamento', 'descricao', 'estabelecimento', 'historico', 'merchant', 'descr', 'nome', 'transacao'])
  const valorIdx = find(['valor', 'montante', 'amount', 'r$', 'debito', 'credito'])

  if (dataIdx === -1 || descricaoIdx === -1 || valorIdx === -1) return null
  return { dataIdx, descricaoIdx, valorIdx }
}

function parseExcel(arrayBuffer: ArrayBuffer, senha?: string): {
  transacoes: TransacaoSimples[]
  total_pdf: number | null
} {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      password: senha || undefined,
      cellDates: true,
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

  // Use the sheet with most rows
  let sheetName = workbook.SheetNames[0]
  let maxRows = 0
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
    const rows = range.e.r - range.s.r
    if (rows > maxRows) { maxRows = rows; sheetName = name }
  }

  const sheet = workbook.Sheets[sheetName]
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: undefined, raw: false })

  // Find header row (search first 25 rows)
  let headerRowIdx = -1
  let colunas: { dataIdx: number; descricaoIdx: number; valorIdx: number } | null = null
  for (let i = 0; i < Math.min(allRows.length, 25); i++) {
    const row = (allRows[i] as unknown[]).map((c) => c?.toString() ?? '')
    const detected = detectarColunas(row)
    if (detected) {
      headerRowIdx = i
      colunas = detected
      break
    }
  }

  if (!colunas || headerRowIdx === -1) {
    throw new Error(
      'Não foi possível identificar as colunas de data, descrição e valor no arquivo. ' +
      'Certifique-se de que é uma fatura de cartão exportada pelo banco.'
    )
  }

  const dataRows = allRows.slice(headerRowIdx + 1) as unknown[][]
  const transacoes: TransacaoSimples[] = []
  let total_pdf: number | null = null

  for (const row of dataRows) {
    const dataCell = row[colunas.dataIdx]
    const descCell = row[colunas.descricaoIdx]
    const valorCell = row[colunas.valorIdx]

    if (!descCell && !valorCell) continue

    const descStr = descCell?.toString().toLowerCase().trim() ?? ''

    // Detect total row
    if (/^total\b/.test(descStr) || descStr === 'total da fatura' || descStr === 'total') {
      const t = parseValorExcel(valorCell)
      if (t !== null && t > 0) total_pdf = t
      continue
    }

    const valor = parseValorExcel(valorCell)
    if (valor === null || valor <= 0) continue // skip zeros, negatives (payments)

    transacoes.push({
      data: formatarDataExcel(dataCell),
      descricao: descCell?.toString().trim() ?? '',
      valor,
    })
  }

  return { transacoes, total_pdf }
}

// ============================================================================
// HELPERS: Value-based matching (mirrors edge function logic)
// ============================================================================

function matchTransacoes(
  appItems: TransacaoSimples[],
  extItems: TransacaoSimples[],
): {
  no_ext_nao_no_app: ItemFatura[]
  no_app_nao_no_ext: ItemFatura[]
} {
  const appPool = appItems.map((item) => ({ item, matched: false }))
  const extPool = extItems.map((item) => ({ item, matched: false }))

  for (const extEntry of extPool) {
    const idx = appPool.findIndex(
      (a) => !a.matched && Math.abs(a.item.valor - extEntry.item.valor) < 0.10,
    )
    if (idx !== -1) {
      appPool[idx].matched = true
      extEntry.matched = true
    }
  }

  return {
    no_ext_nao_no_app: extPool.filter((e) => !e.matched).map((e) => ({
      data: e.item.data,
      descricao: e.item.descricao,
      valor: e.item.valor,
    })),
    no_app_nao_no_ext: appPool.filter((e) => !e.matched).map((e) => ({
      data: e.item.data,
      descricao: e.item.descricao,
      valor: e.item.valor,
    })),
  }
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function gerarResumo(params: {
  noPdfNaoNoApp: ItemFatura[]
  noAppNaoNoPdf: ItemFatura[]
  totalPdf: number | null
  totalApp: number
  diferencaTotal: number | null
}): string {
  const { noPdfNaoNoApp, noAppNaoNoPdf, totalPdf, totalApp, diferencaTotal } = params
  const partes: string[] = []

  if (diferencaTotal !== null) {
    if (Math.abs(diferencaTotal) < 0.10) {
      partes.push(`Os totais conferem: ambos somam ${formatBRL(totalApp)}.`)
    } else if (diferencaTotal > 0) {
      partes.push(`O total da fatura (${formatBRL(totalPdf!)}) é ${formatBRL(diferencaTotal)} maior que o registrado no app (${formatBRL(totalApp)}).`)
    } else {
      partes.push(`O total da fatura (${formatBRL(totalPdf!)}) é ${formatBRL(Math.abs(diferencaTotal))} menor que o registrado no app (${formatBRL(totalApp)}).`)
    }
  }

  if (noPdfNaoNoApp.length === 0 && noAppNaoNoPdf.length === 0) {
    partes.push('Todos os lançamentos conferem perfeitamente.')
  } else {
    if (noPdfNaoNoApp.length > 0) {
      partes.push(`${noPdfNaoNoApp.length} lançamento(s) da fatura não ${noPdfNaoNoApp.length === 1 ? 'está registrado' : 'estão registrados'} no app.`)
    }
    if (noAppNaoNoPdf.length > 0) {
      partes.push(`${noAppNaoNoPdf.length} lançamento(s) do app não ${noAppNaoNoPdf.length === 1 ? 'foi encontrado' : 'foram encontrados'} na fatura.`)
    }
  }

  return partes.join(' ')
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

      const isExcel = arquivo.name.toLowerCase().endsWith('.xlsx') || arquivo.name.toLowerCase().endsWith('.xls')

      const transacoesSimples: TransacaoSimples[] = transacoes.map((t: Lancamento) => ({
        data: t.data,
        descricao: t.observacao || getCategoryName(t.categoria_id),
        valor: t.valor,
        ...(t.parcela_atual && t.parcela_total
          ? { parcela: `${t.parcela_atual}/${t.parcela_total}` }
          : {}),
      }))

      // ------------------------------------------------------------------
      // EXCEL: parse + match entirely client-side, no AI call, no credit
      // ------------------------------------------------------------------
      if (isExcel) {
        setIsExtraindo(true)
        try {
          const arrayBuffer = await arquivo.arrayBuffer()
          const { transacoes: pdfTransacoes, total_pdf } = parseExcel(arrayBuffer, senha)

          if (pdfTransacoes.length === 0) {
            setError('Nenhuma transação encontrada no arquivo. Verifique se o Excel é uma fatura de cartão de crédito.')
            return
          }

          const { no_ext_nao_no_app, no_app_nao_no_ext } = matchTransacoes(transacoesSimples, pdfTransacoes)

          // Use total from file, or sum of extracted transactions if not found
          const totalEfetivo = total_pdf ?? pdfTransacoes.reduce((s, t) => s + t.valor, 0)
          const diferencaTotal = totalEfetivo - totalFatura

          const resumo = gerarResumo({
            noPdfNaoNoApp: no_ext_nao_no_app,
            noAppNaoNoPdf: no_app_nao_no_ext,
            totalPdf: total_pdf,
            totalApp: totalFatura,
            diferencaTotal: total_pdf !== null ? diferencaTotal : null,
          })

          setResultado({
            total_pdf: total_pdf,
            diferenca_total: total_pdf !== null ? diferencaTotal : null,
            no_pdf_nao_no_app: no_ext_nao_no_app,
            no_app_nao_no_pdf: no_app_nao_no_ext,
            valores_divergentes: [],
            resumo,
            fonte: 'excel',
          })
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Erro ao processar o arquivo Excel.')
        } finally {
          setIsExtraindo(false)
        }
        return
      }

      // ------------------------------------------------------------------
      // PDF: extract text client-side, then AI call for structured extraction
      // ------------------------------------------------------------------
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
              console.error('[verificar-fatura] fnError sem context (relay/network error):', fnError)
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

        setResultado({ ...data.analise, fonte: 'pdf' })
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
