import { useMemo, useState } from 'react'
import { Card, CardContent } from './ui'
import { AlertCircle, Clock, Calendar, CheckCircle, TrendingUp, TrendingDown, Check } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useCategoriasStore } from '../store'
import { format, isToday, isThisWeek, isPast, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

interface UpcomingItem {
  id: string
  descricao: string
  valor: number
  data: Date
  categoria_nome: string
  tipo: 'despesa' | 'receita'
  status: 'overdue' | 'today' | 'this_week' | 'upcoming'
  forma_pagamento: string
}

export function UpcomingBillsWidget() {
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)
  const marcarComoPago = useTransacoesStore((state) => state.marcarComoPago)
  const navigate = useNavigate()
  const [loadingIds, setLoadingIds] = useState<string[]>([])

  // Handler para marcar como pago
  const handleMarcarComoPago = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setLoadingIds(prev => [...prev, id])
    try {
      await marcarComoPago(id)
    } finally {
      setLoadingIds(prev => prev.filter(i => i !== id))
    }
  }

  // Calcular itens pendentes - APENAS transações que não são cartão de crédito
  // Cartão de crédito já vai para a fatura e não precisa de lembrete manual
  const upcomingItems = useMemo((): UpcomingItem[] => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const proximos15Dias = addDays(hoje, 15)

    return lancamentos
      .filter(l => {
        // Excluir cartão de crédito - esses vão para a fatura automaticamente
        if (l.forma_pagamento === 'credito') return false

        // Apenas pendentes ou projetados
        if (l.status !== 'pendente' && l.status !== 'projetado') return false

        // Despesas OU receitas (receitas para lembrar de conferir se recebeu)
        const dataLancamento = new Date(l.data)
        dataLancamento.setHours(0, 0, 0, 0)

        // Mostrar: vencidos, hoje, esta semana, ou próximos 15 dias
        return dataLancamento <= proximos15Dias
      })
      .map(l => {
        const dataLancamento = new Date(l.data)
        dataLancamento.setHours(0, 0, 0, 0)
        const categoria = categorias.find(c => c.id === l.categoria_id)

        let status: 'overdue' | 'today' | 'this_week' | 'upcoming' = 'upcoming'

        if (isPast(dataLancamento) && !isToday(dataLancamento)) {
          status = 'overdue'
        } else if (isToday(dataLancamento)) {
          status = 'today'
        } else if (isThisWeek(dataLancamento)) {
          status = 'this_week'
        }

        return {
          id: l.id,
          descricao: l.observacao || categoria?.nome || 'Sem descrição',
          valor: l.valor,
          data: dataLancamento,
          categoria_nome: categoria?.nome || 'Sem categoria',
          tipo: l.tipo,
          status,
          forma_pagamento: l.forma_pagamento,
        }
      })
      .sort((a, b) => {
        // Ordenar: vencidos primeiro, depois por data
        if (a.status === 'overdue' && b.status !== 'overdue') return -1
        if (a.status !== 'overdue' && b.status === 'overdue') return 1
        return a.data.getTime() - b.data.getTime()
      })
  }, [lancamentos, categorias])

  // Separar despesas e receitas
  const despesas = useMemo(() => upcomingItems.filter(i => i.tipo === 'despesa'), [upcomingItems])
  const receitas = useMemo(() => upcomingItems.filter(i => i.tipo === 'receita'), [upcomingItems])

  // Agrupar despesas por status
  const despesasByStatus = useMemo(() => ({
    overdue: despesas.filter(b => b.status === 'overdue'),
    today: despesas.filter(b => b.status === 'today'),
    this_week: despesas.filter(b => b.status === 'this_week'),
    upcoming: despesas.filter(b => b.status === 'upcoming'),
  }), [despesas])

  // Agrupar receitas por status
  const receitasByStatus = useMemo(() => ({
    overdue: receitas.filter(b => b.status === 'overdue'),
    today: receitas.filter(b => b.status === 'today'),
    this_week: receitas.filter(b => b.status === 'this_week'),
    upcoming: receitas.filter(b => b.status === 'upcoming'),
  }), [receitas])

  const totalDespesasVencidas = despesasByStatus.overdue.reduce((sum, b) => sum + b.valor, 0)
  const totalReceitasPendentes = receitas.filter(r => r.status === 'overdue' || r.status === 'today').reduce((sum, b) => sum + b.valor, 0)

  // Helper para nome da forma de pagamento
  const getFormaPagamentoLabel = (fp: string) => {
    const labels: Record<string, string> = {
      'pix': 'PIX',
      'dinheiro': 'Dinheiro',
      'debito': 'Débito',
      'boleto': 'Boleto',
      'transferencia': 'Transferência',
    }
    return labels[fp] || fp
  }

  // Se não há nada pendente, mostrar mensagem positiva
  if (upcomingItems.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-gray-100">Lembretes</h2>
          </div>
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-green-400 font-medium">Tudo em dia!</p>
            <p className="text-xs text-gray-500 mt-1">
              Nenhum pagamento ou recebimento pendente
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Renderizar item com botão de marcar como pago
  const renderItem = (item: UpcomingItem, colorClass: string) => {
    const isLoading = loadingIds.includes(item.id)
    return (
      <div
        key={item.id}
        className="flex items-center gap-2 text-sm bg-dark-900/50 p-2 rounded group"
      >
        {/* Botão de marcar como pago */}
        <button
          onClick={(e) => handleMarcarComoPago(item.id, e)}
          disabled={isLoading}
          title={item.tipo === 'receita' ? 'Marcar como recebido' : 'Marcar como pago'}
          className="w-6 h-6 rounded-full border-2 border-gray-600 hover:border-green-400 hover:bg-green-400/20 flex items-center justify-center transition-all shrink-0 group-hover:border-green-500"
        >
          {isLoading ? (
            <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="w-3 h-3 text-gray-600 group-hover:text-green-400" />
          )}
        </button>

        {/* Info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {item.tipo === 'despesa' ? (
            <TrendingDown className={`w-3.5 h-3.5 ${colorClass} shrink-0`} />
          ) : (
            <TrendingUp className={`w-3.5 h-3.5 ${colorClass} shrink-0`} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-gray-300 font-medium truncate">{item.descricao}</p>
            <p className="text-xs text-gray-500">
              {format(item.data, "dd/MM", { locale: ptBR })} • {getFormaPagamentoLabel(item.forma_pagamento)}
            </p>
          </div>
        </div>

        {/* Valor */}
        <span className={`${colorClass} font-semibold ml-2 whitespace-nowrap`}>
          {item.tipo === 'receita' ? '+' : '-'}{formatCurrency(item.valor)}
        </span>
      </div>
    )
  }

  return (
    <Card className={despesasByStatus.overdue.length > 0 ? 'border border-red-500/30' : ''}>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertCircle className={`w-5 h-5 ${despesasByStatus.overdue.length > 0 ? 'text-red-400' : 'text-amber-400'}`} />
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Lembretes</h2>
              <p className="text-xs text-gray-500">Pagamentos e recebimentos manuais</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/app/transacoes?status=pendente&periodo=todos')}
            className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            Ver todas
          </button>
        </div>

        <div className="space-y-3">
          {/* Despesas Vencidas - URGENTE */}
          {despesasByStatus.overdue.length > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-400 uppercase">
                    Pagar! ({despesasByStatus.overdue.length})
                  </span>
                </div>
                <span className="text-sm font-bold text-red-400">
                  {formatCurrency(totalDespesasVencidas)}
                </span>
              </div>
              <div className="space-y-1.5">
                {despesasByStatus.overdue.slice(0, 3).map((item) => renderItem(item, 'text-red-400'))}
                {despesasByStatus.overdue.length > 3 && (
                  <p className="text-xs text-gray-500 text-center pt-1">
                    +{despesasByStatus.overdue.length - 3} vencidas
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Receitas para conferir - vencidas ou hoje */}
          {(receitasByStatus.overdue.length > 0 || receitasByStatus.today.length > 0) && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400 uppercase">
                    Conferir recebimento
                  </span>
                </div>
                <span className="text-sm font-bold text-emerald-400">
                  {formatCurrency(totalReceitasPendentes)}
                </span>
              </div>
              <div className="space-y-1.5">
                {[...receitasByStatus.overdue, ...receitasByStatus.today].slice(0, 3).map((item) =>
                  renderItem(item, 'text-emerald-400')
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Verifique se já recebeu e marque como pago
              </p>
            </div>
          )}

          {/* Despesas de Hoje */}
          {despesasByStatus.today.length > 0 && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-semibold text-orange-400 uppercase">
                    Pagar Hoje ({despesasByStatus.today.length})
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                {despesasByStatus.today.slice(0, 3).map((item) => renderItem(item, 'text-orange-400'))}
              </div>
            </div>
          )}

          {/* Esta semana */}
          {despesasByStatus.this_week.length > 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-semibold text-yellow-400 uppercase">
                    Esta semana ({despesasByStatus.this_week.length})
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                {despesasByStatus.this_week.slice(0, 3).map((item) => renderItem(item, 'text-yellow-400'))}
                {despesasByStatus.this_week.length > 3 && (
                  <p className="text-xs text-gray-500 text-center pt-1">
                    +{despesasByStatus.this_week.length - 3} esta semana
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Próximos dias (resumo) */}
          {(despesasByStatus.upcoming.length > 0 || receitasByStatus.this_week.length > 0 || receitasByStatus.upcoming.length > 0) && (
            <div className="p-2 bg-dark-800/50 rounded-lg">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Próximos 15 dias</span>
                <span>
                  {despesasByStatus.upcoming.length + receitasByStatus.this_week.length + receitasByStatus.upcoming.length} itens
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
