import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from './components/layout/Layout'
import {
  Dashboard,
  Transactions,
  CreditCards,
  Budgets,
  Projections,
  Family,
  Settings,
} from './pages'
import { Categories } from './pages/Categories'
import { useCategoriasStore, useTransacoesStore, useCartoesStore } from './store'

function App() {
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
      } catch (error) {
        console.error('❌ Erro ao inicializar PocketWise:', error)
      }
    }
    init()
  }, [initializeCategorias, fetchLancamentos, fetchCartoes])

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
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
