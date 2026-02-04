import { useState, useRef, useEffect, type ReactNode } from 'react'
import { GraduationCap, Lightbulb, Calculator, Target, BookOpen } from 'lucide-react'
import { useLearningModeStore } from '../../store/useLearningModeStore'
import { cn } from '../../lib/cn'

export interface LearningContent {
  titulo: string
  descricao: string
  comoFunciona?: string
  comoCalculado?: string
  exemplo?: string
  porqueImportante?: string
  dicaPratica?: string
}

interface LearningTooltipProps {
  children: ReactNode
  content: LearningContent
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function LearningTooltip({
  children,
  content,
  position = 'bottom',
  className,
}: LearningTooltipProps) {
  const isLearningMode = useLearningModeStore((state) => state.isEnabled)
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (!isLearningMode) return
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, 300) // pequeno delay para evitar tooltips acidentais
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const padding = 12

      let top = 0
      let left = 0

      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - padding
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
          break
        case 'bottom':
          top = triggerRect.bottom + padding
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
          break
        case 'left':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
          left = triggerRect.left - tooltipRect.width - padding
          break
        case 'right':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
          left = triggerRect.right + padding
          break
      }

      // Ajustar para não sair da tela
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (left < padding) left = padding
      if (left + tooltipRect.width > viewportWidth - padding) {
        left = viewportWidth - tooltipRect.width - padding
      }
      if (top < padding) top = padding
      if (top + tooltipRect.height > viewportHeight - padding) {
        top = viewportHeight - tooltipRect.height - padding
      }

      setTooltipPosition({ top, left })
    }
  }, [isVisible, position])

  // Se não estiver em modo de aprendizagem, renderiza só os children
  if (!isLearningMode) {
    return <>{children}</>
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn('relative inline-block', className)}
    >
      {/* Indicador visual de que há conteúdo educativo */}
      <div className="relative">
        {children}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full animate-pulse shadow-lg shadow-amber-500/50" />
      </div>

      {/* Tooltip Portal */}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] w-80 max-w-[90vw] animate-in fade-in-0 zoom-in-95 duration-200"
          style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-3 border-b border-dark-600">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-100">{content.titulo}</h3>
                  <p className="text-xs text-amber-400/80">Modo Aprendizagem</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {/* Descrição principal */}
              <p className="text-sm text-gray-300 leading-relaxed">
                {content.descricao}
              </p>

              {/* Como funciona */}
              {content.comoFunciona && (
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                      Como funciona
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {content.comoFunciona}
                  </p>
                </div>
              )}

              {/* Como é calculado */}
              {content.comoCalculado && (
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">
                      Como é calculado
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed font-mono bg-dark-800/50 p-2 rounded">
                    {content.comoCalculado}
                  </p>
                </div>
              )}

              {/* Exemplo prático */}
              {content.exemplo && (
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">
                      Exemplo prático
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed italic">
                    "{content.exemplo}"
                  </p>
                </div>
              )}

              {/* Por que é importante */}
              {content.porqueImportante && (
                <div className="bg-dark-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">
                      Por que isso importa
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {content.porqueImportante}
                  </p>
                </div>
              )}

              {/* Dica prática */}
              {content.dicaPratica && (
                <div className="bg-gradient-to-r from-primary-500/10 to-secondary-500/10 rounded-lg p-3 border border-primary-500/20">
                  <p className="text-xs text-primary-300 leading-relaxed">
                    <span className="font-semibold">Dica:</span> {content.dicaPratica}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente simplificado para menus (tooltip mais compacto)
interface LearningTooltipMenuProps {
  children: ReactNode
  content: LearningContent
  className?: string
}

export function LearningTooltipMenu({
  children,
  content,
  className,
}: LearningTooltipMenuProps) {
  const isLearningMode = useLearningModeStore((state) => state.isEnabled)
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (!isLearningMode) return
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, 400)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const padding = 8

      let top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
      let left = triggerRect.right + padding

      // Ajustar para não sair da tela
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (left + tooltipRect.width > viewportWidth - padding) {
        left = triggerRect.left - tooltipRect.width - padding
      }
      if (top < padding) top = padding
      if (top + tooltipRect.height > viewportHeight - padding) {
        top = viewportHeight - tooltipRect.height - padding
      }

      setTooltipPosition({ top, left })
    }
  }, [isVisible])

  if (!isLearningMode) {
    return <>{children}</>
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn('relative', className)}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] w-72 animate-in fade-in-0 slide-in-from-left-2 duration-200"
          style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-dark-800 border border-dark-600 rounded-lg shadow-xl shadow-black/50 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-3 py-2 border-b border-dark-600">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-gray-100">{content.titulo}</span>
              </div>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-xs text-gray-300 leading-relaxed">
                {content.descricao}
              </p>
              {content.dicaPratica && (
                <p className="text-xs text-primary-400 leading-relaxed">
                  <span className="font-semibold">Dica:</span> {content.dicaPratica}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
