import { useState, useMemo } from 'react'
import { ShoppingCart, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { CurrencyInput } from './ui/CurrencyInput'
import { Select } from './ui/Select'
import { Button } from './ui/Button'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { useCategoriasStore } from '../store/useCategoriasStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'

interface PossoComprarWidgetProps {
  orcamentoId: string
  className?: string
}

export function PossoComprarWidget({ orcamentoId, className }: PossoComprarWidgetProps) {
  const [valor, setValor] = useState(0)
  const [categoriaId, setCategoriaId] = useState('')
  const [resultado, setResultado] = useState<ReturnType<typeof simularCompra> | null>(null)

  const simularCompra = useOrcamentosStore((state) => state.simularCompra)
  const categoriasRaw = useCategoriasStore((state) => state.categorias)
  
  // Filtrar categorias com useMemo para evitar novo array a cada render
  const categorias = useMemo(
    () => categoriasRaw.filter((c) => c.tipo === 'despesa' && !c.categoria_pai_id),
    [categoriasRaw]
  )

  const handleSimular = () => {
    if (valor <= 0 || !categoriaId) {
      return
    }

    const simulacao = simularCompra(valor, categoriaId, orcamentoId)
    setResultado(simulacao)
  }

  const getIcon = () => {
    if (!resultado) return ShoppingCart
    if (resultado.nivel === 'ok') return CheckCircle
    if (resultado.nivel === 'atencao') return AlertTriangle
    return AlertCircle
  }

  const Icon = getIcon()

  const getColorClasses = () => {
    if (!resultado) return 'text-primary-500'
    if (resultado.nivel === 'ok') return 'text-green-500'
    if (resultado.nivel === 'atencao') return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon size={20} className={getColorClasses()} />
          Posso Comprar?
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Valor da Compra</label>
            <CurrencyInput
              value={valor}
              onChange={setValor}
              placeholder="R$ 0,00"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
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
                  'mt-1',
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
          <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
            <p className="text-xs text-gray-400 text-center">
              Digite um valor e selecione uma categoria para ver se você pode fazer essa compra sem
              comprometer seu orçamento.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
