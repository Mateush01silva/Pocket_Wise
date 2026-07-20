import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { Eye, EyeOff, AlertCircle, CheckCircle, Mail, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function SignUp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signUp, signInWithGoogle } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

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
  const [registeredEmail, setRegisteredEmail] = useState('')

  // Password strength
  const passwordStrength = () => {
    if (!password) return { level: 0, text: '', color: '' }
    if (password.length < 6) return { level: 1, text: 'Muito fraca', color: 'text-red-400' }
    if (password.length < 8) return { level: 2, text: 'Fraca', color: 'text-yellow-400' }
    if (password.length < 12) return { level: 3, text: 'Boa', color: 'text-green-400' }
    return { level: 4, text: 'Forte', color: 'text-green-400' }
  }

  const strength = passwordStrength()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validations
    if (!name || !email || !password || !confirmPassword) {
      setError('Preencha todos os campos')
      return
    }

    if (!email.includes('@')) {
      setError('Email inválido')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setIsLoading(true)
    try {
      await signUp(email, password, name)
      setRegisteredEmail(email)
      setEmailSent(true)
    } catch (err: any) {
      console.error('Erro no cadastro:', err)
      setError(err.message || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img
                src="/Logo_PocketWise.jpeg"
                alt="PocketWise"
                className="w-12 h-12 rounded-lg object-cover"
              />
              <span className="text-3xl font-bold text-gray-100">Pocket<span className="text-primary-500">Wise</span></span>
            </div>
          </div>

          <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm text-center space-y-6">
            {/* Ícone */}
            <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-10 h-10 text-primary-400" />
            </div>

            {/* Título */}
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">Confirme seu e-mail</h2>
              <p className="text-gray-400 text-sm">
                Enviamos um link de confirmação para:
              </p>
              <p className="text-primary-400 font-semibold mt-1 break-all">{registeredEmail}</p>
            </div>

            {/* Instruções */}
            <div className="bg-dark-700/50 rounded-xl p-4 text-left space-y-3">
              <p className="text-sm font-medium text-gray-300">Para acessar o app:</p>
              <ol className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="w-5 h-5 bg-primary-500/20 text-primary-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  Abra seu e-mail e procure a mensagem do PocketWise
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="w-5 h-5 bg-primary-500/20 text-primary-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  Clique no link de confirmação dentro do e-mail
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="w-5 h-5 bg-primary-500/20 text-primary-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                  Volte aqui e faça login com sua senha
                </li>
              </ol>
            </div>

            {/* Alerta de spam */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3 text-left">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-300 mb-0.5">Não encontrou o e-mail?</p>
                <p className="text-xs text-yellow-400/80">
                  Verifique a pasta de <strong>spam</strong> ou <strong>lixo eletrônico</strong>. O e-mail pode demorar alguns minutos para chegar.
                </p>
              </div>
            </div>

            {/* Botão de login */}
            <Button
              className="w-full"
              onClick={() => navigate('/login')}
            >
              Ir para o login
            </Button>
          </div>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Crie sua conta</h1>
          <p className="text-gray-400">Comece seu teste grátis de 14 dias</p>
        </div>

        {/* Form */}
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm">
          {/* Google Sign Up */}
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
            {isGoogleLoading ? 'Redirecionando...' : 'Cadastrar com Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-dark-600" />
            <span className="text-xs text-gray-500">ou cadastre com e-mail</span>
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

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome completo <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                required
                disabled={isLoading}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email <span className="text-red-400">*</span>
              </label>
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Senha <span className="text-red-400">*</span>
              </label>
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
              {password && (
                <p className={`text-xs mt-1 ${strength.color}`}>
                  Força: {strength.text}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirmar senha <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {confirmPassword && (
                <div className="flex items-center gap-2 mt-1">
                  {password === confirmPassword ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <p className="text-xs text-green-400">As senhas coincidem</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <p className="text-xs text-red-400">As senhas não coincidem</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Criar conta e começar teste
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center text-sm text-gray-400">
            Já tem uma conta?{' '}
            <Link
              to="/login"
              className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
            >
              Fazer login
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

        {/* Trial Badge */}
        <div className="mt-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
          <p className="text-sm text-green-300 flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>✨ 14 dias grátis • Sem cartão de crédito</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            O teste usa o plano Explorador: até 20 transações, 1 conta, 1 cartão, 5 envelopes e 2
            caixinhas. Para uso ilimitado, conheça o Planejador e o Mestre a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  )
}
