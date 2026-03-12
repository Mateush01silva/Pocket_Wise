import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight.
 * new Date("YYYY-MM-DD") treats it as UTC midnight, causing D-1 in UTC- timezones (e.g. Brazil UTC-3).
 * Appending T00:00:00 forces JavaScript to use local time instead.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

/**
 * Format a date to Brazilian format (DD/MM/YYYY)
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date
  if (!isValid(dateObj)) return ''
  return format(dateObj, 'dd/MM/yyyy', { locale: ptBR })
}

/**
 * Format a date to a readable format (Ex: 15 de janeiro de 2024)
 */
export function formatDateLong(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date
  if (!isValid(dateObj)) return ''
  return format(dateObj, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

/**
 * Format a date to short month format (Ex: Jan 2024)
 */
export function formatMonthYear(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date
  if (!isValid(dateObj)) return ''
  return format(dateObj, 'MMM yyyy', { locale: ptBR })
}

/**
 * Get the current month and year
 */
export function getCurrentMonthYear(): string {
  return formatMonthYear(new Date())
}
