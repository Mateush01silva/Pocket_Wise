/**
 * LocalStorage service for MVP phase
 * This will be replaced with Supabase in production
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'pocketwise_transactions',
  CREDIT_CARDS: 'pocketwise_credit_cards',
  CATEGORIAS: 'pocketwise_categorias',
  PLANEJAMENTOS: 'pocketwise_planejamentos',
  RECEITAS_PROJETADAS: 'pocketwise_receitas_projetadas',
  USER: 'pocketwise_user',
  FAMILY: 'pocketwise_family',
} as const

export class LocalStorageService {
  /**
   * Get data from localStorage
   */
  static get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.error(`Error getting ${key} from localStorage:`, error)
      return null
    }
  }

  /**
   * Set data in localStorage
   */
  static set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(`Error setting ${key} in localStorage:`, error)
    }
  }

  /**
   * Remove data from localStorage
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error)
    }
  }

  /**
   * Clear all app data from localStorage
   */
  static clearAll(): void {
    Object.values(STORAGE_KEYS).forEach((key) => {
      this.remove(key)
    })
  }
}

export { STORAGE_KEYS }
