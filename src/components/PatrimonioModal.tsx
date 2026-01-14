import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Info } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { CurrencyInput } from './ui/CurrencyInput'
import { usePatrimonioStore } from '../store/usePatrimonioStore'
import { formatCurrency } from '../utils/currency'

interface PatrimonioModalProps {
  isOpen: boolean
  onClose: () => void
  patrimonioAtual?: number
  saldoRealAtual?: number
}

export function PatrimonioModal({
  isOpen,
  onClose,
  patrimonioAtual = 0,
  saldoRealAtual = 0,
}: PatrimonioModalProps) {
  const [valorPatrimonio, setValorPatrimonio] = useState(patrimonioAtual)
  const [observacoes, setObservacoes] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const atualizarPatrimonio = usePatrimonioStore((state) => state.atualizarPatrimonio)

  // Atualizar valor quando props mudam
  useEffect(() => {
    if (isOpen) {
      setValorPatrimonio(patrimonioAtual || saldoRealAtual)
      setObservacoes('')
    }
  }, [isOpen, patrimonioAtual, saldoRealAtual])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await atualizarPatrimonio(valorPatrimonio, observacoes)
      onClose()
    } catch (error) {
      console.error('Erro ao atualizar patrimônio:', error)
      alert('Erro ao atualizar patrimônio. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUsarSaldoReal = () => {
    setValorPatrimonio(saldoRealAtual)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Atualizar Patrimônio Líquido">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info Box */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-blue-300 mb-1">O que é Patrimônio Líquido?</p>
              <p className="text-xs text-gray-400">
                É o valor total de tudo que você possui (dinheiro em conta, investimentos, imóveis,
                etc.) menos suas dívidas. O sistema vai atualizá-lo automaticamente conforme você
                registra receitas e despesas.
              </p>
            </div>
          </div>
        </div>

        {/* Valor Atual vs Novo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600">
            <p className="text-xs text-gray-400 mb-1">Patrimônio Atual</p>
            <p className="text-lg font-semibold text-gray-200">
              {formatCurrency(patrimonioAtual)}
            </p>
          </div>

          <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600">
            <p className="text-xs text-gray-400 mb-1">Saldo Real Hoje</p>
            <p className="text-lg font-semibold text-primary-400">
              {formatCurrency(saldoRealAtual)}
            </p>
          </div>
        </div>

        {/* Input de Valor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Novo Valor do Patrimônio <span className="text-red-500">*</span>
          </label>
          <CurrencyInput
            value={valorPatrimonio}
            onChange={setValorPatrimonio}
            placeholder="R$ 0,00"
            className="w-full"
          />
          <div className="mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUsarSaldoReal}
              className="text-xs"
            >
              Usar Saldo Real ({formatCurrency(saldoRealAtual)})
            </Button>
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Observações (opcional)
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Vendi o carro, Recebi herança, Atualizei os investimentos..."
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors resize-none"
            rows={3}
          />
        </div>

        {/* Diferença */}
        {valorPatrimonio !== patrimonioAtual && (
          <div className="p-4 bg-dark-700/30 border border-dark-600 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Diferença:</span>
              <div className="flex items-center gap-2">
                {valorPatrimonio > patrimonioAtual ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />
                )}
                <span
                  className={`text-lg font-semibold ${
                    valorPatrimonio > patrimonioAtual ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {valorPatrimonio > patrimonioAtual ? '+' : ''}
                  {formatCurrency(valorPatrimonio - patrimonioAtual)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={valorPatrimonio === patrimonioAtual}
            className="flex-1"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Atualizar Patrimônio
          </Button>
        </div>
      </form>
    </Modal>
  )
}
