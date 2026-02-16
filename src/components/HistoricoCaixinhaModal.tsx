import { useState, useEffect } from 'react'
import { X, Undo2, ArrowUpCircle, ArrowDownCircle, Calendar, Loader2 } from 'lucide-react'
import { Button } from './ui/Button'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { formatCurrency } from '../utils/currency'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../lib/cn'
import { toast } from 'sonner'
import type { CaixinhaComDetalhes, TransacaoCaixinha } from '../types'

interface HistoricoCaixinhaModalProps {
  isOpen: boolean
  onClose: () => void
  caixinha: CaixinhaComDetalhes
}

export function HistoricoCaixinhaModal({
  isOpen,
  onClose,
  caixinha,
}: HistoricoCaixinhaModalProps) {
  const [undoingId, setUndoingId] = useState<string | null>(null)

  const fetchTransacoes = useCaixinhasStore((state) => state.fetchTransacoes)
  const deleteTransacao = useCaixinhasStore((state) => state.deleteTransacao)
  const isLoadingTransacoes = useCaixinhasStore((state) => state.isLoadingTransacoes)
  const transacoes = useCaixinhasStore((state) => state.transacoes[caixinha.id] || [])

  useEffect(() => {
    if (isOpen) {
      fetchTransacoes(caixinha.id)
    }
  }, [isOpen, caixinha.id, fetchTransacoes])

  const handleUndo = async (transacao: TransacaoCaixinha) => {
    const tipoLabel = transacao.tipo === 'deposito' ? 'depósito' : 'retirada'
    const confirmMsg = transacao.tipo === 'deposito'
      ? `Desfazer este depósito de ${formatCurrency(transacao.valor)}? O valor será removido da caixinha e voltará como saldo disponível do mês de origem.`
      : `Desfazer esta retirada de ${formatCurrency(transacao.valor)}? O valor voltará para a caixinha.`

    if (!confirm(confirmMsg)) return

    setUndoingId(transacao.id)
    try {
      const success = await deleteTransacao(transacao.id, caixinha.id)
      if (success) {
        toast.success(`${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} de ${formatCurrency(transacao.valor)} desfeito com sucesso!`)
      } else {
        const errorMsg = useCaixinhasStore.getState().error
        toast.error(errorMsg || `Erro ao desfazer ${tipoLabel}`)
      }
    } catch (error) {
      console.error('Erro ao desfazer transação:', error)
      toast.error(`Erro ao desfazer ${tipoLabel}`)
    } finally {
      setUndoingId(null)
    }
  }

  const formatMesReferencia = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      const date = parseISO(dateStr)
      return format(date, "MMM 'de' yyyy", { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-dark-900 border border-dark-700 shadow-xl',
          'w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[85vh] flex flex-col',
          'rounded-t-2xl sm:rounded-xl',
          'animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{caixinha.icone}</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">{caixinha.nome}</h2>
              <p className="text-xs text-gray-500">
                Saldo: {formatCurrency(caixinha.saldo_atual)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-800 transition-colors text-gray-400 hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingTransacoes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary-400" size={24} />
              <span className="ml-2 text-gray-400">Carregando...</span>
            </div>
          ) : transacoes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhuma movimentação registrada
            </div>
          ) : (
            <div className="space-y-2">
              {transacoes.map((transacao) => {
                const isDeposito = transacao.tipo === 'deposito'
                const isUndoing = undoingId === transacao.id
                const mesOrigem = formatMesReferencia(transacao.origem_mes_referencia)
                const mesDestino = formatMesReferencia(transacao.destino_mes_referencia)

                return (
                  <div
                    key={transacao.id}
                    className={cn(
                      'rounded-lg p-3 border transition-all',
                      isDeposito
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-amber-500/5 border-amber-500/20'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                        isDeposito ? 'bg-green-500/20' : 'bg-amber-500/20'
                      )}>
                        {isDeposito ? (
                          <ArrowUpCircle size={16} className="text-green-400" />
                        ) : (
                          <ArrowDownCircle size={16} className="text-amber-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            'text-sm font-medium',
                            isDeposito ? 'text-green-400' : 'text-amber-400'
                          )}>
                            {isDeposito ? '+' : '-'}{formatCurrency(transacao.valor)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(parseISO(transacao.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>

                        {transacao.descricao && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {transacao.descricao}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {mesOrigem && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar size={10} />
                              Origem: {mesOrigem}
                            </span>
                          )}
                          {mesDestino && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar size={10} />
                              Destino: {mesDestino}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Undo button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUndo(transacao)}
                        disabled={isUndoing || undoingId !== null}
                        className="shrink-0 p-1.5 h-8 w-8 opacity-60 hover:opacity-100"
                        title="Desfazer movimentação"
                      >
                        {isUndoing ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Undo2 size={14} className="text-red-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 shrink-0">
          <Button variant="ghost" onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
