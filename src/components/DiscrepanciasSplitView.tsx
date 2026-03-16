import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { Transactions } from '../pages/Transactions'
import type { ResultadoVerificacao } from '../hooks/useVerificarFatura'

interface Props {
  isOpen: boolean
  onClose: () => void
  cartaoNome: string
  cartaoCor: string
  resultado: ResultadoVerificacao
}

export function DiscrepanciasSplitView({ isOpen, onClose, cartaoNome, cartaoCor, resultado }: Props) {
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [mobileTab, setMobileTab] = useState<'discrepancias' | 'transacoes'>('discrepancias')

  if (!isOpen) return null

  const temItens =
    resultado.no_pdf_nao_no_app.length > 0 ||
    resultado.no_app_nao_no_pdf.length > 0 ||
    resultado.valores_divergentes.length > 0

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
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Discrepâncias encontradas
              </p>

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
                    {resultado.no_pdf_nao_no_app.map((item, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-red-500/5 border border-red-500/15 rounded-lg"
                      >
                        <div className="flex justify-between gap-2 mb-0.5">
                          <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">
                            {item.descricao}
                          </span>
                          <span className="text-sm font-semibold text-red-300 shrink-0">
                            {formatCurrency(item.valor)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{item.data}</p>
                      </div>
                    ))}
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
                    {resultado.no_app_nao_no_pdf.map((item, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-blue-500/5 border border-blue-500/15 rounded-lg"
                      >
                        <div className="flex justify-between gap-2 mb-0.5">
                          <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">
                            {item.descricao}
                          </span>
                          <span className="text-sm font-semibold text-blue-300 shrink-0">
                            {formatCurrency(item.valor)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{item.data}</p>
                      </div>
                    ))}
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
                    {resultado.valores_divergentes.map((item, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-lg"
                      >
                        <p className="text-sm text-gray-200 truncate mb-1">{item.descricao}</p>
                        <div className="flex gap-3 text-xs flex-wrap">
                          <span className="text-gray-500">
                            App: <span className="text-gray-300">{formatCurrency(item.valor_app)}</span>
                          </span>
                          <span className="text-gray-500">
                            PDF: <span className="text-gray-300">{formatCurrency(item.valor_pdf)}</span>
                          </span>
                          <span className={`font-medium ${item.diferenca > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {item.diferenca > 0 ? '+' : ''}{formatCurrency(item.diferenca)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!temItens && (
                <p className="text-sm text-gray-500 text-center py-6">
                  Nenhuma discrepância encontrada.
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
            {leftCollapsed ? (
              <>
                <ChevronRight size={14} />
              </>
            ) : (
              <>
                <ChevronLeft size={14} />
                <span>Recolher</span>
              </>
            )}
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
