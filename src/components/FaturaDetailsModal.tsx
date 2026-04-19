import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, addMonths, startOfMonth, setDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Calendar, ShoppingBag, FileSearch, Lock } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useCategoriasStore } from '../store'
import type { Lancamento } from '../types'
import { VerificarFaturaModal } from './VerificarFaturaModal'
import { usePlan } from '../hooks/usePlan'

interface FaturaDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  cartaoNome: string
  cartaoCor: string
  transacoes: Lancamento[]
  totalFatura: number
  diaFechamento: number
  showVerificarButton?: boolean
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
  showVerificarButton = false,
}: FaturaDetailsModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  const [verificarOpen, setVerificarOpen] = useState(false)
  const { featureAccess } = usePlan()
  const navigate = useNavigate()
  const verificarAccess = featureAccess('verificar_fatura')

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
          {showVerificarButton && (
            verificarAccess === 'full' ? (
              /* Mestre: botão destacado com contexto de uso */
              <button
                onClick={() => setVerificarOpen(true)}
                className="w-full flex items-start gap-3 py-3 px-4 rounded-xl border transition-colors text-left"
                style={{ borderColor: '#7C3AED44', background: '#7C3AED0A' }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#7C3AED14'
                  e.currentTarget.style.borderColor = '#7C3AED66'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#7C3AED0A'
                  e.currentTarget.style.borderColor = '#7C3AED44'
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #7C3AED22, #7C3AED44)', border: '1px solid #7C3AED55' }}
                >
                  <FileSearch size={16} className="text-secondary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-200">Verificar Fatura</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: '#7C3AED22', color: '#a78bfa', border: '1px solid #7C3AED44' }}
                    >
                      IA
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-snug">
                    Encontrou diferença no total? Envie o Excel do banco e encontre os lançamentos divergentes
                  </p>
                </div>
              </button>
            ) : (
              /* Explorador / Planejador: CTA de upgrade */
              <div className="rounded-xl border border-dark-600 overflow-hidden">
                <div className="flex items-start gap-3 p-3 bg-dark-700/20">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: '#7C3AED11', border: '1px solid #7C3AED33' }}
                  >
                    <Lock size={15} className="text-secondary-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-400">Verificar Fatura com IA</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: '#7C3AED22', color: '#a78bfa', border: '1px solid #7C3AED44' }}
                      >
                        Mestre
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-snug">
                      Envie o Excel da fatura, compare valor a valor e descubra o que está faltando ou errado no app
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/app/assinatura')}
                  className="w-full py-2.5 text-xs font-medium border-t border-dark-600 transition-colors"
                  style={{ color: '#a78bfa', background: '#7C3AED08' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#7C3AED18')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#7C3AED08')}
                >
                  Assinar Mestre para desbloquear →
                </button>
              </div>
            )
          )}
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
