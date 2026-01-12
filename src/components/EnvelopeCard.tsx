import { DollarSign, TrendingDown } from 'lucide-react'
import type { EnvelopeDigital } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { HealthIndicator } from './HealthIndicator'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'

interface EnvelopeCardProps {
  envelope: EnvelopeDigital
  onClick?: () => void
}

export function EnvelopeCard({ envelope, onClick }: EnvelopeCardProps) {
  const { categoria, valor_orcado, valor_gasto, valor_disponivel, percentual_usado, status, prioridade } =
    envelope

  const Icon = categoria.icone ? DollarSign : TrendingDown

  // Cores de prioridade
  const prioridadeColors = {
    essencial: 'text-red-400 border-red-500/30',
    importante: 'text-yellow-400 border-yellow-500/30',
    desejavel: 'text-blue-400 border-blue-500/30',
  }

  return (
    <Card
      hover={!!onClick}
      onClick={onClick}
      className={cn('relative overflow-hidden', onClick && 'cursor-pointer')}
    >
      {/* Badge de prioridade */}
      <div
        className={cn(
          'absolute top-0 right-0 px-2 py-1 text-xs font-medium rounded-bl-lg border-l border-b',
          prioridadeColors[prioridade],
          'bg-dark-900/80'
        )}
      >
        {prioridade}
      </div>

      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            className="p-2 rounded-lg"
            style={{
              backgroundColor: `${categoria.cor}20`,
              borderColor: `${categoria.cor}40`,
              borderWidth: '1px',
            }}
          >
            <Icon size={20} style={{ color: categoria.cor || '#6366f1' }} />
          </div>

          <div className="flex-1">
            <CardTitle className="text-base">{categoria.nome}</CardTitle>
            <div className="mt-2">
              <HealthIndicator saude={status} size="sm" />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Gasto</span>
            <span className="font-medium text-gray-200">
              {formatCurrency(valor_gasto)} / {formatCurrency(valor_orcado)}
            </span>
          </div>

          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                status === 'saudavel' && 'bg-green-500',
                status === 'atencao' && 'bg-yellow-500',
                status === 'critico' && 'bg-red-500'
              )}
              style={{ width: `${Math.min(percentual_usado, 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-gray-500">{percentual_usado.toFixed(1)}% usado</span>
            <span
              className={cn(
                'font-medium',
                valor_disponivel > 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {valor_disponivel > 0 ? 'Disponível: ' : 'Estourado: '}
              {formatCurrency(Math.abs(valor_disponivel))}
            </span>
          </div>
        </div>

        {/* Últimas transações */}
        {envelope.ultimas_transacoes.length > 0 && (
          <div className="pt-3 border-t border-dark-700/50">
            <p className="text-xs text-gray-400 mb-2">Últimas transações</p>
            <div className="space-y-1">
              {envelope.ultimas_transacoes.slice(0, 2).map((transacao) => (
                <div key={transacao.id} className="flex justify-between text-xs">
                  <span className="text-gray-500 truncate max-w-[150px]">
                    {transacao.observacao || 'Sem descrição'}
                  </span>
                  <span className="text-red-400 font-medium">-{formatCurrency(transacao.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
