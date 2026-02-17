import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { Eye, EyeOff, AlertCircle, CheckCircle, Mail, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function SignUp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signUp } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
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
          <p className="text-gray-400">Comece seu teste grátis de 7 dias</p>
        </div>

        {/* Form */}
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm">
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
            <span>✨ 7 dias grátis • Sem cartão de crédito</span>
          </p>
        </div>
      </div>
    </div>
  )
}
