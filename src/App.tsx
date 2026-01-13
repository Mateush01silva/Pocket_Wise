import { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import {
  Dashboard,
  Transactions,
  Categories,
  CreditCards,
  Budgets,
  Envelopes,
  Projections,
  Family,
  Settings,
} from './pages'
import { useCategoriasStore, useTransacoesStore, useCartoesStore } from './store'

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const isMounted = useRef(true) // Track if component is mounted
  const initializeCategorias = useCategoriasStore((state) => state.initialize)
  const fetchLancamentos = useTransacoesStore((state) => state.fetchLancamentos)
  const fetchCartoes = useCartoesStore((state) => state.fetchCartoes)

  // Inicializar stores na montagem do app
  useEffect(() => {
    // Set mounted to true when effect runs
    isMounted.current = true

    const init = async () => {
      console.log('🚀 Inicializando PocketWise...')
      console.log('🔧 Modo:', import.meta.env.VITE_USE_LOCAL_STORAGE === 'true' ? 'LocalStorage' : 'Supabase')

      try {
        // Validar se stores estão funcionando antes de continuar
        if (!initializeCategorias || !fetchLancamentos || !fetchCartoes) {
          throw new Error('Stores não foram inicializados corretamente')
        }

        console.log('📦 Inicializando categorias...')
        await initializeCategorias()

        // Check if still mounted before continuing
        if (!isMounted.current) return

        console.log('✅ Categorias inicializadas')

        console.log('💰 Carregando transações...')
        await fetchLancamentos()

        // Check if still mounted before continuing
        if (!isMounted.current) return

        console.log('✅ Transações carregadas')

        console.log('💳 Carregando cartões...')
        await fetchCartoes()

        // Check if still mounted before updating state
        if (!isMounted.current) return

        console.log('✅ Cartões carregados')

        console.log('🎉 PocketWise inicializado com sucesso!')

        // Only update state if component is still mounted
        if (isMounted.current) {
          setIsInitialized(true)
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar PocketWise:', error)
        console.error('Stack trace:', error)

        // Se o erro for crítico (como localStorage corrompido), tentar limpar
        if (error instanceof Error && (
          error.message.includes('JSON') ||
          error.message.includes('parse') ||
          error.message.includes('storage')
        )) {
          console.warn('⚠️ Detectado possível erro de dados corrompidos, tentando limpar...')
          try {
            // Limpar stores corrompidos
            localStorage.removeItem('pocketwise-categorias-store')
            localStorage.removeItem('pocketwise-transacoes-store')
            localStorage.removeItem('pocketwise-cartoes-store')
            console.log('🗑️ Stores limpos, recarregando...')

            // Only reload if component is still mounted
            if (isMounted.current) {
              // Dar um tempo antes de recarregar
              setTimeout(() => {
                if (isMounted.current) {
                  window.location.reload()
                }
              }, 1000)
            }
            return
          } catch (cleanError) {
            console.error('❌ Erro ao limpar dados:', cleanError)
          }
        }

        // Mostrar erro mas permitir renderizar - only if still mounted
        if (isMounted.current) {
          setIsInitialized(true)
        }
      }
    }
    init()

    // Cleanup function - set mounted to false when component unmounts
    return () => {
      isMounted.current = false
    }
  }, [initializeCategorias, fetchLancamentos, fetchCartoes])

  // Mostrar loading enquanto inicializa
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Carregando PocketWise...</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/credit-cards" element={<CreditCards />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/envelopes" element={<Envelopes />} />
            <Route path="/projections" element={<Projections />} />
            <Route path="/family" element={<Family />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
        <Toaster position="top-right" theme="dark" richColors />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
