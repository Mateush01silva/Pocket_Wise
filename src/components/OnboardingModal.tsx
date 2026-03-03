import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Wallet,
  CreditCard,
  Tag,
  Calendar,
  PieChart,
  CheckCircle2,
  ArrowRight,
  X,
} from 'lucide-react'
import { useUserPreferencesStore } from '../store/useUserPreferencesStore'

interface OnboardingStep {
  icon: React.ReactNode
  title: string
  description: string
  tip: string
  rota?: string
  rotaLabel?: string
}

const steps: OnboardingStep[] = [
  {
    icon: <Wallet className="w-10 h-10 text-blue-400" />,
    title: 'Cadastre suas Contas Bancárias',
    description:
      'Comece registrando suas contas (corrente, poupança, carteira digital). Isso permite que o Pocket Wise calcule seu saldo real e controle entradas e saídas.',
    tip: 'Dica: Informe o saldo atual de cada conta para começar com dados corretos.',
    rota: '/app/contas',
    rotaLabel: 'Ir para Contas',
  },
  {
    icon: <CreditCard className="w-10 h-10 text-purple-400" />,
    title: 'Adicione seus Cartões de Crédito',
    description:
      'Cadastre seus cartões informando o dia de fechamento e vencimento, e o limite. Isso permite acompanhar suas faturas e parcelamentos.',
    tip: 'Dica: O dia de fechamento é quando a fatura fecha; o vencimento é quando você paga.',
    rota: '/app/cartoes',
    rotaLabel: 'Ir para Cartões',
  },
  {
    icon: <Tag className="w-10 h-10 text-green-400" />,
    title: 'Categorias já estão prontas',
    description:
      'O Pocket Wise já vem com categorias padrão (Alimentação, Transporte, Saúde…). Você pode personalizar ou criar novas conforme sua rotina.',
    tip: 'Dica: Subcategorias ajudam a detalhar ainda mais seus gastos.',
    rota: '/app/categorias',
    rotaLabel: 'Ver Categorias',
  },
  {
    icon: <Calendar className="w-10 h-10 text-orange-400" />,
    title: 'Cadastre suas Assinaturas',
    description:
      'Registre serviços recorrentes como Netflix, Spotify, academias e planos. O app vai lançar automaticamente essas cobranças todo mês.',
    tip: 'Dica: Vincule a assinatura ao cartão correto para que a fatura bata certinho.',
    rota: '/app/assinaturas',
    rotaLabel: 'Ir para Assinaturas',
  },
  {
    icon: <PieChart className="w-10 h-10 text-yellow-400" />,
    title: 'Crie seu Orçamento Mensal',
    description:
      'Defina quanto quer gastar em cada categoria. Os envelopes digitais te mostram em tempo real se está dentro do planejado.',
    tip: 'Dica: Comece com valores estimados; você pode ajustar conforme o uso.',
    rota: '/app/envelopes',
    rotaLabel: 'Criar Orçamento',
  },
  {
    icon: <CheckCircle2 className="w-10 h-10 text-primary-400" />,
    title: 'Tudo pronto! Comece a usar',
    description:
      'Agora é só lançar suas transações diárias. Use o Dashboard para uma visão geral das finanças e acompanhe sua saúde financeira em tempo real.',
    tip: 'Dica: Lançar transações regularmente dá muito mais precisão ao seu controle.',
    rota: '/app',
    rotaLabel: 'Ir para o Dashboard',
  },
]

export function OnboardingModal() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const atualizarPreferencias = useUserPreferencesStore((s) => s.atualizarPreferencias)
  // Passo persistido no store para sobreviver à navegação entre rotas
  const currentStep = useUserPreferencesStore((s) => Math.min(s.onboardingStep, steps.length - 1))

  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1

  const setStep = (next: number) => {
    atualizarPreferencias({ onboardingStep: next })
  }

  const handleComplete = () => {
    // Persiste conclusão por usuário numa chave separada (nunca apagada no logout)
    if (user) {
      localStorage.setItem(`pw-onboarding-done-${user.id}`, '1')
    }
    atualizarPreferencias({ onboardingCompleted: true, onboardingStep: 0 })
  }

  const handleNavigate = () => {
    // Apenas navega — NÃO conclui o onboarding para que o modal continue aparecendo
    if (step.rota) {
      navigate(step.rota)
    }
  }

  const handleNext = () => {
    if (isLast) {
      handleComplete()
      navigate(step.rota || '/app')
    } else {
      setStep(currentStep + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl overflow-hidden">
        {/* Skip button */}
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-700 transition-colors z-10"
          title="Pular introdução"
        >
          <X size={18} />
        </button>

        {/* Progress bar */}
        <div className="h-1 bg-dark-700">
          <div
            className="h-full bg-primary-500 transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-6 sm:p-8">
          {/* Step counter */}
          <p className="text-xs text-gray-500 mb-6 font-medium uppercase tracking-wider">
            Passo {currentStep + 1} de {steps.length}
          </p>

          {/* Icon + Title */}
          <div className="flex items-center gap-4 mb-5">
            <div className="p-3 bg-dark-700 rounded-xl shrink-0">{step.icon}</div>
            <h2 className="text-xl font-bold text-gray-100 leading-tight">
              {step.title}
            </h2>
          </div>

          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Tip */}
          <div className="flex items-start gap-2 p-3 bg-primary-500/10 border border-primary-500/20 rounded-lg mb-6">
            <span className="text-primary-400 text-sm mt-0.5">💡</span>
            <p className="text-xs text-primary-300 leading-relaxed">{step.tip}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {step.rota && !isLast && (
              <button
                onClick={handleNavigate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-gray-200 text-sm font-medium rounded-lg border border-dark-600 transition-colors"
              >
                {step.rotaLabel}
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {isLast ? (
                <>
                  <CheckCircle2 size={16} />
                  {step.rotaLabel || 'Concluir'}
                </>
              ) : (
                <>
                  Próximo
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 mt-5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep
                    ? 'bg-primary-400 w-4'
                    : i < currentStep
                    ? 'bg-primary-700'
                    : 'bg-dark-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
