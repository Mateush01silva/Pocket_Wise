import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { GraduationCap, Lightbulb, Calculator, Target, BookOpen, X } from 'lucide-react'
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
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelHide = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  const scheduleHide = () => {
    cancelHide()
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 150)
  }

  const handleMouseEnter = () => {
    if (!isLearningMode) return
    cancelHide()
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)
    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, 300)
  }

  const handleMouseLeave = () => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }
    scheduleHide()
  }

  // Touch/click support: toggle on tap
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isLearningMode) return
    e.stopPropagation()
    setIsVisible((prev) => !prev)
  }, [isLearningMode])

  // Close tooltip when clicking/touching outside
  useEffect(() => {
    if (!isVisible) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isVisible])

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const padding = 12
      const isMobile = window.innerWidth < 640

      let top = 0
      let left = 0

      if (isMobile) {
        // On mobile, position below the trigger, full width
        top = triggerRect.bottom + padding
        left = padding
      } else {
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
      onClick={handleClick}
      className={cn('relative inline-block cursor-pointer', className)}
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
          className="fixed z-[9999] w-80 max-w-[calc(100vw-24px)] animate-in fade-in-0 zoom-in-95 duration-200"
          style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          onMouseEnter={() => { cancelHide(); setIsVisible(true) }}
          onMouseLeave={scheduleHide}
        >
          <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-3 border-b border-dark-600">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-100">{content.titulo}</h3>
                    <p className="text-xs text-amber-400/80">Modo Aprendizagem</p>
                  </div>
                </div>
                {/* Close button visible on mobile */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsVisible(false)
                  }}
                  className="sm:hidden p-1.5 rounded-lg hover:bg-dark-700/50 text-gray-400 min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto overscroll-contain">
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
  const showTimeoutRef2 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimeoutRef2 = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelHide2 = () => {
    if (hideTimeoutRef2.current) {
      clearTimeout(hideTimeoutRef2.current)
      hideTimeoutRef2.current = null
    }
  }

  const scheduleHide2 = () => {
    cancelHide2()
    hideTimeoutRef2.current = setTimeout(() => {
      setIsVisible(false)
    }, 150)
  }

  const handleMouseEnter = () => {
    if (!isLearningMode) return
    cancelHide2()
    if (showTimeoutRef2.current) clearTimeout(showTimeoutRef2.current)
    showTimeoutRef2.current = setTimeout(() => {
      setIsVisible(true)
    }, 400)
  }

  const handleMouseLeave = () => {
    if (showTimeoutRef2.current) {
      clearTimeout(showTimeoutRef2.current)
      showTimeoutRef2.current = null
    }
    scheduleHide2()
  }

  // Touch/click support: toggle on tap (prevents navigation when in learning mode)
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isLearningMode) return
    e.preventDefault()
    e.stopPropagation()
    setIsVisible((prev) => !prev)
  }, [isLearningMode])

  // Close tooltip when clicking/touching outside
  useEffect(() => {
    if (!isVisible) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isVisible])

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const padding = 8
      const isMobile = window.innerWidth < 1024

      let top: number
      let left: number

      if (isMobile) {
        // On mobile/tablet, position below the trigger item
        top = triggerRect.bottom + padding
        left = padding
      } else {
        // On desktop, position to the right of the sidebar item
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
        left = triggerRect.right + padding
      }

      // Ajustar para não sair da tela
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (left + tooltipRect.width > viewportWidth - padding) {
        left = isMobile ? padding : triggerRect.left - tooltipRect.width - padding
      }
      if (left < padding) left = padding
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
      onClick={handleClick}
      className={cn('relative cursor-pointer', className)}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'fixed z-[9999] animate-in fade-in-0 duration-200',
            'w-72 max-w-[calc(100vw-16px)]',
            'lg:slide-in-from-left-2'
          )}
          style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          onMouseEnter={() => { cancelHide2(); setIsVisible(true) }}
          onMouseLeave={scheduleHide2}
        >
          <div className="bg-dark-800 border border-dark-600 rounded-lg shadow-xl shadow-black/50 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-3 py-2 border-b border-dark-600">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-gray-100">{content.titulo}</span>
                </div>
                {/* Close button for mobile/tablet */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsVisible(false)
                  }}
                  className="lg:hidden p-1 rounded text-gray-400 hover:text-gray-200 min-w-[28px] min-h-[28px] flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="p-3 space-y-2 max-h-[40vh] overflow-y-auto overscroll-contain">
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
