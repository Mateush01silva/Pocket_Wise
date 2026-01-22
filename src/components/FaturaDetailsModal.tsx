import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Calendar, ShoppingBag } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useCategoriasStore } from '../store'
import type { Lancamento } from '../types'

interface FaturaDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  cartaoNome: string
  cartaoCor: string
  transacoes: Lancamento[]
  totalFatura: number
}

export function FaturaDetailsModal({
  isOpen,
  onClose,
  cartaoNome,
  cartaoCor,
  transacoes,
  totalFatura,
}: FaturaDetailsModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)

  if (!isOpen) return null

  const getCategoryName = (categoriaId: string | null) => {
    if (!categoriaId) return 'Sem categoria'
    const categoria = categorias.find((c) => c.id === categoriaId)
    return categoria?.nome || 'Categoria desconhecida'
  }

  // Agrupar por mês de vencimento
  const transacoesPorMes = transacoes.reduce((acc, t) => {
    const mes = t.data_vencimento_fatura
      ? format(new Date(t.data_vencimento_fatura), "MMMM 'de' yyyy", { locale: ptBR })
      : 'Sem vencimento'

    if (!acc[mes]) {
      acc[mes] = []
    }
    acc[mes].push(t)
    return acc
  }, {} as Record<string, Lancamento[]>)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cartaoCor }}
              />
              Fatura - {cartaoNome}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {transacoes.length} transação(ões) • Total: {formatCurrency(totalFatura)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-full transition-colors text-gray-400 hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {Object.entries(transacoesPorMes).map(([mes, transacoesDoMes]) => {
            const totalMes = transacoesDoMes.reduce((sum, t) => sum + t.valor, 0)

            return (
              <div key={mes} className="mb-6 last:mb-0">
                {/* Mês header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-dark-700">
                  <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                    <Calendar size={18} />
                    {mes}
                  </h3>
                  <span className="text-sm font-medium text-primary-400">
                    {formatCurrency(totalMes)}
                  </span>
                </div>

                {/* Transações */}
                <div className="space-y-2">
                  {transacoesDoMes
                    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
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
                              {format(new Date(transacao.data), "dd 'de' MMM", { locale: ptBR })}
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
        <div className="p-6 border-t border-dark-700 bg-dark-800/50">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Total da Fatura</span>
            <span className="text-2xl font-bold text-primary-400">
              {formatCurrency(totalFatura)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
