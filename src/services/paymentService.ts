import { supabase } from '../lib/supabase'

export type PlanType = 'monthly' | 'annual' | 'planejador_monthly' | 'planejador_annual' | 'mestre_monthly' | 'mestre_annual'
interface CheckoutResponse {
  success: boolean
  subscription: {
    id: string
    status: string
    paymentLink: string | null
  }
  customer: {
    id: string
  }
}

/**
 * Cria uma assinatura via Supabase Edge Function -> Asaas API
 * Pagamento sempre via cartão de crédito (recorrência automática)
 */
export async function createCheckout(
  plan: PlanType,
  cpfCnpj: string
): Promise<CheckoutResponse> {
  if (!supabase) {
    throw new Error('Supabase não configurado')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { plan, cpfCnpj },
  })

  if (error) {
    // Extrair mensagem real do erro da Edge Function
    let errorMessage = 'Erro ao criar checkout'
    try {
      if (error.context instanceof Response) {
        const errorBody = await error.context.json()
        errorMessage = errorBody?.error || error.message
      } else {
        errorMessage = error.message
      }
    } catch {
      errorMessage = error.message || errorMessage
    }
    console.error('Erro create-checkout:', errorMessage)
    throw new Error(errorMessage)
  }

  if (!data?.success) {
    const msg = data?.error || 'Erro desconhecido ao criar checkout'
    console.error('Erro create-checkout:', msg)
    throw new Error(msg)
  }

  return data as CheckoutResponse
}

/**
 * Abre uma janela em branco no contexto do clique do usuário.
 * Deve ser chamada ANTES de qualquer await para evitar bloqueio de popup.
 */
export function openPaymentWindow(): Window | null {
  return window.open('', '_blank')
}

/**
 * Redireciona a janela já aberta para a página de pagamento da Asaas.
 * Se a janela foi fechada/bloqueada, redireciona a página atual como fallback.
 */
export function redirectToPayment(paymentLink: string, paymentWindow?: Window | null) {
  if (paymentWindow && !paymentWindow.closed) {
    paymentWindow.location.href = paymentLink
  } else {
    window.open(paymentLink, '_blank')
  }
}

/**
 * Cancela a assinatura do usuário via Edge Function (cancela na Asaas + banco).
 * O acesso é mantido até o fim do período já pago.
 */
export async function cancelSubscription(): Promise<{ current_period_end: string }> {
  if (!supabase) {
    throw new Error('Supabase não configurado')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase.functions.invoke('cancel-subscription', {
    body: {},
  })

  if (error) {
    let errorMessage = 'Erro ao cancelar assinatura'
    try {
      if (error.context instanceof Response) {
        const errorBody = await error.context.json()
        errorMessage = errorBody?.error || error.message
      } else {
        errorMessage = error.message
      }
    } catch {
      errorMessage = error.message || errorMessage
    }
    console.error('Erro cancel-subscription:', errorMessage)
    throw new Error(errorMessage)
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Erro ao cancelar assinatura')
  }

  return { current_period_end: data.current_period_end }
}

/**
 * Valores dos planos (espelhando o backend)
 */
export const PLAN_PRICES = {
  monthly: {
    value: 12.90,
    label: 'Mensal',
    description: 'R$ 12,90/mês',
  },
  annual: {
    value: 119.90,
    label: 'Anual',
    description: 'R$ 119,90/ano (R$ 9,99/mês)',
  },
}
