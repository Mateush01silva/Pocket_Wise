import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full'
  // Ocupa a altura da tela e delega o scroll ao conteúdo (para layouts de
  // colunas com rolagem independente, como o planejamento de orçamento)
  fillHeight?: boolean
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  fillHeight = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Mantém a referência mais recente de onClose sem que ela faça parte das
  // dependências do efeito de foco. O onClose costuma ser recriado a cada
  // render do componente pai (ex.: um handleClose inline), então se ele
  // estivesse nas deps o efeito reexecutaria a cada tecla digitada — o
  // cleanup chamava previousFocusRef.current.focus() e o efeito recolocava o
  // foco no primeiro campo, "roubando" o foco do campo que o usuário estava
  // digitando (bug do foco que saía letra por letra).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Esc fecha; Tab fica preso dentro do diálogo (focus trap); ao fechar, o
  // foco volta para o elemento que abriu o modal — sem isso, leitores de
  // tela e navegação por teclado "escapam" para a página atrás do overlay
  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement as HTMLElement | null

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement

        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'

    // Foco inicial no primeiro campo do modal
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.[0]?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = 'unset'
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    full: 'max-w-[1500px]',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${maxWidthClasses[maxWidth]} bg-dark-900 border border-dark-700/50 shadow-2xl flex flex-col rounded-t-2xl sm:rounded-xl ${
          fillHeight
            ? 'h-[100dvh] sm:h-[92vh] max-h-[100dvh] sm:max-h-[92vh]'
            : 'max-h-[100dvh] sm:max-h-[85vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-dark-700/50 shrink-0">
          <div className="min-w-0 pr-4">
            <h2 id="modal-title" className="text-lg sm:text-xl font-bold text-gray-100 truncate">{title}</h2>
            {description && (
              <p className="text-xs sm:text-sm text-gray-400 mt-1">{description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 min-w-[44px] min-h-[44px]"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content - Scrollable (ou delegado ao conteúdo com fillHeight) */}
        <div
          className={
            fillHeight
              ? 'flex-1 min-h-0 flex flex-col overflow-hidden'
              : 'p-4 sm:p-6 overflow-y-auto overscroll-contain min-h-0'
          }
        >
          {children}
        </div>
      </div>
    </div>
  )
}
