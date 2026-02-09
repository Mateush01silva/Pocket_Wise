import { useEffect, useState, useRef, useMemo } from 'react'
import { Filter, TrendingDown, AlertCircle, Plus, Copy, Calendar, Edit2, Trash2, Wallet } from 'lucide-react'
import { format, startOfMonth, parseISO, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { EnvelopeCard } from '../components/EnvelopeCard'
import { CategoryTransactionsModal } from '../components/CategoryTransactionsModal'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { DetectorEstouro } from '../components/DetectorEstouro'
import { FechamentoMesPassado } from '../components/FechamentoMesPassado'
import { BudgetPlanningModal } from '../components/BudgetPlanningModal'
import { HealthIndicator } from '../components/HealthIndicator'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { useTransacoesStore } from '../store/useTransacoesStore'
import { useCategoriasStore } from '../store/useCategoriasStore'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import type { EnvelopeDigital } from '../types'

type FiltroCategoria = 'todas' | 'essencial' | 'importante' | 'desejavel' | 'estouradas' | 'em_risco'
type OrdenacaoCategoria = 'nome' | 'percentual_desc' | 'percentual_asc' | 'valor_desc'

export function Envelopes() {
  const mesRealAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const [mesAtual, setMesAtual] = useState(mesRealAtual)
  const [filtro, setFiltro] = useState<FiltroCategoria>('todas')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoCategoria>('percentual_desc')
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string | null>(null)
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const isMounted = useRef(true)

  // Store selectors
  const orcamentoAtual = useOrcamentosStore((state) => state.orcamentoAtual)
  const categoriasBudget = useOrcamentosStore((state) => state.categoriasBudget)
  const getCategoriasBudgetComDados = useOrcamentosStore((state) => state.getCategoriasBudgetComDados)
  const isLoading = useOrcamentosStore((state) => state.isLoading)
  const initialize = useOrcamentosStore((state) => state.initialize)
  const initialized = useOrcamentosStore((state) => state.initialized)
  const fetchCategoriasBudget = useOrcamentosStore((state) => state.fetchCategoriasBudget)
  const getEnvelopesDigitais = useOrcamentosStore((state) => state.getEnvelopesDigitais)
  const getOrcamentoDoMes = useOrcamentosStore((state) => state.getOrcamentoDoMes)
  const setOrcamentoAtual = useOrcamentosStore((state) => state.setOrcamentoAtual)
  const getProjecaoMensal = useOrcamentosStore((state) => state.getProjecaoMensal)
  const copiarOrcamentoMesAnterior = useOrcamentosStore((state) => state.copiarOrcamentoMesAnterior)
  const createOrcamento = useOrcamentosStore((state) => state.createOrcamento)
  const deleteOrcamento = useOrcamentosStore((state) => state.deleteOrcamento)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)
  // Subscrição às transações de caixinhas para atualizar saldo quando houver retiradas
  const transacoesCaixinhas = useCaixinhasStore((state) => state.transacoes)

  // Detectar se é mês passado (já fechado)
  const isMesPassado = isBefore(parseISO(mesAtual), startOfMonth(new Date()))

  useEffect(() => {
    isMounted.current = true

    if (!initialized) {
      initialize()
    }

    return () => {
      isMounted.current = false
    }
  }, [initialized, initialize])

  useEffect(() => {
    isMounted.current = true

    if (initialized) {
      const orcamento = getOrcamentoDoMes(mesAtual)
      if (isMounted.current) {
        // Setar orçamento diretamente (sem disparar fetchCategoriasBudget interno)
        // e fazer o fetch explicitamente para garantir que completa antes de renderizar
        if (orcamento) {
          useOrcamentosStore.setState({ orcamentoAtual: orcamento })
          fetchCategoriasBudget(orcamento.id)
        } else {
          useOrcamentosStore.setState({ orcamentoAtual: null })
        }
      }
    }

    return () => {
      isMounted.current = false
    }
  }, [initialized, mesAtual, getOrcamentoDoMes, fetchCategoriasBudget])

  const handleCurrentMonth = () => {
    setMesAtual(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  }

  const handleEnvelopeClick = (envelope: EnvelopeDigital) => {
    setSelectedEnvelopeId(envelope.id)
  }

  const handleCloseModal = () => {
    setSelectedEnvelopeId(null)
  }

  // Funções de orçamento
  const handleCopiarMesAnterior = async () => {
    if (isMounted.current) setIsCreating(true)
    try {
      const novoOrcamento = await copiarOrcamentoMesAnterior(mesAtual)
      if (novoOrcamento && isMounted.current) {
        setOrcamentoAtual(novoOrcamento)
      }
    } finally {
      if (isMounted.current) setIsCreating(false)
    }
  }

  const handleCriarDoZero = async () => {
    if (isMounted.current) setIsCreating(true)
    try {
      const novoOrcamento = await createOrcamento({
        family_id: 'local-storage-family',
        mes_referencia: mesAtual,
        meta_poupanca: 0,
        meta_poupanca_percentual: null,
        dia_inicio_ciclo: 1,
        metodo_calculo: 'conservador',
        status: 'ativo',
      })
      if (novoOrcamento && isMounted.current) {
        setOrcamentoAtual(novoOrcamento)
        setIsPlanningModalOpen(true) // Abre o modal para configurar
      }
    } catch (error) {
      console.error('Erro ao criar orçamento:', error)
      alert('Erro ao criar orçamento. Tente novamente.')
    } finally {
      if (isMounted.current) setIsCreating(false)
    }
  }

  const handleDeleteOrcamento = async () => {
    if (!orcamentoAtual) return

    const mesFormatado = format(parseISO(mesAtual), 'MMMM yyyy', { locale: ptBR })
    const confirmacao = confirm(
      `Tem certeza que deseja excluir o orçamento de ${mesFormatado}?\n\n` +
      'Esta ação é IRREVERSÍVEL e irá apagar:\n' +
      '• Todas as categorias orçadas\n' +
      '• Todos os envelopes digitais\n\n' +
      'As transações não serão afetadas.'
    )

    if (!confirmacao) return

    try {
      await deleteOrcamento(orcamentoAtual.id)
      setOrcamentoAtual(null)
      alert(`Orçamento de ${mesFormatado} excluído com sucesso!`)
    } catch (error) {
      console.error('Erro ao deletar orçamento:', error)
      alert('Erro ao excluir orçamento. Tente novamente.')
    }
  }

  // Projeção do orçamento - recalcula quando transações de caixinhas ou categorias budget mudam
  const projecao = useMemo(() => {
    if (!orcamentoAtual) return null
    return getProjecaoMensal(orcamentoAtual.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoAtual, getProjecaoMensal, transacoesCaixinhas, categoriasBudget, lancamentos])

  // Filtrar transações do envelope selecionado
  // Inclui 'pago' e 'projetado' para corresponder ao cálculo de valor_gasto
  const getEnvelopeTransactions = (envelope: EnvelopeDigital | null) => {
    if (!envelope || !orcamentoAtual) return []

    const anoMes = orcamentoAtual.mes_referencia.substring(0, 7)
    return lancamentos.filter(
      (l) =>
        l.categoria_id === envelope.categoria.id &&
        l.tipo === 'despesa' &&
        l.data.substring(0, 7) === anoMes &&
        (l.status === 'pago' || l.status === 'projetado')
    ).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }

  if (isLoading || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Carregando envelopes...</div>
      </div>
    )
  }

  if (!orcamentoAtual) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Envelopes Digitais</h1>

          {/* Seletor de Mês e Ano */}
          <div className="flex items-center gap-3 mt-2">
            <MonthYearSelector
              value={mesAtual}
              onChange={setMesAtual}
              hasData={false}
            />
            {mesAtual !== mesRealAtual && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCurrentMonth}
                className="text-xs"
              >
                Hoje
              </Button>
            )}
          </div>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-12 text-center space-y-6">
            <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto">
              <Calendar className="text-primary-500" size={32} />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">
                Nenhum orçamento para {format(parseISO(mesAtual), 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <p className="text-gray-400">
                Crie seu orçamento para começar a controlar seus gastos com envelopes digitais
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={handleCopiarMesAnterior} isLoading={isCreating} disabled={isCreating}>
                <Copy size={16} className="mr-2" />
                Copiar Mês Anterior
              </Button>
              <Button variant="ghost" onClick={handleCriarDoZero} isLoading={isCreating} disabled={isCreating}>
                <Plus size={16} className="mr-2" />
                Criar do Zero
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const todosEnvelopes = getEnvelopesDigitais(orcamentoAtual.id)

  // Aplicar filtros
  let envelopesFiltrados = todosEnvelopes.filter((env) => {
    if (filtro === 'todas') return true
    if (filtro === 'estouradas') return env.status === 'critico'
    if (filtro === 'em_risco') return env.percentual_usado >= 80
    return env.prioridade === filtro
  })

  // Aplicar ordenação
  envelopesFiltrados = [...envelopesFiltrados].sort((a, b) => {
    switch (ordenacao) {
      case 'nome':
        return a.categoria.nome.localeCompare(b.categoria.nome)
      case 'percentual_desc':
        return b.percentual_usado - a.percentual_usado
      case 'percentual_asc':
        return a.percentual_usado - b.percentual_usado
      case 'valor_desc':
        return b.valor_orcado - a.valor_orcado
      default:
        return 0
    }
  })

  // Estatísticas
  const totalOrcado = todosEnvelopes.reduce((sum, env) => sum + env.valor_orcado, 0)
  const totalGasto = todosEnvelopes.reduce((sum, env) => sum + env.valor_gasto, 0)
  const totalDisponivel = todosEnvelopes.reduce((sum, env) => sum + env.valor_disponivel, 0)
  const percentualGeralUsado = totalOrcado > 0 ? (totalGasto / totalOrcado) * 100 : 0

  const envelopesSaudaveis = todosEnvelopes.filter((e) => e.status === 'saudavel').length
  const envelopesAtencao = todosEnvelopes.filter((e) => e.status === 'atencao').length
  const envelopesCriticos = todosEnvelopes.filter((e) => e.status === 'critico').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Envelopes Digitais</h1>

          {/* Seletor de Mês e Ano */}
          <div className="flex items-center gap-3">
            <MonthYearSelector
              value={mesAtual}
              onChange={setMesAtual}
              hasData={!!orcamentoAtual}
            />
            {mesAtual !== mesRealAtual && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCurrentMonth}
                className="text-xs"
              >
                Hoje
              </Button>
            )}
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPlanningModalOpen(true)}
          >
            <Edit2 size={16} className="mr-2" />
            Editar Orçamento
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteOrcamento}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 size={16} className="mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Resumo do Orçamento - Projeção */}
      {projecao && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Saúde */}
              <div className="flex items-center gap-3">
                <HealthIndicator saude={projecao.saude} size="sm" />
                <div>
                  <p className="text-xs text-gray-500">Saúde Financeira</p>
                  <p className="text-sm font-medium text-gray-200 capitalize">{projecao.saude}</p>
                </div>
              </div>

              {/* Saldo Atual */}
              <div>
                <p className="text-xs text-gray-500">Saldo Atual</p>
                <p className={cn('text-lg font-bold', projecao.saldo_atual >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {formatCurrency(projecao.saldo_atual)}
                </p>
              </div>

              {/* Projeção Fim do Mês */}
              <div>
                <p className="text-xs text-gray-500">Projeção Fim do Mês</p>
                <p className={cn('text-lg font-bold', projecao.saldo_projetado_fim_mes >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {formatCurrency(projecao.saldo_projetado_fim_mes)}
                </p>
              </div>

              {/* Progresso */}
              <div className="flex-1 min-w-[200px]">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Orçamento Usado</span>
                  <span className={cn(
                    'font-medium',
                    projecao.percentual_orcamento_usado <= 80 ? 'text-green-400' :
                    projecao.percentual_orcamento_usado <= 100 ? 'text-yellow-400' : 'text-red-400'
                  )}>
                    {projecao.percentual_orcamento_usado.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      projecao.percentual_orcamento_usado <= 80 ? 'bg-green-500' :
                      projecao.percentual_orcamento_usado <= 100 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${Math.min(projecao.percentual_orcamento_usado, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de resumo */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Total Orçado</span>
              <Wallet size={16} className="text-primary-500" />
            </div>
            <p className="text-2xl font-bold text-gray-100">{formatCurrency(totalOrcado)}</p>
            <p className="text-xs text-gray-500 mt-1">{todosEnvelopes.length} envelopes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Total Gasto</span>
              <TrendingDown size={16} className="text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-400">{formatCurrency(totalGasto)}</p>
            <p className="text-xs text-gray-500 mt-1">{percentualGeralUsado.toFixed(1)}% usado</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Disponível</span>
              <TrendingDown size={16} className="text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(totalDisponivel)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {((totalDisponivel / totalOrcado) * 100).toFixed(1)}% restante
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Saúde Geral</span>
              <Filter size={16} className="text-gray-500" />
            </div>
            <div className="flex gap-2 mt-3">
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-green-400">{envelopesSaudaveis}</p>
                <p className="text-xs text-gray-500">OK</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-yellow-400">{envelopesAtencao}</p>
                <p className="text-xs text-gray-500">Atenção</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-red-400">{envelopesCriticos}</p>
                <p className="text-xs text-gray-500">Crítico</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e ordenação */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <span className="text-sm text-gray-400">Filtrar:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={filtro === 'todas' ? 'primary' : 'ghost'}
                onClick={() => setFiltro('todas')}
              >
                Todas ({todosEnvelopes.length})
              </Button>
              <Button
                size="sm"
                variant={filtro === 'essencial' ? 'primary' : 'ghost'}
                onClick={() => setFiltro('essencial')}
              >
                Essenciais
              </Button>
              <Button
                size="sm"
                variant={filtro === 'importante' ? 'primary' : 'ghost'}
                onClick={() => setFiltro('importante')}
              >
                Importantes
              </Button>
              <Button
                size="sm"
                variant={filtro === 'desejavel' ? 'primary' : 'ghost'}
                onClick={() => setFiltro('desejavel')}
              >
                Desejáveis
              </Button>
              <Button
                size="sm"
                variant={filtro === 'em_risco' ? 'danger' : 'ghost'}
                onClick={() => setFiltro('em_risco')}
              >
                Em Risco (≥80%)
              </Button>
              <Button
                size="sm"
                variant={filtro === 'estouradas' ? 'danger' : 'ghost'}
                onClick={() => setFiltro('estouradas')}
              >
                Estouradas
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-400">Ordenar:</span>
              <Select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as OrdenacaoCategoria)}
                className="w-48"
              >
                <option value="percentual_desc">% Usado (maior)</option>
                <option value="percentual_asc">% Usado (menor)</option>
                <option value="valor_desc">Valor (maior)</option>
                <option value="nome">Nome (A-Z)</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detector de Estouro / Fechamento de Mês Passado */}
      {isMesPassado ? (
        <FechamentoMesPassado
          categoriasBudget={getCategoriasBudgetComDados(orcamentoAtual.id)}
          orcamentoId={orcamentoAtual.id}
          mesReferencia={mesAtual}
          onRebalanceado={async () => {
            if (orcamentoAtual) {
              await fetchCategoriasBudget(orcamentoAtual.id)
            }
          }}
        />
      ) : (
        <DetectorEstouro
          categoriasBudget={getCategoriasBudgetComDados(orcamentoAtual.id)}
          orcamentoId={orcamentoAtual.id}
          onRebalanceado={async () => {
            if (orcamentoAtual) {
              await fetchCategoriasBudget(orcamentoAtual.id)
            }
          }}
        />
      )}

      {/* Grid de envelopes */}
      {envelopesFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 text-gray-500" size={48} />
            <h3 className="text-lg font-semibold text-gray-100 mb-2">
              Nenhum envelope encontrado
            </h3>
            <p className="text-gray-400">
              Tente ajustar os filtros para ver mais envelopes
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-gray-400">
            Mostrando {envelopesFiltrados.length} de {todosEnvelopes.length} envelopes
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {envelopesFiltrados.map((envelope) => (
              <EnvelopeCard
                key={envelope.categoria.id}
                envelope={envelope}
                onClick={() => handleEnvelopeClick(envelope)}
              />
            ))}
          </div>
        </>
      )}

      {/* Modal de Transações - dados derivados do store para refletir mudanças em tempo real */}
      {selectedEnvelopeId && orcamentoAtual && (() => {
        const envelope = todosEnvelopes.find(e => e.id === selectedEnvelopeId)
        if (!envelope) return null
        return (
          <CategoryTransactionsModal
            isOpen={true}
            onClose={handleCloseModal}
            categoria={envelope.categoria}
            subcategorias={categorias.filter(c => c.categoria_pai_id === envelope.categoria.id)}
            transacoes={getEnvelopeTransactions(envelope)}
            mesReferencia={orcamentoAtual.mes_referencia}
            valorOrcado={envelope.valor_orcado}
            valorGasto={envelope.valor_gasto}
            categoriaBudgetId={envelope.id}
            prioridade={envelope.prioridade}
          />
        )
      })()}

      {/* Modal de Planejamento/Edição do Orçamento */}
      {orcamentoAtual && (
        <BudgetPlanningModal
          isOpen={isPlanningModalOpen}
          onClose={() => setIsPlanningModalOpen(false)}
          orcamento={orcamentoAtual}
          mesReferencia={mesAtual}
        />
      )}
    </div>
  )
}
