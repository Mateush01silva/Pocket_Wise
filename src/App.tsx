import { useEffect, useState, useRef, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PrivateRoute } from './components/PrivateRoute'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import {
  // Auth pages
  Landing,
  Login,
  SignUp,
  ForgotPassword,
  ResetPassword,
  Paywall,
  // App pages
  Dashboard,
  Transactions,
  Categories,
  CreditCards,
  BankAccounts,
  CashFlow,
  ComparativeReports,
  Budgets,
  Envelopes,
  Subscriptions,
  Family,
  Settings,
  Assistente,
  Pocks,
} from './pages'
import { Caixinhas } from './pages/Caixinhas'
import { Assinatura } from './pages/Assinatura'
import { AcceptInvite } from './pages/AcceptInvite'
import { useCategoriasStore, useTransacoesStore, useCartoesStore, useAssinaturasStore } from './store'
import { useFamilyStore } from './store/useFamilyStore'
import { useCaixinhasStore } from './store/useCaixinhasStore'
import { isSupabaseConfigured } from './lib/supabase'

function AppRoutes() {
  const { user, loading: authLoading } = useAuth()
  const [isInitialized, setIsInitialized] = useState(false)
  const isMounted = useRef(true)
  // Track which user's data is loaded to avoid unnecessary re-initialization
  const lastInitializedUserRef = useRef<string | null>(null)

  const initializeCategorias = useCategoriasStore((state) => state.initialize)
  const fetchLancamentos = useTransacoesStore((state) => state.fetchLancamentos)
  const fetchCartoes = useCartoesStore((state) => state.fetchCartoes)
  const initializeFamily = useFamilyStore((state) => state.initialize)
  const resetFamily = useFamilyStore((state) => state.reset)
  const initializeAssinaturas = useAssinaturasStore((state) => state.initialize)
  const initializeCaixinhas = useCaixinhasStore((state) => state.initialize)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Inicializar stores quando auth estiver pronto e houver usuário logado
  useEffect(() => {
    // Aguardar auth carregar antes de inicializar stores
    if (authLoading) return

    // Se não há usuário (não logado), permitir renderização para redirecionar ao login
    if (!user) {
      setIsInitialized(true)
      return
    }

    // Evitar re-inicialização para o mesmo usuário
    if (lastInitializedUserRef.current === user.id) return
    lastInitializedUserRef.current = user.id

    // Resetar stores com guard de initialized antes de re-inicializar
    // Necessário quando usuário troca de conta ou faz login após carregamento inicial
    resetFamily()

    const init = async () => {
      console.log('🚀 Inicializando PocketWise...')
      console.log('🔧 Modo:', import.meta.env.VITE_USE_LOCAL_STORAGE === 'true' ? 'LocalStorage' : 'Supabase')

      try {
        // Validar se stores estão funcionando antes de continuar
        if (!initializeCategorias || !fetchLancamentos || !fetchCartoes || !initializeFamily) {
          throw new Error('Stores não foram inicializados corretamente')
        }

        console.log('📦 Inicializando categorias...')
        await initializeCategorias()

        // Check if still mounted before continuing
        if (!isMounted.current) return

        console.log('✅ Categorias inicializadas')

        console.log('👨‍👩‍👧‍👦 Inicializando família...')
        await initializeFamily()

        // Check if still mounted before continuing
        if (!isMounted.current) return

        console.log('✅ Família inicializada')

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

        console.log('📱 Inicializando assinaturas...')
        await initializeAssinaturas()

        // Check if still mounted before updating state
        if (!isMounted.current) return

        console.log('✅ Assinaturas inicializadas')

        console.log('🏦 Inicializando caixinhas...')
        await initializeCaixinhas()

        // Check if still mounted before updating state
        if (!isMounted.current) return

        console.log('✅ Caixinhas inicializadas')

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id])

  // Atualizar dados ao voltar para o app (troca de aba, volta do background no celular)
  // Resolve: sincronização entre dois usuários da família sem reload manual
  const lastRefreshRef = useRef<number>(0)
  const refreshData = useCallback(async () => {
    if (!user) return
    const now = Date.now()
    const COOLDOWN_MS = 30_000 // no máximo 1 refresh a cada 30 segundos
    if (now - lastRefreshRef.current < COOLDOWN_MS) return
    lastRefreshRef.current = now
    try {
      await fetchLancamentos()
    } catch {
      // silencioso — não interromper UX por falha de background refresh
    }
  }, [user, fetchLancamentos])

  useEffect(() => {
    if (!user) return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user, refreshData])

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

  // Se Supabase não está configurado, usar rotas antigas (modo localStorage)
  if (!isSupabaseConfigured()) {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/credit-cards" element={<CreditCards />} />
              <Route path="/bank-accounts" element={<BankAccounts />} />
              <Route path="/cash-flow" element={<CashFlow />} />
              <Route path="/reports" element={<ComparativeReports />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/envelopes" element={<Envelopes />} />
              <Route path="/projections" element={<Navigate to="/credit-cards" replace />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/caixinhas" element={<Caixinhas />} />
              <Route path="/family" element={<Family />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
          <Toaster position="top-right" theme="dark" richColors />
        </BrowserRouter>
      </ErrorBoundary>
    )
  }

  // Modo produção com autenticação
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<SignUp />} />
          <Route path="/recuperar-senha" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/convite/:token" element={<AcceptInvite />} />
          <Route path="/app/assinar" element={<Paywall />} />

          {/* Private routes */}
          <Route
            path="/app"
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/transacoes"
            element={
              <PrivateRoute>
                <Layout>
                  <Transactions />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/categorias"
            element={
              <PrivateRoute>
                <Layout>
                  <Categories />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/cartoes"
            element={
              <PrivateRoute>
                <Layout>
                  <CreditCards />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/contas"
            element={
              <PrivateRoute>
                <Layout>
                  <BankAccounts />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/fluxo-caixa"
            element={
              <PrivateRoute>
                <Layout>
                  <CashFlow />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/relatorios"
            element={
              <PrivateRoute>
                <Layout>
                  <ComparativeReports />
                </Layout>
              </PrivateRoute>
            }
          />
          {/* Redirect old budget route to envelopes */}
          <Route path="/app/orcamento" element={<Navigate to="/app/envelopes" replace />} />
          <Route
            path="/app/envelopes"
            element={
              <PrivateRoute>
                <Layout>
                  <Envelopes />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/projecoes"
            element={<Navigate to="/app/cartoes" replace />}
          />
          <Route
            path="/app/assinaturas"
            element={
              <PrivateRoute>
                <Layout>
                  <Subscriptions />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/caixinhas"
            element={
              <PrivateRoute>
                <Layout>
                  <Caixinhas />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/familia"
            element={
              <PrivateRoute>
                <Layout>
                  <Family />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/configuracoes"
            element={
              <PrivateRoute>
                <Layout>
                  <Settings />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/assistente"
            element={
              <PrivateRoute>
                <Layout>
                  <Assistente />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/pocks"
            element={
              <PrivateRoute>
                <Layout>
                  <Pocks />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/app/assinatura"
            element={
              <PrivateRoute>
                <Layout>
                  <Assinatura />
                </Layout>
              </PrivateRoute>
            }
          />

          {/* Redirect old routes */}
          <Route path="/transactions" element={<Navigate to="/app/transacoes" replace />} />
          <Route path="/credit-cards" element={<Navigate to="/app/cartoes" replace />} />
          <Route path="/bank-accounts" element={<Navigate to="/app/contas" replace />} />
          <Route path="/cash-flow" element={<Navigate to="/app/fluxo-caixa" replace />} />
          <Route path="/reports" element={<Navigate to="/app/relatorios" replace />} />
          <Route path="/categories" element={<Navigate to="/app/categorias" replace />} />
          <Route path="/budgets" element={<Navigate to="/app/envelopes" replace />} />
          <Route path="/envelopes" element={<Navigate to="/app/envelopes" replace />} />
          <Route path="/projections" element={<Navigate to="/app/cartoes" replace />} />
          <Route path="/subscriptions" element={<Navigate to="/app/assinaturas" replace />} />
          <Route path="/caixinhas" element={<Navigate to="/app/caixinhas" replace />} />
          <Route path="/family" element={<Navigate to="/app/familia" replace />} />
          <Route path="/settings" element={<Navigate to="/app/configuracoes" replace />} />
        </Routes>
        <Toaster position="top-right" theme="dark" richColors />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
