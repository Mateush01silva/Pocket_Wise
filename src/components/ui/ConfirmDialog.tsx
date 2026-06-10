import { useEffect } from 'react'
import { create } from 'zustand'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Button } from './Button'

/**
 * Diálogo de confirmação próprio do app — substitui window.confirm(), que
 * quebra a experiência no PWA/mobile (modal nativa fora do tema, mensagens
 * com \n mal renderizadas e sem acessibilidade).
 *
 * Uso (drop-in para `if (!confirm(...)) return`):
 *   if (!(await confirmDialog({ title: 'Deletar conta?', danger: true }))) return
 *
 * O <ConfirmDialogHost /> precisa estar montado uma única vez (App.tsx).
 */

export interface ConfirmDialogOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Estiliza a ação como destrutiva (botão vermelho) */
  danger?: boolean
}

interface ConfirmDialogState {
  open: boolean
  options: ConfirmDialogOptions
  resolver: ((value: boolean) => void) | null
  ask: (options: ConfirmDialogOptions) => Promise<boolean>
  settle: (value: boolean) => void
}

const useConfirmDialogStore = create<ConfirmDialogState>((set, get) => ({
  open: false,
  options: { title: '' },
  resolver: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      // Se já houver um diálogo aberto, o anterior é resolvido como cancelado
      get().resolver?.(false)
      set({ open: true, options, resolver: resolve })
    }),
  settle: (value) => {
    get().resolver?.(value)
    set({ open: false, resolver: null })
  },
}))

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return useConfirmDialogStore.getState().ask(options)
}

export function ConfirmDialogHost() {
  const open = useConfirmDialogStore((s) => s.open)
  const options = useConfirmDialogStore((s) => s.options)
  const settle = useConfirmDialogStore((s) => s.settle)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, settle])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={() => settle(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-dark-900 border border-dark-700 shadow-xl w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              options.danger ? 'bg-red-500/20' : 'bg-primary-500/20'
            }`}
          >
            {options.danger ? (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            ) : (
              <HelpCircle className="w-5 h-5 text-primary-400" />
            )}
          </div>
          <div className="min-w-0 pt-1">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-gray-100">
              {options.title}
            </h2>
            {options.message && (
              <p className="text-sm text-gray-400 mt-1.5 whitespace-pre-line">{options.message}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            autoFocus
            className="flex-1 min-h-[44px]"
            onClick={() => settle(false)}
          >
            {options.cancelLabel || 'Cancelar'}
          </Button>
          <Button
            variant={options.danger ? 'danger' : 'primary'}
            className="flex-1 min-h-[44px]"
            onClick={() => settle(true)}
          >
            {options.confirmLabel || 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
