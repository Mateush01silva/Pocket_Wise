import { supabase } from '../lib/supabase'

export type PlanType = 'monthly' | 'annual'
export type BillingType = 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED'

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
 */
export async function createCheckout(
  plan: PlanType,
  billingType: BillingType = 'UNDEFINED'
): Promise<CheckoutResponse> {
  if (!supabase) {
    throw new Error('Supabase não configurado')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { plan, billingType },
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
 * Redireciona o usuário para a página de pagamento da Asaas
 */
export function redirectToPayment(paymentLink: string) {
  window.open(paymentLink, '_blank')
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
