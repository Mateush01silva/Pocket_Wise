import { Card, CardContent } from './ui/Card'
import { TrendingUp, Calendar, DollarSign, Award } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { LearningTooltip } from './ui/LearningTooltip'
import { learningContent } from '../lib/learningContent'
import type { AssinaturasSummary } from '../types'

interface SubscriptionStatsProps {
  summary: AssinaturasSummary
}

export function SubscriptionStats({ summary }: SubscriptionStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* Total Assinaturas */}
      <LearningTooltip content={learningContent.assinaturasAtivas} position="bottom">
        <Card>
          <CardContent className="flex items-center gap-3 p-4 md:p-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-400">Assinaturas Ativas</p>
              <p className="text-lg md:text-2xl font-bold text-gray-100 truncate">
                {summary.total_assinaturas_ativas}
              </p>
            </div>
          </CardContent>
        </Card>
      </LearningTooltip>

      {/* Custo Mensal */}
      <LearningTooltip content={learningContent.assinaturasTotalMensal} position="bottom">
        <Card>
          <CardContent className="flex items-center gap-3 p-4 md:p-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-400">Custo Mensal</p>
              <p className="text-lg md:text-2xl font-bold text-gray-100 truncate">
                {formatCurrency(summary.total_mensal)}
              </p>
            </div>
          </CardContent>
        </Card>
      </LearningTooltip>

      {/* Custo Anual */}
      <LearningTooltip content={learningContent.assinaturasTotalAnual} position="bottom">
        <Card>
          <CardContent className="flex items-center gap-3 p-4 md:p-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-400">Custo Anual</p>
              <p className="text-lg md:text-2xl font-bold text-gray-100 truncate">
                {formatCurrency(summary.total_anual)}
              </p>
            </div>
          </CardContent>
        </Card>
      </LearningTooltip>

      {/* Mais Cara */}
      <Card>
        <CardContent className="flex items-center gap-3 p-4 md:p-6">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="text-sm text-gray-400">Mais Cara</p>
            {summary.assinatura_mais_cara ? (
              <>
                <p className="text-lg font-bold text-gray-100 truncate">
                  {summary.assinatura_mais_cara.nome}
                </p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(
                    summary.assinatura_mais_cara.frequencia === 'mensal'
                      ? summary.assinatura_mais_cara.valor
                      : summary.assinatura_mais_cara.valor / 12
                  )}/mês
                </p>
              </>
            ) : (
              <p className="text-lg text-gray-500">-</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
