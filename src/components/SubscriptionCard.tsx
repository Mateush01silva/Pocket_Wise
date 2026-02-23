import { Calendar, Edit2, Trash2, Ban, TrendingUp, Clock, CreditCard } from 'lucide-react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { formatCurrency } from '../utils/currency'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AssinaturaComDetalhes } from '../types'
import { cn } from '../lib/cn'
import { useCartoesStore } from '../store'

interface SubscriptionCardProps {
  assinatura: AssinaturaComDetalhes
  onEdit?: (assinatura: AssinaturaComDetalhes) => void
  onCancel?: (assinatura: AssinaturaComDetalhes) => void
  onDelete?: (assinatura: AssinaturaComDetalhes) => void
}

export function SubscriptionCard({ assinatura, onEdit, onCancel, onDelete }: SubscriptionCardProps) {
  const cartoes = useCartoesStore((state) => state.cartoes)
  const cartaoVinculado = assinatura.cartao_id
    ? cartoes.find((c) => c.id === assinatura.cartao_id)
    : null

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

            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <p className="text-sm text-gray-400">{assinatura.categoria_nome}</p>
              {cartaoVinculado && (
                <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  <CreditCard className="w-3 h-3" />
                  {cartaoVinculado.nome}
                </span>
              )}
            </div>

            {/* Próxima cobrança */}
            {assinatura.ativa && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>
                  Próxima cobrança: {format(parseISO(assinatura.proxima_cobranca), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            )}

            {!assinatura.ativa && assinatura.ultima_cobranca && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Ban className="w-4 h-4" />
                <span>
                  Última cobrança: {format(parseISO(assinatura.ultima_cobranca), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            )}

            {/* Data de cadastro */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <Clock className="w-3 h-3" />
              <span>
                Cadastrada em {format(parseISO(assinatura.created_at), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
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
          <div className="flex flex-col gap-2">
            {assinatura.ativa && onEdit && onCancel && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(assinatura)}
                  className="text-xs"
                >
                  <Edit2 className="w-3 h-3 mr-1.5" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCancel(assinatura)}
                  className="text-xs text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                >
                  <Ban className="w-3 h-3 mr-1.5" />
                  Cancelar
                </Button>
              </>
            )}
            {!assinatura.ativa && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(assinatura)}
                className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-3 h-3 mr-1.5" />
                Excluir
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
