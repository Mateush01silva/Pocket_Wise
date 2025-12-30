import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from './components/layout/Layout'
import {
  // Dashboard,  // Temporariamente desabilitado para debug
  Transactions,
  CreditCards,
  Budgets,
  Projections,
  Family,
  Settings,
} from './pages'
import { Categories } from './pages/Categories'
import { DashboardFixed } from './pages/DashboardFixed'
import { useCategoriasStore, useTransacoesStore, useCartoesStore } from './store'

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const initializeCategorias = useCategoriasStore((state) => state.initialize)
  const fetchLancamentos = useTransacoesStore((state) => state.fetchLancamentos)
  const fetchCartoes = useCartoesStore((state) => state.fetchCartoes)

  // Inicializar stores na montagem do app
  useEffect(() => {
    const init = async () => {
      console.log('🚀 Inicializando PocketWise...')
      try {
        console.log('📦 Inicializando categorias...')
        await initializeCategorias()
        console.log('✅ Categorias inicializadas')

        console.log('💰 Carregando transações...')
        await fetchLancamentos()
        console.log('✅ Transações carregadas')

        console.log('💳 Carregando cartões...')
        await fetchCartoes()
        console.log('✅ Cartões carregados')

        console.log('🎉 PocketWise inicializado com sucesso!')
        setIsInitialized(true)
      } catch (error) {
        console.error('❌ Erro ao inicializar PocketWise:', error)
        setIsInitialized(true) // Permitir renderizar mesmo com erro
      }
    }
    init()
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
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardFixed />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/credit-cards" element={<CreditCards />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/projections" element={<Projections />} />
          <Route path="/family" element={<Family />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" theme="dark" richColors />
    </BrowserRouter>
  )
}

export default App
