import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './lib/debug' // Debug tools

// Chaves de stores que podem ser removidas com segurança se corrompidas.
// NUNCA limpar chaves do Supabase (sb-*-auth-token) pois isso desloga o usuário.
const STORE_KEYS_TO_VALIDATE = [
  'pocketwise-categorias-store',
  'pocketwise-transacoes-store',
  'pocketwise-cartoes-store',
  'pocketwise-cartoes-store',
  'pocketwise-contas-bancarias-store',
  'pocketwise-orcamentos-store',
  'pocketwise-patrimonio-store',
  'pocket-wise-user-preferences',
  'learning-mode-storage',
]

// Função para validar e limpar localStorage corrompido ANTES de inicializar React
function validateAndCleanStorage() {
  console.log('🔍 Validando integridade do localStorage...')

  STORE_KEYS_TO_VALIDATE.forEach((key) => {
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
  // Em caso de erro, limpar apenas os stores da aplicação (nunca limpar tudo,
  // pois isso removeria a sessão do Supabase e deslogaria o usuário no PWA)
  try {
    STORE_KEYS_TO_VALIDATE.forEach((key) => {
      try { localStorage.removeItem(key) } catch { /* ignorar erros individuais */ }
    })
    console.log('🗑️ Stores da aplicação limpos devido a erro crítico')
  } catch (clearError) {
    console.error('❌ Não foi possível limpar stores:', clearError)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
