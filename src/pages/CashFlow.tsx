import { useState, useMemo } from 'react'
import { Card, CardContent, Button } from '../components/ui'
import { AlertTriangle, Calendar } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useContasBancariasStore } from '../store'
import { format, addDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

type ViewPeriod = '7d' | '15d' | '30d' | '60d' | '90d'

interface DailyBalance {
  date: Date
  dateStr: string
  saldo: number
  receitas: number
  despesas: number
  saldoInicial: number
}

export function CashFlow() {
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('30d')
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const getSaldoTotal = useContasBancariasStore((state) => state.getSaldoTotal)

  // Calcular saldo inicial (saldo real das contas bancárias)
  const saldoInicialContas = getSaldoTotal()

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

    for (let i = 0; i < numDays; i++) {
      const currentDate = addDays(today, i)
      const dateStart = startOfDay(currentDate)
      const dateEnd = endOfDay(currentDate)

      // Filtrar lançamentos do dia (incluindo pendentes e projetados)
      const lancamentosDoDia = lancamentos.filter(l => {
        const dataLancamento = new Date(l.data)
        return isWithinInterval(dataLancamento, { start: dateStart, end: dateEnd })
      })

      // Calcular receitas e despesas do dia
      const receitasDia = lancamentosDoDia
        .filter(l => l.tipo === 'receita')
        .reduce((sum, l) => sum + l.valor, 0)

      const despesasDia = lancamentosDoDia
        .filter(l => l.tipo === 'despesa')
        .reduce((sum, l) => sum + l.valor, 0)

      // Calcular saldo do dia
      const saldoInicial = saldoAcumulado
      saldoAcumulado = saldoAcumulado + receitasDia - despesasDia

      balances.push({
        date: currentDate,
        dateStr: format(currentDate, 'dd/MM', { locale: ptBR }),
        saldo: saldoAcumulado,
        receitas: receitasDia,
        despesas: despesasDia,
        saldoInicial,
      })
    }

    return balances
  }, [lancamentos, numDays, saldoInicialContas])

  // Encontrar dias com saldo negativo
  const diasNegativos = useMemo(() => {
    return dailyBalances.filter(d => d.saldo < 0)
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
  // Usa escala relativa ao invés de começar do zero
  const yAxisDomain = useMemo(() => {
    if (dailyBalances.length === 0) return [0, 100]

    const saldos = dailyBalances.map(d => d.saldo)
    const minSaldo = Math.min(...saldos)
    const maxSaldo = Math.max(...saldos)
    const range = maxSaldo - minSaldo

    // Se a variação é muito pequena em relação aos valores (< 10%), usar escala relativa
    const avgSaldo = (maxSaldo + minSaldo) / 2
    const variationPercent = avgSaldo !== 0 ? (range / Math.abs(avgSaldo)) * 100 : 100

    if (variationPercent < 20 && Math.abs(avgSaldo) > 1000) {
      // Usar escala relativa com padding de 20% da variação
      const padding = Math.max(range * 0.2, Math.abs(avgSaldo) * 0.05)
      const yMin = minSaldo - padding
      const yMax = maxSaldo + padding

      // Garantir que zero seja incluído se os valores cruzam zero
      if (minSaldo < 0 && maxSaldo > 0) {
        return [yMin, yMax]
      }

      return [yMin, yMax]
    }

    // Caso contrário, incluir zero para dar contexto
    if (minSaldo >= 0) {
      return [0, maxSaldo * 1.1]
    }

    return [minSaldo * 1.1, maxSaldo * 1.1]
  }, [dailyBalances])

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Fluxo de Caixa</h1>
        <p className="text-gray-400">
          Acompanhe a evolução diária do seu saldo e evite surpresas
        </p>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400 mr-3">Visualizar:</span>
            <div className="flex gap-2">
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
                  Atenção: Saldo negativo previsto!
                </h3>
                <p className="text-sm text-gray-300 mb-2">
                  Seu saldo ficará negativo em {diasNegativos.length} dia(s) no período selecionado:
                </p>
                <div className="flex flex-wrap gap-2">
                  {diasNegativos.slice(0, 5).map((dia) => (
                    <span
                      key={dia.dateStr}
                      className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300"
                    >
                      {format(dia.date, "dd 'de' MMM", { locale: ptBR })}: {formatCurrency(dia.saldo)}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card hover>
          <CardContent>
            <p className="text-sm text-gray-400 mb-1">Saldo Inicial</p>
            <p className="text-2xl font-bold text-gray-100">
              {formatCurrency(saldoInicialContas)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Hoje</p>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent>
            <p className="text-sm text-gray-400 mb-1">Total Receitas</p>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(stats.totalReceitas)}
            </p>
            <p className="text-xs text-gray-500 mt-1">No período</p>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent>
            <p className="text-sm text-gray-400 mb-1">Total Despesas</p>
            <p className="text-2xl font-bold text-red-400">
              {formatCurrency(stats.totalDespesas)}
            </p>
            <p className="text-xs text-gray-500 mt-1">No período</p>
          </CardContent>
        </Card>

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
      </div>

      {/* Cash Flow Chart */}
      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-100 mb-4">
            Evolução do Saldo
          </h2>
          {dailyBalances.length > 0 ? (
            <div className="h-96">
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
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => formatCurrency(value)}
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
      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-100 mb-4">
            Detalhamento Diário
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Data</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Receitas</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Despesas</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Saldo do Dia</th>
                </tr>
              </thead>
              <tbody>
                {dailyBalances.map((day, index) => {
                  const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  const isNegative = day.saldo < 0

                  return (
                    <tr
                      key={day.dateStr + index}
                      className={`border-b border-dark-800/50 hover:bg-dark-800/30 ${
                        isToday ? 'bg-blue-500/5' : ''
                      } ${isNegative ? 'bg-red-500/5' : ''}`}
                    >
                      <td className="py-3 px-4 text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                          {format(day.date, "dd 'de' MMM", { locale: ptBR })}
                          {isToday && (
                            <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300">
                              Hoje
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        {day.receitas > 0 ? (
                          <span className="text-green-400 font-medium">
                            +{formatCurrency(day.receitas)}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        {day.despesas > 0 ? (
                          <span className="text-red-400 font-medium">
                            -{formatCurrency(day.despesas)}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <span className={`font-semibold ${day.saldo >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                          {formatCurrency(day.saldo)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
