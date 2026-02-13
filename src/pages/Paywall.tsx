import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '../components/ui'
import { Check, TrendingUp, Loader2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createCheckout, redirectToPayment } from '../services/paymentService'
import type { PlanType } from '../services/paymentService'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'

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

export function Paywall() {
  const navigate = useNavigate()
  const { refreshSubscription } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null)
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [waitingPayment, setWaitingPayment] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // Polling: verifica a cada 5s se o pagamento foi confirmado pelo webhook
  const startPolling = useCallback(() => {
    stopPolling()
    setWaitingPayment(true)

    pollingRef.current = setInterval(async () => {
      try {
        const sub = await refreshSubscription()
        if (sub?.status === 'active') {
          stopPolling()
          setWaitingPayment(false)
          toast.success('Pagamento confirmado! Redirecionando...')
          navigate('/app', { replace: true })
        }
      } catch {
        // Silencioso - continua tentando
      }
    }, 5000)
  }, [refreshSubscription, stopPolling, navigate])

  // Limpar polling ao desmontar o componente
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // Quando o usuário volta para a aba, faz uma verificação imediata
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && waitingPayment) {
        try {
          const sub = await refreshSubscription()
          if (sub?.status === 'active') {
            stopPolling()
            setWaitingPayment(false)
            toast.success('Pagamento confirmado! Redirecionando...')
            navigate('/app', { replace: true })
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

    try {
      const result = await createCheckout(selectedPlan, digits)

      if (result.subscription.paymentLink) {
        toast.success('Redirecionando para pagamento...')
        setSelectedPlan(null)
        redirectToPayment(result.subscription.paymentLink)
        startPolling()
      } else {
        toast.success('Assinatura criada! Verifique seu email para o link de pagamento.')
        setSelectedPlan(null)
        startPolling()
      }
    } catch (error) {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-100 mb-4">
            Seu teste de 7 dias terminou
          </h1>
          <p className="text-xl text-gray-400">
            Continue no controle total das suas finanças
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Plano Mensal */}
          <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-100 mb-2">Mensal</h3>
            <div className="mb-6">
              <span className="text-5xl font-bold text-gray-100">R$ 12,90</span>
              <span className="text-gray-400">/mês</span>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'Cancele quando quiser',
                'Todas as funcionalidades',
                'Família completa incluída',
                'Suporte prioritário',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <Check className="w-5 h-5 text-green-400" />
                  {item}
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              size="lg"
              onClick={() => handlePlanClick('monthly')}
              disabled={loadingPlan !== null}
            >
              Assinar Mensal
            </Button>
          </div>

          {/* Plano Anual */}
          <div className="bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border-2 border-primary-500 rounded-2xl p-8 relative">
            <div className="absolute -top-4 right-8 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
              Mais Popular
            </div>

            <h3 className="text-2xl font-bold text-gray-100 mb-2">Anual</h3>
            <div className="mb-2">
              <span className="text-5xl font-bold text-gray-100">R$ 119,90</span>
              <span className="text-gray-400">/ano</span>
            </div>
            <p className="text-sm text-green-400 mb-6">Economize R$ 34,90 • R$ 9,99/mês</p>

            <ul className="space-y-3 mb-8">
              {[
                '2 meses grátis',
                'Todas as funcionalidades',
                'Família completa incluída',
                'Suporte prioritário',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <Check className="w-5 h-5 text-green-400" />
                  {item}
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              size="lg"
              onClick={() => handlePlanClick('annual')}
              disabled={loadingPlan !== null}
            >
              Assinar Anual
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
            <button
              onClick={async () => {
                const sub = await refreshSubscription()
                if (sub?.status === 'active') {
                  stopPolling()
                  setWaitingPayment(false)
                  toast.success('Pagamento confirmado! Redirecionando...')
                  navigate('/app', { replace: true })
                } else {
                  toast.info('Pagamento ainda não confirmado. Aguarde alguns instantes.')
                }
              }}
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors underline"
            >
              Já paguei, verificar agora
            </button>
          </div>
        )}

        {/* FAQ Mini */}
        <div className="bg-dark-800/30 border border-dark-700 rounded-xl p-6 text-center">
          <p className="text-gray-400 mb-4">
            Pagamento 100% seguro via Asaas • Cancele quando quiser
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Pagamento via Cartão de Crédito com cobrança automática
          </p>
          <button
            onClick={() => navigate('/app')}
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            Voltar para o app (apenas leitura)
          </button>
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
              Plano {selectedPlan === 'monthly' ? 'Mensal • R$ 12,90/mês' : 'Anual • R$ 119,90/ano'}
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
