import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { formatCurrency } from '../utils/currency'

export function EnvelopesWidget() {
  const navigate = useNavigate()
  const orcamentoAtual = useOrcamentosStore((state) => state.orcamentoAtual)
  const getEnvelopesDigitais = useOrcamentosStore((state) => state.getEnvelopesDigitais)

  // Todos os envelopes com orçamento — usado para o cálculo do resumo
  const allEnvelopes = useMemo(() => {
    if (!orcamentoAtual) return []
    return getEnvelopesDigitais(orcamentoAtual.id).filter((e) => e.valor_orcado > 0)
  }, [orcamentoAtual, getEnvelopesDigitais])

  // Top 10 por valor orçado — divididos em duas colunas de 5
  const sorted = useMemo(
    () => [...allEnvelopes].sort((a, b) => b.valor_orcado - a.valor_orcado).slice(0, 10),
    [allEnvelopes]
  )
  const leftCol = sorted.slice(0, 5)
  const rightCol = sorted.slice(5, 10)

  // Resumo considera TODOS os envelopes, não só os exibidos
  const totalOrcado = allEnvelopes.reduce((sum, e) => sum + e.valor_orcado, 0)
  const totalGasto = allEnvelopes.reduce((sum, e) => sum + e.valor_gasto, 0)
  const saldoLivre = totalOrcado - totalGasto

  if (!orcamentoAtual || allEnvelopes.length === 0) return null

  const tooltipSaldo =
    saldoLivre >= 0
      ? `Gasto: ${formatCurrency(totalGasto)} de ${formatCurrency(totalOrcado)} orçados (todos os envelopes). Ainda há ${formatCurrency(saldoLivre)} disponível.`
      : `Gasto: ${formatCurrency(totalGasto)}, ultrapassando em ${formatCurrency(Math.abs(saldoLivre))} o total orçado de ${formatCurrency(totalOrcado)}.`

  const EnvelopeRow = ({ envelope }: { envelope: (typeof sorted)[number] }) => {
    const pct = Math.min(envelope.percentual_usado, 100)
    const barColor =
      envelope.status === 'critico'
        ? '#ef4444'
        : envelope.status === 'atencao'
        ? '#f59e0b'
        : envelope.categoria.cor || '#6366f1'

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-gray-200 truncate">{envelope.categoria.nome}</span>
          <span className="text-xs font-medium text-gray-300 shrink-0">
            {formatCurrency(envelope.valor_gasto)}{' '}
            <span className="text-gray-600 font-normal">/ {formatCurrency(envelope.valor_orcado)}</span>
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
  }

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

      {/* Duas colunas de envelopes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
        <div className="space-y-3.5">
          {leftCol.map((e) => <EnvelopeRow key={e.id} envelope={e} />)}
        </div>
        {rightCol.length > 0 && (
          <div className="space-y-3.5 mt-3.5 sm:mt-0">
            {rightCol.map((e) => <EnvelopeRow key={e.id} envelope={e} />)}
          </div>
        )}
      </div>

      {/* Resumo — baseado em todos os envelopes */}
      <div
        className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
          saldoLivre >= 0
            ? 'bg-green-500/10 border border-green-500/20'
            : 'bg-red-500/10 border border-red-500/20'
        }`}
      >
        <p className="flex-1 text-sm text-gray-300">
          {saldoLivre >= 0 ? (
            <>
              Ainda há{' '}
              <span className="text-green-400 font-medium">{formatCurrency(saldoLivre)}</span>{' '}
              disponível nos envelopes deste mês.
            </>
          ) : (
            <>
              Você ultrapassou o orçamento em{' '}
              <span className="text-red-400 font-medium">{formatCurrency(Math.abs(saldoLivre))}</span>{' '}
              este mês.
            </>
          )}
        </p>
        <span title={tooltipSaldo} className="shrink-0 mt-0.5 cursor-help">
          <Info size={14} className="text-gray-500 hover:text-gray-300" />
        </span>
      </div>
    </div>
  )
}
