import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Zap, Crown, Check, Loader2, LogOut } from 'lucide-react'
import { Button } from './ui/Button'
import { createCheckout, openPaymentWindow, redirectToPayment } from '../services/paymentService'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

const PLANS = [
  {
    id: 'planejador_monthly' as const,
    name: 'Planejador',
    price: 'R$12,90/mês',
    color: 'from-primary-500 to-secondary-500',
    border: 'border-primary-500',
    badge: null,
    features: [
      'Transações, cartões e contas ilimitados',
      'Fluxo de Caixa e Relatórios completos',
      'Família e compartilhamento',
    ],
  },
  {
    id: 'mestre_monthly' as const,
    name: 'Mestre',
    price: 'R$18,90/mês',
    color: 'from-teal-500 to-emerald-500',
    border: 'border-teal-400',
    badge: 'Recomendado',
    features: [
      'Tudo do Planejador',
      'Assistente IA financeiro pessoal',
      'Pocks — score e conquistas financeiras',
    ],
  },
]

export function TrialExpiredModal() {
  const navigate = useNavigate()
  const { refreshSubscription, signOut } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [cpf, setCpf] = useState('')
  const [showCpfInput, setShowCpfInput] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[number] | null>(null)

  const handleSelectPlan = (plan: typeof PLANS[number]) => {
    setSelectedPlan(plan)
    setShowCpfInput(true)
  }

  const handleCheckout = async () => {
    if (!selectedPlan || !cpf.trim()) return
    const cpfClean = cpf.replace(/\D/g, '')
    if (cpfClean.length < 11) {
      toast.error('Informe um CPF ou CNPJ válido')
      return
    }

    setLoadingPlan(selectedPlan.id)
    const paymentWindow = openPaymentWindow()

    try {
      const result = await createCheckout(selectedPlan.id, cpfClean)
      if (result.subscription.paymentLink) {
        redirectToPayment(result.subscription.paymentLink, paymentWindow)
      }

      // Poll para confirmar pagamento
      const interval = setInterval(async () => {
        await refreshSubscription()
      }, 5000)

      const handleVisibility = async () => {
        if (!document.hidden) {
          await refreshSubscription()
        }
      }
      document.addEventListener('visibilitychange', handleVisibility)

      setTimeout(() => {
        clearInterval(interval)
        document.removeEventListener('visibilitychange', handleVisibility)
      }, 10 * 60 * 1000)
    } catch (err) {
      paymentWindow?.close()
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar pagamento')
      setLoadingPlan(null)
    }
  }

  const handleViewAllPlans = () => {
    navigate('/app/assinatura')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500/20 to-secondary-500/20 border border-primary-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">
            Seu período Explorador terminou
          </h2>
          <p className="text-gray-400">
            Escolha um plano para continuar usando o PocketWise
          </p>
        </div>

        {!showCpfInput ? (
          <>
            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-dark-800 border-2 ${plan.border} rounded-xl p-6 flex flex-col`}
                >
                  {plan.badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r ${plan.color} text-white text-xs font-semibold px-3 py-1 rounded-full`}>
                      {plan.badge}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    {plan.name === 'Mestre' ? (
                      <Crown className="w-5 h-5 text-teal-400" />
                    ) : (
                      <Zap className="w-5 h-5 text-primary-400" />
                    )}
                    <h3 className="text-lg font-bold text-gray-100">{plan.name}</h3>
                  </div>
                  <p className={`text-2xl font-bold mb-4 bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>
                    {plan.price}
                  </p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    onClick={() => handleSelectPlan(plan)}
                  >
                    Assinar {plan.name}
                  </Button>
                </div>
              ))}
            </div>

            <div className="text-center space-y-3">
              <button
                onClick={handleViewAllPlans}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Ver todos os planos (incluindo anuais com desconto)
              </button>
              <div>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair / Trocar conta
                </button>
              </div>
            </div>
          </>
        ) : (
          /* CPF input step */
          <div className="space-y-4">
            <div className="bg-dark-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Plano selecionado</p>
              <p className="font-semibold text-gray-100">{selectedPlan?.name} — {selectedPlan?.price}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                CPF ou CNPJ (necessário para emissão da cobrança)
              </label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => { setShowCpfInput(false); setSelectedPlan(null) }}
                disabled={loadingPlan !== null}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={loadingPlan !== null || !cpf.trim()}
                className="flex-1"
              >
                {loadingPlan !== null ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Aguardando...
                  </span>
                ) : (
                  'Ir para pagamento'
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-600 text-center">
              Você será redirecionado para a página de pagamento seguro da Asaas.
              Após confirmar, seu acesso é ativado automaticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
