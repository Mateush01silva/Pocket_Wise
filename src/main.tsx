import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './lib/debug' // Debug tools

// Função para validar e limpar localStorage corrompido ANTES de inicializar React
function validateAndCleanStorage() {
  const storeKeys = [
    'pocketwise-categorias-store',
    'pocketwise-transacoes-store',
    'pocketwise-cartoes-store',
  ]

  console.log('🔍 Validando integridade do localStorage...')

  storeKeys.forEach((key) => {
    try {
      const value = localStorage.getItem(key)
      if (value) {
        // Tentar fazer parse para verificar se é JSON válido
        JSON.parse(value)
        console.log(`✅ ${key} OK`)
      }
    } catch (error) {
      console.error(`❌ ${key} está corrompido, removendo...`, error)
      try {
        localStorage.removeItem(key)
        console.log(`🗑️ ${key} removido com sucesso`)
      } catch (removeError) {
        console.error(`❌ Erro ao remover ${key}:`, removeError)
      }
    }
  })

  console.log('✅ Validação de localStorage concluída')
}

// Validar storage antes de renderizar
try {
  validateAndCleanStorage()
} catch (error) {
  console.error('❌ Erro ao validar storage:', error)
  // Em caso de erro crítico, limpar tudo
  try {
    localStorage.clear()
    console.log('🗑️ localStorage completamente limpo devido a erro crítico')
  } catch (clearError) {
    console.error('❌ Não foi possível limpar localStorage:', clearError)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
