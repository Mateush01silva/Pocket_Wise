import { useState, useEffect, useMemo } from 'react'
import { Check, X, AlertTriangle, TrendingUp } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button, Input, Select } from './ui'
import { CurrencyInput } from './ui/CurrencyInput'
import { useOrcamentosStore } from '../store'
import { useCategoriasStore } from '../store'
import type { OrcamentoMensal, Categoria, CategoriaPrioridade } from '../types'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import { IconRenderer } from '../lib/iconRenderer'

interface BudgetPlanningModalProps {
  isOpen: boolean
  onClose: () => void
  orcamento?: OrcamentoMensal // Para edição
  mesReferencia: string
}

interface CategoriaFormData {
  categoria_id: string
  valor_orcado: number
  prioridade: CategoriaPrioridade
}

export function BudgetPlanningModal({
  isOpen,
  onClose,
  orcamento,
  mesReferencia,
}: BudgetPlanningModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  const categoriasBudget = useOrcamentosStore((state) => state.categoriasBudget)
  const createOrcamento = useOrcamentosStore((state) => state.createOrcamento)
  const updateOrcamento = useOrcamentosStore((state) => state.updateOrcamento)
  const bulkCreateCategoriasBudget = useOrcamentosStore((state) => state.bulkCreateCategoriasBudget)

  const [metaPoupanca, setMetaPoupanca] = useState(0)
  const [metaPoupancaPercentual, setMetaPoupancaPercentual] = useState<number | null>(null)
  const [tipoMeta, setTipoMeta] = useState<'valor' | 'percentual'>('valor')
  const [receitasProjetadas, setReceitasProjetadas] = useState(0)
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<CategoriaFormData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const isEditMode = !!orcamento

  // Filtrar apenas categorias de despesa principais
  const categoriasDespesa = useMemo(
    () =>
      categorias.filter((c) => c.tipo === 'despesa' && !c.categoria_pai_id).sort((a, b) => a.nome.localeCompare(b.nome)),
    [categorias]
  )

  // Inicializar formulário com dados do orçamento existente
  useEffect(() => {
    if (orcamento) {
      setMetaPoupanca(orcamento.meta_poupanca || 0)
      setMetaPoupancaPercentual(orcamento.meta_poupanca_percentual)
      setTipoMeta(orcamento.meta_poupanca_percentual ? 'percentual' : 'valor')

      // Carregar categorias budget existentes
      const categoriasDoOrcamento = categoriasBudget
        .filter((cb) => cb.orcamento_id === orcamento.id)
        .map((cb) => ({
          categoria_id: cb.categoria_id,
          valor_orcado: cb.valor_orcado,
          prioridade: cb.prioridade,
        }))

      setCategoriasSelecionadas(categoriasDoOrcamento)
    }
  }, [orcamento, categoriasBudget])

  // Cálculos
  const totalDespesasPlanejadas = categoriasSelecionadas.reduce((sum, c) => sum + c.valor_orcado, 0)
  const metaReal = tipoMeta === 'percentual' && metaPoupancaPercentual
    ? (receitasProjetadas * metaPoupancaPercentual) / 100
    : metaPoupanca
  const totalNecessario = totalDespesasPlanejadas + metaReal
  const saldo = receitasProjetadas - totalNecessario
  const isValid = saldo >= 0

  const handleToggleCategoria = (categoria: Categoria) => {
    const exists = categoriasSelecionadas.find((c) => c.categoria_id === categoria.id)

    if (exists) {
      setCategoriasSelecionadas((prev) => prev.filter((c) => c.categoria_id !== categoria.id))
    } else {
      setCategoriasSelecionadas((prev) => [
        ...prev,
        { categoria_id: categoria.id, valor_orcado: 0, prioridade: 'importante' },
      ])
    }
  }

  const handleUpdateValor = (categoriaId: string, valor: number) => {
    setCategoriasSelecionadas((prev) =>
      prev.map((c) => (c.categoria_id === categoriaId ? { ...c, valor_orcado: valor } : c))
    )
  }

  const handleUpdatePrioridade = (categoriaId: string, prioridade: CategoriaPrioridade) => {
    setCategoriasSelecionadas((prev) =>
      prev.map((c) => (c.categoria_id === categoriaId ? { ...c, prioridade } : c))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValid) {
      alert('O orçamento está desbalanceado! Receitas devem ser >= Despesas + Poupança')
      return
    }

    if (categoriasSelecionadas.length === 0) {
      alert('Selecione ao menos uma categoria para orçar')
      return
    }

    setIsLoading(true)
    try {
      let orcamentoId = orcamento?.id

      if (isEditMode && orcamento) {
        // Atualizar orçamento existente
        await updateOrcamento(orcamento.id, {
          meta_poupanca: tipoMeta === 'valor' ? metaPoupanca : metaReal,
          meta_poupanca_percentual: tipoMeta === 'percentual' ? metaPoupancaPercentual : null,
        })
      } else {
        // Criar novo orçamento
        const novoOrcamento = await createOrcamento({
          family_id: 'local-storage-family',
          mes_referencia: mesReferencia,
          meta_poupanca: tipoMeta === 'valor' ? metaPoupanca : metaReal,
          meta_poupanca_percentual: tipoMeta === 'percentual' ? metaPoupancaPercentual : null,
          dia_inicio_ciclo: 1,
          metodo_calculo: 'conservador',
          status: 'ativo',
        })

        if (!novoOrcamento) {
          throw new Error('Erro ao criar orçamento')
        }

        orcamentoId = novoOrcamento.id
      }

      // Criar categorias budget
      if (orcamentoId) {
        await bulkCreateCategoriasBudget({
          orcamento_id: orcamentoId,
          categorias: categoriasSelecionadas,
        })
      }

      onClose()
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error)
      alert('Erro ao salvar orçamento. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Editar Orçamento' : 'Planejar Orçamento'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seção 1: Receitas Projetadas */}
        <div className="bg-dark-700/30 p-4 rounded-lg border border-dark-600">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-400" />
            Receitas Projetadas do Mês
          </h3>
          <CurrencyInput
            value={receitasProjetadas}
            onChange={setReceitasProjetadas}
            placeholder="Ex: R$ 5.000,00"
          />
          <p className="text-xs text-gray-500 mt-2">
            Some todas as suas receitas previstas (salário, freelances, etc.)
          </p>
        </div>

        {/* Seção 2: Meta de Poupança */}
        <div className="bg-dark-700/30 p-4 rounded-lg border border-dark-600">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Meta de Poupança</h3>

          <div className="space-y-3">
            <Select
              value={tipoMeta}
              onChange={(e) => setTipoMeta(e.target.value as 'valor' | 'percentual')}
              options={[
                { value: 'valor', label: 'Valor Fixo (R$)' },
                { value: 'percentual', label: 'Percentual da Renda (%)' },
              ]}
            />

            {tipoMeta === 'valor' ? (
              <CurrencyInput
                value={metaPoupanca}
                onChange={setMetaPoupanca}
                placeholder="Ex: R$ 1.000,00"
              />
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={metaPoupancaPercentual || ''}
                  onChange={(e) => setMetaPoupancaPercentual(Number(e.target.value))}
                  placeholder="Ex: 20"
                  min={0}
                  max={100}
                />
                <span className="text-gray-400">%</span>
              </div>
            )}

            {tipoMeta === 'percentual' && metaPoupancaPercentual && receitasProjetadas > 0 && (
              <p className="text-xs text-gray-400">
                = {formatCurrency(metaReal)} ({metaPoupancaPercentual}% de {formatCurrency(receitasProjetadas)})
              </p>
            )}
          </div>
        </div>

        {/* Seção 3: Seleção de Categorias */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Categorias de Despesa ({categoriasSelecionadas.length} selecionadas)
          </h3>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {categoriasDespesa.map((categoria) => {
              const selecionada = categoriasSelecionadas.find((c) => c.categoria_id === categoria.id)

              return (
                <div
                  key={categoria.id}
                  className={cn(
                    'border rounded-lg transition-all',
                    selecionada ? 'border-primary-500 bg-primary-500/5' : 'border-dark-600 bg-dark-700/30'
                  )}
                >
                  <div className="flex items-center gap-3 p-3">
                    <button
                      type="button"
                      onClick={() => handleToggleCategoria(categoria)}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                        selecionada
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-600 hover:border-primary-500'
                      )}
                    >
                      {selecionada && <Check size={14} className="text-white" />}
                    </button>

                    <IconRenderer iconName={categoria.icone} size={20} className="text-gray-300" />
                    <span className="font-medium text-gray-200 flex-1">{categoria.nome}</span>
                  </div>

                  {selecionada && (
                    <div className="px-3 pb-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Valor Orçado</label>
                        <CurrencyInput
                          value={selecionada.valor_orcado}
                          onChange={(value) => handleUpdateValor(categoria.id, value)}
                          placeholder="R$ 0,00"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Prioridade</label>
                        <Select
                          value={selecionada.prioridade}
                          onChange={(e) =>
                            handleUpdatePrioridade(categoria.id, e.target.value as CategoriaPrioridade)
                          }
                          options={[
                            { value: 'essencial', label: '🔴 Essencial' },
                            { value: 'importante', label: '🟡 Importante' },
                            { value: 'desejavel', label: '🟢 Desejável' },
                          ]}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Seção 4: Resumo e Validação */}
        <div
          className={cn(
            'p-4 rounded-lg border-2',
            isValid
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          )}
        >
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Receitas Projetadas:</span>
              <span className="font-medium text-green-400">{formatCurrency(receitasProjetadas)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Despesas Planejadas:</span>
              <span className="font-medium text-red-400">{formatCurrency(totalDespesasPlanejadas)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Meta de Poupança:</span>
              <span className="font-medium text-yellow-400">{formatCurrency(metaReal)}</span>
            </div>

            <div className="h-px bg-dark-600 my-2" />

            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-200">Saldo:</span>
              <div className="flex items-center gap-2">
                <span className={cn('font-bold text-lg', isValid ? 'text-green-400' : 'text-red-400')}>
                  {formatCurrency(saldo)}
                </span>
                {isValid ? (
                  <Check size={20} className="text-green-400" />
                ) : (
                  <AlertTriangle size={20} className="text-red-400" />
                )}
              </div>
            </div>

            {!isValid && (
              <p className="text-xs text-red-400 mt-2">
                ⚠️ Orçamento desbalanceado! Reduza despesas ou aumente receitas.
              </p>
            )}
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            <X size={16} className="mr-2" />
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading} disabled={!isValid} className="flex-1">
            <Check size={16} className="mr-2" />
            {isEditMode ? 'Salvar Alterações' : 'Criar Orçamento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
