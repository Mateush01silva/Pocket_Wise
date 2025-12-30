import { useMemo, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '../components/ui'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore } from '../store'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { TransactionModal } from '../components/TransactionModal'

export function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)

  // Callback estável para fechar modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  // Calcular dados do mês atual
  const stats = useMemo(() => {
    const hoje = new Date()
    const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd')
    const fimMes = format(endOfMonth(hoje), 'yyyy-MM-dd')

    // Filtrar lançamentos do mês atual que estão pagos ou pendentes (não projetados)
    const lancamentosMes = lancamentos.filter((l) => {
      const dataLancamento = l.data_vencimento_fatura || l.data
      return (
        dataLancamento >= inicioMes &&
        dataLancamento <= fimMes &&
        (l.status === 'pago' || l.status === 'pendente')
      )
    })

    // Calcular receitas
    const receitas = lancamentosMes
      .filter((l) => l.tipo === 'receita')
      .reduce((sum, l) => sum + l.valor, 0)

    // Calcular despesas
    const despesas = lancamentosMes
      .filter((l) => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0)

    // Calcular faturas de cartão do mês
    const faturasCartao = lancamentosMes
      .filter((l) => l.tipo === 'despesa' && l.cartao_id)
      .reduce((sum, l) => sum + l.valor, 0)

    const saldo = receitas - despesas

    return {
      receitas,
      despesas,
      saldo,
      faturasCartao,
    }
  }, [lancamentos])

  const statCards = [
    {
      title: 'Receitas do Mês',
      value: formatCurrency(stats.receitas),
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      description: stats.receitas > 0 ? 'Recebido e a receber' : 'Nenhuma receita cadastrada',
    },
    {
      title: 'Despesas do Mês',
      value: formatCurrency(stats.despesas),
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      description: stats.despesas > 0 ? 'Pago e a pagar' : 'Nenhuma despesa cadastrada',
    },
    {
      title: 'Saldo Projetado',
      value: formatCurrency(stats.saldo),
      icon: Wallet,
      color: stats.saldo >= 0 ? 'text-primary-400' : 'text-red-400',
      bgColor: stats.saldo >= 0 ? 'bg-primary-500/10' : 'bg-red-500/10',
      description: stats.saldo >= 0 ? 'Positivo' : 'Negativo',
    },
    {
      title: 'Faturas de Cartão',
      value: formatCurrency(stats.faturasCartao),
      icon: CreditCard,
      color: 'text-secondary-400',
      bgColor: 'bg-secondary-500/10',
      description: stats.faturasCartao > 0 ? 'Vencimento neste mês' : 'Nenhuma fatura',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Dashboard</h1>
          <p className="text-gray-400">Visão geral das suas finanças</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-5 h-5" />
          Nova Transação
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} hover>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-100">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-xs text-gray-500">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Transactions and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
            <CardDescription>Últimas 5 transações</CardDescription>
          </CardHeader>
          <CardContent>
            {lancamentos.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <Wallet className="w-16 h-16 text-gray-600 mb-4" />
                <p className="text-gray-400 mb-2">Nenhuma transação cadastrada</p>
                <p className="text-sm text-gray-500">
                  Comece adicionando suas receitas e despesas
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lancamentos
                  .slice()
                  .sort((a, b) => {
                    const dataA = a.data_vencimento_fatura || a.data
                    const dataB = b.data_vencimento_fatura || b.data
                    return dataB.localeCompare(dataA)
                  })
                  .slice(0, 5)
                  .map((lancamento) => {
                    const data = lancamento.data_vencimento_fatura || lancamento.data
                    const isReceita = lancamento.tipo === 'receita'
                    return (
                      <div
                        key={lancamento.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-dark-800/50 hover:bg-dark-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              isReceita ? 'bg-green-400' : 'bg-red-400'
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-200">
                              {lancamento.observacao || 'Sem descrição'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(data).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`text-sm font-semibold ${
                            isReceita ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {isReceita ? '+' : '-'} {formatCurrency(lancamento.valor)}
                        </p>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
            <CardDescription>Configure seu PocketWise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary-500/10 border border-primary-500/20">
                <h4 className="text-sm font-semibold text-primary-400 mb-2">
                  1. Visualize suas Categorias
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Temos 70+ categorias pré-configuradas para você. Veja todas na página de Categorias!
                </p>
              </div>

              <div className="p-4 rounded-lg bg-secondary-500/10 border border-secondary-500/20">
                <h4 className="text-sm font-semibold text-secondary-400 mb-2">
                  2. Adicione suas Transações
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  Clique no botão "Nova Transação" acima para adicionar suas receitas e despesas.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">
                  3. Cadastre seus Cartões
                </h4>
                <p className="text-sm text-gray-400">
                  Gerencie faturas e parcelas dos seus cartões de crédito.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Modal */}
      <TransactionModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  )
}
