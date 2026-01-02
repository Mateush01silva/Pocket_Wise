import { useState, useCallback } from 'react'
import { Card, CardContent, Button, DateRangeFilter, getDefaultDateRange, type DateRange } from '../components/ui'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useCategoriasStore } from '../store'
import { TransactionModal } from '../components/TransactionModal'
import { CategoryDetailsModal } from '../components/CategoryDetailsModal'
import { format, subMonths, startOfMonth, endOfMonth, differenceInMonths, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'

export function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange())
  const [selectedCategoryData, setSelectedCategoryData] = useState<{
    categoria_id: string
    nome: string
    cor: string
    total: number
  } | null>(null)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)

  // Stable callbacks to prevent render loops
  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const handleDateRangeChange = useCallback((newRange: DateRange) => {
    setDateRange(newRange)
  }, [])

  const handleCategoryClick = useCallback((data: any) => {
    setSelectedCategoryData({
      categoria_id: data.categoria_id,
      nome: data.nome,
      cor: data.cor,
      total: data.total
    })
  }, [])

  const handleCloseCategoryModal = useCallback(() => {
    setSelectedCategoryData(null)
  }, [])

  // Get category name by id
  const getCategoryName = useCallback((categoriaId: string | null) => {
    if (!categoriaId) return 'Sem categoria'
    const categoria = categorias.find(c => c.id === categoriaId)
    return categoria?.nome || 'Categoria desconhecida'
  }, [categorias])

  // Filtrar lançamentos pelo período selecionado
  const lancamentosFiltrados = lancamentos.filter((l) => {
    const data = new Date(l.data_vencimento_fatura || l.data)
    return (
      data >= dateRange.startDate &&
      data <= dateRange.endDate &&
      (l.status === 'pago' || l.status === 'pendente')
    )
  })

  const receitas = lancamentosFiltrados
    .filter((l) => l.tipo === 'receita')
    .reduce((sum, l) => sum + l.valor, 0)

  const despesas = lancamentosFiltrados
    .filter((l) => l.tipo === 'despesa')
    .reduce((sum, l) => sum + l.valor, 0)

  const faturasCartao = lancamentosFiltrados
    .filter((l) => l.tipo === 'despesa' && l.cartao_id)
    .reduce((sum, l) => sum + l.valor, 0)

  // Breakdown detalhado para o card de Saldo Projetado
  const saldoInicial = receitas

  const gastosRealizados = lancamentosFiltrados
    .filter((l) => l.tipo === 'despesa' && !l.cartao_id && l.status === 'pago')
    .reduce((sum, l) => sum + l.valor, 0)

  const contasPendentes = lancamentosFiltrados
    .filter((l) => l.tipo === 'despesa' && !l.cartao_id && l.status === 'pendente')
    .reduce((sum, l) => sum + l.valor, 0)

  const saldoProjetado = saldoInicial - faturasCartao - gastosRealizados - contasPendentes

  // Calcular período anterior para comparação
  const diasPeriodo = Math.abs(differenceInDays(dateRange.endDate, dateRange.startDate))
  const periodoAnteriorStart = new Date(dateRange.startDate)
  periodoAnteriorStart.setDate(periodoAnteriorStart.getDate() - diasPeriodo - 1)
  const periodoAnteriorEnd = new Date(dateRange.startDate)
  periodoAnteriorEnd.setDate(periodoAnteriorEnd.getDate() - 1)

  const lancamentosPeriodoAnterior = lancamentos.filter((l) => {
    const data = new Date(l.data_vencimento_fatura || l.data)
    return (
      data >= periodoAnteriorStart &&
      data <= periodoAnteriorEnd &&
      (l.status === 'pago' || l.status === 'pendente')
    )
  })

  const receitasPeriodoAnterior = lancamentosPeriodoAnterior
    .filter((l) => l.tipo === 'receita')
    .reduce((sum, l) => sum + l.valor, 0)

  const despesasPeriodoAnterior = lancamentosPeriodoAnterior
    .filter((l) => l.tipo === 'despesa')
    .reduce((sum, l) => sum + l.valor, 0)

  // Calcular variação percentual
  const variacaoReceitas = receitasPeriodoAnterior > 0
    ? ((receitas - receitasPeriodoAnterior) / receitasPeriodoAnterior) * 100
    : 0

  const variacaoDespesas = despesasPeriodoAnterior > 0
    ? ((despesas - despesasPeriodoAnterior) / despesasPeriodoAnterior) * 100
    : 0

  // Get recent transactions (last 5) - criar cópia antes de ordenar!
  const transacoesRecentes = [...lancamentos]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 5)

  // Próximos vencimentos (despesas pendentes/projetadas) - top 5
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const proximosVencimentos = [...lancamentos]
    .filter((l) => {
      const dataVencimento = new Date(l.data_vencimento_fatura || l.data)
      return (
        l.tipo === 'despesa' &&
        (l.status === 'pendente' || l.status === 'projetado') &&
        dataVencimento >= hoje
      )
    })
    .sort((a, b) => {
      const dataA = new Date(a.data_vencimento_fatura || a.data)
      const dataB = new Date(b.data_vencimento_fatura || b.data)
      return dataA.getTime() - dataB.getTime()
    })
    .slice(0, 5)

  // Helper: calcular dias até vencimento
  const getDiasAteVencimento = (dataVencimento: Date) => {
    const diff = differenceInDays(dataVencimento, hoje)
    return diff
  }

  // Chart data - Gastos por Categoria (apenas despesas do período filtrado) - SEM useMemo para evitar loops
  const despesasPeriodo = lancamentosFiltrados.filter(l => l.tipo === 'despesa')

  const grouped = despesasPeriodo.reduce((acc, lancamento) => {
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

  const gastosPorCategoria = Object.values(grouped)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10) // Top 10

  // Filtrar transações da categoria selecionada
  const selectedCategoryTransactions = selectedCategoryData
    ? despesasPeriodo.filter(l => l.categoria_id === selectedCategoryData.categoria_id)
    : []

  // Chart data - Receitas x Despesas (por mês dentro do período) - SEM useMemo para evitar loops
  const mesesDiferenca = Math.abs(differenceInMonths(dateRange.endDate, dateRange.startDate))
  const numMesesGrafico = Math.max(Math.min(mesesDiferenca + 1, 12), 6) // Min 6, Max 12 meses

  const mesesData = []
  for (let i = numMesesGrafico - 1; i >= 0; i--) {
    const mesData = subMonths(new Date(), i)
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

  // Chart colors
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Dashboard</h1>
          <p className="text-gray-400">Visão geral das suas finanças</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} />
          <Button onClick={handleOpenModal} className="gap-2">
            <Plus className="w-5 h-5" />
            Nova Transação
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Receitas */}
        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1">Receitas do Período</p>
                <p className="text-2xl font-bold text-gray-100">{formatCurrency(receitas)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {variacaoReceitas !== 0 && (
                <>
                  <span className={variacaoReceitas > 0 ? 'text-green-400' : 'text-red-400'}>
                    {variacaoReceitas > 0 ? '↑' : '↓'} {Math.abs(variacaoReceitas).toFixed(1)}%
                  </span>
                  <span className="text-gray-500">vs período anterior</span>
                </>
              )}
              {variacaoReceitas === 0 && receitas > 0 && (
                <span className="text-gray-500">Recebido e a receber</span>
              )}
              {receitas === 0 && (
                <span className="text-gray-500">Nenhuma receita cadastrada</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1">Despesas do Período</p>
                <p className="text-2xl font-bold text-gray-100">{formatCurrency(despesas)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <TrendingDown className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {variacaoDespesas !== 0 && (
                <>
                  <span className={variacaoDespesas > 0 ? 'text-red-400' : 'text-green-400'}>
                    {variacaoDespesas > 0 ? '↑' : '↓'} {Math.abs(variacaoDespesas).toFixed(1)}%
                  </span>
                  <span className="text-gray-500">vs período anterior</span>
                </>
              )}
              {variacaoDespesas === 0 && despesas > 0 && (
                <span className="text-gray-500">Pago e a pagar</span>
              )}
              {despesas === 0 && (
                <span className="text-gray-500">Nenhuma despesa cadastrada</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Saldo Projetado com Breakdown */}
        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1">Saldo Projetado</p>
                <p className={`text-2xl font-bold ${
                  saldoProjetado >= 5000 ? 'text-green-400' :
                  saldoProjetado >= 1000 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {formatCurrency(saldoProjetado)}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${
                saldoProjetado >= 5000 ? 'bg-green-500/10' :
                saldoProjetado >= 1000 ? 'bg-yellow-500/10' :
                'bg-red-500/10'
              } flex items-center justify-center shrink-0`}>
                <Wallet className={`w-6 h-6 ${
                  saldoProjetado >= 5000 ? 'text-green-400' :
                  saldoProjetado >= 1000 ? 'text-yellow-400' :
                  'text-red-400'
                }`} />
              </div>
            </div>
            {/* Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Saldo Inicial:</span>
                <span className="text-green-400">+{formatCurrency(saldoInicial)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Faturas:</span>
                <span className="text-red-400">-{formatCurrency(faturasCartao)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Gastos:</span>
                <span className="text-red-400">-{formatCurrency(gastosRealizados)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Pendente:</span>
                <span className="text-red-400">-{formatCurrency(contasPendentes)}</span>
              </div>
              <div className="border-t border-dark-700 pt-1 mt-1"></div>
              <div className="flex justify-between font-medium">
                <span className="text-gray-300">= Saldo Final</span>
                <span className={
                  saldoProjetado >= 5000 ? 'text-green-400' :
                  saldoProjetado >= 1000 ? 'text-yellow-400' :
                  'text-red-400'
                }>
                  {formatCurrency(saldoProjetado)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Faturas */}
        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1">Faturas de Cartão</p>
                <p className="text-2xl font-bold text-gray-100">{formatCurrency(faturasCartao)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-secondary-500/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-6 h-6 text-secondary-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {faturasCartao > 0 ? 'Vencimento neste mês' : 'Nenhuma fatura'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      {lancamentos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gastos por Categoria */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-100 mb-4">
                Gastos por Categoria ({dateRange.preset === 'current_month' ? 'Mês Atual' : 'Período Selecionado'})
              </h2>
              {gastosPorCategoria.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gastosPorCategoria}
                        dataKey="total"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        label={(entry: any) => `${entry.nome}: ${formatCurrency(entry.total)}`}
                        labelLine={false}
                        onClick={handleCategoryClick}
                        style={{ cursor: 'pointer' }}
                      >
                        {gastosPorCategoria.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.cor || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number | undefined) => value ? formatCurrency(value) : 'R$ 0,00'}
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#F3F4F6'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
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
                Receitas x Despesas (Últimos {numMesesGrafico} Meses)
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
                          {format(new Date(lancamento.data), "dd 'de' MMM", { locale: ptBR })}
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

      {/* Próximos Vencimentos */}
      {proximosVencimentos.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-100">Próximos Vencimentos</h2>
              <span className="text-xs text-gray-500">
                {proximosVencimentos.length} conta{proximosVencimentos.length > 1 ? 's' : ''} pendente{proximosVencimentos.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {proximosVencimentos.map((lancamento) => {
                const dataVencimento = new Date(lancamento.data_vencimento_fatura || lancamento.data)
                const diasAteVencimento = getDiasAteVencimento(dataVencimento)
                const isUrgente = diasAteVencimento <= 3

                return (
                  <div
                    key={lancamento.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isUrgente
                        ? 'bg-red-500/5 border-red-500/30'
                        : 'bg-dark-800/50 border-dark-700/50 hover:border-dark-600'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isUrgente ? 'bg-red-500/10' : 'bg-yellow-500/10'
                      }`}>
                        <Clock className={`w-5 h-5 ${isUrgente ? 'text-red-400' : 'text-yellow-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {getCategoryName(lancamento.categoria_id)}
                          {lancamento.subcategoria_id && (
                            <span className="text-gray-500"> • {getCategoryName(lancamento.subcategoria_id)}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className={`text-xs ${isUrgente ? 'text-red-400 font-medium' : 'text-gray-500'}`}>
                            Vence {format(dataVencimento, "dd 'de' MMM", { locale: ptBR })}
                          </p>
                          {diasAteVencimento === 0 && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                              Hoje
                            </span>
                          )}
                          {diasAteVencimento === 1 && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                              Amanhã
                            </span>
                          )}
                          {diasAteVencimento > 1 && diasAteVencimento <= 3 && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                              {diasAteVencimento} dias
                            </span>
                          )}
                          {diasAteVencimento > 3 && (
                            <span className="text-xs text-gray-500">
                              {diasAteVencimento} dias
                            </span>
                          )}
                        </div>
                        {lancamento.observacao && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {lancamento.observacao}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-400">
                        {formatCurrency(lancamento.valor)}
                      </p>
                      {lancamento.parcela_atual && lancamento.parcela_total && (
                        <span className="text-xs text-gray-500">
                          {lancamento.parcela_atual}/{lancamento.parcela_total}x
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Modal */}
      <TransactionModal isOpen={isModalOpen} onClose={handleCloseModal} />

      {/* Category Details Modal */}
      {selectedCategoryData && (
        <CategoryDetailsModal
          isOpen={!!selectedCategoryData}
          onClose={handleCloseCategoryModal}
          categoryName={selectedCategoryData.nome}
          categoryColor={selectedCategoryData.cor}
          transactions={selectedCategoryTransactions}
          totalValue={selectedCategoryData.total}
          getCategoryName={getCategoryName}
        />
      )}
    </div>
  )
}
