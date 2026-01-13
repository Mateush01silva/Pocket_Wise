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
  ORCAMENTOS_MENSAIS: 'pocketwise_orcamentos_mensais',
  CATEGORIAS_BUDGET: 'pocketwise_categorias_budget',
  ALERTAS_ORCAMENTO: 'pocketwise_alertas_orcamento',
  CONFIGURACOES_ORCAMENTO: 'pocketwise_configuracoes_orcamento',
  USER: 'pocketwise_user',
  FAMILY: 'pocketwise_family',
} as const

export class LocalStorageService {
  /**
   * Get data from localStorage with validation and error recovery
   */
  static get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      if (!item) return null

      // Tentar fazer parse do JSON
      const parsed = JSON.parse(item)

      // Validar se o resultado é válido
      if (parsed === undefined) {
        console.warn(`⚠️ ${key} retornou undefined, removendo...`)
        this.remove(key)
        return null
      }

      return parsed
    } catch (error) {
      console.error(`❌ Erro ao ler ${key} do localStorage:`, error)

      // Se o JSON está corrompido, remover a chave
      if (error instanceof SyntaxError) {
        console.warn(`⚠️ ${key} contém JSON inválido, removendo...`)
        try {
          localStorage.removeItem(key)
        } catch (removeError) {
          console.error(`❌ Erro ao remover ${key}:`, removeError)
        }
      }

      return null
    }
  }

  /**
   * Set data in localStorage with error handling
   */
  static set<T>(key: string, value: T): void {
    try {
      // Validar se o valor pode ser serializado
      const serialized = JSON.stringify(value)

      // Verificar se não é muito grande (limite de ~5MB para localStorage)
      if (serialized.length > 5 * 1024 * 1024) {
        console.warn(`⚠️ Dados muito grandes para ${key} (${(serialized.length / 1024 / 1024).toFixed(2)}MB)`)
      }

      localStorage.setItem(key, serialized)
    } catch (error) {
      console.error(`❌ Erro ao salvar ${key} no localStorage:`, error)

      // Se for erro de quota excedida, tentar limpar dados antigos
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('⚠️ Quota do localStorage excedida, tentando liberar espaço...')
        this.clearOldData()
      }
    }
  }

  /**
   * Remove data from localStorage
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`❌ Erro ao remover ${key} do localStorage:`, error)
    }
  }

  /**
   * Clear all app data from localStorage
   */
  static clearAll(): void {
    console.log('🗑️ Limpando todos os dados do PocketWise...')
    Object.values(STORAGE_KEYS).forEach((key) => {
      this.remove(key)
    })
    console.log('✅ Dados limpos com sucesso')
  }

  /**
   * Clear old data to free up space (keeps only essential data)
   */
  private static clearOldData(): void {
    try {
      // Remover dados não essenciais primeiro
      const nonEssentialKeys = [
        STORAGE_KEYS.ALERTAS_ORCAMENTO,
        STORAGE_KEYS.RECEITAS_PROJETADAS,
      ]

      nonEssentialKeys.forEach((key) => {
        this.remove(key)
      })

      console.log('✅ Dados antigos removidos para liberar espaço')
    } catch (error) {
      console.error('❌ Erro ao limpar dados antigos:', error)
    }
  }

  /**
   * Validate storage integrity
   */
  static validateIntegrity(): boolean {
    console.log('🔍 Validando integridade do localStorage...')
    let hasErrors = false

    Object.values(STORAGE_KEYS).forEach((key) => {
      try {
        const value = localStorage.getItem(key)
        if (value) {
          JSON.parse(value)
        }
      } catch (error) {
        console.error(`❌ ${key} está corrompido:`, error)
        hasErrors = true
        this.remove(key)
      }
    })

    if (hasErrors) {
      console.warn('⚠️ Foram encontrados e corrigidos erros no localStorage')
    } else {
      console.log('✅ localStorage está íntegro')
    }

    return !hasErrors
  }
}

export { STORAGE_KEYS }
