import { useMemo } from 'react'
import { Card, CardContent } from './ui'
import { AlertCircle, Clock, Calendar, CheckCircle } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useCategoriasStore } from '../store'
import { format, isToday, isThisWeek, isThisMonth, isPast, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

interface UpcomingBill {
  id: string
  descricao: string
  valor: number
  data: Date
  categoria_nome: string
  status: 'overdue' | 'today' | 'this_week' | 'this_month'
}

export function UpcomingBillsWidget() {
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)
  const navigate = useNavigate()

  // Calcular contas a pagar (despesas pendentes ou projetadas)
  const upcomingBills = useMemo((): UpcomingBill[] => {
    const today = startOfDay(new Date())

    return lancamentos
      .filter(l =>
        l.tipo === 'despesa' &&
        (l.status === 'pendente' || l.status === 'projetado')
      )
      .map(l => {
        const dataLancamento = new Date(l.data)
        const categoria = categorias.find(c => c.id === l.categoria_id)

        let status: 'overdue' | 'today' | 'this_week' | 'this_month' = 'this_month'

        if (isPast(dataLancamento) && !isToday(dataLancamento)) {
          status = 'overdue'
        } else if (isToday(dataLancamento)) {
          status = 'today'
        } else if (isThisWeek(dataLancamento)) {
          status = 'this_week'
        }

        return {
          id: l.id,
          descricao: l.descricao || categoria?.nome || 'Sem descrição',
          valor: l.valor,
          data: dataLancamento,
          categoria_nome: categoria?.nome || 'Sem categoria',
          status,
        }
      })
      .sort((a, b) => a.data.getTime() - b.data.getTime())
  }, [lancamentos, categorias])

  // Agrupar por status
  const billsByStatus = useMemo(() => {
    return {
      overdue: upcomingBills.filter(b => b.status === 'overdue'),
      today: upcomingBills.filter(b => b.status === 'today'),
      this_week: upcomingBills.filter(b => b.status === 'this_week'),
      this_month: upcomingBills.filter(b => b.status === 'this_month'),
    }
  }, [upcomingBills])

  const totalOverdue = billsByStatus.overdue.reduce((sum, b) => sum + b.valor, 0)
  const totalToday = billsByStatus.today.reduce((sum, b) => sum + b.valor, 0)
  const totalThisWeek = billsByStatus.this_week.reduce((sum, b) => sum + b.valor, 0)

  // Se não há contas, mostrar mensagem positiva
  if (upcomingBills.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-gray-100">Contas a Pagar</h2>
          </div>
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-green-400 font-medium">Tudo em dia!</p>
            <p className="text-sm text-gray-500 mt-1">Você não tem contas pendentes</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={billsByStatus.overdue.length > 0 ? 'border-2 border-red-500/30' : ''}>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertCircle className={`w-5 h-5 ${billsByStatus.overdue.length > 0 ? 'text-red-400' : 'text-yellow-400'}`} />
            <h2 className="text-lg font-semibold text-gray-100">Contas a Pagar</h2>
          </div>
          <button
            onClick={() => navigate('/app/transacoes')}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            Ver todas
          </button>
        </div>

        <div className="space-y-4">
          {/* Vencidas */}
          {billsByStatus.overdue.length > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-red-400">
                    Vencidas ({billsByStatus.overdue.length})
                  </span>
                </div>
                <span className="text-sm font-bold text-red-400">
                  {formatCurrency(totalOverdue)}
                </span>
              </div>
              <div className="space-y-2 mt-2">
                {billsByStatus.overdue.slice(0, 3).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between text-sm bg-dark-900/50 p-2 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 font-medium truncate">{bill.descricao}</p>
                      <p className="text-xs text-gray-500">
                        {format(bill.data, "dd 'de' MMM", { locale: ptBR })}
                      </p>
                    </div>
                    <span className="text-red-400 font-semibold ml-2">
                      {formatCurrency(bill.valor)}
                    </span>
                  </div>
                ))}
                {billsByStatus.overdue.length > 3 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{billsByStatus.overdue.length - 3} contas vencidas
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Hoje */}
          {billsByStatus.today.length > 0 && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-semibold text-orange-400">
                    Hoje ({billsByStatus.today.length})
                  </span>
                </div>
                <span className="text-sm font-bold text-orange-400">
                  {formatCurrency(totalToday)}
                </span>
              </div>
              <div className="space-y-2 mt-2">
                {billsByStatus.today.slice(0, 3).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between text-sm bg-dark-900/50 p-2 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 font-medium truncate">{bill.descricao}</p>
                      <p className="text-xs text-gray-500">{bill.categoria_nome}</p>
                    </div>
                    <span className="text-orange-400 font-semibold ml-2">
                      {formatCurrency(bill.valor)}
                    </span>
                  </div>
                ))}
                {billsByStatus.today.length > 3 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{billsByStatus.today.length - 3} contas hoje
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Esta semana */}
          {billsByStatus.this_week.length > 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-semibold text-yellow-400">
                    Esta semana ({billsByStatus.this_week.length})
                  </span>
                </div>
                <span className="text-sm font-bold text-yellow-400">
                  {formatCurrency(totalThisWeek)}
                </span>
              </div>
              <div className="space-y-2 mt-2">
                {billsByStatus.this_week.slice(0, 3).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between text-sm bg-dark-900/50 p-2 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 font-medium truncate">{bill.descricao}</p>
                      <p className="text-xs text-gray-500">
                        {format(bill.data, "dd 'de' MMM", { locale: ptBR })}
                      </p>
                    </div>
                    <span className="text-yellow-400 font-semibold ml-2">
                      {formatCurrency(bill.valor)}
                    </span>
                  </div>
                ))}
                {billsByStatus.this_week.length > 3 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{billsByStatus.this_week.length - 3} contas esta semana
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Este mês (resumo) */}
          {billsByStatus.this_month.length > 0 && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-blue-400">
                    Mais tarde este mês
                  </span>
                </div>
                <span className="text-sm text-blue-400">
                  {billsByStatus.this_month.length} conta{billsByStatus.this_month.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
