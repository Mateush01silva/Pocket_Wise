import { useState } from 'react'
import { X, ArrowLeftRight, AlertTriangle } from 'lucide-react'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { Button } from './ui/Button'
import { CurrencyInput } from './ui/CurrencyInput'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import { toast } from 'sonner'
import type { ContaBancaria } from '../types'

interface TransferirContasModalProps {
  isOpen: boolean
  onClose: () => void
  contaOrigem: ContaBancaria
}

export function TransferirContasModal({ isOpen, onClose, contaOrigem }: TransferirContasModalProps) {
  const [contaDestinoId, setContaDestinoId] = useState('')
  const [valor, setValor] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const contas = useContasBancariasStore((state) => state.contas)
  const transferirEntreContas = useContasBancariasStore((state) => state.transferirEntreContas)
  const updateCaixinha = useCaixinhasStore((state) => state.updateCaixinha)
  const caixinhas = useCaixinhasStore((state) => state.caixinhas)

  const contasDestino = contas.filter((c) => c.ativo && c.id !== contaOrigem.id)
  const contaDestino = contasDestino.find((c) => c.id === contaDestinoId)

  const excedeSaldo = valor > contaOrigem.saldo_atual
  const podeConfirmar = valor > 0 && !!contaDestinoId && !excedeSaldo && !isLoading

  const handleClose = () => {
    setContaDestinoId('')
    setValor(0)
    onClose()
  }

  const handleSubmit = async () => {
    if (!podeConfirmar) return

    setIsLoading(true)
    try {
      await transferirEntreContas(contaOrigem.id, contaDestinoId, valor)

      // Se a conta de origem é de investimento, reduzir valor_mercado das caixinhas vinculadas
      if (contaOrigem.tipo === 'investimento') {
        const caixinhasVinculadas = caixinhas.filter(
          (c) => c.conta_investimento_id === contaOrigem.id && c.tipo === 'investimento' && c.ativa
        )
        if (caixinhasVinculadas.length > 0) {
          const totalMercado = caixinhasVinculadas.reduce(
            (sum, c) => sum + (c.valor_mercado ?? c.saldo_atual), 0
          )
          for (const caixinha of caixinhasVinculadas) {
            const mercadoCaixinha = caixinha.valor_mercado ?? caixinha.saldo_atual
            const proporcao = totalMercado > 0 ? mercadoCaixinha / totalMercado : 1 / caixinhasVinculadas.length
            const reducao = valor * proporcao
            const novoValorMercado = Math.max(0, mercadoCaixinha - reducao)
            await updateCaixinha({
              id: caixinha.id,
              valor_mercado: novoValorMercado,
              data_valor_mercado: new Date().toISOString(),
            })
          }
        }
      }

      // Se a conta de destino é de investimento, aumentar valor_mercado das caixinhas vinculadas
      if (contaDestino?.tipo === 'investimento') {
        const caixinhasVinculadas = caixinhas.filter(
          (c) => c.conta_investimento_id === contaDestinoId && c.tipo === 'investimento' && c.ativa
        )
        if (caixinhasVinculadas.length > 0) {
          const totalMercado = caixinhasVinculadas.reduce(
            (sum, c) => sum + (c.valor_mercado ?? c.saldo_atual), 0
          )
          for (const caixinha of caixinhasVinculadas) {
            const mercadoCaixinha = caixinha.valor_mercado ?? caixinha.saldo_atual
            const proporcao = totalMercado > 0 ? mercadoCaixinha / totalMercado : 1 / caixinhasVinculadas.length
            const aumento = valor * proporcao
            const novoValorMercado = mercadoCaixinha + aumento
            await updateCaixinha({
              id: caixinha.id,
              valor_mercado: novoValorMercado,
              data_valor_mercado: new Date().toISOString(),
            })
          }
        }
      }

      toast.success(`${formatCurrency(valor)} transferido com sucesso!`)
      handleClose()
    } catch (error) {
      console.error('Erro ao transferir:', error)
      toast.error('Erro ao realizar transferência')
    } finally {
      setIsLoading(false)
    }
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
          'w-full max-w-md flex flex-col max-h-[90vh]',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
              <ArrowLeftRight className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Transferir</h2>
              <p className="text-xs text-gray-500">De: {contaOrigem.nome}</p>
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
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Conta origem */}
          <div className="p-3 bg-dark-800 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Conta de origem</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{contaOrigem.icone || '🏦'}</span>
                <span className="text-sm font-medium text-gray-200">{contaOrigem.nome}</span>
              </div>
              <span className="text-sm font-bold text-gray-100">{formatCurrency(contaOrigem.saldo_atual)}</span>
            </div>
          </div>

          {/* Conta destino */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Conta de destino
            </label>
            <select
              value={contaDestinoId}
              onChange={(e) => setContaDestinoId(e.target.value)}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            >
              <option value="">Selecione uma conta...</option>
              {contasDestino.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.icone || '🏦'} {conta.nome}{conta.instituicao ? ` — ${conta.instituicao}` : ''} ({formatCurrency(conta.saldo_atual)})
                </option>
              ))}
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Valor</label>
            <CurrencyInput
              value={valor}
              onChange={setValor}
              placeholder="R$ 0,00"
              className="w-full"
            />
            {excedeSaldo && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-400">
                  Valor excede o saldo disponível de {formatCurrency(contaOrigem.saldo_atual)}
                </p>
              </div>
            )}
          </div>

          {/* Preview */}
          {valor > 0 && contaDestino && !excedeSaldo && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-2">
              <p className="text-xs text-gray-400 font-medium">Após a transferência</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{contaOrigem.nome}</span>
                <span className="text-red-400 font-medium">{formatCurrency(contaOrigem.saldo_atual - valor)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{contaDestino.nome}</span>
                <span className="text-green-400 font-medium">{formatCurrency(contaDestino.saldo_atual + valor)}</span>
              </div>
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
            disabled={!podeConfirmar}
            isLoading={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeftRight size={18} className="mr-2" />
            Transferir
          </Button>
        </div>
      </div>
    </div>
  )
}
