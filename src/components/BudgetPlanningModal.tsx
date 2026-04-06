import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Check, X, AlertTriangle, TrendingUp, Search, PiggyBank, Clock } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button, Input, Select } from './ui'
import { CurrencyInput } from './ui/CurrencyInput'
import { useOrcamentosStore } from '../store'
import { useCategoriasStore } from '../store'
import { useTransacoesStore } from '../store'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import type { OrcamentoMensal, Categoria, CategoriaPrioridade } from '../types'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import { IconRenderer } from '../lib/iconRenderer'
import { getRetiradasCaixinhasParaMes } from '../lib/financialCalculations'

interface BudgetPlanningModalProps {
  isOpen: boolean
  onClose: () => void
  orcamento?: OrcamentoMensal // Para edição
  mesReferencia: string
  envelopeLimit?: number // Limite de envelopes para o tier atual
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
  envelopeLimit = Infinity,
}: BudgetPlanningModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  const categoriasBudget = useOrcamentosStore((state) => state.categoriasBudget)
  const createOrcamento = useOrcamentosStore((state) => state.createOrcamento)
  const updateOrcamento = useOrcamentosStore((state) => state.updateOrcamento)
  const bulkCreateCategoriasBudget = useOrcamentosStore((state) => state.bulkCreateCategoriasBudget)

  // Caixinhas para mostrar retiradas destinadas a este mês
  const caixinhas = useCaixinhasStore((state) => state.caixinhas)
  const transacoesCaixinhas = useCaixinhasStore((state) => state.transacoes)
  const deleteTransacaoCaixinha = useCaixinhasStore((state) => state.deleteTransacao)

  // Lançamentos para sugestão de receitas pendentes
  const lancamentos = useTransacoesStore((state) => state.lancamentos)

  const [metaPoupanca, setMetaPoupanca] = useState(0)
  const [metaPoupancaPercentual, setMetaPoupancaPercentual] = useState<number | null>(null)
  const [tipoMeta, setTipoMeta] = useState<'valor' | 'percentual'>('valor')
  const [categoriasReceitaSelecionadas, setCategoriasReceitaSelecionadas] = useState<CategoriaFormData[]>([])
  const [categoriasDespesaSelecionadas, setCategoriasDespesaSelecionadas] = useState<CategoriaFormData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filtroReceita, setFiltroReceita] = useState('')
  const [filtroDespesa, setFiltroDespesa] = useState('')
  const [sugestaoReceitasDismissed, setSugestaoReceitasDismissed] = useState(false)

  // Sincronizar dismissed com localStorage ao abrir o modal (por mês)
  useEffect(() => {
    const key = `budget-receitas-dismissed-${mesReferenciaFormatado}`
    setSugestaoReceitasDismissed(localStorage.getItem(key) === 'true')
  }, [isOpen, mesReferenciaFormatado])

  const dismissSugestao = () => {
    const key = `budget-receitas-dismissed-${mesReferenciaFormatado}`
    localStorage.setItem(key, 'true')
    setSugestaoReceitasDismissed(true)
  }

  const isEditMode = !!orcamento

  // Converter mesReferencia para YYYY-MM
  const mesReferenciaFormatado = useMemo(() => {
    // mesReferencia pode vir como YYYY-MM-DD ou YYYY-MM
    return mesReferencia.substring(0, 7)
  }, [mesReferencia])

  // Calcular retiradas de caixinhas destinadas a este mês
  const { retiradas: retiradasCaixinhas, totalRetiradas: totalRetiradasCaixinhas } = useMemo(() => {
    const todasTransacoes = Object.values(transacoesCaixinhas).flat()
    return getRetiradasCaixinhasParaMes(todasTransacoes, caixinhas, mesReferenciaFormatado)
  }, [transacoesCaixinhas, caixinhas, mesReferenciaFormatado])

  // Receitas pendentes para o mês de referência (sugestão ao planejar)
  const receitasPendentesMes = useMemo(() => {
    return lancamentos.filter(
      (l) =>
        l.tipo === 'receita' &&
        l.status === 'pendente' &&
        l.data.startsWith(mesReferenciaFormatado)
    )
  }, [lancamentos, mesReferenciaFormatado])

  // Agrupar receitas pendentes por categoria (soma)
  const receitasPendentesPorCategoria = useMemo(() => {
    return receitasPendentesMes.reduce(
      (acc, l) => {
        if (l.categoria_id) {
          acc[l.categoria_id] = (acc[l.categoria_id] || 0) + l.valor
        }
        return acc
      },
      {} as Record<string, number>
    )
  }, [receitasPendentesMes])

  const totalReceitasPendentes = useMemo(
    () => receitasPendentesMes.reduce((sum, l) => sum + l.valor, 0),
    [receitasPendentesMes]
  )

  const handleAplicarReceitasPendentes = () => {
    const novasSelecionadas = [...categoriasReceitaSelecionadas]

    Object.entries(receitasPendentesPorCategoria).forEach(([catId, valor]) => {
      const jaExiste = novasSelecionadas.findIndex((c) => c.categoria_id === catId)
      if (jaExiste >= 0) {
        // Atualizar valor se já existe e o pendente é maior
        if (valor > novasSelecionadas[jaExiste].valor_orcado) {
          novasSelecionadas[jaExiste] = { ...novasSelecionadas[jaExiste], valor_orcado: valor }
        }
      } else {
        novasSelecionadas.push({ categoria_id: catId, valor_orcado: valor, prioridade: 'importante' })
      }
    })

    setCategoriasReceitaSelecionadas(novasSelecionadas)
    dismissSugestao()
  }

  // Filtrar categorias de receita principais
  const categoriasReceita = useMemo(
    () =>
      categorias.filter((c) => c.tipo === 'receita' && !c.categoria_pai_id).sort((a, b) => a.nome.localeCompare(b.nome)),
    [categorias]
  )

  // Filtrar apenas categorias de despesa principais
  const categoriasDespesa = useMemo(
    () =>
      categorias.filter((c) => c.tipo === 'despesa' && !c.categoria_pai_id).sort((a, b) => a.nome.localeCompare(b.nome)),
    [categorias]
  )

  // Categorias filtradas pelo termo de busca
  const categoriasReceitaFiltradas = useMemo(
    () =>
      filtroReceita
        ? categoriasReceita.filter((c) => c.nome.toLowerCase().includes(filtroReceita.toLowerCase()))
        : categoriasReceita,
    [categoriasReceita, filtroReceita]
  )

  const categoriasDespesaFiltradas = useMemo(
    () =>
      filtroDespesa
        ? categoriasDespesa.filter((c) => c.nome.toLowerCase().includes(filtroDespesa.toLowerCase()))
        : categoriasDespesa,
    [categoriasDespesa, filtroDespesa]
  )

  // Inicializar formulário com dados do orçamento existente
  useEffect(() => {
    if (orcamento) {
      setMetaPoupanca(orcamento.meta_poupanca || 0)
      setMetaPoupancaPercentual(orcamento.meta_poupanca_percentual)
      setTipoMeta(orcamento.meta_poupanca_percentual ? 'percentual' : 'valor')

      // Carregar categorias budget existentes (separar receitas e despesas)
      const categoriasDoOrcamento = categoriasBudget.filter((cb) => cb.orcamento_id === orcamento.id)

      const receitas = categoriasDoOrcamento
        .filter((cb) => {
          const categoria = categorias.find((c) => c.id === cb.categoria_id)
          return categoria?.tipo === 'receita'
        })
        .map((cb) => ({
          categoria_id: cb.categoria_id,
          valor_orcado: cb.valor_orcado,
          prioridade: cb.prioridade,
        }))

      const despesas = categoriasDoOrcamento
        .filter((cb) => {
          const categoria = categorias.find((c) => c.id === cb.categoria_id)
          return categoria?.tipo === 'despesa'
        })
        .map((cb) => ({
          categoria_id: cb.categoria_id,
          valor_orcado: cb.valor_orcado,
          prioridade: cb.prioridade,
        }))

      setCategoriasReceitaSelecionadas(receitas)
      setCategoriasDespesaSelecionadas(despesas)
    }
  }, [orcamento, categoriasBudget, categorias])

  // Cálculos
  const totalReceitasCategorias = categoriasReceitaSelecionadas.reduce((sum, c) => sum + c.valor_orcado, 0)
  // Incluir retiradas de caixinhas no total de receitas
  const totalReceitasPlanejadas = totalReceitasCategorias + totalRetiradasCaixinhas
  const totalDespesasPlanejadas = categoriasDespesaSelecionadas.reduce((sum, c) => sum + c.valor_orcado, 0)
  const metaReal = tipoMeta === 'percentual' && metaPoupancaPercentual
    ? (totalReceitasCategorias * metaPoupancaPercentual) / 100 // Meta baseada apenas em receitas regulares
    : metaPoupanca
  const totalNecessario = totalDespesasPlanejadas + metaReal
  const saldo = totalReceitasPlanejadas - totalNecessario
  const isValid = saldo >= 0

  const handleToggleCategoriaReceita = (categoria: Categoria) => {
    const exists = categoriasReceitaSelecionadas.find((c) => c.categoria_id === categoria.id)

    if (exists) {
      setCategoriasReceitaSelecionadas((prev) => prev.filter((c) => c.categoria_id !== categoria.id))
    } else {
      setCategoriasReceitaSelecionadas((prev) => [
        ...prev,
        { categoria_id: categoria.id, valor_orcado: 0, prioridade: 'importante' },
      ])
    }
  }

  const handleToggleCategoriaDespesa = (categoria: Categoria) => {
    const exists = categoriasDespesaSelecionadas.find((c) => c.categoria_id === categoria.id)

    if (exists) {
      setCategoriasDespesaSelecionadas((prev) => prev.filter((c) => c.categoria_id !== categoria.id))
    } else {
      if (categoriasDespesaSelecionadas.length >= envelopeLimit) {
        toast.error(`Limite do Explorador atingido (${envelopeLimit} envelopes). Assine o Planejador para adicionar mais.`)
        return
      }
      setCategoriasDespesaSelecionadas((prev) => [
        ...prev,
        { categoria_id: categoria.id, valor_orcado: 0, prioridade: 'importante' },
      ])
    }
  }

  const handleUpdateValorReceita = (categoriaId: string, valor: number) => {
    setCategoriasReceitaSelecionadas((prev) =>
      prev.map((c) => (c.categoria_id === categoriaId ? { ...c, valor_orcado: valor } : c))
    )
  }

  const handleUpdateValorDespesa = (categoriaId: string, valor: number) => {
    setCategoriasDespesaSelecionadas((prev) =>
      prev.map((c) => (c.categoria_id === categoriaId ? { ...c, valor_orcado: valor } : c))
    )
  }

  const handleUpdatePrioridadeDespesa = (categoriaId: string, prioridade: CategoriaPrioridade) => {
    setCategoriasDespesaSelecionadas((prev) =>
      prev.map((c) => (c.categoria_id === categoriaId ? { ...c, prioridade } : c))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValid) {
      alert('O orçamento está desbalanceado! Receitas devem ser >= Despesas + Poupança')
      return
    }

    if (categoriasReceitaSelecionadas.length === 0 && categoriasDespesaSelecionadas.length === 0) {
      alert('Selecione ao menos uma categoria (receita ou despesa) para orçar')
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

      // Criar/atualizar categorias budget (receitas + despesas)
      if (orcamentoId) {
        const todasCategorias = [...categoriasReceitaSelecionadas, ...categoriasDespesaSelecionadas]
        // Usar a nova função que substitui as categorias existentes
        await bulkCreateCategoriasBudget({
          orcamento_id: orcamentoId,
          categorias: todasCategorias,
          substituir_existentes: true, // Importante: deletar categorias antigas antes de criar novas
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
      maxWidth="5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Layout de 2 colunas para telas maiores */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Coluna 1: Receitas */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-400" />
                Receitas Previstas ({categoriasReceitaSelecionadas.length} categorias)
              </h3>

              {/* Sugestão: receitas pendentes do mês */}
              {receitasPendentesMes.length > 0 && !sugestaoReceitasDismissed && (
                <div className="mb-3 flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <Clock size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-yellow-300">
                      Você tem {receitasPendentesMes.length} receita{receitasPendentesMes.length > 1 ? 's' : ''} pendente{receitasPendentesMes.length > 1 ? 's' : ''} no mês ({formatCurrency(totalReceitasPendentes)})
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Deseja usar esses valores como base para o planejamento de receitas?
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAplicarReceitasPendentes}
                      className="text-xs"
                    >
                      Incluir
                    </Button>
                    <button
                      type="button"
                      onClick={dismissSugestao}
                      className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Busca de Receitas */}
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  value={filtroReceita}
                  onChange={(e) => setFiltroReceita(e.target.value)}
                  placeholder="Buscar categoria de receita..."
                  className="pl-9"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {categoriasReceitaFiltradas.map((categoria) => {
                  const selecionada = categoriasReceitaSelecionadas.find((c) => c.categoria_id === categoria.id)

                  return (
                    <div
                      key={categoria.id}
                      className={cn(
                        'border rounded-lg transition-all',
                        selecionada ? 'border-green-500 bg-green-500/5' : 'border-dark-600 bg-dark-700/30'
                      )}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <button
                          type="button"
                          onClick={() => handleToggleCategoriaReceita(categoria)}
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                            selecionada
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-600 hover:border-green-500'
                          )}
                        >
                          {selecionada && <Check size={14} className="text-white" />}
                        </button>

                        <IconRenderer iconName={categoria.icone} size={20} className="text-gray-300 shrink-0" />
                        <span className="font-medium text-gray-200 flex-1 truncate">{categoria.nome}</span>

                        {selecionada && (
                          <div className="w-32 shrink-0">
                            <CurrencyInput
                              value={selecionada.valor_orcado}
                              onChange={(valor) => handleUpdateValorReceita(categoria.id, valor)}
                              placeholder="R$ 0,00"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {categoriasReceitaFiltradas.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {filtroReceita ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria de receita disponível'}
                  </p>
                )}
              </div>

              {/* Receitas de Caixinhas */}
              {retiradasCaixinhas.length > 0 && (
                <div className="mt-4 pt-4 border-t border-dark-700">
                  <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
                    <PiggyBank size={14} className="text-primary-400" />
                    Receitas de Caixinhas ({retiradasCaixinhas.length})
                  </h4>
                  <div className="space-y-2">
                    {retiradasCaixinhas.map((retirada) => (
                      <div
                        key={retirada.id}
                        className="flex items-center gap-3 p-2 bg-primary-500/5 border border-primary-500/30 rounded-lg"
                      >
                        <span className="text-lg">{retirada.caixinha_icone || '💰'}</span>
                        <span className="text-sm text-gray-200 flex-1 truncate">
                          {retirada.caixinha_nome}
                        </span>
                        <span className="text-sm font-semibold text-primary-400">
                          {formatCurrency(retirada.valor)}
                        </span>
                        <button
                          onClick={async () => {
                            if (!confirm(`Remover aporte de ${formatCurrency(retirada.valor)} da ${retirada.caixinha_nome} deste orçamento? O valor voltará para a caixinha.`)) return
                            await deleteTransacaoCaixinha(retirada.id, retirada.caixinha_id)
                          }}
                          className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                          title="Remover do orçamento"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Valores retirados de caixinhas para compor este mês
                  </p>
                </div>
              )}

              {/* Resumo de Receitas */}
              <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-green-400">Total de Receitas: </span>
                  {formatCurrency(totalReceitasPlanejadas)}
                  {totalRetiradasCaixinhas > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      (categorias: {formatCurrency(totalReceitasCategorias)} + caixinhas: {formatCurrency(totalRetiradasCaixinhas)})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Meta de Poupança */}
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

                {tipoMeta === 'percentual' && metaPoupancaPercentual && totalReceitasPlanejadas > 0 && (
                  <p className="text-xs text-gray-400">
                    = {formatCurrency(metaReal)} ({metaPoupancaPercentual}% de {formatCurrency(totalReceitasPlanejadas)})
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Coluna 2: Despesas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Despesas Previstas ({categoriasDespesaSelecionadas.length} categorias)
            </h3>

            {/* Busca de Despesas */}
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input
                value={filtroDespesa}
                onChange={(e) => setFiltroDespesa(e.target.value)}
                placeholder="Buscar categoria de despesa..."
                className="pl-9"
              />
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {categoriasDespesaFiltradas.map((categoria) => {
                const selecionada = categoriasDespesaSelecionadas.find((c) => c.categoria_id === categoria.id)

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
                        onClick={() => handleToggleCategoriaDespesa(categoria)}
                        className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                          selecionada
                            ? 'bg-primary-500 border-primary-500'
                            : 'border-gray-600 hover:border-primary-500'
                        )}
                      >
                        {selecionada && <Check size={14} className="text-white" />}
                      </button>

                      <IconRenderer iconName={categoria.icone} size={20} className="text-gray-300 shrink-0" />
                      <span className="font-medium text-gray-200 flex-1 truncate">{categoria.nome}</span>

                      {selecionada && (
                        <span className="text-sm text-primary-400 font-medium shrink-0">
                          {formatCurrency(selecionada.valor_orcado)}
                        </span>
                      )}
                    </div>

                    {selecionada && (
                      <div className="px-3 pb-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Valor Orçado</label>
                          <CurrencyInput
                            value={selecionada.valor_orcado}
                            onChange={(value) => handleUpdateValorDespesa(categoria.id, value)}
                            placeholder="R$ 0,00"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Prioridade</label>
                          <Select
                            value={selecionada.prioridade}
                            onChange={(e) =>
                              handleUpdatePrioridadeDespesa(categoria.id, e.target.value as CategoriaPrioridade)
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

              {categoriasDespesaFiltradas.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  {filtroDespesa ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria de despesa disponível'}
                </p>
              )}
            </div>

            {/* Resumo de Despesas */}
            <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
              <p className="text-sm text-gray-300">
                <span className="font-semibold text-red-400">Total de Despesas: </span>
                {formatCurrency(totalDespesasPlanejadas)}
              </p>
            </div>
          </div>
        </div>

        {/* Seção de Resumo e Validação */}
        <div
          className={cn(
            'p-4 rounded-lg border-2',
            isValid
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          )}
        >
          <div className="grid sm:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-2 bg-dark-800/50 rounded-lg">
              <span className="block text-gray-400 text-xs mb-1">Receitas</span>
              <span className="font-semibold text-green-400">{formatCurrency(totalReceitasPlanejadas)}</span>
            </div>

            <div className="text-center p-2 bg-dark-800/50 rounded-lg">
              <span className="block text-gray-400 text-xs mb-1">Despesas</span>
              <span className="font-semibold text-red-400">{formatCurrency(totalDespesasPlanejadas)}</span>
            </div>

            <div className="text-center p-2 bg-dark-800/50 rounded-lg">
              <span className="block text-gray-400 text-xs mb-1">Poupança</span>
              <span className="font-semibold text-yellow-400">{formatCurrency(metaReal)}</span>
            </div>

            <div className="text-center p-2 bg-dark-800/50 rounded-lg">
              <span className="block text-gray-400 text-xs mb-1">Saldo</span>
              <div className="flex items-center justify-center gap-1">
                <span className={cn('font-bold', isValid ? 'text-green-400' : 'text-red-400')}>
                  {formatCurrency(saldo)}
                </span>
                {isValid ? (
                  <Check size={16} className="text-green-400" />
                ) : (
                  <AlertTriangle size={16} className="text-red-400" />
                )}
              </div>
            </div>
          </div>

          {!isValid && (
            <p className="text-xs text-red-400 mt-3 text-center">
              Orçamento desbalanceado! Reduza despesas ou aumente receitas.
            </p>
          )}
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-2">
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
