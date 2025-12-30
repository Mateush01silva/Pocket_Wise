import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui'
import { TrendingUp, TrendingDown, Wallet, DollarSign } from 'lucide-react'
import { formatCurrency } from '../utils/currency'

export function Dashboard() {
  // Mock data - será substituído por dados reais do store
  const stats = {
    totalIncome: 15000,
    totalExpenses: 8500,
    balance: 6500,
    savingsRate: 43.3,
  }

  const statCards = [
    {
      title: 'Receitas',
      value: formatCurrency(stats.totalIncome),
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Despesas',
      value: formatCurrency(stats.totalExpenses),
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Saldo',
      value: formatCurrency(stats.balance),
      icon: Wallet,
      color: 'text-primary-400',
      bgColor: 'bg-primary-500/10',
    },
    {
      title: 'Taxa de Poupança',
      value: `${stats.savingsRate.toFixed(1)}%`,
      icon: DollarSign,
      color: 'text-secondary-400',
      bgColor: 'bg-secondary-500/10',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Dashboard</h1>
        <p className="text-gray-400">Visão geral das suas finanças</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} hover>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-100">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts and Recent Transactions - Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
            <CardDescription>Últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              Gráfico em desenvolvimento
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
            <CardDescription>Últimas 5 transações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              Lista em desenvolvimento
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
