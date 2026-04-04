import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Loader2, X, Zap, Crown, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../hooks/usePlan'
import { createCheckout, openPaymentWindow, redirectToPayment } from '../services/paymentService'
import type { PlanType } from '../services/paymentService'

// ============================================================================
// CPF/CNPJ helpers (same as Paywall.tsx)
// ============================================================================

function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function isValidCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length === 11 || digits.length === 14
}

// ============================================================================
// Plan data
// ============================================================================

type BillingCycle = 'mensal' | 'anual'

const EXPLORADOR_FEATURES = [
  '14 dias grátis',
  'Dashboard completo',
  'Até 20 transações',
  '1 cartão de crédito',
  '1 conta bancária',
  '5 envelopes de orçamento',
  '2 caixinhas',
  'Rebalanceamento',
  'Posso Comprar? (simulação)',
]

const PLANEJADOR_FEATURES = [
  'Tudo do Explorador sem limites',
  'Fluxo de Caixa',
  'Relatórios Comparativos',
  'Família / Multi-usuário',
  'Caixinhas ilimitadas',
  'Transações, cartões e contas ilimitados',
  'Envelopes ilimitados',
]

const MESTRE_FEATURES = [
  'Tudo do Planejador',
  'Pocks — Score de Saúde Financeira',
  'Assistente Financeiro IA',
  'Posso Comprar? com IA',
  'Personalidades do assistente IA',
  'Créditos mensais de IA',
]

// ============================================================================
// Component
// ============================================================================

export function Assinatura() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { subscription, refreshSubscription } = useAuth()
  const { tier, trialDaysLeft } = usePlan()

  const [ciclo, setCiclo] = useState<BillingCycle>(
    searchParams.get('ciclo') === 'anual' ? 'anual' : 'mensal'
  )

  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null)
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null)
  const [waitingPayment, setWaitingPayment] = useState(false)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    stopPolling()
    setWaitingPayment(true)
    pollingRef.current = setInterval(async () => {
      try {
        const sub = await refreshSubscription()
        if (sub?.status === 'active') {
          stopPolling()
          setWaitingPayment(false)
          navigate('/app', { replace: true })
          setTimeout(() => toast.success('Pagamento confirmado! Bem-vindo ao PocketWise!'), 100)
        }
      } catch { /* silencioso */ }
    }, 5000)
  }, [refreshSubscription, stopPolling, navigate])

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && waitingPayment) {
        try {
          const sub = await refreshSubscription()
          if (sub?.status === 'active') {
            stopPolling()
            setWaitingPayment(false)
            navigate('/app', { replace: true })
            setTimeout(() => toast.success('Pagamento confirmado!'), 100)
          }
        } catch { /* silencioso */ }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [waitingPayment, refreshSubscription, stopPolling, navigate])

  useEffect(() => () => stopPolling(), [stopPolling])

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
    setCpfCnpj(formatCpfCnpj(raw))
  }

  const handleConfirmSubscription = async () => {
    if (!selectedPlan) return
    const digits = cpfCnpj.replace(/\D/g, '')
    if (!isValidCpfCnpj(digits)) {
      toast.error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.')
      return
    }
    setLoadingPlan(selectedPlan)
    const paymentWindow = openPaymentWindow()
    try {
      const result = await createCheckout(selectedPlan, digits)
      if (result.subscription.paymentLink) {
        setSelectedPlan(null)
        setPaymentLink(result.subscription.paymentLink)
        redirectToPayment(result.subscription.paymentLink, paymentWindow)
        startPolling()
      } else {
        paymentWindow?.close()
        toast.success('Assinatura criada! Verifique seu email para o link de pagamento.')
        setSelectedPlan(null)
        startPolling()
      }
    } catch (error) {
      paymentWindow?.close()
      toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento.')
    } finally {
      setLoadingPlan(null)
    }
  }

  // Prorate: Planejador → Mestre
  const prorateMestre = (() => {
    if (tier !== 'planejador' || !subscription?.current_period_end) return null
    const diasRestantes = Math.max(0, Math.ceil(
      (new Date(subscription.current_period_end).getTime() - Date.now()) / 86400000
    ))
    const valorHoje = Math.round((18.90 - 12.90) / 30 * diasRestantes * 100) / 100
    return { diasRestantes, valorHoje }
  })()

  // Trial progress
  const trialProgress = Math.max(0, Math.min(100, ((14 - trialDaysLeft) / 14) * 100))

  // Determine plan IDs based on cycle
  const planejadorPlanId: PlanType = ciclo === 'anual' ? 'planejador_annual' : 'planejador_monthly'
  const mestrePlanId: PlanType = ciclo === 'anual' ? 'mestre_annual' : 'mestre_monthly'

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Escolha seu plano</h1>
        <p className="text-gray-400">Comece grátis por 14 dias, sem cartão de crédito</p>
      </div>

      {/* Toggle mensal/anual */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <button
          onClick={() => setCiclo('mensal')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            ciclo === 'mensal'
              ? 'bg-secondary-500 text-white shadow-lg shadow-secondary-500/20'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Mensal
        </button>
        <button
          onClick={() => setCiclo('anual')}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
            ciclo === 'anual'
              ? 'bg-secondary-500 text-white shadow-lg shadow-secondary-500/20'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Anual
          <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
            -23%
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        {/* Explorador */}
        <div className={`relative bg-dark-800/50 border rounded-2xl p-6 ${
          tier === 'explorador' ? 'border-gray-500' : 'border-dark-700'
        }`}>
          {tier === 'explorador' && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Seu plano atual
            </div>
          )}
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-bold text-gray-100">Explorador</h3>
          </div>
          <div className="mb-4">
            <span className="text-3xl font-bold text-gray-100">Grátis</span>
            <p className="text-sm text-gray-500 mt-1">14 dias de trial</p>
          </div>

          {/* Trial progress bar */}
          {tier === 'explorador' && subscription?.status === 'trial' && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{trialDaysLeft} dias restantes</span>
                <span>14 dias</span>
              </div>
              <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gray-500 to-gray-400 rounded-full transition-all"
                  style={{ width: `${trialProgress}%` }}
                />
              </div>
            </div>
          )}

          <ul className="space-y-2 mb-6">
            {EXPLORADOR_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                <Check className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <button
            disabled
            className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-gray-500 bg-dark-700 cursor-not-allowed"
          >
            {tier === 'explorador' ? 'Plano atual' : 'Trial expirado'}
          </button>
        </div>

        {/* Planejador */}
        <div className={`relative bg-dark-800/50 border rounded-2xl p-6 ${
          tier === 'planejador'
            ? 'border-secondary-500'
            : 'border-dark-700 hover:border-secondary-500/50 transition-colors'
        }`}>
          {tier === 'planejador' && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Seu plano atual
            </div>
          )}
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-secondary-400" />
            <h3 className="text-lg font-bold text-gray-100">Planejador</h3>
          </div>
          <div className="mb-4">
            {ciclo === 'anual' ? (
              <>
                <span className="text-3xl font-bold text-gray-100">R$9,90</span>
                <span className="text-gray-400 text-sm">/mês</span>
                <p className="text-xs text-green-400 mt-1">cobrado como R$119,90/ano</p>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold text-gray-100">R$12,90</span>
                <span className="text-gray-400 text-sm">/mês</span>
              </>
            )}
          </div>

          <ul className="space-y-2 mb-6">
            {PLANEJADOR_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <Check className="w-4 h-4 text-secondary-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {tier === 'planejador' ? (
            <button
              disabled
              className="w-full py-2.5 px-4 rounded-xl text-sm font-medium text-secondary-400 bg-secondary-500/10 border border-secondary-500/30 cursor-not-allowed"
            >
              Plano atual
            </button>
          ) : tier === 'mestre' ? null : (
            <button
              onClick={() => setSelectedPlan(planejadorPlanId)}
              disabled={loadingPlan !== null}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
            >
              Assinar Planejador
            </button>
          )}
        </div>

        {/* Mestre */}
        <div className="relative bg-gradient-to-br from-dark-800/80 to-dark-800/50 border-2 border-emerald-500/60 rounded-2xl p-6">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {tier === 'mestre' ? 'Seu plano atual' : 'Recomendado'}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-gray-100">Mestre</h3>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold ml-auto">
              IA + Pocks
            </span>
          </div>
          <div className="mb-4">
            {ciclo === 'anual' ? (
              <>
                <span className="text-3xl font-bold text-gray-100">R$14,66</span>
                <span className="text-gray-400 text-sm">/mês</span>
                <p className="text-xs text-green-400 mt-1">cobrado como R$175,90/ano</p>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold text-gray-100">R$18,90</span>
                <span className="text-gray-400 text-sm">/mês</span>
              </>
            )}
          </div>

          <ul className="space-y-2 mb-6">
            {MESTRE_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {tier === 'mestre' ? (
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">
                Próxima cobrança:{' '}
                {subscription?.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR')
                  : '—'}
              </p>
              <button
                onClick={() => navigate('/app/configuracoes')}
                className="text-xs text-red-400 hover:text-red-300 transition-colors underline"
              >
                Cancelar assinatura
              </button>
            </div>
          ) : (
            <>
              {tier === 'planejador' && prorateMestre && (
                <div className="mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300">
                  Upgrade por <strong>apenas +R$6/mês</strong>.<br />
                  Você paga <strong>R${prorateMestre.valorHoje.toFixed(2).replace('.', ',')}</strong> hoje
                  ({prorateMestre.diasRestantes} dias restantes).<br />
                  A partir do próximo ciclo: R$18,90/mês.
                </div>
              )}
              <button
                onClick={() => setSelectedPlan(mestrePlanId)}
                disabled={loadingPlan !== null}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}
              >
                Assinar Mestre
              </button>
            </>
          )}
        </div>
      </div>

      {/* Aguardando pagamento */}
      {waitingPayment && (
        <div className="bg-secondary-500/10 border border-secondary-500/30 rounded-xl p-6 text-center mb-8">
          <Loader2 className="w-8 h-8 animate-spin text-secondary-400 mx-auto mb-3" />
          <p className="text-gray-200 font-medium mb-2">Aguardando confirmação do pagamento...</p>
          <p className="text-sm text-gray-400 mb-4">
            Após concluir o pagamento, você será redirecionado automaticamente.
          </p>
          {paymentLink && (
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mb-4 px-4 py-2 bg-secondary-500 hover:bg-secondary-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Abrir página de pagamento
            </a>
          )}
          <button
            onClick={async () => {
              const sub = await refreshSubscription()
              if (sub?.status === 'active') {
                stopPolling()
                setWaitingPayment(false)
                navigate('/app', { replace: true })
                setTimeout(() => toast.success('Pagamento confirmado!'), 100)
              } else {
                toast.info('Pagamento ainda não confirmado. Aguarde alguns instantes.')
              }
            }}
            className="block mx-auto text-sm text-secondary-400 hover:text-secondary-300 transition-colors underline"
          >
            Já paguei, verificar agora
          </button>
        </div>
      )}

      {/* Rodapé */}
      <p className="text-center text-xs text-gray-500">
        Pagamento 100% seguro via Asaas • Cancele quando quiser
      </p>

      {/* Modal CPF/CNPJ */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 max-w-md w-full relative">
            <button
              onClick={() => { if (!loadingPlan) setSelectedPlan(null) }}
              disabled={loadingPlan !== null}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-gray-100 mb-2">Confirmar assinatura</h3>
            <p className="text-gray-400 mb-6 text-sm">
              {selectedPlan.includes('mestre')
                ? `Mestre ${ciclo === 'anual' ? '• R$175,90/ano' : '• R$18,90/mês'}`
                : `Planejador ${ciclo === 'anual' ? '• R$119,90/ano' : '• R$12,90/mês'}`
              }
            </p>

            <label htmlFor="cpfCnpj" className="block text-sm font-medium text-gray-300 mb-2">
              CPF ou CNPJ
            </label>
            <input
              id="cpfCnpj"
              type="text"
              inputMode="numeric"
              autoFocus
              value={cpfCnpj}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              className="w-full px-4 py-3 bg-dark-700 border border-dark-500 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent text-center text-lg tracking-wider mb-2"
            />
            <p className="text-xs text-gray-500 mb-6 text-center">
              Necessário para emissão da cobrança
            </p>

            <button
              className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
              onClick={handleConfirmSubscription}
              disabled={loadingPlan !== null}
            >
              {loadingPlan ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </span>
              ) : (
                'Confirmar e pagar'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
