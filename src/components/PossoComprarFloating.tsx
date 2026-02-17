import { useState, useMemo } from 'react'
import { ShoppingCart, AlertCircle, CheckCircle, AlertTriangle, X, GraduationCap, Lightbulb, Target, BookOpen } from 'lucide-react'
import { CurrencyInput } from './ui/CurrencyInput'
import { Select } from './ui/Select'
import { Button } from './ui/Button'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { useCategoriasStore } from '../store/useCategoriasStore'
import { useLearningModeStore } from '../store/useLearningModeStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import { learningContent } from '../lib/learningContent'

export function PossoComprarFloating() {
  const [isOpen, setIsOpen] = useState(false)
  const [valor, setValor] = useState(0)
  const [categoriaId, setCategoriaId] = useState('')
  const [resultado, setResultado] = useState<ReturnType<typeof simularCompra> | null>(null)
  const [showLearningTooltip, setShowLearningTooltip] = useState(false)

  const isLearningMode = useLearningModeStore((state) => state.isEnabled)
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
      {/* Learning Mode Tooltip - posicionado fixo acima do botão */}
      {isLearningMode && showLearningTooltip && (
        <div
          className="fixed z-[9999] w-80 max-w-[calc(100vw-24px)] animate-in fade-in-0 zoom-in-95 duration-200"
          style={{ bottom: 'calc(6rem + 3.5rem + 14px)', right: '24px' }}
          onMouseEnter={() => setShowLearningTooltip(true)}
          onMouseLeave={() => setShowLearningTooltip(false)}
        >
          <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-3 border-b border-dark-600">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-100">{learningContent.orcamentoPossoComprar.titulo}</h3>
                  <p className="text-xs text-amber-400/80">Modo Aprendizagem</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-72 overflow-y-auto overscroll-contain">
              <p className="text-sm text-gray-300 leading-relaxed">
                {learningContent.orcamentoPossoComprar.descricao}
              </p>
              {learningContent.orcamentoPossoComprar.comoFunciona && (
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Como funciona</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{learningContent.orcamentoPossoComprar.comoFunciona}</p>
                </div>
              )}
              {learningContent.orcamentoPossoComprar.exemplo && (
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Exemplo prático</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed italic">"{learningContent.orcamentoPossoComprar.exemplo}"</p>
                </div>
              )}
              {learningContent.orcamentoPossoComprar.porqueImportante && (
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">Por que isso importa</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{learningContent.orcamentoPossoComprar.porqueImportante}</p>
                </div>
              )}
              {learningContent.orcamentoPossoComprar.dicaPratica && (
                <div className="bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-lg p-3 border border-primary-500/20">
                  <p className="text-xs text-primary-300 leading-relaxed">
                    <span className="font-semibold">Dica:</span> {learningContent.orcamentoPossoComprar.dicaPratica}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-6 z-40">
        {/* Indicador de modo aprendizagem */}
        {isLearningMode && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full animate-pulse shadow-lg shadow-amber-500/50 z-10 pointer-events-none" />
        )}
        <button
          onClick={handleOpen}
          onMouseEnter={() => isLearningMode && setShowLearningTooltip(true)}
          onMouseLeave={() => setShowLearningTooltip(false)}
          className={cn(
            'flex items-center justify-center',
            'w-14 h-14 rounded-full',
            'bg-gradient-to-r from-secondary-500 to-secondary-600',
            'hover:from-secondary-400 hover:to-secondary-500',
            'shadow-lg shadow-secondary-500/30',
            'transition-all duration-200 hover:scale-105'
          )}
          title="Posso Comprar?"
        >
          <ShoppingCart className="w-6 h-6 text-white" />
        </button>
      </div>

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
