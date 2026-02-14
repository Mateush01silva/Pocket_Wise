import { supabase } from '../lib/supabase'

export type PlanType = 'monthly' | 'annual'
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
 * Cancela a assinatura do usuário.
 * Tenta via Edge Function (que também cancela na Asaas).
 * Se a Edge Function não estiver disponível, usa RPC direto no banco.
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

  // Tentar via Edge Function primeiro (cancela na Asaas + banco)
  try {
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: {},
    })

    if (!error && data?.success) {
      return { current_period_end: data.current_period_end }
    }

    // Se o erro for que a função não existe (404), tentar fallback
    const is404 = error?.context instanceof Response && error.context.status === 404
    if (!is404 && error) {
      // Erro real da Edge Function - extrair mensagem
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
      throw new Error(errorMessage)
    }

    if (!is404 && data && !data.success) {
      throw new Error(data?.error || 'Erro ao cancelar assinatura')
    }

    // Se chegou aqui, é 404 - tentar fallback RPC
    console.log('Edge Function cancel-subscription não disponível, usando fallback RPC')
  } catch (edgeFnError) {
    // Se o erro já foi tratado acima (throw new Error), propagar
    if (edgeFnError instanceof Error && edgeFnError.message !== 'Failed to fetch') {
      // Verificar se é um erro de negócio (não de rede/404)
      if (!edgeFnError.message.includes('Edge Function') &&
          !edgeFnError.message.includes('FunctionsHttpError') &&
          !edgeFnError.message.includes('FunctionsRelayError')) {
        throw edgeFnError
      }
    }
    console.log('Edge Function falhou, tentando fallback RPC:', edgeFnError)
  }

  // Fallback: cancelar via RPC direto no banco
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc('cancel_my_subscription')

  if (rpcError) {
    console.error('Erro RPC cancel_my_subscription:', rpcError)
    throw new Error(rpcError.message || 'Erro ao cancelar assinatura')
  }

  if (!rpcData?.success) {
    throw new Error(rpcData?.error || 'Erro ao cancelar assinatura')
  }

  return { current_period_end: rpcData.current_period_end }
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
