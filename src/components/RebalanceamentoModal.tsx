import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button, CurrencyInput } from './ui'
import { AlertTriangle, ArrowRight, CheckCircle, TrendingUp } from 'lucide-react'
import { rebalanceamentoService, analisarEstouroCategoria } from '../services/rebalanceamentoService'
import { useFamilyStore } from '../store/useFamilyStore'
import type { AnaliseEstouro, SugestaoRebalanceamento, CategoriaBudgetComRelacoes } from '../types'
import { formatCurrency } from '../utils/currency'
import { toast } from 'sonner'

interface RebalanceamentoModalProps {
  isOpen: boolean
  onClose: () => void
  categoriaEstourada: CategoriaBudgetComRelacoes
  orcamentoId: string
  onRebalanceado?: () => void
}

export function RebalanceamentoModal({
  isOpen,
  onClose,
  categoriaEstourada,
  orcamentoId,
  onRebalanceado,
}: RebalanceamentoModalProps) {
  const family = useFamilyStore((state) => state.family)
  const [analise, setAnalise] = useState<AnaliseEstouro | null>(null)
  const [selectedSugestao, setSelectedSugestao] = useState<SugestaoRebalanceamento | null>(null)
  const [valorCustomizado, setValorCustomizado] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalisando, setIsAnalisando] = useState(false)

  // Buscar análise quando modal abre
  useEffect(() => {
    if (isOpen && categoriaEstourada.id && orcamentoId) {
      buscarAnalise()
    }
  }, [isOpen, categoriaEstourada.id, orcamentoId])

  const buscarAnalise = async () => {
    setIsAnalisando(true)
    try {
      const { data, error } = await analisarEstouroCategoria(
        categoriaEstourada.id,
        orcamentoId
      )

      if (error) {
        toast.error('Erro ao analisar estouro')
        console.error(error)
        return
      }

      if (data) {
        setAnalise(data)
        // Selecionar automaticamente a primeira sugestão (melhor opção)
        if (data.sugestoes.length > 0) {
          const melhorSugestao = data.sugestoes[0]
          setSelectedSugestao(melhorSugestao)
          setValorCustomizado(melhorSugestao.valor_sugerido)
        }
      }
    } catch (error) {
      console.error('Erro ao buscar análise:', error)
      toast.error('Erro ao analisar estouro')
    } finally {
      setIsAnalisando(false)
    }
  }

  const handleExecutarRebalanceamento = async () => {
    if (!selectedSugestao || !family?.id || valorCustomizado <= 0) {
      toast.error('Selecione uma categoria e um valor válido')
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await rebalanceamentoService.executarRebalanceamento({
        family_id: family.id,
        orcamento_id: orcamentoId,
        categoria_origem_id: selectedSugestao.categoria_origem.id,
        categoria_destino_id: categoriaEstourada.categoria_id!,
        valor_transferido: valorCustomizado,
        motivo: `Rebalanceamento automático: ${categoriaEstourada.categoria?.nome} estourou em ${formatCurrency(analise?.valor_estouro || 0)}`,
        foi_sugestao_automatica: true,
      })

      if (error) {
        toast.error('Erro ao executar rebalanceamento')
        console.error(error)
        return
      }

      if (data) {
        toast.success('Rebalanceamento realizado com sucesso!')
        onRebalanceado?.()
        onClose()
      }
    } catch (error) {
      console.error('Erro ao executar rebalanceamento:', error)
      toast.error('Erro ao executar rebalanceamento')
    } finally {
      setIsLoading(false)
    }
  }

  const getPrioridadeColor = (nivel: 1 | 2 | 3) => {
    switch (nivel) {
      case 1:
        return 'text-green-400 bg-green-500/10 border-green-500'
      case 2:
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500'
      case 3:
        return 'text-red-400 bg-red-500/10 border-red-500'
    }
  }

  const getPrioridadeLabel = (nivel: 1 | 2 | 3) => {
    switch (nivel) {
      case 1:
        return 'Melhor Opção'
      case 2:
        return 'Opção Moderada'
      case 3:
        return 'Última Opção'
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rebalanceamento de Orçamento"
      size="large"
    >
      <div className="space-y-6">
        {/* Alerta de Estouro */}
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-400 mt-1" size={20} />
            <div className="flex-1">
              <h3 className="text-red-400 font-semibold mb-1">Categoria Estourada</h3>
              <p className="text-gray-300 text-sm">
                <span className="font-medium">{categoriaEstourada.categoria?.nome}</span> estourou em{' '}
                <span className="font-bold text-red-400">
                  {formatCurrency(analise?.valor_estouro || 0)}
                </span>
              </p>
              {analise && (
                <div className="mt-2 text-xs text-gray-400">
                  <div>Orçado: {formatCurrency(analise.valor_orcado)}</div>
                  <div>Gasto: {formatCurrency(analise.valor_gasto)}</div>
                  <div className="text-red-400">
                    Estouro: {analise.percentual_estouro.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {isAnalisando && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Analisando possibilidades...</p>
          </div>
        )}

        {/* Sugestões */}
        {!isAnalisando && analise && (
          <>
            {analise.sugestoes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">
                  Não há categorias com saldo disponível para rebalanceamento.
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Considere usar uma caixinha de emergência ou ajustar seu orçamento.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">
                    <TrendingUp className="inline mr-2" size={16} />
                    Sugestões Inteligentes
                  </h4>
                  <div className="space-y-2">
                    {analise.sugestoes.map((sugestao, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSelectedSugestao(sugestao)
                          setValorCustomizado(sugestao.valor_sugerido)
                        }}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          selectedSugestao === sugestao
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-dark-600 hover:border-dark-500 bg-dark-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{sugestao.categoria_origem.icone}</span>
                              <span className="font-medium text-gray-200">
                                {sugestao.categoria_origem.nome}
                              </span>
                              <ArrowRight size={14} className="text-gray-600" />
                              <span className="text-lg">{sugestao.categoria_destino.icone}</span>
                              <span className="font-medium text-gray-200">
                                {sugestao.categoria_destino.nome}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mb-2">{sugestao.motivo}</p>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-gray-500">
                                Disponível: {formatCurrency(sugestao.valor_disponivel)}
                              </span>
                              <span className="text-primary-400 font-medium">
                                Sugerido: {formatCurrency(sugestao.valor_sugerido)}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`px-2 py-1 rounded text-xs font-medium border ${getPrioridadeColor(
                              sugestao.nivel_prioridade
                            )}`}
                          >
                            {getPrioridadeLabel(sugestao.nivel_prioridade)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Valor Customizado */}
                {selectedSugestao && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Valor a transferir
                    </label>
                    <CurrencyInput
                      value={valorCustomizado}
                      onChange={setValorCustomizado}
                      placeholder="R$ 0,00"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Máximo disponível: {formatCurrency(selectedSugestao.valor_disponivel)}
                    </p>
                  </div>
                )}

                {/* Resumo da Ação */}
                {selectedSugestao && valorCustomizado > 0 && (
                  <div className="bg-primary-500/10 border border-primary-500/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="text-primary-400 mt-1" size={20} />
                      <div className="flex-1 text-sm">
                        <p className="text-gray-300">
                          Transferir{' '}
                          <span className="font-bold text-primary-400">
                            {formatCurrency(valorCustomizado)}
                          </span>
                        </p>
                        <p className="text-gray-400 mt-1">
                          De:{' '}
                          <span className="font-medium">
                            {selectedSugestao.categoria_origem.nome}
                          </span>
                        </p>
                        <p className="text-gray-400">
                          Para:{' '}
                          <span className="font-medium">
                            {selectedSugestao.categoria_destino.nome}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t border-dark-700">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          {analise && analise.sugestoes.length > 0 && (
            <Button onClick={handleExecutarRebalanceamento} disabled={isLoading || !selectedSugestao}>
              {isLoading ? 'Rebalanceando...' : 'Confirmar Rebalanceamento'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
