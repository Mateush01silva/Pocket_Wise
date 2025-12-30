/**
 * Format a number as Brazilian Real currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Format a number as currency without the symbol
 */
export function formatCurrencyCompact(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return formatCurrency(value)
}

/**
 * Parse a currency string to number
 */
export function parseCurrency(value: string): number {
  return Number(value.replace(/[^0-9,-]/g, '').replace(',', '.'))
}
