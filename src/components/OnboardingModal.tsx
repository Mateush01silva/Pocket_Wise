import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { useUserPreferencesStore } from '../store/useUserPreferencesStore'
import { useLearningModeStore } from '../store/useLearningModeStore'

interface OnboardingStep {
  icon: React.ReactNode
  title: string
  description: string
  tip: string
  rota?: string
  rotaLabel?: string
  hasTooltips?: boolean // se a página de destino tem tooltips de aprendizagem
}

const steps: OnboardingStep[] = [
  {
    icon: <Wallet className="w-7 h-7 text-blue-400" />,
    title: 'Cadastre suas Contas Bancárias',
    description:
      'Comece registrando suas contas (corrente, poupança, carteira digital). Isso permite que o Pocket Wise calcule seu saldo real e controle entradas e saídas.',
    tip: 'Informe o saldo atual de cada conta para começar com dados corretos.',
    rota: '/app/contas',
    rotaLabel: 'Ir para Contas',
    hasTooltips: false,
  },
  {
    icon: <CreditCard className="w-7 h-7 text-purple-400" />,
    title: 'Adicione seus Cartões de Crédito',
    description:
      'Cadastre seus cartões informando o dia de fechamento, vencimento e limite. Isso permite acompanhar suas faturas e parcelamentos.',
    tip: 'O dia de fechamento é quando a fatura fecha; o vencimento é quando você paga.',
    rota: '/app/cartoes',
    rotaLabel: 'Ir para Cartões',
    hasTooltips: true,
  },
  {
    icon: <Tag className="w-7 h-7 text-green-400" />,
    title: 'Categorias já estão prontas',
    description:
      'O Pocket Wise já vem com categorias padrão (Alimentação, Transporte, Saúde…). Você pode personalizar ou criar novas conforme sua rotina.',
    tip: 'Subcategorias ajudam a detalhar ainda mais seus gastos.',
    rota: '/app/categorias',
    rotaLabel: 'Ver Categorias',
    hasTooltips: false,
  },
  {
    icon: <Calendar className="w-7 h-7 text-orange-400" />,
    title: 'Cadastre suas Assinaturas',
    description:
      'Registre serviços recorrentes como Netflix, Spotify e academias. O app vai lançar automaticamente essas cobranças todo mês.',
    tip: 'Vincule a assinatura ao cartão correto para que a fatura bata certinho.',
    rota: '/app/assinaturas',
    rotaLabel: 'Ir para Assinaturas',
    hasTooltips: false,
  },
  {
    icon: <PieChart className="w-7 h-7 text-yellow-400" />,
    title: 'Crie seu Orçamento Mensal',
    description:
      'Defina quanto quer gastar em cada categoria. Os envelopes digitais te mostram em tempo real se está dentro do planejado.',
    tip: 'Comece com valores estimados; você pode ajustar conforme o uso.',
    rota: '/app/envelopes',
    rotaLabel: 'Criar Orçamento',
    hasTooltips: true,
  },
  {
    icon: <CheckCircle2 className="w-7 h-7 text-primary-400" />,
    title: 'Tudo pronto! Comece a usar',
    description:
      'Agora é só lançar suas transações diárias. Use o Dashboard para uma visão geral das finanças e acompanhe sua saúde financeira em tempo real.',
    tip: 'Lançar transações regularmente dá muito mais precisão ao seu controle.',
    rota: '/app',
    rotaLabel: 'Ir para o Dashboard',
    hasTooltips: true,
  },
]

export function OnboardingModal() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const atualizarPreferencias = useUserPreferencesStore((s) => s.atualizarPreferencias)
  const currentStep = useUserPreferencesStore((s) => Math.min(s.onboardingStep, steps.length - 1))
  const setLearningMode = useLearningModeStore((s) => s.setLearningMode)
  const isLearningMode = useLearningModeStore((s) => s.isEnabled)
  const [minimized, setMinimized] = useState(false)

  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1
  const isOnStepPage = step.rota
    ? location.pathname === step.rota || (step.rota === '/app' && location.pathname === '/app')
    : false

  const setStep = (next: number) => {
    atualizarPreferencias({ onboardingStep: next })
  }

  const handleComplete = () => {
    if (user) {
      localStorage.setItem(`pw-onboarding-done-${user.id}`, '1')
    }
    atualizarPreferencias({ onboardingCompleted: true, onboardingStep: 0 })
  }

  const handleNavigate = () => {
    if (!step.rota) return
    navigate(step.rota)
    // Ativar modo de aprendizagem automaticamente se a página tem tooltips
    if (step.hasTooltips) {
      setLearningMode(true)
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

  // Estado minimizado: botão flutuante compacto
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-dark-800 border border-primary-500/40 rounded-full shadow-xl shadow-black/40 text-sm font-medium text-gray-200 hover:border-primary-400 hover:bg-dark-700 transition-all"
      >
        <MapPin className="w-4 h-4 text-primary-400" />
        <span>Tour · Passo {currentStep + 1}/{steps.length}</span>
        <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 bg-dark-800 border border-dark-600/80 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
      {/* Barra de progresso */}
      <div className="h-0.5 bg-dark-700">
        <div
          className="h-full bg-primary-500 transition-all duration-500"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-primary-400" />
          <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
            Tour · Passo {currentStep + 1} de {steps.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
            title="Minimizar"
          >
            <ChevronDown size={15} />
          </button>
          <button
            onClick={handleComplete}
            className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
            title="Pular tour"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        {/* Ícone + Título */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-dark-700 rounded-xl shrink-0">{step.icon}</div>
          <h2 className="text-sm font-bold text-gray-100 leading-snug">{step.title}</h2>
        </div>

        {/* Descrição */}
        <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>

        {/* Dica */}
        <div className="flex items-start gap-2 p-2.5 bg-primary-500/10 border border-primary-500/20 rounded-lg">
          <span className="text-xs mt-0.5">💡</span>
          <p className="text-xs text-primary-300 leading-relaxed">{step.tip}</p>
        </div>

        {/* Hint de tooltips — mostra quando está na página E a página tem tooltips */}
        {isOnStepPage && step.hasTooltips && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300 leading-relaxed">
              {isLearningMode
                ? 'Passe o mouse nos pontos laranjas para aprender sobre cada elemento.'
                : 'Esta página tem tooltips de aprendizagem. O Modo Aprendizagem foi ativado automaticamente — passe o mouse nos pontos laranjas.'}
            </p>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex items-center gap-2 pt-1">
          {step.rota && !isLast && (
            <button
              onClick={handleNavigate}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 text-xs font-medium rounded-lg border border-dark-600 transition-colors"
            >
              {step.rotaLabel}
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {isLast ? (
              <>
                <CheckCircle2 size={13} />
                {step.rotaLabel || 'Concluir'}
              </>
            ) : (
              <>
                Próximo
                <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>

        {/* Indicadores de passo */}
        <div className="flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep
                  ? 'bg-primary-400 w-4'
                  : i < currentStep
                  ? 'bg-primary-700 w-1.5'
                  : 'bg-dark-600 w-1.5'
              }`}
            />
          ))}
        </div>

        {/* Dica do Settings — aparece no último passo */}
        {isLast && (
          <p className="text-xs text-gray-600 text-center leading-relaxed">
            Você pode retomar este tour a qualquer momento em{' '}
            <button
              onClick={() => { handleComplete(); navigate('/app/configuracoes') }}
              className="text-gray-500 hover:text-gray-400 underline transition-colors"
            >
              Configurações
            </button>
            .
          </p>
        )}
        {!isLast && currentStep === steps.length - 2 && (
          <p className="text-xs text-gray-600 text-center leading-relaxed">
            Sabia que você pode retomar este tour em Configurações a qualquer momento?
          </p>
        )}
      </div>
    </div>
  )
}
