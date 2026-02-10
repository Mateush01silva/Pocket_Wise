// Configuração da API Asaas
const ASAAS_API_URL = Deno.env.get('ASAAS_ENVIRONMENT') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? ''

// Headers padrão para chamadas à API Asaas
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  }
}

// ============================================================================
// CUSTOMERS
// ============================================================================

interface CreateCustomerParams {
  name: string
  email: string
  cpfCnpj?: string
  externalReference?: string // user_id do Supabase
}

export async function createCustomer(params: CreateCustomerParams) {
  const response = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      cpfCnpj: params.cpfCnpj || undefined,
      externalReference: params.externalReference,
      notificationDisabled: false,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Asaas createCustomer error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

export async function findCustomerByEmail(email: string) {
  const response = await fetch(
    `${ASAAS_API_URL}/customers?email=${encodeURIComponent(email)}`,
    { headers: getHeaders() }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Asaas findCustomer error: ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return data.data?.[0] || null
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

type BillingCycle = 'MONTHLY' | 'YEARLY'

interface CreateSubscriptionParams {
  customer: string // Asaas customer ID
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED'
  value: number
  cycle: BillingCycle
  description: string
  externalReference?: string // user_id do Supabase
}

export async function createSubscription(params: CreateSubscriptionParams) {
  const nextDueDate = getNextDueDate()

  const response = await fetch(`${ASAAS_API_URL}/subscriptions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      customer: params.customer,
      billingType: params.billingType,
      value: params.value,
      nextDueDate,
      cycle: params.cycle,
      description: params.description,
      externalReference: params.externalReference,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Asaas createSubscription error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

export async function cancelSubscription(subscriptionId: string) {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Asaas cancelSubscription error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// ============================================================================
// PAYMENTS (Cobranças)
// ============================================================================

export async function getPayment(paymentId: string) {
  const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Asaas getPayment error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

export async function getPaymentPixQrCode(paymentId: string) {
  const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Asaas getPixQrCode error: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// ============================================================================
// HELPERS
// ============================================================================

function getNextDueDate(): string {
  const today = new Date()
  // Próximo vencimento: hoje + 1 dia (para dar tempo de pagar)
  today.setDate(today.getDate() + 1)
  return today.toISOString().split('T')[0]
}

// Planos do Pocket Wise
export const PLANS = {
  monthly: {
    value: 12.90,
    cycle: 'MONTHLY' as BillingCycle,
    description: 'Pocket Wise - Plano Mensal',
  },
  annual: {
    value: 119.90,
    cycle: 'YEARLY' as BillingCycle,
    description: 'Pocket Wise - Plano Anual',
  },
}
