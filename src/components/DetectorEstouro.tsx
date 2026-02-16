import { useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './ui'
import { RebalanceamentoModal } from './RebalanceamentoModal'
import type { CategoriaBudgetComRelacoes } from '../types'
import { formatCurrency } from '../utils/currency'

interface DetectorEstouroProps {
  categoriasBudget: CategoriaBudgetComRelacoes[]
  orcamentoId: string
  onRebalanceado?: () => void | Promise<void>
}

export function DetectorEstouro({
  categoriasBudget,
  orcamentoId,
  onRebalanceado,
}: DetectorEstouroProps) {
  const [categoriaEstourada, setCategoriaEstourada] = useState<CategoriaBudgetComRelacoes | null>(
    null
  )
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Detectar categorias estouradas (tolerância de R$ 0,01 para evitar falsos positivos por arredondamento)
  const categoriasEstouradas = categoriasBudget.filter(
    (cat) => cat.valor_disponivel !== undefined && cat.valor_disponivel < -0.01
  )

  if (categoriasEstouradas.length === 0) {
    return null
  }

  const handleAbrirRebalanceamento = (categoria: CategoriaBudgetComRelacoes) => {
    setCategoriaEstourada(categoria)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setCategoriaEstourada(null)
  }

  const handleRebalanceado = async () => {
    // Aguardar a atualização do store completar
    await onRebalanceado?.()
    // Não fechar o modal aqui - deixar o RebalanceamentoModal fazer isso
  }

  return (
    <>
      {categoriaEstourada && (
        <RebalanceamentoModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          categoriaEstourada={categoriaEstourada}
          todasCategoriasBudget={categoriasBudget}
          orcamentoId={orcamentoId}
          onRebalanceado={handleRebalanceado}
        />
      )}

      <div className="space-y-2">
        {categoriasEstouradas.map((categoria) => {
          const valorEstouro = Math.abs(categoria.valor_disponivel || 0)
          const percentualEstouro = categoria.valor_orcado
            ? ((valorEstouro / categoria.valor_orcado) * 100).toFixed(1)
            : 0

          return (
            <div
              key={categoria.id}
              className="bg-red-500/10 border border-red-500/50 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <AlertTriangle className="text-red-400 mt-1 flex-shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-red-400 font-semibold mb-1">
                      {categoria.categoria?.nome} Estourada
                    </h3>
                    <div className="text-sm space-y-1">
                      <p className="text-gray-300">
                        Orçado:{' '}
                        <span className="font-medium">
                          {formatCurrency(categoria.valor_orcado || 0)}
                        </span>
                      </p>
                      <p className="text-gray-300">
                        Gasto:{' '}
                        <span className="font-medium">
                          {formatCurrency(categoria.valor_gasto || 0)}
                        </span>
                      </p>
                      <p className="text-red-400 font-bold">
                        Estouro: {formatCurrency(valorEstouro)} ({percentualEstouro}%)
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAbrirRebalanceamento(categoria)}
                  className="flex-shrink-0"
                >
                  <RefreshCw size={14} className="mr-1" />
                  Rebalancear
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
