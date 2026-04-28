import { useState } from 'react'
import { X, RefreshCw, AlertCircle } from 'lucide-react'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { Button, Input } from './ui'
import { formatCurrency } from '../utils/currency'
import type { ContaBancaria } from '../types'

interface AdjustBalanceModalProps {
  isOpen: boolean
  onClose: () => void
  conta: ContaBancaria
}

export function AdjustBalanceModal({ isOpen, onClose, conta }: AdjustBalanceModalProps) {
  const [novoSaldo, setNovoSaldo] = useState(conta.saldo_atual.toString())
  const [isLoading, setIsLoading] = useState(false)
  const updateConta = useContasBancariasStore((state) => state.updateConta)
  const caixinhas = useCaixinhasStore((state) => state.caixinhas)
  const updateCaixinha = useCaixinhasStore((state) => state.updateCaixinha)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const valorNumerico = parseFloat(novoSaldo.replace(',', '.'))

      if (isNaN(valorNumerico)) {
        alert('Digite um valor válido')
        return
      }

      await updateConta(conta.id, { saldo_atual: valorNumerico })

      // Se é conta de investimento, distribuir o delta proporcionalmente nas caixinhas vinculadas
      const delta = valorNumerico - conta.saldo_atual
      if (conta.tipo === 'investimento' && delta !== 0) {
        const caixinhasVinculadas = caixinhas.filter(
          (c) => c.conta_investimento_id === conta.id && c.tipo === 'investimento' && c.ativa
        )
        if (caixinhasVinculadas.length > 0) {
          const totalMercado = caixinhasVinculadas.reduce(
            (sum, c) => sum + (c.valor_mercado ?? c.saldo_atual), 0
          )
          for (const caixinha of caixinhasVinculadas) {
            const mercadoCaixinha = caixinha.valor_mercado ?? caixinha.saldo_atual
            const proporcao = totalMercado > 0 ? mercadoCaixinha / totalMercado : 1 / caixinhasVinculadas.length
            const novoValorMercado = Math.max(0, mercadoCaixinha + delta * proporcao)
            await updateCaixinha({
              id: caixinha.id,
              valor_mercado: novoValorMercado,
              data_valor_mercado: new Date().toISOString(),
            })
          }
        }
      }

      alert('Saldo atualizado com sucesso!')
      onClose()
    } catch (error) {
      console.error('Erro ao atualizar saldo:', error)
      alert('Erro ao atualizar saldo. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const diferenca = parseFloat(novoSaldo.replace(',', '.') || '0') - conta.saldo_atual

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md shadow-xl border border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: `${conta.cor}20` }}
            >
              {conta.icone || '💳'}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Ajustar Saldo</h2>
              <p className="text-sm text-gray-400">{conta.nome}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-300">
              Use esta opção para corrigir inconsistências no saldo quando os lançamentos não refletem o valor real da conta.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Saldo Atual */}
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Saldo Atual no Sistema</p>
            <p className="text-xl font-bold text-gray-200">
              {formatCurrency(conta.saldo_atual)}
            </p>
          </div>

          {/* Novo Saldo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Novo Saldo Real
            </label>
            <Input
              type="number"
              step="0.01"
              value={novoSaldo}
              onChange={(e) => setNovoSaldo(e.target.value)}
              placeholder="Digite o saldo real da conta"
              className="text-lg"
              autoFocus
            />
          </div>

          {/* Diferença */}
          {diferenca !== 0 && !isNaN(diferenca) && (
            <div className={`p-3 rounded-lg ${diferenca > 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <p className="text-xs text-gray-400 mb-1">Diferença</p>
              <p className={`text-lg font-bold ${diferenca > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {diferenca > 0 ? '+' : ''}{formatCurrency(diferenca)}
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Atualizar Saldo
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
