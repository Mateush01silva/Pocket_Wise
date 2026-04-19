import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { formatCurrency } from '../utils/currency'

export function EnvelopesWidget() {
  const navigate = useNavigate()
  const orcamentoAtual = useOrcamentosStore((state) => state.orcamentoAtual)
  const getEnvelopesDigitais = useOrcamentosStore((state) => state.getEnvelopesDigitais)

  const envelopes = useMemo(() => {
    if (!orcamentoAtual) return []
    return getEnvelopesDigitais(orcamentoAtual.id)
      .filter((e) => e.valor_orcado > 0)
      .sort((a, b) => b.valor_orcado - a.valor_orcado)
      .slice(0, 5)
  }, [orcamentoAtual, getEnvelopesDigitais])

  const totalOrcado = envelopes.reduce((sum, e) => sum + e.valor_orcado, 0)
  const totalGasto = envelopes.reduce((sum, e) => sum + e.valor_gasto, 0)
  const saldoLivre = totalOrcado - totalGasto

  if (!orcamentoAtual || envelopes.length === 0) return null

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-100">Envelopes do mês</h3>
        <button
          onClick={() => navigate('/app/envelopes')}
          className="text-sm text-primary-400 hover:text-primary-300 transition-colors font-medium"
        >
          Ver todos →
        </button>
      </div>

      <div className="space-y-3.5">
        {envelopes.map((envelope) => {
          const pct = Math.min(envelope.percentual_usado, 100)
          const barColor =
            envelope.status === 'critico'
              ? '#ef4444'
              : envelope.status === 'atencao'
              ? '#f59e0b'
              : (envelope.categoria.cor || '#6366f1')

          return (
            <div key={envelope.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-200 truncate">{envelope.categoria.nome}</span>
                <span className="text-sm font-medium text-gray-300 shrink-0">
                  {formatCurrency(envelope.valor_gasto)}{' '}
                  <span className="text-gray-600 font-normal">
                    / {formatCurrency(envelope.valor_orcado)}
                  </span>
                </span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div
        className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
          saldoLivre >= 0
            ? 'bg-green-500/10 border border-green-500/20'
            : 'bg-red-500/10 border border-red-500/20'
        }`}
      >
        <Sparkles size={14} className={saldoLivre >= 0 ? 'text-green-400 shrink-0' : 'text-red-400 shrink-0'} />
        <p className="text-sm text-gray-300">
          {saldoLivre >= 0 ? (
            <>
              Você está{' '}
              <span className="text-green-400 font-medium">{formatCurrency(saldoLivre)}</span>{' '}
              à frente do planejado para este mês.
            </>
          ) : (
            <>
              Você está{' '}
              <span className="text-red-400 font-medium">{formatCurrency(Math.abs(saldoLivre))}</span>{' '}
              acima do planejado para este mês.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
