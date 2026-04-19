import { useState, useMemo } from 'react'
import { X, ArrowRight, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { Button } from './ui/Button'
import { CurrencyInput } from './ui/CurrencyInput'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { formatCurrency } from '../utils/currency'
import { toast } from 'sonner'
import type { CaixinhaComDetalhes } from '../types'

interface TransferirCaixinhaModalProps {
  isOpen: boolean
  onClose: () => void
  caixinha: CaixinhaComDetalhes // origem pré-selecionada
}

export function TransferirCaixinhaModal({ isOpen, onClose, caixinha }: TransferirCaixinhaModalProps) {
  const [destId, setDestId] = useState<string>('')
  const [valor, setValor] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const caixinhas = useCaixinhasStore((state) => state.caixinhas)
  const transferirCaixinhas = useCaixinhasStore((state) => state.transferirCaixinhas)

  const destinosDisponiveis = useMemo(
    () => caixinhas.filter((c) => c.tipo === 'investimento' && c.id !== caixinha.id && c.ativa),
    [caixinhas, caixinha.id]
  )

  const destSelecionado = destinosDisponiveis.find((c) => c.id === destId)
  const valorMercadoSource = caixinha.valor_mercado ?? caixinha.saldo_atual

  // Custo proporcional que será movido
  const costBasis = valorMercadoSource > 0
    ? valor * (caixinha.saldo_atual / valorMercadoSource)
    : valor

  // Simulação após transferência
  const sourceApos = {
    saldo_atual: caixinha.saldo_atual - costBasis,
    valor_mercado: valorMercadoSource - valor,
  }
  const destApos = destSelecionado
    ? {
        saldo_atual: destSelecionado.saldo_atual + costBasis,
        valor_mercado: (destSelecionado.valor_mercado ?? destSelecionado.saldo_atual) + valor,
      }
    : null

  const sourceRentPct = sourceApos.saldo_atual > 0
    ? ((sourceApos.valor_mercado - sourceApos.saldo_atual) / sourceApos.saldo_atual) * 100
    : 0
  const sourceRentPctAtual = caixinha.saldo_atual > 0
    ? ((valorMercadoSource - caixinha.saldo_atual) / caixinha.saldo_atual) * 100
    : 0
  const destRentPctAtual = destSelecionado
    ? destSelecionado.saldo_atual > 0
      ? (((destSelecionado.valor_mercado ?? destSelecionado.saldo_atual) - destSelecionado.saldo_atual) / destSelecionado.saldo_atual) * 100
      : 0
    : 0
  const destRentPctApos = destApos && destApos.saldo_atual > 0
    ? ((destApos.valor_mercado - destApos.saldo_atual) / destApos.saldo_atual) * 100
    : 0

  const excedeLimite = valor > valorMercadoSource
  const canSubmit = destId && valor > 0 && !excedeLimite && !isLoading

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsLoading(true)
    try {
      const success = await transferirCaixinhas({
        source_id: caixinha.id,
        dest_id: destId,
        valor_mercado_transferir: valor,
      })
      if (success) {
        toast.success(`Transferência de ${formatCurrency(valor)} realizada com sucesso!`)
        onClose()
      } else {
        toast.error('Erro ao realizar transferência. Tente novamente.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-dark-800 shadow-xl sm:max-w-lg w-full max-h-[100dvh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-dark-700">
          <div>
            <h2 className="text-lg font-bold text-gray-100">Transferir entre Investimentos</h2>
            <p className="text-xs text-gray-400 mt-0.5">Origem: {caixinha.nome}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-full transition-colors text-gray-400 hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
          {/* Destino */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Caixinha de destino
            </label>
            {destinosDisponiveis.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
                <AlertTriangle size={16} />
                Nenhuma outra caixinha de investimento ativa encontrada.
              </div>
            ) : (
              <select
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 text-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Selecione o destino...</option>
                {destinosDisponiveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icone} {c.nome} — {formatCurrency(c.valor_mercado ?? c.saldo_atual)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Valor a transferir <span className="text-gray-500 font-normal">(valor de mercado)</span>
            </label>
            <CurrencyInput
              value={valor}
              onChange={setValor}
              placeholder="R$ 0,00"
            />
            <p className="text-xs text-gray-500 mt-1">
              Disponível: {formatCurrency(valorMercadoSource)}
            </p>
            {excedeLimite && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Valor excede o disponível na caixinha de origem
              </p>
            )}
          </div>

          {/* Preview */}
          {valor > 0 && !excedeLimite && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Prévia após transferência</p>

              {/* Cost basis info */}
              <div className="text-xs text-gray-500 bg-dark-700/50 rounded-lg px-3 py-2">
                Custo proporcional movido: <span className="text-gray-300 font-medium">{formatCurrency(costBasis)}</span>
                {' '}(base de cálculo de rentabilidade)
              </div>

              {/* Origem */}
              <div className="bg-dark-700/40 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <span>{caixinha.icone}</span>
                  <span>{caixinha.nome}</span>
                  <span className="text-xs text-red-400 ml-auto">origem</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500">Aportado</p>
                    <p className="text-gray-300 font-medium">
                      {formatCurrency(caixinha.saldo_atual)}{' '}
                      <span className="text-red-400">→ {formatCurrency(sourceApos.saldo_atual)}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Valor Mercado</p>
                    <p className="text-gray-300 font-medium">
                      {formatCurrency(valorMercadoSource)}{' '}
                      <span className="text-red-400">→ {formatCurrency(sourceApos.valor_mercado)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {sourceRentPct >= 0
                    ? <TrendingUp size={12} className="text-green-400" />
                    : <TrendingDown size={12} className="text-red-400" />
                  }
                  <span className="text-gray-500">Rentabilidade:</span>
                  <span className={sourceRentPctAtual >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {sourceRentPctAtual >= 0 ? '+' : ''}{sourceRentPctAtual.toFixed(2)}%
                  </span>
                  <ArrowRight size={10} className="text-gray-600 mx-0.5" />
                  <span className={sourceRentPct >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {sourceRentPct >= 0 ? '+' : ''}{sourceRentPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Destino */}
              {destSelecionado && destApos && (
                <div className="bg-dark-700/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <span>{destSelecionado.icone}</span>
                    <span>{destSelecionado.nome}</span>
                    <span className="text-xs text-green-400 ml-auto">destino</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500">Aportado</p>
                      <p className="text-gray-300 font-medium">
                        {formatCurrency(destSelecionado.saldo_atual)}{' '}
                        <span className="text-green-400">→ {formatCurrency(destApos.saldo_atual)}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Valor Mercado</p>
                      <p className="text-gray-300 font-medium">
                        {formatCurrency(destSelecionado.valor_mercado ?? destSelecionado.saldo_atual)}{' '}
                        <span className="text-green-400">→ {formatCurrency(destApos.valor_mercado)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {destRentPctApos >= 0
                      ? <TrendingUp size={12} className="text-green-400" />
                      : <TrendingDown size={12} className="text-red-400" />
                    }
                    <span className="text-gray-500">Rentabilidade:</span>
                    <span className={destRentPctAtual >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {destRentPctAtual >= 0 ? '+' : ''}{destRentPctAtual.toFixed(2)}%
                    </span>
                    <ArrowRight size={10} className="text-gray-600 mx-0.5" />
                    <span className={destRentPctApos >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {destRentPctApos >= 0 ? '+' : ''}{destRentPctApos.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 border-t border-dark-700 shrink-0">
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {isLoading ? 'Transferindo...' : 'Confirmar Transferência'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
