import { useState, useMemo } from 'react'
import { X, ArrowUpCircle, ArrowDownCircle, AlertTriangle, Calendar } from 'lucide-react'
import { Button } from './ui/Button'
import { CurrencyInput } from './ui/CurrencyInput'
import { Input } from './ui/Input'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { useTransacoesStore } from '../store'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import { toast } from 'sonner'
import { format, addMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CaixinhaComDetalhes, TransacaoCaixinhaTipo } from '../types'

interface MovimentarCaixinhaModalProps {
  isOpen: boolean
  onClose: () => void
  caixinha: CaixinhaComDetalhes
  tipo: 'deposito' | 'retirada'
  saldoDisponivelParaDeposito?: number // Saldo disponível para depósito (de meses anteriores)
}

export function MovimentarCaixinhaModal({
  isOpen,
  onClose,
  caixinha,
  tipo,
  saldoDisponivelParaDeposito = 0,
}: MovimentarCaixinhaModalProps) {
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [mesDestino, setMesDestino] = useState<string>(() => format(startOfMonth(new Date()), 'yyyy-MM'))
  const [isLoading, setIsLoading] = useState(false)

  const createTransacao = useCaixinhasStore((state) => state.createTransacao)
  const createLancamento = useTransacoesStore((state) => state.createLancamento)

  const isDeposito = tipo === 'deposito'
  const excedeSaldoDisponivel = isDeposito && valor > saldoDisponivelParaDeposito

  // Gerar opções de meses (mês atual + próximos 2 meses)
  const opcoesDesMeses = useMemo(() => {
    const hoje = new Date()
    const meses = []
    for (let i = 0; i < 3; i++) {
      const mesData = addMonths(startOfMonth(hoje), i)
      meses.push({
        value: format(mesData, 'yyyy-MM'),
        label: format(mesData, "MMMM 'de' yyyy", { locale: ptBR }),
      })
    }
    return meses
  }, [])

  const handleSubmit = async () => {
    if (valor <= 0) {
      toast.error('Informe um valor válido')
      return
    }

    if (!isDeposito && valor > caixinha.saldo_atual) {
      toast.error('Valor maior que o saldo disponível')
      return
    }

    // Validar depósito contra saldo disponível
    if (isDeposito && valor > saldoDisponivelParaDeposito) {
      toast.error(`Saldo disponível insuficiente. Você tem apenas ${formatCurrency(saldoDisponivelParaDeposito)} disponível para alocar em caixinhas.`)
      return
    }

    setIsLoading(true)

    try {
      // Criar transação na caixinha
      const result = await createTransacao({
        caixinha_id: caixinha.id,
        valor,
        tipo: tipo as TransacaoCaixinhaTipo,
        descricao: descricao || null,
      })

      if (!result) {
        toast.error('Erro ao realizar operação')
        return
      }

      // Se for retirada, criar uma receita no mês destino
      if (!isDeposito) {
        const mesDestinoLabel = opcoesDesMeses.find(m => m.value === mesDestino)?.label || mesDestino
        const dataReceita = `${mesDestino}-01` // Primeiro dia do mês selecionado

        try {
          await createLancamento({
            tipo: 'receita',
            valor,
            data: dataReceita,
            status: 'pago',
            descricao: descricao || `Retirada da caixinha "${caixinha.nome}"`,
            observacao: `Valor retirado da caixinha "${caixinha.nome}" para compor o orçamento de ${mesDestinoLabel}`,
          })

          toast.success(
            `${formatCurrency(valor)} retirado e adicionado como receita em ${mesDestinoLabel}!`
          )
        } catch (error) {
          console.error('Erro ao criar receita:', error)
          // A retirada da caixinha já aconteceu, apenas avisar sobre a receita
          toast.warning(
            `${formatCurrency(valor)} retirado da caixinha, mas não foi possível criar a receita. Adicione manualmente.`
          )
        }
      } else {
        toast.success(`${formatCurrency(valor)} depositado com sucesso!`)
      }

      handleClose()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao realizar operação')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setValor(0)
    setDescricao('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className={cn(
          'bg-dark-900 border border-dark-700 rounded-xl shadow-xl',
          'w-full max-w-md',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isDeposito ? 'bg-green-500/20' : 'bg-amber-500/20'
              )}
            >
              {isDeposito ? (
                <ArrowUpCircle className="w-5 h-5 text-green-400" />
              ) : (
                <ArrowDownCircle className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">
                {isDeposito ? 'Depositar' : 'Retirar'}
              </h2>
              <p className="text-xs text-gray-500">{caixinha.nome}</p>
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
        <div className="p-4 space-y-4">
          {/* Info da Caixinha */}
          <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg">
            <span className="text-2xl">{caixinha.icone}</span>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Saldo Atual</p>
              <p className="text-lg font-bold text-primary-400">
                {formatCurrency(caixinha.saldo_atual)}
              </p>
            </div>
            {caixinha.meta_valor && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Meta</p>
                <p className="text-sm text-gray-300">{formatCurrency(caixinha.meta_valor)}</p>
              </div>
            )}
          </div>

          {/* Saldo Disponível para Depósito */}
          {isDeposito && (
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex-1">
                <p className="text-sm text-gray-400">Saldo Disponível para Alocar</p>
                <p className="text-lg font-bold text-green-400">
                  {formatCurrency(saldoDisponivelParaDeposito)}
                </p>
              </div>
              <p className="text-xs text-gray-500 max-w-[150px] text-right">
                Sobra de meses anteriores
              </p>
            </div>
          )}

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Valor
            </label>
            <CurrencyInput
              value={valor}
              onChange={setValor}
              placeholder="R$ 0,00"
              className="w-full"
            />
            {!isDeposito && valor > caixinha.saldo_atual && (
              <p className="text-xs text-red-400 mt-1">
                Valor maior que o saldo disponível
              </p>
            )}
            {excedeSaldoDisponivel && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-400">
                  Valor excede o saldo disponível de {formatCurrency(saldoDisponivelParaDeposito)}
                </p>
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descrição (opcional)
            </label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={isDeposito ? 'Ex: Salário de janeiro' : 'Ex: Compra de viagem'}
            />
          </div>

          {/* Mês destino (apenas para retirada) */}
          {!isDeposito && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar size={14} className="inline mr-2" />
                Compor orçamento de qual mês?
              </label>
              <p className="text-xs text-gray-500 mb-2">
                O valor será adicionado como receita no mês selecionado
              </p>
              <select
                value={mesDestino}
                onChange={(e) => setMesDestino(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              >
                {opcoesDesMeses.map((mes) => (
                  <option key={mes.value} value={mes.value} className="capitalize">
                    {mes.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview do novo saldo */}
          {valor > 0 && (
            <div
              className={cn(
                'p-3 rounded-lg border',
                isDeposito
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              )}
            >
              <p className="text-sm text-gray-400 mb-1">Novo saldo após {isDeposito ? 'depósito' : 'retirada'}:</p>
              <p
                className={cn(
                  'text-xl font-bold',
                  isDeposito ? 'text-green-400' : 'text-amber-400'
                )}
              >
                {formatCurrency(
                  isDeposito
                    ? caixinha.saldo_atual + valor
                    : Math.max(0, caixinha.saldo_atual - valor)
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-dark-700">
          <Button variant="ghost" onClick={handleClose} disabled={isLoading} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={valor <= 0 || isLoading || (!isDeposito && valor > caixinha.saldo_atual) || excedeSaldoDisponivel}
            isLoading={isLoading}
            className={cn(
              'flex-1',
              isDeposito ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'
            )}
          >
            {isDeposito ? (
              <>
                <ArrowUpCircle size={18} className="mr-2" />
                Depositar
              </>
            ) : (
              <>
                <ArrowDownCircle size={18} className="mr-2" />
                Retirar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
