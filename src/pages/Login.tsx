import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, signInWithGoogle, user, loading } = useAuth()

  // Se o usuário já está logado, redirecionar diretamente para o app
  useEffect(() => {
    if (!loading && user) {
      const redirectTo = searchParams.get('redirect') || '/app'
      navigate(redirectTo, { replace: true })
    }
  }, [user, loading, navigate, searchParams])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleSignIn = async () => {
    setError('')
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle()
      // Não chega aqui — o navegador redireciona para o Google
    } catch (err: any) {
      setError('Erro ao autenticar com Google. Tente novamente.')
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Preencha todos os campos')
      return
    }

    setIsLoading(true)
    try {
      await signIn(email, password)
      const redirectTo = searchParams.get('redirect') || '/app'
      navigate(redirectTo, { replace: true })
      setTimeout(() => {
        toast.success('Login realizado com sucesso!')
      }, 100)
    } catch (err: any) {
      console.error('Erro no login - detalhes completos:', {
        message: err.message,
        status: err.status,
        statusCode: err.statusCode,
        name: err.name,
        cause: err.cause,
        stack: err.stack,
        raw: err,
      })
      const msg = err.message || ''
      if (msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('network')) {
        setError('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente em instantes.')
      } else if (err.status === 429 || err.statusCode === 429) {
        setError('Muitas tentativas de login. Aguarde alguns minutos e tente novamente.')
      } else {
        setError(msg || 'Email ou senha incorretos')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img
              src="/Logo_PocketWise.jpeg"
              alt="PocketWise"
              className="w-12 h-12 rounded-lg object-cover"
            />
            <span className="text-3xl font-bold text-gray-100">Pocket<span className="text-primary-500">Wise</span></span>
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Bem-vindo de volta!</h1>
          <p className="text-gray-400">Faça login para continuar</p>
        </div>

        {/* Form */}
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm">
          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl border border-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-5"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C17.778 13.531 17.64 11.5 17.64 9.2z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.177 0 7.547 0 9s.348 2.823.957 4.038l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            {isGoogleLoading ? 'Redirecionando...' : 'Continuar com Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-dark-600" />
            <span className="text-xs text-gray-500">ou</span>
            <div className="flex-1 h-px bg-dark-600" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-dark-700 text-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0"
                />
                Lembrar de mim
              </label>
              <Link
                to="/recuperar-senha"
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                Esqueceu sua senha?
              </Link>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Entrar
            </Button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center text-sm text-gray-400">
            Não tem uma conta?{' '}
            <Link
              to="/cadastro"
              className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
            >
              Cadastre-se
            </Link>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            ← Voltar para home
          </Link>
        </div>
      </div>
    </div>
  )
}
