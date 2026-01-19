import { Calendar, Edit2, Trash2, X, TrendingUp } from 'lucide-react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { formatCurrency } from '../utils/currency'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AssinaturaComDetalhes } from '../types'
import { cn } from '../lib/cn'

interface SubscriptionCardProps {
  assinatura: AssinaturaComDetalhes
  onEdit: (assinatura: AssinaturaComDetalhes) => void
  onCancel: (assinatura: AssinaturaComDetalhes) => void
  onDelete: (assinatura: AssinaturaComDetalhes) => void
}

export function SubscriptionCard({ assinatura, onEdit, onCancel, onDelete }: SubscriptionCardProps) {
  const valorMensal = assinatura.frequencia === 'mensal'
    ? assinatura.valor
    : assinatura.valor / 12

  return (
    <Card
      hover
      className={cn(
        'transition-all duration-200',
        !assinatura.ativa && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        {/* Logo e Info */}
        <div className="flex items-start gap-4 flex-1">
          {/* Logo */}
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0"
            style={{ backgroundColor: `${assinatura.categoria_cor || '#6B7280'}20` }}
          >
            {assinatura.logo_url || '📱'}
          </div>

          {/* Informações */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-100 truncate">
                {assinatura.nome}
              </h3>
              {!assinatura.ativa && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-400">
                  Cancelada
                </span>
              )}
            </div>

            <p className="text-sm text-gray-400 mb-3">{assinatura.categoria_nome}</p>

            {/* Próxima cobrança */}
            {assinatura.ativa && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>
                  Próxima cobrança: {format(parseISO(assinatura.proxima_cobranca), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            )}

            {assinatura.ultima_cobranca && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <X className="w-4 h-4" />
                <span>
                  Cancelada em: {format(parseISO(assinatura.ultima_cobranca), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Valores e Ações */}
        <div className="text-right ml-4">
          <div className="mb-3">
            <p className="text-2xl font-bold text-gray-100">
              {formatCurrency(valorMensal)}
            </p>
            <p className="text-xs text-gray-500">por mês</p>
            {assinatura.frequencia === 'anual' && (
              <p className="text-xs text-gray-400 mt-1">
                {formatCurrency(assinatura.valor)}/ano
              </p>
            )}
          </div>

          {/* Total pago no ano */}
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
            <TrendingUp className="w-3 h-3" />
            <span>{formatCurrency(assinatura.total_pago_ano)} no ano</span>
          </div>

          {/* Ações */}
          <div className="flex gap-2 justify-end">
            {assinatura.ativa && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(assinatura)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCancel(assinatura)}
                  className="h-8 w-8 p-0 text-yellow-500 hover:text-yellow-400"
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(assinatura)}
              className="h-8 w-8 p-0 text-red-500 hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
