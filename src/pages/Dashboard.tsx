import { useState, useCallback } from 'react'
import { Card, CardContent, Button } from '../components/ui'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useCategoriasStore } from '../store'
import { TransactionModal } from '../components/TransactionModal'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'

export function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)

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

  // Calcular stats diretamente, sem useMemo complexo
  const hoje = new Date()
  const mesAtual = hoje.getMonth()
  const anoAtual = hoje.getFullYear()

  const lancamentosMes = lancamentos.filter((l) => {
    const data = new Date(l.data_vencimento_fatura || l.data)
    return (
      data.getMonth() === mesAtual &&
      data.getFullYear() === anoAtual &&
      (l.status === 'pago' || l.status === 'pendente')
    )
  })

  const receitas = lancamentosMes
    .filter((l) => l.tipo === 'receita')
    .reduce((sum, l) => sum + l.valor, 0)

  const despesas = lancamentosMes
    .filter((l) => l.tipo === 'despesa')
    .reduce((sum, l) => sum + l.valor, 0)

  const faturasCartao = lancamentosMes
    .filter((l) => l.tipo === 'despesa' && l.cartao_id)
    .reduce((sum, l) => sum + l.valor, 0)

  const saldo = receitas - despesas

  // Get recent transactions (last 5) - criar cópia antes de ordenar!
  const transacoesRecentes = [...lancamentos]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
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

  const gastosPorCategoria = Object.values(grouped)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10) // Top 10

  // Chart data - Receitas x Despesas (últimos 6 meses) - SEM useMemo para evitar loops
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Receitas */}
        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1">Receitas do Mês</p>
                <p className="text-2xl font-bold text-gray-100">{formatCurrency(receitas)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {receitas > 0 ? 'Recebido e a receber' : 'Nenhuma receita cadastrada'}
            </p>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1">Despesas do Mês</p>
                <p className="text-2xl font-bold text-gray-100">{formatCurrency(despesas)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <TrendingDown className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {despesas > 0 ? 'Pago e a pagar' : 'Nenhuma despesa cadastrada'}
            </p>
          </CardContent>
        </Card>

        {/* Saldo */}
        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1">Saldo Projetado</p>
                <p className="text-2xl font-bold text-gray-100">{formatCurrency(saldo)}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${saldo >= 0 ? 'bg-primary-500/10' : 'bg-red-500/10'} flex items-center justify-center shrink-0`}>
                <Wallet className={`w-6 h-6 ${saldo >= 0 ? 'text-primary-400' : 'text-red-400'}`} />
              </div>
            </div>
            <p className="text-xs text-gray-500">{saldo >= 0 ? 'Positivo' : 'Negativo'}</p>
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
                Gastos por Categoria (Mês Atual)
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

      {/* Transaction Modal */}
      <TransactionModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  )
}
