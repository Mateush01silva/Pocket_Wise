import { useState, useCallback } from 'react'
import { Card, CardContent, Button } from '../components/ui'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore } from '../store'
import { TransactionModal } from '../components/TransactionModal'

export function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)

  // Stable callbacks to prevent render loops
  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

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

      {/* Empty State */}
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-200 mb-2">
              Bem-vindo ao PocketWise!
            </h3>
            <p className="text-gray-400 mb-6">
              {lancamentos.length === 0
                ? 'Comece adicionando sua primeira transação'
                : `Você tem ${lancamentos.length} transação(ões) cadastrada(s)`}
            </p>
            <Button onClick={handleOpenModal} className="gap-2">
              <Plus className="w-5 h-5" />
              Adicionar Transação
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Modal */}
      <TransactionModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  )
}
