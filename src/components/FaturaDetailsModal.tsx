import { useState } from 'react'
import { format, parseISO, addMonths, startOfMonth, setDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Calendar, ShoppingBag, FileSearch } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useCategoriasStore } from '../store'
import type { Lancamento } from '../types'
import { VerificarFaturaModal } from './VerificarFaturaModal'

interface FaturaDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  cartaoNome: string
  cartaoCor: string
  transacoes: Lancamento[]
  totalFatura: number
  diaFechamento: number
}

/**
 * Calcula o mês da fatura baseado na data da compra e dia de fechamento
 *
 * Exemplo com fechamento dia 13:
 * - Compra em 10/jan (dia 10 <= 13) → Fatura de janeiro
 * - Compra em 15/jan (dia 15 > 13) → Fatura de fevereiro
 */
function calcularMesFatura(dataCompra: string, diaFechamento: number): Date {
  const data = parseISO(dataCompra)
  const diaCompra = data.getDate()

  // Se comprou depois do fechamento, vai para o próximo mês
  if (diaCompra > diaFechamento) {
    return addMonths(startOfMonth(data), 1)
  }

  return startOfMonth(data)
}

/**
 * Retorna o período do ciclo de faturamento
 * Exemplo com fechamento dia 13 para fatura de Janeiro:
 * - Início: 14 de dezembro
 * - Fim: 13 de janeiro
 */
function getPeriodoCiclo(mesFatura: Date, diaFechamento: number): { inicio: Date; fim: Date } {
  const mesAnterior = addMonths(mesFatura, -1)
  const inicio = setDate(mesAnterior, diaFechamento + 1)
  const fim = setDate(mesFatura, diaFechamento)

  return { inicio, fim }
}

export function FaturaDetailsModal({
  isOpen,
  onClose,
  cartaoNome,
  cartaoCor,
  transacoes,
  totalFatura,
  diaFechamento,
}: FaturaDetailsModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  const [verificarOpen, setVerificarOpen] = useState(false)

  if (!isOpen) return null

  const getCategoryName = (categoriaId: string | null) => {
    if (!categoriaId) return 'Sem categoria'
    const categoria = categorias.find((c) => c.id === categoriaId)
    return categoria?.nome || 'Categoria desconhecida'
  }

  // Agrupar por ciclo de faturamento
  // Para parcelas com data_vencimento_fatura, usar esse campo para determinar o mês da fatura
  // Para transações normais, calcular baseado na data de compra e dia de fechamento
  const transacoesPorMes = transacoes.reduce((acc, t) => {
    const mesFatura = t.data_vencimento_fatura
      ? startOfMonth(parseISO(t.data_vencimento_fatura))
      : calcularMesFatura(t.data, diaFechamento)
    const { inicio, fim } = getPeriodoCiclo(mesFatura, diaFechamento)

    // Chave: "Janeiro 2026 (14/dez - 13/jan)"
    const mesLabel = format(mesFatura, "MMMM 'de' yyyy", { locale: ptBR })
    const periodoLabel = `${format(inicio, 'dd/MMM', { locale: ptBR })} - ${format(fim, 'dd/MMM', { locale: ptBR })}`
    const chave = `${mesLabel}|${periodoLabel}|${mesFatura.getTime()}`

    if (!acc[chave]) {
      acc[chave] = []
    }
    acc[chave].push(t)
    return acc
  }, {} as Record<string, Lancamento[]>)

  // Ordenar por mês (mais próximo primeiro - faturas mais urgentes no topo)
  const mesesOrdenados = Object.entries(transacoesPorMes).sort((a, b) => {
    const [, , timestampA] = a[0].split('|')
    const [, , timestampB] = b[0].split('|')
    return parseInt(timestampA) - parseInt(timestampB)
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-dark-800 shadow-xl sm:max-w-3xl w-full max-h-[100dvh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-dark-700">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-100 flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: cartaoCor }}
              />
              <span className="truncate">Fatura - {cartaoNome}</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {transacoes.length} transação(ões) • Total: {formatCurrency(totalFatura)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-full transition-colors text-gray-400 hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 min-h-0">
          {mesesOrdenados.map(([chave, transacoesDoMes]) => {
            const [mesLabel, periodoLabel] = chave.split('|')
            const totalMes = transacoesDoMes.reduce((sum, t) => sum + t.valor, 0)

            return (
              <div key={chave} className="mb-6 last:mb-0">
                {/* Mês header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-dark-700">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                      <Calendar size={18} />
                      Fatura de {mesLabel}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Compras de {periodoLabel}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-primary-400">
                    {formatCurrency(totalMes)}
                  </span>
                </div>

                {/* Transações */}
                <div className="space-y-2">
                  {transacoesDoMes
                    .sort((a, b) => parseISO(b.data).getTime() - parseISO(a.data).getTime())
                    .map((transacao) => (
                      <div
                        key={transacao.id}
                        className="flex items-center justify-between p-3 bg-dark-700/30 rounded-lg hover:bg-dark-700/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <ShoppingBag size={14} className="text-gray-500" />
                            <span className="text-sm font-medium text-gray-200">
                              {getCategoryName(transacao.categoria_id)}
                            </span>
                            {transacao.parcela_atual && transacao.parcela_total && (
                              <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded">
                                {transacao.parcela_atual}/{transacao.parcela_total}
                              </span>
                            )}
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                transacao.status === 'pago'
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-yellow-500/10 text-yellow-400'
                              }`}
                            >
                              {transacao.status === 'pago' ? 'Pago' : 'Pendente'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>
                              {format(parseISO(transacao.data), "dd 'de' MMM", { locale: ptBR })}
                            </span>
                            {transacao.observacao && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-xs">{transacao.observacao}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <span className="text-lg font-bold text-gray-100">
                            {formatCurrency(transacao.valor)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 border-t border-dark-700 bg-dark-800/50 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">Total da Fatura</span>
            <span className="text-2xl font-bold text-primary-400">
              {formatCurrency(totalFatura)}
            </span>
          </div>
          <button
            onClick={() => setVerificarOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-dark-600 text-sm text-gray-300 hover:text-gray-100 hover:bg-dark-700/50 hover:border-dark-500 transition-colors"
          >
            <FileSearch size={16} />
            Verificar com PDF da fatura
          </button>
        </div>
      </div>

      <VerificarFaturaModal
        isOpen={verificarOpen}
        onClose={() => setVerificarOpen(false)}
        cartaoNome={cartaoNome}
        cartaoCor={cartaoCor}
        transacoes={transacoes}
        totalFatura={totalFatura}
        periodo={
          mesesOrdenados.length > 0
            ? mesesOrdenados.map(([chave]) => chave.split('|')[0]).join(', ')
            : ''
        }
        getCategoryName={getCategoryName}
      />
    </div>
  )
}
