import React, { useState, useMemo } from 'react'
import { FeaturePreview } from '../components/FeaturePreview'
import { Card, CardContent, Button } from '../components/ui'
import { AlertTriangle, ArrowLeftRight, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { parseLocalDate } from '../utils/date'
import { useTransacoesStore, useContasBancariasStore, useCategoriasStore } from '../store'
import { format, addDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { LearningTooltip } from '../components/ui/LearningTooltip'
import { learningContent } from '../lib/learningContent'
import type { Lancamento } from '../types'

type ViewPeriod = '7d' | '15d' | '30d' | '60d' | '90d'

interface DailyBalance {
  date: Date
  dateStr: string
  dateKey: string             // yyyy-MM-dd — chave única para expandedDay
  saldo: number
  saldoDisponivel: number     // saldo sem contas de investimento
  receitas: number
  despesas: number
  despesasConfirmadas: number
  despesasProjetadas: number
  saldoInicial: number
  lancamentosDoDia: Lancamento[]
}

export function CashFlow() {
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('30d')
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [mobileCol, setMobileCol] = useState<'saldo' | 'disponivel'>('disponivel')

  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const getSaldoTotal = useContasBancariasStore((state) => state.getSaldoTotal)
  const getSaldoDisponivel = useContasBancariasStore((state) => state.getSaldoDisponivel)
  const categorias = useCategoriasStore((state) => state.categorias)

  // Calcular saldo inicial (saldo real das contas bancárias)
  const saldoInicialContas = getSaldoTotal()
  // Saldo disponível = apenas contas que não são investimento
  const saldoDisponivelContas = getSaldoDisponivel()

  // Calcular número de dias baseado no período
  const numDays = useMemo(() => {
    switch (viewPeriod) {
      case '7d': return 7
      case '15d': return 15
      case '30d': return 30
      case '60d': return 60
      case '90d': return 90
      default: return 30
    }
  }, [viewPeriod])

  // Calcular fluxo de caixa diário
  const dailyBalances = useMemo((): DailyBalance[] => {
    const today = startOfDay(new Date())
    const balances: DailyBalance[] = []

    // Iniciar com o saldo atual das contas
    let saldoAcumulado = saldoInicialContas
    let saldoDisponivelAcumulado = saldoDisponivelContas

    for (let i = 0; i < numDays; i++) {
      const currentDate = addDays(today, i)
      const dateStart = startOfDay(currentDate)
      const dateEnd = endOfDay(currentDate)
      const isFutureDay = i > 0  // hoje = índice 0

      // Filtrar lançamentos do dia
      // Para cartão de crédito com data_vencimento_fatura: posicionar na data da fatura
      // (quando o dinheiro efetivamente sai da conta, não na data da compra)
      // Para demais: posicionar na data da transação
      const lancamentosDoDia = lancamentos.filter(l => {
        const dataStr = (l.forma_pagamento === 'credito' && l.data_vencimento_fatura)
          ? l.data_vencimento_fatura
          : l.data
        const dataRef = parseLocalDate(dataStr)
        return isWithinInterval(dataRef, { start: dateStart, end: dateEnd })
      })

      // Calcular receitas do dia
      const receitasDia = lancamentosDoDia
        .filter(l => l.tipo === 'receita')
        .reduce((sum, l) => sum + l.valor, 0)

      // Despesas: para dias futuros tudo é projetado por definição;
      // para hoje/passado separamos por status
      const despesasDoDia = lancamentosDoDia.filter(l => l.tipo === 'despesa')
      const despesasDia = despesasDoDia.reduce((sum, l) => sum + l.valor, 0)

      const despesasConfirmadasDia = isFutureDay
        ? 0
        : despesasDoDia.filter(l => l.status === 'pago').reduce((sum, l) => sum + l.valor, 0)

      const despesasProjetadasDia = isFutureDay
        ? despesasDia
        : despesasDoDia.filter(l => l.status !== 'pago').reduce((sum, l) => sum + l.valor, 0)

      // Calcular saldo acumulado (total e disponível)
      // Para hoje (i===0): saldoInicialContas já reflete as transações confirmadas (pago)
      // do dia, pois vem do saldo real das contas bancárias. Somar tudo de novo
      // causaria dupla contagem. Somamos apenas o líquido das transações AINDA NÃO pagas.
      // Para dias futuros: somamos tudo normalmente (nada está pago ainda).
      const receitasParaAcumular = i === 0
        ? lancamentosDoDia.filter(l => l.tipo === 'receita' && l.status !== 'pago').reduce((s, l) => s + l.valor, 0)
        : receitasDia
      const despesasParaAcumular = i === 0
        ? lancamentosDoDia.filter(l => l.tipo === 'despesa' && l.status !== 'pago').reduce((s, l) => s + l.valor, 0)
        : despesasDia

      const saldoInicial = saldoAcumulado
      saldoAcumulado = saldoAcumulado + receitasParaAcumular - despesasParaAcumular
      saldoDisponivelAcumulado = saldoDisponivelAcumulado + receitasParaAcumular - despesasParaAcumular

      balances.push({
        date: currentDate,
        dateStr: format(currentDate, 'dd/MM', { locale: ptBR }),
        dateKey: format(currentDate, 'yyyy-MM-dd'),
        saldo: saldoAcumulado,
        saldoDisponivel: saldoDisponivelAcumulado,
        receitas: receitasDia,
        despesas: despesasDia,
        despesasConfirmadas: despesasConfirmadasDia,
        despesasProjetadas: despesasProjetadasDia,
        saldoInicial,
        lancamentosDoDia,
      })
    }

    return balances
  }, [lancamentos, numDays, saldoInicialContas, saldoDisponivelContas])

  // Encontrar dias com saldo disponível negativo (sem investimentos)
  const diasNegativos = useMemo(() => {
    return dailyBalances.filter(d => d.saldoDisponivel < 0)
  }, [dailyBalances])

  // Estatísticas do período
  const stats = useMemo(() => {
    const totalReceitas = dailyBalances.reduce((sum, d) => sum + d.receitas, 0)
    const totalDespesas = dailyBalances.reduce((sum, d) => sum + d.despesas, 0)
    const saldoFinal = dailyBalances[dailyBalances.length - 1]?.saldo || 0
    const menorSaldo = Math.min(...dailyBalances.map(d => d.saldo))

    return {
      totalReceitas,
      totalDespesas,
      saldoFinal,
      menorSaldo,
      variacao: saldoFinal - saldoInicialContas,
    }
  }, [dailyBalances, saldoInicialContas])

  // Calcular escala do eixo Y para melhor visualização
  const yAxisDomain = useMemo(() => {
    if (dailyBalances.length === 0) return [0, 100]

    const saldos = dailyBalances.map(d => d.saldo)
    const minSaldo = Math.min(...saldos)
    const maxSaldo = Math.max(...saldos)
    const range = maxSaldo - minSaldo

    const avgSaldo = (maxSaldo + minSaldo) / 2
    const variationPercent = avgSaldo !== 0 ? (range / Math.abs(avgSaldo)) * 100 : 100

    if (variationPercent < 20 && Math.abs(avgSaldo) > 1000) {
      const padding = Math.max(range * 0.2, Math.abs(avgSaldo) * 0.05)
      return [minSaldo - padding, maxSaldo + padding]
    }

    if (minSaldo >= 0) {
      return [0, maxSaldo * 1.1]
    }

    return [minSaldo * 1.1, maxSaldo * 1.1]
  }, [dailyBalances])

  // Helper: nome da categoria a partir do id
  const getCategoryName = (l: Lancamento): string => {
    if (!l.categoria_id) return 'Sem categoria'
    return categorias.find(c => c.id === l.categoria_id)?.nome ?? 'Sem categoria'
  }

  // Helper: cor da categoria
  const getCategoryColor = (l: Lancamento): string => {
    if (!l.categoria_id) return '#6B7280'
    return categorias.find(c => c.id === l.categoria_id)?.cor ?? '#6B7280'
  }

  // Helper: label amigável para status
  const getStatusLabel = (l: Lancamento, isFutureDay: boolean): { label: string; color: string } => {
    if (isFutureDay) return { label: 'projetado', color: 'text-orange-400/80' }
    if (l.status === 'pago') return { label: 'confirmado', color: 'text-green-400' }
    if (l.status === 'projetado') return { label: 'projetado', color: 'text-orange-400/80' }
    return { label: 'pendente', color: 'text-yellow-400/80' }
  }

  // Helper: descrição do lançamento (parcela, assinatura, observação)
  const getDescricao = (l: Lancamento): string | null => {
    if (l.parcela_atual && l.parcela_total) {
      return `Parcela ${l.parcela_atual}/${l.parcela_total}`
    }
    return l.observacao || null
  }

  // Custom tooltip para o gráfico
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as DailyBalance
      return (
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold text-gray-100 mb-2">
            {format(data.date, "dd 'de' MMMM", { locale: ptBR })}
          </p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-gray-400">Saldo:</span>
              <span className={`font-semibold ${data.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(data.saldo)}
              </span>
            </div>
            {data.receitas > 0 && (
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-gray-400">Receitas:</span>
                <span className="font-semibold text-green-400">+{formatCurrency(data.receitas)}</span>
              </div>
            )}
            {data.despesas > 0 && (
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-gray-400">Despesas:</span>
                <span className="font-semibold text-red-400">-{formatCurrency(data.despesas)}</span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <FeaturePreview
      feature="cashflow"
      title="Fluxo de Caixa"
      subtitle="Antecipe o futuro do seu dinheiro e evite surpresas no fim do mês."
      requiredTier="planejador"
      benefits={[
        'Visualize entradas e saídas previstas para os próximos meses',
        'Descubra em quais dias do mês seu saldo fica mais apertado',
        'Planeje pagamentos grandes sem ser pego de surpresa',
        'Gráfico diário de evolução do saldo ao longo do mês',
      ]}
    >
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-100 mb-1 md:mb-2">Fluxo de Caixa</h1>
        <p className="text-gray-400">
          Acompanhe a evolução diária do seu saldo e evite surpresas
        </p>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400 mr-1">Visualizar:</span>
            <div className="flex flex-wrap gap-2">
              {(['7d', '15d', '30d', '60d', '90d'] as ViewPeriod[]).map((period) => (
                <Button
                  key={period}
                  size="sm"
                  variant={viewPeriod === period ? 'primary' : 'ghost'}
                  onClick={() => setViewPeriod(period)}
                >
                  {period === '7d' && '7 dias'}
                  {period === '15d' && '15 dias'}
                  {period === '30d' && '30 dias'}
                  {period === '60d' && '60 dias'}
                  {period === '90d' && '90 dias'}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert se houver dias com saldo negativo */}
      {diasNegativos.length > 0 && (
        <Card className="border-2 border-red-500/30 bg-red-500/5">
          <CardContent>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-red-400 mb-1">
                  Atenção: Saldo disponível negativo previsto!
                </h3>
                <p className="text-sm text-gray-300 mb-2">
                  Seu saldo disponível (sem investimentos) ficará negativo em {diasNegativos.length} dia(s) no período selecionado:
                </p>
                <div className="flex flex-wrap gap-2">
                  {diasNegativos.slice(0, 5).map((dia) => (
                    <span
                      key={dia.dateKey}
                      className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300"
                    >
                      {format(dia.date, "dd 'de' MMM", { locale: ptBR })}: {formatCurrency(dia.saldoDisponivel)}
                    </span>
                  ))}
                  {diasNegativos.length > 5 && (
                    <span className="px-2 py-1 text-xs text-gray-400">
                      +{diasNegativos.length - 5} dias
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <LearningTooltip content={learningContent.fluxoSaldoInicial} position="bottom">
          <Card hover>
            <CardContent>
              <p className="text-sm text-gray-400 mb-1">Saldo Inicial</p>
              <p className="text-2xl font-bold text-gray-100">
                {formatCurrency(saldoInicialContas)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Hoje</p>
            </CardContent>
          </Card>
        </LearningTooltip>

        <LearningTooltip content={learningContent.fluxoSaldoDisponivel} position="bottom">
          <Card hover className={saldoDisponivelContas < 0 ? 'border-2 border-orange-500/30' : ''}>
            <CardContent>
              <p className="text-sm text-gray-400 mb-1">Disponível Hoje</p>
              <p className={`text-2xl font-bold ${saldoDisponivelContas >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(saldoDisponivelContas)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Sem investimentos</p>
            </CardContent>
          </Card>
        </LearningTooltip>

        <LearningTooltip content={learningContent.fluxoTotalReceitas} position="bottom">
          <Card hover>
            <CardContent>
              <p className="text-sm text-gray-400 mb-1">Total Receitas</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(stats.totalReceitas)}
              </p>
              <p className="text-xs text-gray-500 mt-1">No período</p>
            </CardContent>
          </Card>
        </LearningTooltip>

        <LearningTooltip content={learningContent.fluxoTotalDespesas} position="bottom">
          <Card hover>
            <CardContent>
              <p className="text-sm text-gray-400 mb-1">Total Despesas</p>
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(stats.totalDespesas)}
              </p>
              <p className="text-xs text-gray-500 mt-1">No período</p>
            </CardContent>
          </Card>
        </LearningTooltip>

        <LearningTooltip content={learningContent.fluxoSaldoFinal} position="bottom">
          <Card hover>
            <CardContent>
              <p className="text-sm text-gray-400 mb-1">Saldo Final</p>
              <p className={`text-2xl font-bold ${stats.saldoFinal >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {formatCurrency(stats.saldoFinal)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Ao final do período
              </p>
            </CardContent>
          </Card>
        </LearningTooltip>

        <LearningTooltip content={learningContent.fluxoMenorSaldo} position="bottom">
          <Card hover className={stats.menorSaldo < 0 ? 'border-2 border-red-500/30' : ''}>
            <CardContent>
              <p className="text-sm text-gray-400 mb-1">Menor Saldo</p>
              <p className={`text-2xl font-bold ${stats.menorSaldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(stats.menorSaldo)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.menorSaldo < 0 ? 'Atenção!' : 'No período'}
              </p>
            </CardContent>
          </Card>
        </LearningTooltip>
      </div>

      {/* Cash Flow Chart */}
      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-100 mb-4">
            Evolução do Saldo
          </h2>
          {dailyBalances.length > 0 ? (
            <div className="h-64 md:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyBalances}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="dateStr"
                    stroke="#9CA3AF"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    style={{ fontSize: '11px' }}
                    width={56}
                    tickFormatter={(value) => {
                      const abs = Math.abs(value)
                      if (abs >= 1000) return `R$${(value / 1000).toFixed(0)}k`
                      return `R$${value.toFixed(0)}`
                    }}
                    domain={yAxisDomain}
                    allowDataOverflow={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props
                      const isNegative = payload.saldo < 0
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill={isNegative ? '#EF4444' : '#3B82F6'}
                          stroke={isNegative ? '#DC2626' : '#2563EB'}
                          strokeWidth={2}
                        />
                      )
                    }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center text-gray-500">
              <p>Sem dados de fluxo de caixa</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Details Table */}
      <Card className="overflow-hidden">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-100">Detalhamento Diário</h2>
              <button
                onClick={() => setMobileCol(c => c === 'saldo' ? 'disponivel' : 'saldo')}
                className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-dark-700 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                <ArrowLeftRight size={12} />
                {mobileCol === 'saldo' ? 'Saldo' : 'Disponível'}
              </button>
            </div>
            <p className="text-xs text-gray-500 hidden sm:block">Clique em uma linha para ver os lançamentos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-400">Data</th>
                  <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-400">Receitas</th>
                  <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-400">Despesas</th>
                  <th className={`text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-400 ${mobileCol === 'saldo' ? '' : 'hidden'} sm:table-cell`}>Saldo</th>
                  <th className={`text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-emerald-500/80 ${mobileCol === 'disponivel' ? '' : 'hidden'} sm:table-cell`}>
                    <LearningTooltip content={learningContent.fluxoColunaSaldoDisponivel} position="bottom-end">
                      <span className="cursor-help">Disponível</span>
                    </LearningTooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyBalances.map((day, index) => {
                  const isToday = day.dateKey === format(new Date(), 'yyyy-MM-dd')
                  const isNegative = day.saldoDisponivel < 0
                  const isFutureDay = index > 0
                  const hasTransactions = day.lancamentosDoDia.length > 0
                  const isExpanded = expandedDay === day.dateKey

                  return (
                    <React.Fragment key={day.dateKey}>
                      {/* Linha principal */}
                      <tr
                        onClick={() => hasTransactions && setExpandedDay(isExpanded ? null : day.dateKey)}
                        className={`border-b border-dark-800/50 transition-colors ${
                          hasTransactions ? 'cursor-pointer hover:bg-dark-800/40' : ''
                        } ${isToday ? 'bg-blue-500/5' : ''} ${isNegative && !isExpanded ? 'bg-red-500/5' : ''} ${isExpanded ? 'bg-dark-800/50' : ''}`}
                      >
                        <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-gray-300">
                          <div className="flex items-center gap-1 sm:gap-2">
                            {hasTransactions ? (
                              isExpanded
                                ? <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 shrink-0" />
                                : <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 shrink-0" />
                            ) : (
                              <span className="w-3 sm:w-4 shrink-0" />
                            )}
                            <span className="whitespace-nowrap">{format(day.date, "dd/MM", { locale: ptBR })}<span className="hidden sm:inline"> de {format(day.date, "MMM", { locale: ptBR })}</span></span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300 hidden sm:inline">
                                Hoje
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-right">
                          {day.receitas > 0 ? (
                            <span className="text-green-400 font-medium whitespace-nowrap">
                              +{formatCurrency(day.receitas)}
                            </span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-right">
                          {day.despesas > 0 ? (
                            <div>
                              <span className="text-red-400 font-medium whitespace-nowrap">
                                -{formatCurrency(day.despesas)}
                              </span>
                              {day.despesasProjetadas > 0 && (
                                <div className="text-xs text-orange-400/70 mt-0.5 hidden sm:block">
                                  ~{formatCurrency(day.despesasProjetadas)} proj.
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className={`py-2 px-2 sm:px-4 text-xs sm:text-sm text-right ${mobileCol === 'saldo' ? '' : 'hidden'} sm:table-cell`}>
                          <span className={`font-semibold whitespace-nowrap ${day.saldo >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                            {formatCurrency(day.saldo)}
                          </span>
                        </td>
                        <td className={`py-2 px-2 sm:px-4 text-xs sm:text-sm text-right ${mobileCol === 'disponivel' ? '' : 'hidden'} sm:table-cell`}>
                          <span className={`font-semibold whitespace-nowrap ${day.saldoDisponivel >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatCurrency(day.saldoDisponivel)}
                          </span>
                        </td>
                      </tr>

                      {/* Painel de detalhes expandido */}
                      {isExpanded && (
                        <tr className="border-b border-dark-800/50 bg-dark-900/40">
                          <td colSpan={5} className="px-2 sm:px-4 py-3">
                            <div className="space-y-1.5 pl-4 border-l-2 border-dark-700">
                              {[...day.lancamentosDoDia]
                                .sort((a, b) => b.valor - a.valor)
                                .map((l) => {
                                  const statusInfo = getStatusLabel(l, isFutureDay)
                                  const descricao = getDescricao(l)
                                  return (
                                    <div
                                      key={l.id}
                                      className="flex items-center justify-between gap-3 py-1"
                                    >
                                      {/* Categoria */}
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div
                                          className="w-2 h-2 rounded-full shrink-0"
                                          style={{ backgroundColor: getCategoryColor(l) }}
                                        />
                                        <div className="min-w-0">
                                          <span className="text-xs text-gray-300 font-medium">
                                            {getCategoryName(l)}
                                          </span>
                                          {descricao && (
                                            <span className="text-xs text-gray-500 ml-1.5">
                                              {descricao}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {/* Valor + status */}
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-xs font-semibold ${l.tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
                                          {l.tipo === 'receita' ? '+' : '-'}{formatCurrency(l.valor)}
                                        </span>
                                        <span className={`text-xs ${statusInfo.color}`}>
                                          {statusInfo.label}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {dailyBalances.some(d => d.despesasProjetadas > 0) && (
            <p className="mt-3 text-xs text-gray-500">
              <span className="text-orange-400/70 font-medium">~ proj.</span>
              {' '}= despesa ainda não confirmada (vencimento de fatura de cartão ou lançamento pendente)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
    </FeaturePreview>
  )
}
