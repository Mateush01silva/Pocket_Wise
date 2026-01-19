import { Modal } from './ui/Modal'
import { formatCurrency } from '../utils/currency'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Lancamento, Categoria } from '../types'
import { TrendingDown, Calendar } from 'lucide-react'
import { cn } from '../lib/cn'

interface CategoryTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  categoria: Categoria
  subcategorias: Categoria[]
  transacoes: Lancamento[]
  mesReferencia: string
  valorOrcado: number
  valorGasto: number
}

export function CategoryTransactionsModal({
  isOpen,
  onClose,
  categoria,
  subcategorias,
  transacoes,
  mesReferencia,
  valorOrcado,
  valorGasto,
}: CategoryTransactionsModalProps) {
  const percentualUsado = valorOrcado > 0 ? (valorGasto / valorOrcado) * 100 : 0
  const valorDisponivel = valorOrcado - valorGasto

  const getSubcategoriaNome = (subcategoriaId: string | null | undefined) => {
    if (!subcategoriaId) return null
    const subcat = subcategorias.find(s => s.id === subcategoriaId)
    return subcat?.nome
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={categoria.nome}
      description={`Transações de ${format(new Date(mesTransacoes), 'MMMM yyyy', { locale: ptBR })}`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Resumo */}
        <div className="bg-dark-800 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Orçado</span>
            <span className="text-lg font-semibold text-gray-100">
              {formatCurrency(valorOrcado)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Gasto</span>
            <span className="text-lg font-semibold text-red-400">
              {formatCurrency(valorGasto)}
            </span>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-dark-700">
            <span className="text-sm text-gray-400">Disponível</span>
            <span
              className={cn(
                'text-lg font-semibold',
                valorDisponivel >= 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {formatCurrency(valorDisponivel)}
            </span>
          </div>

          {/* Barra de progresso */}
          <div className="space-y-2 pt-2">
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  percentualUsado < 80 && 'bg-green-500',
                  percentualUsado >= 80 && percentualUsado < 100 && 'bg-yellow-500',
                  percentualUsado >= 100 && 'bg-red-500'
                )}
                style={{ width: `${Math.min(percentualUsado, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{percentualUsado.toFixed(1)}% usado</span>
              <span>{transacoes.length} transações</span>
            </div>
          </div>
        </div>

        {/* Lista de Transações */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <TrendingDown size={16} />
            Despesas
          </h3>

          {transacoes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma transação nesta categoria
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {transacoes.map((transacao) => (
                <div
                  key={transacao.id}
                  className="bg-dark-800 rounded-lg p-4 hover:bg-dark-700 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-100 font-medium">
                          {transacao.observacao || `Despesa em ${categoria.nome}`}
                        </p>
                        {getSubcategoriaNome(transacao.subcategoria_id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30">
                            {getSubcategoriaNome(transacao.subcategoria_id)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Calendar size={12} className="text-gray-500" />
                        <span className="text-xs text-gray-500">
                          {format(new Date(transacao.data), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            transacao.status === 'pago' && 'bg-green-500/20 text-green-400',
                            transacao.status === 'pendente' && 'bg-yellow-500/20 text-yellow-400',
                            transacao.status === 'projetado' && 'bg-blue-500/20 text-blue-400'
                          )}
                        >
                          {transacao.status === 'pago' && 'Pago'}
                          {transacao.status === 'pendente' && 'Pendente'}
                          {transacao.status === 'projetado' && 'Projetado'}
                        </span>
                        {transacao.forma_pagamento && (
                          <span className="text-xs text-gray-500">
                            • {transacao.forma_pagamento === 'dinheiro' && 'Dinheiro'}
                            {transacao.forma_pagamento === 'debito' && 'Débito'}
                            {transacao.forma_pagamento === 'credito' && 'Crédito'}
                            {transacao.forma_pagamento === 'pix' && 'PIX'}
                            {transacao.forma_pagamento === 'transferencia' && 'Transferência'}
                            {transacao.forma_pagamento === 'boleto' && 'Boleto'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-lg font-semibold text-red-400 ml-4">
                      {formatCurrency(transacao.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
