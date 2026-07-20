import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button, CurrencyInput } from './ui'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import { formatCurrency } from '../utils/currency'
import { toast } from 'sonner'
import type { CaixinhaComDetalhes } from '../types'

interface AjustarSaldoCaixinhaModalProps {
  isOpen: boolean
  onClose: () => void
  caixinha: CaixinhaComDetalhes
}

export function AjustarSaldoCaixinhaModal({ isOpen, onClose, caixinha }: AjustarSaldoCaixinhaModalProps) {
  const atualizarValorMercado = useCaixinhasStore((state) => state.atualizarValorMercado)
  const updateCaixinha = useCaixinhasStore((state) => state.updateCaixinha)
  const getContaById = useContasBancariasStore((state) => state.getContaById)

  const contaVinculada = caixinha.conta_investimento_id
    ? getContaById(caixinha.conta_investimento_id)
    : null

  const valorMercadoAtual = caixinha.valor_mercado ?? caixinha.saldo_atual
  const [novoTotal, setNovoTotal] = useState(valorMercadoAtual)
  const [isLoading, setIsLoading] = useState(false)

  // Escala proporcionalmente o aportado para manter a mesma % de rentabilidade
  const ratio = valorMercadoAtual > 0 ? novoTotal / valorMercadoAtual : 1
  const novoSaldoAtual = Math.max(0, caixinha.saldo_atual * ratio)
  const rentabilidadeAtual = valorMercadoAtual > 0
    ? ((valorMercadoAtual - caixinha.saldo_atual) / caixinha.saldo_atual) * 100
    : 0

  const delta = novoTotal - valorMercadoAtual
  const naoMudou = delta === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (novoTotal < 0) {
      toast.error('O valor não pode ser negativo')
      return
    }

    if (naoMudou) {
      onClose()
      return
    }

    setIsLoading(true)
    try {
      // 1. Atualiza valor_mercado e sincroniza a conta vinculada
      const result = await atualizarValorMercado({
        caixinha_id: caixinha.id,
        novo_valor_mercado: novoTotal,
      })

      if (!result) {
        toast.error('Erro ao ajustar saldo')
        return
      }

      // 2. Atualiza saldo_atual (aportado) proporcionalmente para manter a % de rentabilidade
      await updateCaixinha({
        id: caixinha.id,
        saldo_atual: novoSaldoAtual,
      })

      const contaMsg = contaVinculada && delta !== 0
        ? ` Conta "${contaVinculada.nome}" ajustada em ${delta > 0 ? '+' : ''}${formatCurrency(delta)}.`
        : ''
      toast.success(`Saldo ajustado para ${formatCurrency(novoTotal)}.${contaMsg}`)
      onClose()
    } catch {
      toast.error('Erro ao ajustar saldo')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajustar Saldo">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Identificação */}
        <div className="flex items-center gap-3 pb-3 border-b border-dark-700">
          <span className="text-3xl">{caixinha.icone || '📈'}</span>
          <div>
            <p className="font-semibold text-gray-100">{caixinha.nome}</p>
            <p className="text-xs text-gray-500">Ajuste corrige o saldo mantendo a mesma rentabilidade</p>
          </div>
        </div>

        {/* Valores atuais */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-700 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Aportado Atual</p>
            <p className="text-base font-bold text-gray-200">{formatCurrency(caixinha.saldo_atual)}</p>
          </div>
          <div className="bg-dark-700 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Valor de Mercado Atual</p>
            <p className="text-base font-bold text-gray-200">{formatCurrency(valorMercadoAtual)}</p>
          </div>
        </div>

        {/* Rentabilidade atual */}
        <div className="bg-dark-700 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Rentabilidade Atual</p>
          <p className={`text-sm font-semibold ${rentabilidadeAtual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {rentabilidadeAtual >= 0 ? '+' : ''}{rentabilidadeAtual.toFixed(2)}%
            {' '}({formatCurrency(valorMercadoAtual - caixinha.saldo_atual)})
          </p>
        </div>

        {/* Input do novo valor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Novo Valor Total *
          </label>
          <CurrencyInput
            value={novoTotal}
            onChange={setNovoTotal}
            placeholder="R$ 0,00"
          />
          <p className="text-xs text-gray-500 mt-1">
            Digite o valor real atual do investimento
          </p>
        </div>

        {/* Preview após ajuste */}
        {!naoMudou && novoTotal >= 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <SlidersHorizontal size={14} className="text-blue-400" />
              <p className="text-xs font-semibold text-blue-300">Após o ajuste</p>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Novo Aportado</span>
              <span className="text-gray-200 font-medium">{formatCurrency(novoSaldoAtual)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Novo Valor de Mercado</span>
              <span className={`font-medium ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(novoTotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t border-blue-500/20 pt-2">
              <span className="text-gray-400">Rentabilidade (mantida)</span>
              <span className={`font-semibold ${rentabilidadeAtual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {rentabilidadeAtual >= 0 ? '+' : ''}{rentabilidadeAtual.toFixed(2)}%
              </span>
            </div>
            {contaVinculada && (
              <div className="flex justify-between text-sm border-t border-blue-500/20 pt-2">
                <span className="text-xs text-gray-500">Conta "{contaVinculada.nome}"</span>
                <span className={`text-xs font-semibold ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {delta > 0 ? '+' : ''}{formatCurrency(delta)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading || novoTotal < 0}>
            {isLoading ? 'Salvando...' : 'Confirmar Ajuste'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
