import { useState, useMemo } from 'react'
import { ShoppingCart, AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { CurrencyInput } from './ui/CurrencyInput'
import { Select } from './ui/Select'
import { Button } from './ui/Button'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { useCategoriasStore } from '../store/useCategoriasStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'

export function PossoComprarFloating() {
  const [isOpen, setIsOpen] = useState(false)
  const [valor, setValor] = useState(0)
  const [categoriaId, setCategoriaId] = useState('')
  const [resultado, setResultado] = useState<ReturnType<typeof simularCompra> | null>(null)

  const orcamentoAtual = useOrcamentosStore((state) => state.orcamentoAtual)
  const simularCompra = useOrcamentosStore((state) => state.simularCompra)
  const categoriasRaw = useCategoriasStore((state) => state.categorias)

  // Filtrar categorias
  const categorias = useMemo(
    () => categoriasRaw.filter((c) => c.tipo === 'despesa' && !c.categoria_pai_id),
    [categoriasRaw]
  )

  const handleSimular = () => {
    if (valor <= 0 || !categoriaId || !orcamentoAtual) {
      return
    }

    const simulacao = simularCompra(valor, categoriaId, orcamentoAtual.id)
    setResultado(simulacao)
  }

  const handleClose = () => {
    setIsOpen(false)
    // Reset após fechar
    setTimeout(() => {
      setValor(0)
      setCategoriaId('')
      setResultado(null)
    }, 300)
  }

  const handleOpen = () => {
    setIsOpen(true)
  }

  const getIcon = () => {
    if (!resultado) return ShoppingCart
    if (resultado.nivel === 'ok') return CheckCircle
    if (resultado.nivel === 'atencao') return AlertTriangle
    return AlertCircle
  }

  const Icon = getIcon()

  // Não mostrar se não tiver orçamento
  if (!orcamentoAtual) {
    return null
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={handleOpen}
        className={cn(
          'fixed bottom-24 right-6 z-40',
          'flex items-center justify-center',
          'w-14 h-14 rounded-full',
          'bg-gradient-to-r from-secondary-500 to-secondary-600',
          'hover:from-secondary-400 hover:to-secondary-500',
          'shadow-lg shadow-secondary-500/30',
          'transition-all duration-200 hover:scale-105',
          'group'
        )}
        title="Posso Comprar?"
      >
        <ShoppingCart className="w-6 h-6 text-white" />

        {/* Tooltip */}
        <span className="absolute right-16 bg-dark-800 text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-dark-600">
          Posso Comprar?
        </span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Modal Content */}
          <div
            className={cn(
              'bg-dark-900 border border-dark-700 rounded-xl shadow-xl',
              'w-full max-w-md',
              'animate-in fade-in zoom-in-95 duration-200'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  !resultado && 'bg-secondary-500/20',
                  resultado?.nivel === 'ok' && 'bg-green-500/20',
                  resultado?.nivel === 'atencao' && 'bg-yellow-500/20',
                  resultado?.nivel === 'critico' && 'bg-red-500/20'
                )}>
                  <Icon className={cn(
                    'w-5 h-5',
                    !resultado && 'text-secondary-400',
                    resultado?.nivel === 'ok' && 'text-green-400',
                    resultado?.nivel === 'atencao' && 'text-yellow-400',
                    resultado?.nivel === 'critico' && 'text-red-400'
                  )} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-100">Posso Comprar?</h2>
                  <p className="text-xs text-gray-500">Simule antes de gastar</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-dark-800 transition-colors text-gray-400 hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor da Compra
                  </label>
                  <CurrencyInput
                    value={valor}
                    onChange={setValor}
                    placeholder="R$ 0,00"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Categoria
                  </label>
                  <Select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">Selecione a categoria</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nome}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Botão simular */}
              <Button
                onClick={handleSimular}
                disabled={valor <= 0 || !categoriaId}
                className="w-full"
              >
                <ShoppingCart size={18} className="mr-2" />
                Simular Compra
              </Button>

              {/* Resultado */}
              {resultado && (
                <div
                  className={cn(
                    'p-4 rounded-lg border animate-in fade-in slide-in-from-top-2 duration-300',
                    resultado.nivel === 'ok' && 'bg-green-500/10 border-green-500/30',
                    resultado.nivel === 'atencao' && 'bg-yellow-500/10 border-yellow-500/30',
                    resultado.nivel === 'critico' && 'bg-red-500/10 border-red-500/30'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      size={24}
                      className={cn(
                        'mt-1 shrink-0',
                        resultado.nivel === 'ok' && 'text-green-400',
                        resultado.nivel === 'atencao' && 'text-yellow-400',
                        resultado.nivel === 'critico' && 'text-red-400'
                      )}
                    />
                    <div className="flex-1">
                      <p
                        className={cn(
                          'font-medium mb-2',
                          resultado.nivel === 'ok' && 'text-green-400',
                          resultado.nivel === 'atencao' && 'text-yellow-400',
                          resultado.nivel === 'critico' && 'text-red-400'
                        )}
                      >
                        {resultado.pode_comprar ? '✓ Pode Comprar' : '✗ Não Recomendado'}
                      </p>
                      <p className="text-sm text-gray-300 mb-3">{resultado.mensagem}</p>

                      {/* Detalhes */}
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Impacto na categoria:</span>
                          <span className="text-gray-200 font-medium">
                            +{resultado.impacto_categoria.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Margem restante:</span>
                          <span
                            className={cn(
                              'font-medium',
                              resultado.margem_restante_categoria >= 0 ? 'text-green-400' : 'text-red-400'
                            )}
                          >
                            {formatCurrency(resultado.margem_restante_categoria)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dica */}
              {!resultado && (
                <div className="p-3 bg-secondary-500/10 border border-secondary-500/30 rounded-lg">
                  <p className="text-xs text-gray-400 text-center">
                    Digite um valor e selecione uma categoria para ver se você pode fazer essa compra sem
                    comprometer seu orçamento.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
