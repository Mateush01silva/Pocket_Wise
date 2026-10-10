// Moedas disponíveis para lançamentos em moeda estrangeira
export const MOEDAS = [
  { codigo: 'EUR', nome: 'Euro', simbolo: '€' },
  { codigo: 'USD', nome: 'Dólar americano', simbolo: 'US$' },
  { codigo: 'GBP', nome: 'Libra esterlina', simbolo: '£' },
  { codigo: 'ARS', nome: 'Peso argentino', simbolo: 'AR$' },
  { codigo: 'CLP', nome: 'Peso chileno', simbolo: 'CLP$' },
  { codigo: 'CAD', nome: 'Dólar canadense', simbolo: 'CA$' },
  { codigo: 'CHF', nome: 'Franco suíço', simbolo: 'CHF' },
  { codigo: 'JPY', nome: 'Iene', simbolo: '¥' },
] as const

export function formatarMoeda(valor: number, codigo: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: codigo }).format(valor)
  } catch {
    return `${codigo} ${valor.toFixed(2)}`
  }
}

const COTACAO_KEY = 'pocketwise:ultima-cotacao'

// Última cotação usada por moeda (conveniência: evita redigitar a cada lançamento)
export function lerUltimaCotacao(codigo: string): number | undefined {
  try {
    const raw = localStorage.getItem(COTACAO_KEY)
    const v = raw ? JSON.parse(raw)?.[codigo] : undefined
    return typeof v === 'number' && v > 0 ? v : undefined
  } catch {
    return undefined
  }
}

export function salvarUltimaCotacao(codigo: string, cotacao: number): void {
  try {
    const raw = localStorage.getItem(COTACAO_KEY)
    const atual = raw ? JSON.parse(raw) : {}
    localStorage.setItem(COTACAO_KEY, JSON.stringify({ ...atual, [codigo]: cotacao }))
  } catch {
    // localStorage indisponível: ignora
  }
}

// Cotação atual (R$ por 1 unidade) via AwesomeAPI; null se indisponível
export async function buscarCotacaoAtual(codigo: string): Promise<number | null> {
  try {
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${codigo}-BRL`)
    if (!res.ok) return null
    const json = await res.json()
    const bid = parseFloat(json?.[`${codigo}BRL`]?.bid)
    return bid > 0 ? bid : null
  } catch {
    return null
  }
}
