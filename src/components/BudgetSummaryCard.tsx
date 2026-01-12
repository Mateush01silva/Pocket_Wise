import { TrendingDown, TrendingUp, Wallet, PiggyBank } from 'lucide-react'
import type { ProjecaoMensal } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { HealthIndicator } from './HealthIndicator'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'

interface BudgetSummaryCardProps {
  projecao: ProjecaoMensal
  className?: string
}

export function BudgetSummaryCard({ projecao, className }: BudgetSummaryCardProps) {
  const {
    saldo_atual,
    saldo_projetado_fim_mes,
    saude,
    percentual_mes_decorrido,
    percentual_orcamento_usado,
  } = projecao

  const isOnPace = percentual_orcamento_usado <= percentual_mes_decorrido
  const variance = percentual_orcamento_usado - percentual_mes_decorrido

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet size={20} className="text-primary-500" />
            Resumo do Orçamento
          </CardTitle>
          <HealthIndicator saude={saude} size="sm" />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Saldo atual vs projetado */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <TrendingUp size={16} />
              Saldo Atual
            </div>
            <p className={cn('text-2xl font-bold', saldo_atual >= 0 ? 'text-green-400' : 'text-red-400')}>
              {formatCurrency(saldo_atual)}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <PiggyBank size={16} />
              Projeção Fim do Mês
            </div>
            <p
              className={cn(
                'text-2xl font-bold',
                saldo_projetado_fim_mes >= 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {formatCurrency(saldo_projetado_fim_mes)}
            </p>
          </div>
        </div>

        {/* Barra de progresso do mês */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Progresso do Mês</span>
            <span className="text-gray-200 font-medium">{percentual_mes_decorrido.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${percentual_mes_decorrido}%` }}
            />
          </div>
        </div>

        {/* Barra de uso do orçamento */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Orçamento Utilizado</span>
            <span
              className={cn(
                'font-medium',
                percentual_orcamento_usado <= 80
                  ? 'text-green-400'
                  : percentual_orcamento_usado <= 100
                    ? 'text-yellow-400'
                    : 'text-red-400'
              )}
            >
              {percentual_orcamento_usado.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                percentual_orcamento_usado <= 80
                  ? 'bg-green-500'
                  : percentual_orcamento_usado <= 100
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              )}
              style={{ width: `${Math.min(percentual_orcamento_usado, 100)}%` }}
            />
          </div>
        </div>

        {/* Análise de ritmo */}
        <div
          className={cn(
            'p-3 rounded-lg border',
            isOnPace
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-yellow-500/10 border-yellow-500/30'
          )}
        >
          <div className="flex items-start gap-2">
            <TrendingDown
              size={16}
              className={cn('mt-0.5', isOnPace ? 'text-green-400' : 'text-yellow-400')}
            />
            <div>
              <p className={cn('text-sm font-medium', isOnPace ? 'text-green-400' : 'text-yellow-400')}>
                {isOnPace ? 'Dentro do Ritmo' : 'Atenção ao Ritmo'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {isOnPace
                  ? `Você está gastando ${Math.abs(variance).toFixed(1)}% a menos que o esperado para este período do mês.`
                  : `Você está gastando ${variance.toFixed(1)}% a mais que o esperado para este período do mês.`}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
