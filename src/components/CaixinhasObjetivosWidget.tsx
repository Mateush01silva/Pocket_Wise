import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { formatCurrency } from '../utils/currency'

export function CaixinhasObjetivosWidget() {
  const navigate = useNavigate()
  const caixinhas = useCaixinhasStore((state) => state.caixinhas)
  const initialized = useCaixinhasStore((state) => state.initialized)

  const caixinhasObjetivo = useMemo(() => {
    return caixinhas
      .filter((c) => c.tipo !== 'investimento' && c.ativa && c.status === 'ativa')
      .sort((a, b) => (b.saldo_atual || 0) - (a.saldo_atual || 0))
      .slice(0, 5)
  }, [caixinhas])

  if (!initialized || caixinhasObjetivo.length === 0) return null

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-100">Metas e Sonhos</h3>
        <button
          onClick={() => navigate('/app/caixinhas')}
          className="text-sm text-primary-400 hover:text-primary-300 transition-colors font-medium"
        >
          Ver todas →
        </button>
      </div>

      <div className="space-y-4">
        {caixinhasObjetivo.map((caixinha) => {
          const pct = caixinha.progresso_percentual || 0
          const pctDisplay = Math.min(pct, 100)
          const barColor = caixinha.cor || '#6366f1'

          const pctColor =
            pct >= 100 ? 'text-green-400' : pct >= 75 ? 'text-blue-400' : 'text-primary-400'

          return (
            <div key={caixinha.id}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{caixinha.icone || '🎯'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{caixinha.nome}</p>
                    <p className="text-xs text-gray-500">
                      {caixinha.meta_valor
                        ? `${formatCurrency(caixinha.saldo_atual)} de ${formatCurrency(caixinha.meta_valor)}`
                        : formatCurrency(caixinha.saldo_atual)}
                    </p>
                  </div>
                </div>
                {caixinha.meta_valor && caixinha.meta_valor > 0 && (
                  <span className={`text-sm font-bold shrink-0 ${pctColor}`}>
                    {Math.round(pctDisplay)}%
                  </span>
                )}
              </div>
              {caixinha.meta_valor && caixinha.meta_valor > 0 && (
                <div className="w-full bg-dark-700 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${pctDisplay}%`, backgroundColor: barColor }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
