/**
 * Debug utilities for development
 * Access via window._pocketwise in browser console
 */

import { LocalStorageService } from '../services/localStorage'

export const debug = {
  /**
   * Clear all localStorage data
   */
  clearStorage: () => {
    try {
      LocalStorageService.clearAll()
      console.log('✅ LocalStorage cleared successfully')
      console.log('🔄 Reload the page to see changes')
    } catch (error) {
      console.error('❌ Error clearing localStorage:', error)
    }
  },

  /**
   * Show all localStorage keys and their sizes
   */
  inspectStorage: () => {
    const keys = Object.keys(localStorage)
    const data: Record<string, { size: string; preview: string }> = {}

    keys.forEach((key) => {
      if (key.startsWith('pocketwise_')) {
        const value = localStorage.getItem(key)
        const size = value ? (new Blob([value]).size / 1024).toFixed(2) + ' KB' : '0 KB'
        const preview = value ? value.substring(0, 100) + '...' : 'empty'
        data[key] = { size, preview }
      }
    })

    console.table(data)
    return data
  },

  /**
   * Get raw data from a storage key
   */
  getRaw: (key: string) => {
    const value = localStorage.getItem(key)
    try {
      return value ? JSON.parse(value) : null
    } catch {
      return value
    }
  },

  /**
   * Check app configuration
   */
  checkConfig: () => {
    const config = {
      mode: import.meta.env.VITE_USE_LOCAL_STORAGE === 'true' ? 'LocalStorage' : 'Supabase',
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      isDev: import.meta.env.DEV,
      isProd: import.meta.env.PROD,
    }

    console.log('🔧 App Configuration:')
    console.table(config)
    return config
  },

  /**
   * Export all data as JSON
   */
  exportData: () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('pocketwise_'))
    const data: Record<string, any> = {}

    keys.forEach(key => {
      data[key] = debug.getRaw(key)
    })

    const json = JSON.stringify(data, null, 2)
    console.log('📦 Exported data:')
    console.log(json)

    // Create download link
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pocketwise-backup-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)

    return data
  },
}

// Attach to window for easy console access
if (typeof window !== 'undefined') {
  (window as any)._pocketwise = debug
  console.log('🔍 Debug tools available at: window._pocketwise')
  console.log('Available commands:')
  console.log('  - _pocketwise.clearStorage()    // Clear all data')
  console.log('  - _pocketwise.inspectStorage()  // Show all storage keys')
  console.log('  - _pocketwise.checkConfig()     // Show configuration')
  console.log('  - _pocketwise.exportData()      // Export data as JSON')
}
