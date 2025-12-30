import { Modal } from './ui'
import { formatCurrency } from '../utils/currency'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X } from 'lucide-react'
import type { Lancamento } from '../types'

interface CategoryDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  categoryName: string
  categoryColor: string
  transactions: Lancamento[]
  totalValue: number
  getCategoryName: (id: string | null) => string
}

export function CategoryDetailsModal({
  isOpen,
  onClose,
  categoryName,
  categoryColor,
  transactions,
  totalValue,
  getCategoryName
}: CategoryDetailsModalProps) {
  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="max-w-3xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${categoryColor}20` }}
            >
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: categoryColor }}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">{categoryName}</h2>
              <p className="text-sm text-gray-400">
                {transactions.length} transaç{transactions.length === 1 ? 'ão' : 'ões'} • {formatCurrency(totalValue)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Transactions List */}
        <div className="max-h-96 overflow-y-auto space-y-2">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma transação encontrada
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-400 border-b border-dark-700">
                <div className="col-span-2">Data</div>
                <div className="col-span-3">Subcategoria</div>
                <div className="col-span-4">Observação</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Valor</div>
              </div>

              {/* Table Body */}
              {transactions
                .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                .map((transaction) => (
                  <div
                    key={transaction.id}
                    className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors border border-dark-700/50"
                  >
                    <div className="col-span-2 text-sm text-gray-300">
                      {format(new Date(transaction.data), 'dd/MM/yy', { locale: ptBR })}
                    </div>
                    <div className="col-span-3 text-sm text-gray-300 truncate">
                      {transaction.subcategoria_id
                        ? getCategoryName(transaction.subcategoria_id)
                        : '-'}
                    </div>
                    <div className="col-span-4 text-sm text-gray-400 truncate">
                      {transaction.observacao || '-'}
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          transaction.status === 'pago'
                            ? 'bg-green-500/10 text-green-400'
                            : transaction.status === 'pendente'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {transaction.status === 'pago' && 'Pago'}
                        {transaction.status === 'pendente' && 'Pendente'}
                        {transaction.status === 'projetado' && 'Projetado'}
                      </span>
                    </div>
                    <div className="col-span-1 text-right text-sm font-semibold text-red-400">
                      {formatCurrency(transaction.valor)}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-dark-700">
          <div className="text-sm text-gray-400">
            Total de {transactions.length} transaç{transactions.length === 1 ? 'ão' : 'ões'}
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">Total Gasto</div>
            <div className="text-xl font-bold text-red-400">
              {formatCurrency(totalValue)}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
