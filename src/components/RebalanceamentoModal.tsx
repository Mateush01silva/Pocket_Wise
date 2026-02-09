import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button, CurrencyInput } from './ui'
import { AlertTriangle, ArrowRight, CheckCircle, TrendingUp } from 'lucide-react'
import { rebalanceamentoService, gerarSugestoesRebalanceamento } from '../services/rebalanceamentoService'
import { useFamilyStore } from '../store/useFamilyStore'
import type { AnaliseEstouro, SugestaoRebalanceamento, CategoriaBudgetComRelacoes } from '../types'
import { formatCurrency } from '../utils/currency'
import { toast } from 'sonner'

interface RebalanceamentoModalProps {
  isOpen: boolean
  onClose: () => void
  categoriaEstourada: CategoriaBudgetComRelacoes
  todasCategoriasBudget: CategoriaBudgetComRelacoes[]
  orcamentoId: string
  onRebalanceado?: () => void | Promise<void>
}

export function RebalanceamentoModal({
  isOpen,
  onClose,
  categoriaEstourada,
  todasCategoriasBudget,
  orcamentoId,
  onRebalanceado,
}: RebalanceamentoModalProps) {
  const family = useFamilyStore((state) => state.family)
  const [analise, setAnalise] = useState<AnaliseEstouro | null>(null)
  const [sugestoesSelecionadas, setSugestoesSelecionadas] = useState<Map<number, number>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalisando, setIsAnalisando] = useState(false)

  // Gerar análise quando modal abre usando dados locais (já calculados pelo store)
  useEffect(() => {
    if (isOpen && categoriaEstourada.id) {
      gerarAnaliseLocal()
    }
  }, [isOpen, categoriaEstourada.id])

  const gerarAnaliseLocal = async () => {
    setIsAnalisando(true)
    try {
      const valorOrcado = categoriaEstourada.valor_orcado || 0
      const valorGasto = categoriaEstourada.valor_gasto || 0
      const valorDisponivel = categoriaEstourada.valor_disponivel ?? (valorOrcado - valorGasto)

      // Se não há estouro real, retornar sem sugestões
      if (valorDisponivel >= 0) {
        setAnalise({
          categoria: categoriaEstourada.categoria!,
          valor_orcado: valorOrcado,
          valor_gasto: valorGasto,
          valor_estouro: 0,
          percentual_estouro: 0,
          sugestoes: [],
        })
        return
      }

      const valorEstouro = Math.abs(valorDisponivel)
      const percentualEstouro = valorOrcado > 0 ? (valorEstouro / valorOrcado) * 100 : 0

      // Gerar sugestões usando os dados locais já calculados pelo store
      const sugestoes = await gerarSugestoesRebalanceamento(
        categoriaEstourada,
        valorEstouro,
        todasCategoriasBudget
      )

      setAnalise({
        categoria: categoriaEstourada.categoria!,
        valor_orcado: valorOrcado,
        valor_gasto: valorGasto,
        valor_estouro: valorEstouro,
        percentual_estouro: percentualEstouro,
        sugestoes,
      })
      setSugestoesSelecionadas(new Map())
    } catch (error) {
      console.error('Erro ao gerar análise:', error)
      toast.error('Erro ao analisar estouro')
    } finally {
      setIsAnalisando(false)
    }
  }

  const toggleSugestao = (index: number, sugestao: SugestaoRebalanceamento) => {
    setSugestoesSelecionadas(prev => {
      const newMap = new Map(prev)
      if (newMap.has(index)) {
        newMap.delete(index)
      } else {
        newMap.set(index, sugestao.valor_sugerido)
      }
      return newMap
    })
  }

  const updateValorSugestao = (index: number, valor: number) => {
    setSugestoesSelecionadas(prev => {
      const newMap = new Map(prev)
      newMap.set(index, valor)
      return newMap
    })
  }

  const totalSelecionado = Array.from(sugestoesSelecionadas.values()).reduce((sum, val) => sum + val, 0)

  const handleExecutarRebalanceamento = async () => {
    if (!family?.id || sugestoesSelecionadas.size === 0) {
      toast.error('Selecione ao menos uma categoria para rebalancear')
      return
    }

    setIsLoading(true)
    try {
      // Executar rebalanceamentos em sequência
      for (const [index, valor] of sugestoesSelecionadas.entries()) {
        const sugestao = analise!.sugestoes[index]

        const { error } = await rebalanceamentoService.executarRebalanceamento({
          family_id: family.id,
          orcamento_id: orcamentoId,
          categoria_origem_id: sugestao.categoria_origem.id,
          categoria_destino_id: categoriaEstourada.categoria_id!,
          valor_transferido: valor,
          motivo: `Rebalanceamento: ${sugestao.categoria_origem.nome} → ${categoriaEstourada.categoria?.nome}`,
          foi_sugestao_automatica: true,
        })

        if (error) {
          toast.error(`Erro ao transferir de ${sugestao.categoria_origem.nome}`)
          console.error(error)
          return
        }
      }

      toast.success(`Rebalanceamento realizado! ${sugestoesSelecionadas.size} transferência(s)`)

      // Aguardar atualização do store antes de fechar o modal
      await onRebalanceado?.()

      onClose()
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
                  {formatCurrency(analise?.valor_estouro || Math.abs(categoriaEstourada.valor_disponivel || 0))}
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
                  <div className="space-y-3">
                    {analise.sugestoes.map((sugestao, index) => {
                      const isSelected = sugestoesSelecionadas.has(index)
                      const valorSelecionado = sugestoesSelecionadas.get(index) || sugestao.valor_sugerido

                      return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-dark-600 bg-dark-800'
                        }`}
                      >
                        {/* Checkbox e conteúdo */}
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSugestao(index, sugestao)}
                            className="mt-1 w-4 h-4 text-primary-600 bg-dark-700 border-dark-600 rounded focus:ring-primary-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-200">
                                    {sugestao.categoria_origem.nome}
                                  </span>
                                  <ArrowRight size={14} className="text-gray-600" />
                                  <span className="font-medium text-gray-200">
                                    {sugestao.categoria_destino.nome}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400">{sugestao.motivo}</p>
                              </div>
                              <div
                                className={`px-2 py-1 rounded text-xs font-medium border ${getPrioridadeColor(
                                  sugestao.nivel_prioridade
                                )}`}
                              >
                                {getPrioridadeLabel(sugestao.nivel_prioridade)}
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-xs mb-2">
                              <span className="text-gray-500">
                                Disponível: {formatCurrency(sugestao.valor_disponivel)}
                              </span>
                              <span className="text-primary-400 font-medium">
                                Sugerido: {formatCurrency(sugestao.valor_sugerido)}
                              </span>
                            </div>

                            {/* Input de valor quando selecionado */}
                            {isSelected && (
                              <div className="mt-3">
                                <CurrencyInput
                                  value={valorSelecionado}
                                  onChange={(val) => updateValorSugestao(index, val)}
                                  placeholder="R$ 0,00"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Máximo: {formatCurrency(sugestao.valor_disponivel)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                    })}
                  </div>
                </div>

                {/* Resumo Total */}
                {sugestoesSelecionadas.size > 0 && (
                  <div className="bg-primary-500/10 border border-primary-500/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="text-primary-400 mt-1" size={20} />
                      <div className="flex-1 text-sm">
                        <p className="text-gray-300 mb-2">
                          Total a transferir:{' '}
                          <span className="font-bold text-primary-400 text-lg">
                            {formatCurrency(totalSelecionado)}
                          </span>
                        </p>
                        <p className="text-gray-400">
                          {sugestoesSelecionadas.size} categoria(s) selecionada(s)
                        </p>
                        <p className="text-gray-400">
                          Para: <span className="font-medium">{categoriaEstourada.categoria?.nome}</span>
                        </p>
                        {analise && totalSelecionado < analise.valor_estouro && (
                          <p className="text-yellow-400 mt-2">
                            ⚠️ Ainda faltam {formatCurrency(analise.valor_estouro - totalSelecionado)} para cobrir o estouro
                          </p>
                        )}
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
            <Button
              onClick={handleExecutarRebalanceamento}
              disabled={isLoading || sugestoesSelecionadas.size === 0}
            >
              {isLoading ? 'Rebalanceando...' : `Confirmar ${sugestoesSelecionadas.size > 0 ? `(${sugestoesSelecionadas.size})` : 'Rebalanceamento'}`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
