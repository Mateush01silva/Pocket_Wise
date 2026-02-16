import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, Button } from '../components/ui'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus, ArrowUpRight, ArrowDownLeft, Clock, Package, AlertTriangle, Calculator, PiggyBank, Sparkles } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useCategoriasStore } from '../store'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { TransactionModal } from '../components/TransactionModal'
import { HealthIndicator } from '../components/HealthIndicator'
import { DetectorEstouro } from '../components/DetectorEstouro'
import { BankAccountsWidget } from '../components/BankAccountsWidget'
import { UpcomingBillsWidget } from '../components/UpcomingBillsWidget'
import { AlocarSaldoModal } from '../components/AlocarSaldoModal'
import { PeriodFilter, type PeriodFilterValue } from '../components/PeriodFilter'
import { calcularSaldoProjetado, calcularFaturasAtuaisCartao, filtrarPorPeriodo, calcularSaldoAcumuladoNaoAlocado } from '../lib/financialCalculations'
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { LearningTooltip } from '../components/ui/LearningTooltip'
import { learningContent } from '../lib/learningContent'
import { PossoComprarFloating } from '../components/PossoComprarFloating'

export function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAlocarSaldoModalOpen, setIsAlocarSaldoModalOpen] = useState(false)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>({
    tipo: 'mes-atual',
    dataInicio: startOfMonth(new Date()),
    dataFim: endOfMonth(new Date()),
  })
  const isMounted = useRef(true) // Track if component is mounted
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)
  const navigate = useNavigate()

  // Caixinhas store para alocação de saldo
  const caixinhasInitialized = useCaixinhasStore((state) => state.initialized)
  const initializeCaixinhas = useCaixinhasStore((state) => state.initialize)
  const caixinhas = useCaixinhasStore((state) => state.caixinhas)
  const fetchTransacoesCaixinha = useCaixinhasStore((state) => state.fetchTransacoes)
  const transacoesCaixinhas = useCaixinhasStore((state) => state.transacoes)

  // Budget store
  // Use selectors for each value/function to keep identities stable
  const orcamentoAtual = useOrcamentosStore((state) => state.orcamentoAtual)
  const getCategoriasBudgetComDados = useOrcamentosStore((state) => state.getCategoriasBudgetComDados)
  const initializeOrcamentos = useOrcamentosStore((state) => state.initialize)
  const orcamentosInitialized = useOrcamentosStore((state) => state.initialized)
  const getOrcamentoDoMes = useOrcamentosStore((state) => state.getOrcamentoDoMes)
  const getProjecaoMensal = useOrcamentosStore((state) => state.getProjecaoMensal)
  const getEnvelopesDigitais = useOrcamentosStore((state) => state.getEnvelopesDigitais)
  const setOrcamentoAtual = useOrcamentosStore((state) => state.setOrcamentoAtual)


  // Initialize budget store
  useEffect(() => {
    isMounted.current = true

    if (!orcamentosInitialized) {
      initializeOrcamentos().catch(err => {
        if (isMounted.current) {
          console.error('Erro ao inicializar orçamentos:', err)
        }
      })
    }

    return () => {
      isMounted.current = false
    }
  }, [orcamentosInitialized, initializeOrcamentos])

  // Load current month's budget
  useEffect(() => {
    isMounted.current = true

    if (orcamentosInitialized) {
      try {
        const mesReferencia = format(startOfMonth(new Date()), 'yyyy-MM-dd')
        const orcamento = getOrcamentoDoMes(mesReferencia)

        // Sempre atualizar o orcamentoAtual com o orçamento do mês atual
        // Isso garante que mesmo após navegar em Envelopes, o Dashboard mostre o mês correto
        if (isMounted.current) {
          setOrcamentoAtual(orcamento || null)
        }
      } catch (err) {
        if (isMounted.current) {
          console.error('Erro ao carregar orçamento do mês:', err)
        }
      }
    }

    return () => {
      isMounted.current = false
    }
  }, [orcamentosInitialized, getOrcamentoDoMes, setOrcamentoAtual])

  // Initialize caixinhas store
  useEffect(() => {
    if (!caixinhasInitialized) {
      initializeCaixinhas().catch(err => {
        console.error('Erro ao inicializar caixinhas:', err)
      })
    }
  }, [caixinhasInitialized, initializeCaixinhas])

  // Buscar transações das caixinhas ativas para calcular alocações já feitas
  useEffect(() => {
    if (caixinhasInitialized && caixinhas.length > 0) {
      caixinhas
        .filter(c => c.ativa)
        .forEach(c => {
          fetchTransacoesCaixinha(c.id).catch(err => {
            console.error('Erro ao buscar transações da caixinha:', err)
          })
        })
    }
  }, [caixinhasInitialized, caixinhas, fetchTransacoesCaixinha])


  // Stable callbacks to prevent render loops
  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  // Get category name by id
  const getCategoryName = useCallback((categoriaId: string | null) => {
    if (!categoriaId) return 'Sem categoria'
    const categoria = categorias.find(c => c.id === categoriaId)
    return categoria?.nome || 'Categoria desconhecida'
  }, [categorias])

  // Calcular stats usando os filtros de período
  const lancamentosFiltrados = filtrarPorPeriodo(lancamentos, periodFilter.dataInicio, periodFilter.dataFim)

  // Saldo do Período (Receitas - Despesas lançadas no período)
  const { receitasTotal, despesasTotal, saldoProjetado } = calcularSaldoProjetado(
    lancamentos,
    periodFilter.dataInicio,
    periodFilter.dataFim
  )

  // Faturas de cartão ATUAIS (todas as não pagas)
  const faturasCartaoAtuais = calcularFaturasAtuaisCartao(lancamentos)

  // Backward compatibility (para não quebrar código que usa essas variáveis)
  const receitas = receitasTotal
  const despesas = despesasTotal
  const saldo = saldoProjetado
  const lancamentosMes = lancamentosFiltrados

  // Calcular saldo acumulado de todos os meses anteriores não alocados
  // Flatten das transações de caixinhas para a função de cálculo
  const todasTransacoesCaixinhas = useMemo(() => {
    return Object.values(transacoesCaixinhas).flat()
  }, [transacoesCaixinhas])

  // Calcular saldo acumulado disponível para alocação
  const { totalDisponivel: saldoAcumuladoDisponivel, mesesComSaldo } = useMemo(() => {
    return calcularSaldoAcumuladoNaoAlocado(lancamentos, todasTransacoesCaixinhas)
  }, [lancamentos, todasTransacoesCaixinhas])

  // Total já alocado (para mostrar na mensagem)
  const totalJaAlocado = useMemo(() => {
    return todasTransacoesCaixinhas
      .filter(t => t.tipo === 'deposito' && t.origem_mes_referencia)
      .reduce((sum, t) => sum + t.valor, 0)
  }, [todasTransacoesCaixinhas])

  // Saldo disponível para alocar (alias para compatibilidade)
  const saldoMesAnterior = saldoAcumuladoDisponivel

  // Verificar se deve mostrar sugestão de alocação (saldo positivo e caixinhas existem)
  const mostrarSugestaoAlocacao = useMemo(() => {
    return saldoMesAnterior > 0 && caixinhasInitialized && caixinhas.some(c => c.ativa)
  }, [saldoMesAnterior, caixinhasInitialized, caixinhas])

  // Get recent transactions (last 5) - ordenar por data de cadastro (created_at)
  const transacoesRecentes = [...lancamentos]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // Chart data - Gastos por Categoria (apenas despesas do mês atual) - SEM useMemo para evitar loops
  const despesasMes = lancamentosMes.filter(l => l.tipo === 'despesa')

  const grouped = despesasMes.reduce((acc, lancamento) => {
    const catId = lancamento.categoria_id || 'sem-categoria'
    if (!acc[catId]) {
      acc[catId] = {
        categoria_id: catId,
        nome: getCategoryName(lancamento.categoria_id),
        total: 0,
        cor: categorias.find(c => c.id === catId)?.cor || '#6B7280'
      }
    }
    acc[catId].total += lancamento.valor
    return acc
  }, {} as Record<string, { categoria_id: string; nome: string; total: number; cor: string }>)

  const gastosPorCategoriaRaw = Object.values(grouped)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10) // Top 10

  const totalDespesasMes = gastosPorCategoriaRaw.reduce((sum, g) => sum + g.total, 0)

  const gastosPorCategoria = gastosPorCategoriaRaw.map(g => ({
    ...g,
    percentual: totalDespesasMes > 0 ? (g.total / totalDespesasMes) * 100 : 0,
  }))

  // Chart data - Receitas x Despesas (últimos 6 meses) - SEM useMemo para evitar loops
  const hoje = new Date()
  const mesesData = []
  for (let i = 5; i >= 0; i--) {
    const mesData = subMonths(hoje, i)
    const inicio = startOfMonth(mesData)
    const fim = endOfMonth(mesData)

    const lancamentosMesIteracao = lancamentos.filter(l => {
      const dataLancamento = new Date(l.data)
      return dataLancamento >= inicio && dataLancamento <= fim
    })

    const receitasMes = lancamentosMesIteracao
      .filter(l => l.tipo === 'receita')
      .reduce((sum, l) => sum + l.valor, 0)

    const despesasMes = lancamentosMesIteracao
      .filter(l => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0)

    mesesData.push({
      mes: format(mesData, 'MMM/yy', { locale: ptBR }),
      receitas: receitasMes,
      despesas: despesasMes,
    })
  }
  const receitasDespesasPorMes = mesesData

  // Budget data - only calculate if all stores are initialized and have data
  let projecao = null
  let envelopes: any[] = []
  let envelopesEmRisco: any[] = []
  let envelopesCriticos: any[] = []

  try {
    if (orcamentoAtual && orcamentosInitialized && lancamentos.length >= 0 && categorias.length > 0) {
      projecao = getProjecaoMensal(orcamentoAtual.id)
      envelopes = getEnvelopesDigitais(orcamentoAtual.id)
      envelopesEmRisco = envelopes.filter(e => e.percentual_usado >= 80 && e.status !== 'critico')
      envelopesCriticos = envelopes.filter(e => e.status === 'critico')
    }
  } catch (err) {
    console.error('Erro ao calcular dados de orçamento:', err)
  }

  // Chart colors
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Dashboard</h1>
          <p className="text-gray-400">Visão geral das suas finanças</p>
        </div>
        <Button onClick={handleOpenModal} className="gap-2">
          <Plus className="w-5 h-5" />
          Nova Transação
        </Button>
      </div>

      {/* Filtro de Período */}
      <Card>
        <CardContent>
          <PeriodFilter value={periodFilter} onChange={setPeriodFilter} />
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Receitas do Período */}
        <LearningTooltip content={learningContent.receitas} position="bottom">
          <Card hover>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">Receitas</p>
                  <p className="text-2xl font-bold text-gray-100">{formatCurrency(receitas)}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {receitas > 0 ? 'Recebido e a receber' : 'Nenhuma receita'}
              </p>
            </CardContent>
          </Card>
        </LearningTooltip>

        {/* Despesas do Período */}
        <LearningTooltip content={learningContent.despesas} position="bottom">
          <Card hover>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">Despesas</p>
                  <p className="text-2xl font-bold text-gray-100">{formatCurrency(despesas)}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-6 h-6 text-red-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {despesas > 0 ? 'Pago e a pagar' : 'Nenhuma despesa'}
              </p>
            </CardContent>
          </Card>
        </LearningTooltip>

        {/* Saldo do Período */}
        <LearningTooltip content={learningContent.saldoDoPeriodo} position="bottom">
          <Card hover className={`ring-2 ${saldo >= 0 ? 'ring-green-500/30' : 'ring-red-500/30'}`}>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">Saldo do Período</p>
                  <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(saldo)}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-lg ${saldo >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'} flex items-center justify-center shrink-0`}>
                  <Calculator className={`w-6 h-6 ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Receitas - Despesas
              </p>
            </CardContent>
          </Card>
        </LearningTooltip>

        {/* Saldo Projetado (baseado no orçamento) */}
        <LearningTooltip content={learningContent.saldoProjetado} position="bottom">
          <Card hover>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">Saldo Projetado</p>
                  <p className="text-2xl font-bold text-gray-100">
                    {formatCurrency(projecao?.saldo_projetado_fim_mes ?? saldo)}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-lg ${(projecao?.saldo_projetado_fim_mes ?? saldo) >= 0 ? 'bg-primary-500/10' : 'bg-red-500/10'} flex items-center justify-center shrink-0`}>
                  <Wallet className={`w-6 h-6 ${(projecao?.saldo_projetado_fim_mes ?? saldo) >= 0 ? 'text-primary-400' : 'text-red-400'}`} />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {projecao ? 'Baseado no orçamento' : 'Receitas - Despesas'}
              </p>
            </CardContent>
          </Card>
        </LearningTooltip>

        {/* Próximas Faturas */}
        <LearningTooltip content={learningContent.proximasFaturas} position="bottom">
          <Card hover>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">Próximas Faturas</p>
                  <p className="text-2xl font-bold text-gray-100">{formatCurrency(faturasCartaoAtuais)}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-secondary-500/10 flex items-center justify-center shrink-0">
                  <CreditCard className="w-6 h-6 text-secondary-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {faturasCartaoAtuais > 0 ? 'Total não pago' : 'Nenhuma fatura'}
              </p>
            </CardContent>
          </Card>
        </LearningTooltip>
      </div>

      {/* Bank Accounts Widget - Saldo em Contas */}
      <BankAccountsWidget />

      {/* Budget Section */}
      {orcamentoAtual && projecao && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Budget Health Card */}
          <LearningTooltip content={learningContent.saudeFinanceira} position="bottom">
            <Card hover>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Saúde Financeira</p>
                    <p className="text-lg font-semibold text-gray-100 capitalize">
                      {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
                    </p>
                  </div>
                  <HealthIndicator saude={projecao.saude} size="lg" showLabel={false} />
                </div>

                <div className="space-y-3 pt-3 border-t border-dark-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Orçamento usado:</span>
                    <span className="font-medium text-gray-200">
                      {projecao.percentual_orcamento_usado.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Mês decorrido:</span>
                    <span className="font-medium text-gray-200">
                      {projecao.percentual_mes_decorrido.toFixed(1)}%
                    </span>
                  </div>
                  {projecao.saude === 'saudavel' && (
                    <div className="pt-2">
                      <p className="text-xs text-green-400">✓ Gastos dentro do esperado</p>
                    </div>
                  )}
                  {projecao.saude === 'atencao' && (
                    <div className="pt-2">
                      <p className="text-xs text-yellow-400">⚠ Atenção aos gastos</p>
                    </div>
                  )}
                  {projecao.saude === 'critico' && (
                    <div className="pt-2">
                      <p className="text-xs text-red-400">⚠ Gastos acima do planejado</p>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => navigate('/app/envelopes')}
                >
                  Ver Envelopes
                </Button>
              </CardContent>
            </Card>
          </LearningTooltip>

          {/* Projected Balance Card */}
          <LearningTooltip content={learningContent.saldoProjetadoFimMes} position="bottom">
            <Card hover>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm text-gray-400 mb-1">Saldo Projetado Fim do Mês</p>
                    <p className="text-2xl font-bold text-gray-100">
                      {formatCurrency(projecao.saldo_projetado_fim_mes)}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${
                    projecao.saldo_projetado_fim_mes >= orcamentoAtual.meta_poupanca
                      ? 'bg-green-500/10'
                      : 'bg-yellow-500/10'
                  } flex items-center justify-center shrink-0`}>
                    <Wallet className={`w-6 h-6 ${
                      projecao.saldo_projetado_fim_mes >= orcamentoAtual.meta_poupanca
                        ? 'text-green-400'
                        : 'text-yellow-400'
                    }`} />
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-dark-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Meta de poupança:</span>
                    <span className="font-medium text-gray-200">
                      {formatCurrency(orcamentoAtual.meta_poupanca)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Diferença:</span>
                    <span className={`font-medium ${
                      projecao.saldo_projetado_fim_mes >= orcamentoAtual.meta_poupanca
                        ? 'text-green-400'
                        : 'text-yellow-400'
                    }`}>
                      {formatCurrency(projecao.saldo_projetado_fim_mes - orcamentoAtual.meta_poupanca)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </LearningTooltip>

          {/* Envelopes at Risk Card */}
          <LearningTooltip content={learningContent.envelopesDigitais} position="bottom">
            <Card hover>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Envelopes Digitais</p>
                    <p className="text-2xl font-bold text-gray-100">{envelopes.length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-primary-400" />
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-dark-700">
                  {envelopesCriticos.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400">Estourados:</span>
                      </div>
                      <span className="font-medium text-red-400">{envelopesCriticos.length}</span>
                    </div>
                  )}
                  {envelopesEmRisco.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400">Em risco (≥80%):</span>
                      </div>
                      <span className="font-medium text-yellow-400">{envelopesEmRisco.length}</span>
                    </div>
                  )}
                  {envelopesCriticos.length === 0 && envelopesEmRisco.length === 0 && (
                    <p className="text-sm text-green-400">✓ Todos os envelopes saudáveis</p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => navigate('/app/envelopes')}
                >
                  Ver Todos os Envelopes
                </Button>
              </CardContent>
            </Card>
          </LearningTooltip>
        </div>
      )}

      {/* Detector de Estouro */}
      {orcamentoAtual && (
        <DetectorEstouro
          categoriasBudget={getCategoriasBudgetComDados(orcamentoAtual.id)}
          orcamentoId={orcamentoAtual.id}
          onRebalanceado={async () => {
            // Recarregar dados após rebalanceamento
            await initializeOrcamentos()
          }}
        />
      )}

      {/* Budget Empty State */}
      {!orcamentoAtual && orcamentosInitialized && (
        <Card>
          <CardContent className="py-8 text-center">
            <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-100 mb-2">
              Crie seu primeiro orçamento
            </h3>
            <p className="text-gray-400 mb-4 max-w-md mx-auto">
              Comece a planejar suas finanças criando um orçamento mensal.
              Acompanhe seus gastos e veja se pode fazer aquela compra!
            </p>
            <Button onClick={() => navigate('/app/envelopes')}>
              Criar Orçamento
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Bills Widget */}
      <UpcomingBillsWidget />

      {/* Sugestão de Alocação de Saldo */}
      {mostrarSugestaoAlocacao && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-7 h-7 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-100 mb-1">
                  {totalJaAlocado > 0
                    ? 'Ainda tem saldo para alocar!'
                    : mesesComSaldo.length > 1
                      ? 'Você tem saldo acumulado de meses anteriores!'
                      : 'Você terminou o mês passado com saldo positivo!'}
                </h3>
                <p className="text-sm text-gray-400">
                  {totalJaAlocado > 0 ? (
                    <>
                      Você já alocou {formatCurrency(totalJaAlocado)} e ainda tem{' '}
                      <span className="text-green-400 font-semibold">{formatCurrency(saldoMesAnterior)}</span> disponível
                      {mesesComSaldo.length > 1 && ` de ${mesesComSaldo.length} meses`}.
                    </>
                  ) : (
                    <>
                      Você tem <span className="text-green-400 font-semibold">{formatCurrency(saldoMesAnterior)}</span> disponível
                      {mesesComSaldo.length > 1 && ` acumulado de ${mesesComSaldo.length} meses`}.
                      Que tal guardar em uma caixinha para seus objetivos?
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/app/caixinhas')}
                >
                  Ver Caixinhas
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setIsAlocarSaldoModalOpen(true)}
                >
                  <PiggyBank className="w-4 h-4 mr-2" />
                  Alocar Agora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      {lancamentos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gastos por Categoria */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-100 mb-4">
                Gastos por Categoria (Mês Atual)
              </h2>
              {gastosPorCategoria.length > 0 ? (
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  {/* Donut Chart */}
                  <div className="h-64 w-64 shrink-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          {gastosPorCategoria.map((entry, index) => {
                            const color = entry.cor || COLORS[index % COLORS.length]
                            return (
                              <linearGradient key={`grad-${index}`} id={`catGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={1} />
                                <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                              </linearGradient>
                            )
                          })}
                        </defs>
                        <Pie
                          data={gastosPorCategoria}
                          dataKey="total"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          cornerRadius={6}
                          stroke="none"
                        >
                          {gastosPorCategoria.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#catGrad-${index})`} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number | undefined, _name: any, props: any) => {
                            const pct = props?.payload?.percentual
                            return value ? `${formatCurrency(value)} (${pct?.toFixed(1)}%)` : 'R$ 0,00'
                          }}
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#F3F4F6'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Centro do donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-lg font-bold text-gray-100">{formatCurrency(totalDespesasMes)}</p>
                    </div>
                  </div>

                  {/* Legenda com percentuais */}
                  <div className="flex-1 w-full space-y-2 max-h-64 overflow-y-auto">
                    {gastosPorCategoria.map((entry, index) => (
                      <div key={entry.categoria_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-700/30 transition-colors">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: entry.cor || COLORS[index % COLORS.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300 truncate">{entry.nome}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-200">{formatCurrency(entry.total)}</p>
                          <p className="text-xs text-gray-500">{entry.percentual.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-500">
                  <p>Nenhuma despesa neste mês</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receitas x Despesas */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-100 mb-4">
                Receitas x Despesas (Últimos 6 Meses)
              </h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={receitasDespesasPorMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="mes"
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => value ? formatCurrency(value) : 'R$ 0,00'}
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F3F4F6'
                      }}
                    />
                    <Legend
                      wrapperStyle={{ color: '#9CA3AF' }}
                      formatter={(value) => value === 'receitas' ? 'Receitas' : 'Despesas'}
                    />
                    <Bar dataKey="receitas" fill="#10B981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="despesas" fill="#EF4444" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Transactions or Empty State */}
      {lancamentos.length > 0 ? (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-100">Transações Recentes</h2>
              <Button variant="ghost" size="sm">
                Ver todas
              </Button>
            </div>
            <div className="space-y-3">
              {transacoesRecentes.map((lancamento) => (
                <div
                  key={lancamento.id}
                  className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-dark-700/50 hover:border-dark-600 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      lancamento.tipo === 'receita'
                        ? 'bg-green-500/10'
                        : 'bg-red-500/10'
                    }`}>
                      {lancamento.tipo === 'receita' ? (
                        <ArrowUpRight className="w-5 h-5 text-green-400" />
                      ) : (
                        <ArrowDownLeft className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-100 truncate">
                        {getCategoryName(lancamento.categoria_id)}
                        {lancamento.subcategoria_id && (
                          <span className="text-gray-500"> • {getCategoryName(lancamento.subcategoria_id)}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">
                          {format(parseISO(lancamento.data), "dd 'de' MMM", { locale: ptBR })}
                        </p>
                        {lancamento.parcela_atual && lancamento.parcela_total && (
                          <span className="text-xs text-gray-500">
                            • {lancamento.parcela_atual}/{lancamento.parcela_total}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        lancamento.tipo === 'receita'
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}>
                        {lancamento.tipo === 'receita' ? '+' : '-'} {formatCurrency(lancamento.valor)}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        {lancamento.status === 'pendente' && (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                        {lancamento.status === 'pago' && (
                          <span className="text-xs text-gray-500">Pago</span>
                        )}
                        {lancamento.status === 'projetado' && (
                          <span className="text-xs text-gray-500">Projetado</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-200 mb-2">
                Bem-vindo ao PocketWise!
              </h3>
              <p className="text-gray-400 mb-6">
                Comece adicionando sua primeira transação
              </p>
              <Button onClick={handleOpenModal} className="gap-2">
                <Plus className="w-5 h-5" />
                Adicionar Transação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Modal */}
      <TransactionModal isOpen={isModalOpen} onClose={handleCloseModal} />

      {/* Modal de Alocação de Saldo */}
      <AlocarSaldoModal
        isOpen={isAlocarSaldoModalOpen}
        onClose={() => setIsAlocarSaldoModalOpen(false)}
        saldoDisponivel={saldoMesAnterior}
        onSuccess={() => {
          // Recarregar transações das caixinhas para atualizar o saldo já alocado
          caixinhas
            .filter(c => c.ativa)
            .forEach(c => {
              fetchTransacoesCaixinha(c.id).catch(err => {
                console.error('Erro ao buscar transações da caixinha:', err)
              })
            })
        }}
      />

      {/* Floating Posso Comprar Button */}
      <PossoComprarFloating />
    </div>
  )
}
