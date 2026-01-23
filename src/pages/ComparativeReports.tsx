import { useState, useMemo } from 'react'
import { Card, CardContent } from '../components/ui'
import { TrendingUp, TrendingDown, Calendar, ArrowUpRight, ArrowDownRight, MinusCircle } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useCategoriasStore } from '../store'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts'

interface MonthlyData {
  receitas: number
  despesas: number
  saldo: number
  categorias: Map<string, number>
}

interface CategoryComparison {
  categoria_id: string
  categoria_nome: string
  cor: string
  mes1: number
  mes2: number
  diferenca: number
  percentual: number
}

export function ComparativeReports() {
  const today = new Date()
  const [mes1, setMes1] = useState(startOfMonth(subMonths(today, 1)))
  const [mes2, setMes2] = useState(startOfMonth(today))

  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)

  // Calcular dados de um mês específico
  const getMonthData = (month: Date): MonthlyData => {
    const inicio = startOfMonth(month)
    const fim = endOfMonth(month)

    const lancamentosMes = lancamentos.filter(l => {
      const dataLancamento = new Date(l.data)
      return dataLancamento >= inicio && dataLancamento <= fim
    })

    const receitas = lancamentosMes
      .filter(l => l.tipo === 'receita')
      .reduce((sum, l) => sum + l.valor, 0)

    const despesas = lancamentosMes
      .filter(l => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0)

    // Agrupar despesas por categoria
    const categorias = new Map<string, number>()
    lancamentosMes
      .filter(l => l.tipo === 'despesa')
      .forEach(l => {
        const catId = l.categoria_id || 'sem-categoria'
        categorias.set(catId, (categorias.get(catId) || 0) + l.valor)
      })

    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
      categorias,
    }
  }

  // Dados dos dois meses
  const mes1Data = useMemo(() => getMonthData(mes1), [mes1, lancamentos])
  const mes2Data = useMemo(() => getMonthData(mes2), [mes2, lancamentos])

  // Comparação de categorias
  const categoryComparisons = useMemo((): CategoryComparison[] => {
    const allCategoriaIds = new Set([
      ...Array.from(mes1Data.categorias.keys()),
      ...Array.from(mes2Data.categorias.keys()),
    ])

    return Array.from(allCategoriaIds)
      .map(catId => {
        const categoria = categorias.find(c => c.id === catId)
        const mes1Value = mes1Data.categorias.get(catId) || 0
        const mes2Value = mes2Data.categorias.get(catId) || 0
        const diferenca = mes2Value - mes1Value
        const percentual = mes1Value > 0 ? ((diferenca / mes1Value) * 100) : (mes2Value > 0 ? 100 : 0)

        return {
          categoria_id: catId,
          categoria_nome: categoria?.nome || 'Sem categoria',
          cor: categoria?.cor || '#6B7280',
          mes1: mes1Value,
          mes2: mes2Value,
          diferenca,
          percentual,
        }
      })
      .filter(c => c.mes1 > 0 || c.mes2 > 0) // Apenas categorias com valores
      .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca)) // Ordenar por maior diferença
  }, [mes1Data, mes2Data, categorias])

  // Dados para gráfico de evolução dos últimos 6 meses
  const evolutionData = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(today, i)
      const data = getMonthData(month)
      months.push({
        mes: format(month, 'MMM/yy', { locale: ptBR }),
        receitas: data.receitas,
        despesas: data.despesas,
        saldo: data.saldo,
      })
    }
    return months
  }, [lancamentos])

  // Gerar opções de meses para seleção (últimos 12 meses)
  const monthOptions = useMemo(() => {
    const options = []
    for (let i = 0; i < 12; i++) {
      const month = subMonths(today, i)
      options.push({
        value: month.toISOString(),
        label: format(month, 'MMMM yyyy', { locale: ptBR }),
      })
    }
    return options
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Relatórios Comparativos</h1>
        <p className="text-gray-400">
          Compare diferentes períodos e identifique tendências nas suas finanças
        </p>
      </div>

      {/* Month Selectors */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Período 1
              </label>
              <select
                value={mes1.toISOString()}
                onChange={(e) => setMes1(new Date(e.target.value))}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Período 2 (comparar com)
              </label>
              <select
                value={mes2.toISOString()}
                onChange={(e) => setMes2(new Date(e.target.value))}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Receitas */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="text-sm font-semibold text-gray-300">Receitas</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{format(mes1, 'MMM/yy', { locale: ptBR })}</span>
                <span className="text-sm font-medium text-gray-300">{formatCurrency(mes1Data.receitas)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{format(mes2, 'MMM/yy', { locale: ptBR })}</span>
                <span className="text-sm font-medium text-gray-300">{formatCurrency(mes2Data.receitas)}</span>
              </div>
              <div className="pt-2 border-t border-dark-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Variação</span>
                  <div className="flex items-center gap-1">
                    {mes2Data.receitas > mes1Data.receitas ? (
                      <ArrowUpRight className="w-4 h-4 text-green-400" />
                    ) : mes2Data.receitas < mes1Data.receitas ? (
                      <ArrowDownRight className="w-4 h-4 text-red-400" />
                    ) : (
                      <MinusCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-sm font-semibold ${
                      mes2Data.receitas > mes1Data.receitas ? 'text-green-400' :
                      mes2Data.receitas < mes1Data.receitas ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {formatCurrency(Math.abs(mes2Data.receitas - mes1Data.receitas))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <h3 className="text-sm font-semibold text-gray-300">Despesas</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{format(mes1, 'MMM/yy', { locale: ptBR })}</span>
                <span className="text-sm font-medium text-gray-300">{formatCurrency(mes1Data.despesas)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{format(mes2, 'MMM/yy', { locale: ptBR })}</span>
                <span className="text-sm font-medium text-gray-300">{formatCurrency(mes2Data.despesas)}</span>
              </div>
              <div className="pt-2 border-t border-dark-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Variação</span>
                  <div className="flex items-center gap-1">
                    {mes2Data.despesas > mes1Data.despesas ? (
                      <ArrowUpRight className="w-4 h-4 text-red-400" />
                    ) : mes2Data.despesas < mes1Data.despesas ? (
                      <ArrowDownRight className="w-4 h-4 text-green-400" />
                    ) : (
                      <MinusCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-sm font-semibold ${
                      mes2Data.despesas > mes1Data.despesas ? 'text-red-400' :
                      mes2Data.despesas < mes1Data.despesas ? 'text-green-400' :
                      'text-gray-400'
                    }`}>
                      {formatCurrency(Math.abs(mes2Data.despesas - mes1Data.despesas))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-300">Saldo</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{format(mes1, 'MMM/yy', { locale: ptBR })}</span>
                <span className={`text-sm font-medium ${mes1Data.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(mes1Data.saldo)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{format(mes2, 'MMM/yy', { locale: ptBR })}</span>
                <span className={`text-sm font-medium ${mes2Data.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(mes2Data.saldo)}
                </span>
              </div>
              <div className="pt-2 border-t border-dark-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Variação</span>
                  <div className="flex items-center gap-1">
                    {mes2Data.saldo > mes1Data.saldo ? (
                      <ArrowUpRight className="w-4 h-4 text-green-400" />
                    ) : mes2Data.saldo < mes1Data.saldo ? (
                      <ArrowDownRight className="w-4 h-4 text-red-400" />
                    ) : (
                      <MinusCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-sm font-semibold ${
                      mes2Data.saldo > mes1Data.saldo ? 'text-green-400' :
                      mes2Data.saldo < mes1Data.saldo ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {formatCurrency(Math.abs(mes2Data.saldo - mes1Data.saldo))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Chart (Last 6 months) */}
      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-100 mb-4">
            Evolução dos Últimos 6 Meses
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="mes"
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => formatCurrency(value)}
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
                  formatter={(value) => {
                    if (value === 'receitas') return 'Receitas'
                    if (value === 'despesas') return 'Despesas'
                    if (value === 'saldo') return 'Saldo'
                    return value
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="receitas"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="despesas"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ fill: '#EF4444', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Comparison Table */}
      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-100 mb-4">
            Comparação por Categoria
          </h2>
          {categoryComparisons.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Categoria</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                      {format(mes1, 'MMM/yy', { locale: ptBR })}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                      {format(mes2, 'MMM/yy', { locale: ptBR })}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Variação</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">%</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryComparisons.map((cat) => {
                    const increased = cat.diferenca > 0
                    const decreased = cat.diferenca < 0
                    const unchanged = cat.diferenca === 0

                    return (
                      <tr
                        key={cat.categoria_id}
                        className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.cor }}
                            />
                            <span className="text-gray-300 font-medium">{cat.categoria_nome}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-400">
                          {formatCurrency(cat.mes1)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-400">
                          {formatCurrency(cat.mes2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-1">
                            {increased && <ArrowUpRight className="w-4 h-4 text-red-400" />}
                            {decreased && <ArrowDownRight className="w-4 h-4 text-green-400" />}
                            {unchanged && <MinusCircle className="w-4 h-4 text-gray-400" />}
                            <span className={`font-semibold ${
                              increased ? 'text-red-400' :
                              decreased ? 'text-green-400' :
                              'text-gray-400'
                            }`}>
                              {formatCurrency(Math.abs(cat.diferenca))}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <span className={`font-semibold ${
                            increased ? 'text-red-400' :
                            decreased ? 'text-green-400' :
                            'text-gray-400'
                          }`}>
                            {increased && '+'}
                            {decreased && '-'}
                            {Math.abs(cat.percentual).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Sem dados para comparação</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
