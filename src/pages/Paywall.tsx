import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '../components/ui'
import { Check, Loader2, X, Zap, Crown, TrendingUp, Headphones, Users, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createCheckout, openPaymentWindow, redirectToPayment } from '../services/paymentService'
import type { PlanType } from '../services/paymentService'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'

type BillingCycle = 'mensal' | 'anual'

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

function getPlanLabel(plan: PlanType): string {
  if (plan.startsWith('planejador')) return 'Planejador'
  return 'Mestre'
}

function getPlanPriceLabel(plan: PlanType): string {
  if (plan === 'planejador_monthly') return 'Mensal • R$ 12,90/mês'
  if (plan === 'planejador_annual') return 'Anual • R$ 119,90/ano'
  if (plan === 'mestre_monthly') return 'Mensal • R$ 18,90/mês'
  if (plan === 'mestre_annual') return 'Anual • R$ 175,90/ano'
  return ''
}

export function Paywall() {
  const navigate = useNavigate()
  const { refreshSubscription, signOut, userFamilies, personalFamilyId, switchFamily } = useAuth()
  const [ciclo, setCiclo] = useState<BillingCycle>('mensal')
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null)
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [waitingPayment, setWaitingPayment] = useState(false)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [switchingFamily, setSwitchingFamily] = useState<string | null>(null)

  // Famílias onde o usuário é convidado (não é a família pessoal dele)
  const invitedFamilies = userFamilies.filter(
    (f) => f.family_id !== personalFamilyId && (!f.is_personal || f.role !== 'admin')
  )

  const handleSwitchToFamily = async (familyId: string) => {
    setSwitchingFamily(familyId)
    try {
      const result = await switchFamily(familyId)
      if (result.success) {
        window.location.href = '/app'
      } else {
        toast.error(result.error ?? 'Erro ao acessar família')
        setSwitchingFamily(null)
      }
    } catch {
      toast.error('Erro ao acessar família')
      setSwitchingFamily(null)
    }
  }

  const planejadorId: PlanType = ciclo === 'anual' ? 'planejador_annual' : 'planejador_monthly'
  const mestreId: PlanType = ciclo === 'anual' ? 'mestre_annual' : 'mestre_monthly'

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
          setTimeout(() => toast.success('Pagamento confirmado!'), 100)
        }
      } catch {
        // Silencioso - continua tentando
      }
    }, 5000)
  }, [refreshSubscription, stopPolling, navigate])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

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
        } catch {
          // Silencioso
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [waitingPayment, refreshSubscription, stopPolling, navigate])

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
    setCpfCnpj(formatCpfCnpj(raw))
  }

  const handlePlanClick = (plan: PlanType) => {
    setSelectedPlan(plan)
  }

  const handleCloseModal = () => {
    if (!loadingPlan) {
      setSelectedPlan(null)
    }
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
      console.error('Erro ao criar checkout:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao processar pagamento. Tente novamente.'
      )
    } finally {
      setLoadingPlan(null)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <a href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-200 font-semibold text-sm hidden sm:block">PocketWise</span>
          </a>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sair / Trocar conta
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">
            Seu período Explorador terminou
          </h1>
          <p className="text-gray-400">
            Escolha um plano para continuar no controle das suas finanças
          </p>
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

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Planejador */}
          <div className="bg-dark-800/50 border border-dark-700 hover:border-secondary-500/50 transition-colors rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-secondary-400" />
              <h3 className="text-xl font-bold text-gray-100">Planejador</h3>
            </div>

            <div className="mb-6">
              {ciclo === 'anual' ? (
                <>
                  <span className="text-4xl font-bold text-gray-100">R$9,90</span>
                  <span className="text-gray-400 text-sm">/mês</span>
                  <p className="text-xs text-green-400 mt-1">cobrado como R$119,90/ano</p>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold text-gray-100">R$12,90</span>
                  <span className="text-gray-400 text-sm">/mês</span>
                </>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'Tudo do Explorador sem limites',
                'Fluxo de Caixa e Relatórios',
                'Família / Multi-usuário',
                'Transações, cartões e contas ilimitados',
                'Envelopes ilimitados',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                  <Check className="w-4 h-4 text-secondary-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              size="lg"
              onClick={() => handlePlanClick(planejadorId)}
              disabled={loadingPlan !== null}
            >
              Assinar Planejador
            </Button>
          </div>

          {/* Mestre */}
          <div className="relative bg-gradient-to-br from-dark-800/80 to-dark-800/50 border-2 border-emerald-500/60 rounded-2xl p-8">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
              Recomendado
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-5 h-5 text-emerald-400" />
              <h3 className="text-xl font-bold text-gray-100">Mestre</h3>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold ml-auto">
                IA + Pocks
              </span>
            </div>

            <div className="mb-6">
              {ciclo === 'anual' ? (
                <>
                  <span className="text-4xl font-bold text-gray-100">R$14,66</span>
                  <span className="text-gray-400 text-sm">/mês</span>
                  <p className="text-xs text-green-400 mt-1">cobrado como R$175,90/ano</p>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold text-gray-100">R$18,90</span>
                  <span className="text-gray-400 text-sm">/mês</span>
                </>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'Tudo do Planejador',
                'Pocks — Score de Saúde Financeira',
                'Assistente Financeiro IA',
                'Posso Comprar? com IA',
                'Créditos mensais de IA',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              size="lg"
              onClick={() => handlePlanClick(mestreId)}
              disabled={loadingPlan !== null}
              style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}
            >
              Assinar Mestre
            </Button>
          </div>
        </div>

        {/* Aguardando pagamento */}
        {waitingPayment && (
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-6 text-center mb-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400 mx-auto mb-3" />
            <p className="text-gray-200 font-medium mb-2">
              Aguardando confirmação do pagamento...
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Após concluir o pagamento, você será redirecionado automaticamente.
            </p>
            {paymentLink && (
              <a
                href={paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mb-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
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
              className="block mx-auto text-sm text-primary-400 hover:text-primary-300 transition-colors underline"
            >
              Já paguei, verificar agora
            </button>
          </div>
        )}

        {/* Famílias convidadas — voltar sem assinar */}
        {invitedFamilies.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-dark-700" />
              <span className="text-xs text-gray-500 uppercase tracking-wider">ou continue em</span>
              <div className="flex-1 h-px bg-dark-700" />
            </div>
            <div className="space-y-3">
              {invitedFamilies.map((family) => (
                <button
                  key={family.family_id}
                  onClick={() => handleSwitchToFamily(family.family_id)}
                  disabled={switchingFamily !== null}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-dark-800/50 border border-dark-700 hover:border-primary-500/40 hover:bg-dark-800 transition-all disabled:opacity-60 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                    {switchingFamily === family.family_id ? (
                      <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
                    ) : (
                      <Users className="w-5 h-5 text-primary-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-100 truncate">{family.nome}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {family.member_type === 'consultor' ? 'Consultor' : 'Membro convidado'}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-dark-800/30 border border-dark-700 rounded-xl p-6 text-center">
          <p className="text-gray-400 mb-2">
            Pagamento 100% seguro via Asaas • Cancele quando quiser
          </p>
          <p className="text-xs text-gray-500">
            Pagamento via Cartão de Crédito com cobrança automática
          </p>
          <div className="mt-4 pt-4 border-t border-dark-600">
            <a
              href="/suporte"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-400 transition-colors"
            >
              <Headphones className="w-3.5 h-3.5" />
              Com problemas? Fale com nosso suporte
            </a>
          </div>
        </div>
      </div>

      {/* Modal CPF/CNPJ */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 max-w-md w-full relative">
            <button
              onClick={handleCloseModal}
              disabled={loadingPlan !== null}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-gray-100 mb-2">
              Confirmar assinatura
            </h3>
            <p className="text-gray-400 mb-6">
              {getPlanLabel(selectedPlan)} • {getPlanPriceLabel(selectedPlan)}
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
              className="w-full px-4 py-3 bg-dark-700 border border-dark-500 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg tracking-wider mb-2"
            />
            <p className="text-xs text-gray-500 mb-6 text-center">
              Necessário para emissão da cobrança
            </p>

            <Button
              className="w-full"
              size="lg"
              onClick={handleConfirmSubscription}
              disabled={loadingPlan !== null}
            >
              {loadingPlan ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </span>
              ) : (
                'Confirmar e pagar'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
