import { useState, useMemo } from 'react'
import { X, CreditCard, Landmark, AlertTriangle, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from './ui/Button'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import { useTransacoesStore } from '../store/useTransacoesStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import type { Lancamento } from '../types'

interface FaturaInfo {
  mesFatura: Date
  total: number
  transacoes: Lancamento[]
  vencida: boolean
  dataVencimento: Date
}

interface PagarFaturaModalProps {
  isOpen: boolean
  onClose: () => void
  cartaoNome: string
  fatura: FaturaInfo
  onSuccess?: () => void
}

export function PagarFaturaModal({
  isOpen,
  onClose,
  cartaoNome,
  fatura,
  onSuccess
}: PagarFaturaModalProps) {
  const [contaSelecionada, setContaSelecionada] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contas = useContasBancariasStore((state) => state.contas)
  const updateLancamento = useTransacoesStore((state) => state.updateLancamento)

  // Filtrar apenas contas ativas
  const contasAtivas = useMemo(
    () => contas.filter((c) => c.ativo),
    [contas]
  )

  // Verificar se conta selecionada tem saldo suficiente
  const contaInfo = useMemo(() => {
    if (!contaSelecionada) return null
    return contasAtivas.find((c) => c.id === contaSelecionada)
  }, [contaSelecionada, contasAtivas])

  const saldoInsuficiente = contaInfo ? contaInfo.saldo_atual < fatura.total : false

  const handlePagar = async () => {
    if (!contaSelecionada) {
      setErro('Selecione uma conta bancária para débito')
      return
    }

    setIsLoading(true)
    setErro(null)

    try {
      // Atualizar todas as transações da fatura com a conta e status pago
      for (const transacao of fatura.transacoes) {
        await updateLancamento(transacao.id, {
          conta_id: contaSelecionada,
          status: 'pago'
        })
      }

      // Sucesso
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Erro ao pagar fatura:', error)
      setErro('Erro ao processar pagamento. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setContaSelecionada('')
      setErro(null)
      onClose()
    }
  }

  if (!isOpen) return null

  const mesFormatado = format(fatura.mesFatura, "MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className={cn(
          'bg-dark-900 border border-dark-700 rounded-xl shadow-xl',
          'w-full max-w-lg max-h-[90vh] flex flex-col',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              fatura.vencida ? 'bg-red-500/20' : 'bg-green-500/20'
            )}>
              <CreditCard className={cn(
                'w-5 h-5',
                fatura.vencida ? 'text-red-400' : 'text-green-400'
              )} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Pagar Fatura</h2>
              <p className="text-xs text-gray-500">{cartaoNome}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-dark-800 transition-colors text-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Resumo da Fatura */}
          <div className={cn(
            'p-4 rounded-lg border',
            fatura.vencida
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-dark-800 border-dark-700'
          )}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm text-gray-400">Fatura de</p>
                <p className="text-lg font-semibold text-gray-100 capitalize">{mesFormatado}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Valor Total</p>
                <p className={cn(
                  'text-2xl font-bold',
                  fatura.vencida ? 'text-red-400' : 'text-gray-100'
                )}>
                  {formatCurrency(fatura.total)}
                </p>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{fatura.transacoes.length} lançamento(s)</span>
              {fatura.vencida && (
                <span className="text-red-400 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  Vencida
                </span>
              )}
            </div>
          </div>

          {/* Seleção de Conta */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Debitar de qual conta?
            </label>

            {contasAtivas.length === 0 ? (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
                <p className="text-sm text-yellow-400">Nenhuma conta bancária cadastrada</p>
                <p className="text-xs text-gray-500 mt-1">Cadastre uma conta primeiro</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contasAtivas.map((conta) => {
                  const isSelected = contaSelecionada === conta.id
                  const temSaldo = conta.saldo_atual >= fatura.total

                  return (
                    <button
                      key={conta.id}
                      onClick={() => setContaSelecionada(conta.id)}
                      disabled={isLoading}
                      className={cn(
                        'w-full p-3 rounded-lg border transition-all text-left',
                        'flex items-center gap-3',
                        isSelected
                          ? 'bg-primary-500/10 border-primary-500/50'
                          : 'bg-dark-800 border-dark-700 hover:border-dark-600',
                        !temSaldo && 'opacity-60'
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        isSelected ? 'bg-primary-500/20' : 'bg-dark-700'
                      )}>
                        <Landmark className={cn(
                          'w-5 h-5',
                          isSelected ? 'text-primary-400' : 'text-gray-400'
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-medium truncate',
                          isSelected ? 'text-primary-400' : 'text-gray-200'
                        )}>
                          {conta.nome}
                        </p>
                        <p className="text-xs text-gray-500">{conta.instituicao || conta.tipo}</p>
                      </div>

                      <div className="text-right">
                        <p className={cn(
                          'text-sm font-semibold',
                          conta.saldo_atual >= 0 ? 'text-green-400' : 'text-red-400'
                        )}>
                          {formatCurrency(conta.saldo_atual)}
                        </p>
                        {!temSaldo && (
                          <p className="text-xs text-yellow-400">Saldo insuficiente</p>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="w-5 h-5 text-primary-400 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Aviso de saldo insuficiente */}
          {saldoInsuficiente && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-400 font-medium">Atenção: Saldo insuficiente</p>
                <p className="text-xs text-gray-400 mt-1">
                  O saldo da conta ficará negativo após o pagamento. Você pode continuar, mas recomendamos verificar.
                </p>
              </div>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-dark-700 shrink-0">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handlePagar}
            disabled={!contaSelecionada || isLoading || contasAtivas.length === 0}
            isLoading={isLoading}
            className={cn(
              'flex-1',
              fatura.vencida
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            )}
          >
            <CreditCard size={18} className="mr-2" />
            Confirmar Pagamento
          </Button>
        </div>
      </div>
    </div>
  )
}
