import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertCircle, History, Undo2 } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button, CurrencyInput } from './ui'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import { formatCurrency } from '../utils/currency'
import { toast } from 'sonner'
import type { CaixinhaComDetalhes } from '../types'

interface AtualizarCotacaoModalProps {
  isOpen: boolean
  onClose: () => void
  caixinha: CaixinhaComDetalhes
}

const SUBTIPO_LABELS: Record<string, string> = {
  renda_fixa: '🏦 Renda Fixa',
  renda_variavel: '📊 Renda Variável',
  fii: '🏢 FII',
  cripto: '🪙 Cripto',
  internacional: '🌎 Internacional',
  outro: '💼 Outro',
}

export function AtualizarCotacaoModal({ isOpen, onClose, caixinha }: AtualizarCotacaoModalProps) {
  const atualizarValorMercado = useCaixinhasStore((state) => state.atualizarValorMercado)
  const reverterCotacao = useCaixinhasStore((state) => state.reverterCotacao)
  const historicoCaixinha = useCaixinhasStore((state) => state.historicoCotacoes[caixinha.id] || [])
  const getContaById = useContasBancariasStore((state) => state.getContaById)

  const contaVinculada = caixinha.conta_investimento_id
    ? getContaById(caixinha.conta_investimento_id)
    : null

  // Valor anterior: se já foi definido usa valor_mercado, senão usa saldo_atual (aportado)
  const valorAnterior = caixinha.valor_mercado ?? caixinha.saldo_atual

  const [novoValor, setNovoValor] = useState(valorAnterior)
  const [isLoading, setIsLoading] = useState(false)
  const [isReverting, setIsReverting] = useState(false)

  const delta = novoValor - valorAnterior
  const deltaPercent = valorAnterior > 0 ? (delta / valorAnterior) * 100 : 0
  const isGain = delta > 0
  const isLoss = delta < 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (novoValor < 0) {
      toast.error('O valor de mercado não pode ser negativo')
      return
    }

    setIsLoading(true)
    try {
      const result = await atualizarValorMercado({
        caixinha_id: caixinha.id,
        novo_valor_mercado: novoValor,
      })

      if (result) {
        const msg = contaVinculada && delta !== 0
          ? `Cotação atualizada! Conta "${contaVinculada.nome}" ajustada em ${delta > 0 ? '+' : ''}${formatCurrency(delta)}.`
          : 'Cotação atualizada com sucesso!'
        toast.success(msg)
        onClose()
      } else {
        toast.error('Erro ao atualizar cotação')
      }
    } catch {
      toast.error('Erro ao atualizar cotação')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReverter = async (valorParaReverter: number) => {
    if (!confirm(`Reverter para ${formatCurrency(valorParaReverter)}? O saldo da conta vinculada também será ajustado.`)) return
    setIsReverting(true)
    try {
      const success = await reverterCotacao(caixinha.id, valorParaReverter)
      if (success) {
        toast.success(`Cotação revertida para ${formatCurrency(valorParaReverter)}`)
        onClose()
      } else {
        toast.error('Erro ao reverter cotação')
      }
    } catch {
      toast.error('Erro ao reverter cotação')
    } finally {
      setIsReverting(false)
    }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return null
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Atualizar Cotação"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Identificação da caixinha */}
        <div className="flex items-center gap-3 pb-3 border-b border-dark-700">
          <span className="text-3xl">{caixinha.icone || '📈'}</span>
          <div>
            <p className="font-semibold text-gray-100">{caixinha.nome}</p>
            <p className="text-xs text-gray-500">
              {caixinha.subtipo_investimento
                ? SUBTIPO_LABELS[caixinha.subtipo_investimento]
                : '📈 Investimento'}
            </p>
          </div>
        </div>

        {/* Comparativo de valores */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-700 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Aportado</p>
            <p className="text-lg font-bold text-gray-200">{formatCurrency(caixinha.saldo_atual)}</p>
            <p className="text-xs text-gray-600 mt-1">imutável</p>
          </div>
          <div className="bg-dark-700 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Último Valor Mercado</p>
            <p className="text-lg font-bold text-gray-200">{formatCurrency(valorAnterior)}</p>
            {caixinha.data_valor_mercado ? (
              <p className="text-xs text-gray-600 mt-1">{formatDate(caixinha.data_valor_mercado)}</p>
            ) : (
              <p className="text-xs text-yellow-600 mt-1">nunca atualizado</p>
            )}
          </div>
        </div>

        {/* Alerta de cotação desatualizada após aporte */}
        {caixinha.data_valor_mercado && caixinha.updated_at > caixinha.data_valor_mercado && (
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <AlertCircle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-400">
              Um aporte foi realizado após a última atualização de cotação. O valor de mercado pode estar desatualizado.
            </p>
          </div>
        )}

        {/* Input do novo valor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Novo Valor de Mercado *
          </label>
          <CurrencyInput
            value={novoValor}
            onChange={setNovoValor}
            placeholder="R$ 0,00"
          />
          <p className="text-xs text-gray-500 mt-1">
            Informe o valor atual do investimento conforme sua corretora/banco
          </p>
        </div>

        {/* Preview da variação */}
        {delta !== 0 && (
          <div className={`rounded-lg p-4 border ${
            isGain
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {isGain
                ? <TrendingUp size={16} className="text-green-400" />
                : <TrendingDown size={16} className="text-red-400" />
              }
              <p className={`text-sm font-semibold ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                {isGain ? 'Valorização' : 'Desvalorização'} detectada
              </p>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Variação</span>
              <span className={`font-bold ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                {delta > 0 ? '+' : ''}{formatCurrency(delta)} ({deltaPercent > 0 ? '+' : ''}{deltaPercent.toFixed(2)}%)
              </span>
            </div>
            {contaVinculada && (
              <div className="flex justify-between items-center mt-1 pt-1 border-t border-white/10">
                <span className="text-xs text-gray-500">
                  Conta "{contaVinculada.nome}" será atualizada
                </span>
                <span className={`text-xs font-semibold ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                  {delta > 0 ? '+' : ''}{formatCurrency(delta)}
                </span>
              </div>
            )}
          </div>
        )}

        {delta === 0 && novoValor > 0 && (
          <div className="flex items-center gap-2 bg-dark-700 rounded-lg p-3">
            <Minus size={16} className="text-gray-500" />
            <p className="text-sm text-gray-400">Sem variação em relação ao valor anterior</p>
          </div>
        )}

        {/* Conta vinculada info */}
        {contaVinculada && (
          <div className="text-xs text-gray-500 bg-dark-700 rounded p-2">
            🔗 Vinculada a: <span className="text-gray-300 font-medium">{contaVinculada.nome}</span>
            {' '}— saldo atual: <span className="text-gray-300">{formatCurrency(contaVinculada.saldo_atual)}</span>
            {delta !== 0 && (
              <span className="ml-1">
                → novo saldo: <span className={`font-semibold ${isGain ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-gray-300'}`}>
                  {formatCurrency(Math.max(0, contaVinculada.saldo_atual + delta))}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Histórico de cotações desta sessão */}
        {historicoCaixinha.length > 0 && (
          <div className="border-t border-dark-700 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <History size={14} className="text-gray-500" />
              <p className="text-xs font-medium text-gray-400">Histórico desta sessão</p>
            </div>
            <div className="space-y-1.5">
              {historicoCaixinha.map((entrada, idx) => (
                <div key={idx} className="flex items-center justify-between bg-dark-800 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="text-gray-500">{formatDate(entrada.data)}</span>
                    <span>{formatCurrency(entrada.valor_anterior)}</span>
                    <span className="text-gray-600">→</span>
                    <span className={entrada.novo_valor > entrada.valor_anterior ? 'text-green-400' : 'text-red-400'}>
                      {formatCurrency(entrada.novo_valor)}
                    </span>
                  </div>
                  {idx === 0 && (
                    <button
                      type="button"
                      onClick={() => handleReverter(entrada.valor_anterior)}
                      disabled={isReverting || isLoading}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 ml-2 shrink-0"
                      title="Reverter para este valor"
                    >
                      <Undo2 size={12} />
                      Reverter
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading || isReverting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading || isReverting || novoValor < 0}>
            {isLoading ? 'Salvando...' : 'Confirmar Cotação'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
