import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, AlertTriangle, TrendingDown, TrendingUp, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { Transactions } from '../pages/Transactions'
import type { ResultadoVerificacao } from '../hooks/useVerificarFatura'

interface Props {
  isOpen: boolean
  onClose: () => void
  cartaoNome: string
  cartaoCor: string
  periodo: string
  resultado: ResultadoVerificacao
}

type ItemType = 'falta' | 'extra' | 'divergente'

function itemKey(type: ItemType, descricao: string, valor: number, data: string): string {
  return `${type}|${descricao}|${valor}|${data}`
}

export function DiscrepanciasSplitView({ isOpen, onClose, cartaoNome, cartaoCor, periodo, resultado }: Props) {
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [mobileTab, setMobileTab] = useState<'discrepancias' | 'transacoes'>('discrepancias')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showDismissed, setShowDismissed] = useState(false)

  const storageKey = `pw_disc_${cartaoNome}_${periodo}`

  // Load dismissed state from localStorage on open
  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setDismissed(new Set(JSON.parse(raw)))
    } catch {
      setDismissed(new Set())
    }
  }, [isOpen, storageKey])

  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      try { localStorage.setItem(storageKey, JSON.stringify([...next])) } catch { /* storage full */ }
      return next
    })
  }, [storageKey])

  if (!isOpen) return null

  const allItems = [
    ...resultado.no_pdf_nao_no_app.map(i => ({ type: 'falta' as ItemType, ...i })),
    ...resultado.no_app_nao_no_pdf.map(i => ({ type: 'extra' as ItemType, ...i })),
    ...resultado.valores_divergentes.map(i => ({ type: 'divergente' as ItemType, data: '', descricao: i.descricao, valor: i.valor_pdf })),
  ]

  const totalItems = allItems.length
  const dismissedCount = allItems.filter(i => dismissed.has(itemKey(i.type, i.descricao, i.valor, i.data))).length
  const pendingCount = totalItems - dismissedCount

  const temItens = totalItems > 0

  function renderItem(
    type: ItemType,
    item: { data: string; descricao: string; valor: number },
    extraContent?: React.ReactNode,
    colorClass?: string,
    borderClass?: string,
  ) {
    const key = itemKey(type, item.descricao, item.valor, item.data)
    const isDismissed = dismissed.has(key)

    if (isDismissed && !showDismissed) return null

    return (
      <div
        key={key}
        className={`p-2.5 rounded-lg border transition-opacity ${borderClass ?? 'border-dark-600'} ${colorClass ?? ''} ${isDismissed ? 'opacity-40' : ''}`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between gap-2 mb-0.5">
              <span className={`text-sm flex-1 min-w-0 truncate ${isDismissed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                {item.descricao}
              </span>
              <span className={`text-sm font-semibold shrink-0 ${isDismissed ? 'text-gray-500' : type === 'falta' ? 'text-red-300' : type === 'extra' ? 'text-blue-300' : 'text-yellow-300'}`}>
                {formatCurrency(item.valor)}
              </span>
            </div>
            {item.data && <p className="text-xs text-gray-500">{item.data}</p>}
            {extraContent}
          </div>
          <button
            onClick={() => dismiss(key)}
            title={isDismissed ? 'Marcar como pendente' : 'Marcar como resolvido'}
            className={`shrink-0 mt-0.5 p-1 rounded-md transition-colors ${
              isDismissed
                ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                : 'text-gray-600 hover:text-green-400 hover:bg-green-500/10'
            }`}
          >
            <CheckCircle2 size={15} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-dark-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 shrink-0 bg-dark-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cartaoCor }} />
          <span className="font-semibold text-gray-100 truncate">
            Lançar Discrepâncias — {cartaoNome}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile tabs */}
          <div className="flex md:hidden rounded-lg bg-dark-700 p-0.5 text-xs">
            <button
              onClick={() => setMobileTab('discrepancias')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                mobileTab === 'discrepancias' ? 'bg-dark-600 text-gray-100' : 'text-gray-400'
              }`}
            >
              Discrepâncias
            </button>
            <button
              onClick={() => setMobileTab('transacoes')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                mobileTab === 'transacoes' ? 'bg-dark-600 text-gray-100' : 'text-gray-400'
              }`}
            >
              Transações
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-full transition-colors text-gray-400 hover:text-gray-200 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: discrepancy list */}
        <div
          className={`
            ${mobileTab === 'transacoes' ? 'hidden' : 'flex'} md:flex flex-col
            ${leftCollapsed ? 'w-0 overflow-hidden' : 'w-full md:w-80 lg:w-96'}
            border-r border-dark-700 bg-dark-800/60 transition-[width] duration-200 shrink-0
          `}
        >
          {!leftCollapsed && (
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 min-h-0">

              {/* Progress header */}
              {temItens && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Discrepâncias encontradas
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      pendingCount === 0
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-dark-700 text-gray-400'
                    }`}>
                      {pendingCount === 0 ? '✓ Todas resolvidas' : `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {dismissedCount > 0 && (
                    <div className="w-full bg-dark-700 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(dismissedCount / totalItems) * 100}%` }}
                      />
                    </div>
                  )}

                  {/* Show dismissed toggle */}
                  {dismissedCount > 0 && (
                    <button
                      onClick={() => setShowDismissed(!showDismissed)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showDismissed
                        ? `Ocultar resolvidas (${dismissedCount})`
                        : `Mostrar resolvidas (${dismissedCount})`
                      }
                    </button>
                  )}
                </div>
              )}

              {/* Na fatura, não no app */}
              {resultado.no_pdf_nao_no_app.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown size={13} className="text-red-400" />
                    <p className="text-xs font-medium text-red-400">
                      Na fatura, não no app ({resultado.no_pdf_nao_no_app.length})
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {resultado.no_pdf_nao_no_app.map((item) =>
                      renderItem('falta', item, null, 'bg-red-500/5', 'border-red-500/15')
                    )}
                  </div>
                </div>
              )}

              {/* No app, não na fatura */}
              {resultado.no_app_nao_no_pdf.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp size={13} className="text-blue-400" />
                    <p className="text-xs font-medium text-blue-400">
                      No app, não na fatura ({resultado.no_app_nao_no_pdf.length})
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {resultado.no_app_nao_no_pdf.map((item) =>
                      renderItem('extra', item, null, 'bg-blue-500/5', 'border-blue-500/15')
                    )}
                  </div>
                </div>
              )}

              {/* Valores divergentes */}
              {resultado.valores_divergentes.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={13} className="text-yellow-400" />
                    <p className="text-xs font-medium text-yellow-400">
                      Valores divergentes ({resultado.valores_divergentes.length})
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {resultado.valores_divergentes.map((item) =>
                      renderItem(
                        'divergente',
                        { data: '', descricao: item.descricao, valor: item.valor_pdf },
                        <div className="flex gap-3 text-xs flex-wrap mt-1">
                          <span className="text-gray-500">
                            App: <span className="text-gray-300">{formatCurrency(item.valor_app)}</span>
                          </span>
                          <span className="text-gray-500">
                            Fatura: <span className="text-gray-300">{formatCurrency(item.valor_pdf)}</span>
                          </span>
                          <span className={`font-medium ${item.diferenca > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {item.diferenca > 0 ? '+' : ''}{formatCurrency(item.diferenca)}
                          </span>
                        </div>,
                        'bg-yellow-500/5',
                        'border-yellow-500/15',
                      )
                    )}
                  </div>
                </div>
              )}

              {!temItens && (
                <p className="text-sm text-gray-500 text-center py-6">
                  Nenhuma discrepância encontrada.
                </p>
              )}

              {/* Hint */}
              {temItens && pendingCount > 0 && (
                <p className="text-xs text-gray-600 text-center pt-2">
                  Toque em ✓ após resolver cada item
                </p>
              )}
            </div>
          )}

          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="hidden md:flex items-center justify-center w-full py-2 border-t border-dark-700 text-gray-500 hover:text-gray-300 hover:bg-dark-700/50 transition-colors shrink-0 text-xs gap-1"
            title={leftCollapsed ? 'Expandir painel' : 'Recolher painel'}
          >
            {leftCollapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Recolher</span></>}
          </button>
        </div>

        {/* Right panel: full Transactions page */}
        <div
          className={`
            ${mobileTab === 'discrepancias' ? 'hidden' : 'flex'} md:flex flex-col flex-1 min-w-0 overflow-hidden
          `}
        >
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
            <Transactions />
          </div>
        </div>
      </div>
    </div>
  )
}
