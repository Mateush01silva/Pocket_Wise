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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* Total Assinaturas */}
      <LearningTooltip content={learningContent.assinaturasAtivas} position="bottom">
        <Card>
          <CardContent className="flex items-center gap-2 md:gap-3 p-3 md:p-4 lg:p-6">
            <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-400 leading-tight">Assinaturas Ativas</p>
              <p className="text-base md:text-xl font-bold text-gray-100 whitespace-nowrap">
                {summary.total_assinaturas_ativas}
              </p>
            </div>
          </CardContent>
        </Card>
      </LearningTooltip>

      {/* Custo Mensal */}
      <LearningTooltip content={learningContent.assinaturasTotalMensal} position="bottom">
        <Card>
          <CardContent className="flex items-center gap-2 md:gap-3 p-3 md:p-4 lg:p-6">
            <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-400 leading-tight">Custo Mensal</p>
              <p className="text-sm md:text-xl font-bold text-gray-100 whitespace-nowrap">
                {formatCurrency(summary.total_mensal)}
              </p>
            </div>
          </CardContent>
        </Card>
      </LearningTooltip>

      {/* Custo Anual */}
      <LearningTooltip content={learningContent.assinaturasTotalAnual} position="bottom">
        <Card>
          <CardContent className="flex items-center gap-2 md:gap-3 p-3 md:p-4 lg:p-6">
            <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-400 leading-tight">Custo Anual</p>
              <p className="text-sm md:text-xl font-bold text-gray-100 whitespace-nowrap">
                {formatCurrency(summary.total_anual)}
              </p>
            </div>
          </CardContent>
        </Card>
      </LearningTooltip>

      {/* Mais Cara — ocupa largura total no mobile para exibir o nome completo */}
      <Card className="col-span-2 lg:col-span-1">
        <CardContent className="flex items-center gap-2 md:gap-3 p-3 md:p-4 lg:p-6">
          <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-yellow-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm text-gray-400 leading-tight">Mais Cara</p>
            {summary.assinatura_mais_cara ? (
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-sm md:text-base font-bold text-gray-100 break-words leading-tight">
                  {summary.assinatura_mais_cara.nome}
                </p>
                <p className="text-xs text-gray-500 whitespace-nowrap">
                  {formatCurrency(
                    summary.assinatura_mais_cara.frequencia === 'mensal'
                      ? summary.assinatura_mais_cara.valor
                      : summary.assinatura_mais_cara.valor / 12
                  )}/mês
                </p>
              </div>
            ) : (
              <p className="text-base text-gray-500">-</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
