import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { Eye, EyeOff, AlertCircle, CheckCircle, KeyRound, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Mode = 'loading' | 'error' | 'form' | 'success'

export function ResetPassword() {
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('loading')
  const [errorTitle, setErrorTitle] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // Password strength
  const passwordStrength = () => {
    if (!password) return { level: 0, text: '', color: '' }
    if (password.length < 6) return { level: 1, text: 'Muito fraca', color: 'text-red-400' }
    if (password.length < 8) return { level: 2, text: 'Fraca', color: 'text-yellow-400' }
    if (password.length < 12) return { level: 3, text: 'Boa', color: 'text-green-400' }
    return { level: 4, text: 'Forte', color: 'text-green-400' }
  }
  const strength = passwordStrength()

  useEffect(() => {
    // 1) Verificar se há erro no hash (ex: link expirado)
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)

    const error = params.get('error')
    const errorCode = params.get('error_code')
    const errorDesc = params.get('error_description')

    if (error) {
      const isExpired = errorCode === 'otp_expired'
      setErrorTitle(isExpired ? 'Link expirado' : 'Link inválido')
      setErrorMessage(
        isExpired
          ? 'Este link de recuperação expirou. Os links são válidos por 1 hora e só podem ser usados uma vez.'
          : (errorDesc?.replace(/\+/g, ' ') || 'O link de recuperação é inválido ou já foi utilizado.')
      )
      setMode('error')
      return
    }

    // 2) Se tem access_token com type=recovery, o Supabase já processou o token
    const accessToken = params.get('access_token')
    const type = params.get('type')

    if (accessToken && type === 'recovery') {
      setMode('form')
      return
    }

    // 3) Fallback: escutar evento PASSWORD_RECOVERY do Supabase
    // (ocorre quando o hash já foi consumido pelo cliente antes do useEffect)
    if (!supabase) {
      setErrorTitle('Configuração inválida')
      setErrorMessage('O serviço de autenticação não está configurado.')
      setMode('error')
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('form')
        subscription.unsubscribe()
      }
    })

    // Se depois de um breve período não detectou nada, mostra erro
    const timeout = setTimeout(() => {
      setMode((current) => {
        if (current === 'loading') {
          setErrorTitle('Link inválido')
          setErrorMessage('Não foi possível identificar o link de recuperação. Solicite um novo link.')
          return 'error'
        }
        return current
      })
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (password.length < 6) {
      setFormError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setFormError('As senhas não coincidem')
      return
    }

    if (!supabase) {
      setFormError('Serviço de autenticação não disponível')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMode('success')
    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err)
      setFormError(err.message || 'Erro ao atualizar a senha. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const Header = () => (
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
  )

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Verificando link...</p>
        </div>
      </div>
    )
  }

  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Header />
          <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">{errorTitle}</h2>
              <p className="text-gray-400 text-sm">{errorMessage}</p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <p className="text-sm text-blue-300">
                💡 Solicite um novo link de recuperação — ele chegará em instantes no seu e-mail.
              </p>
            </div>

            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate('/recuperar-senha')}>
                Solicitar novo link
              </Button>
              <Link
                to="/login"
                className="block text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                Voltar para login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Header />
          <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm text-center space-y-6">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">Senha atualizada!</h2>
              <p className="text-gray-400 text-sm">
                Sua senha foi redefinida com sucesso. Você já pode fazer login com a nova senha.
              </p>
            </div>

            <Button className="w-full" onClick={() => navigate('/login')}>
              Ir para o login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // mode === 'form'
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Header />
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mb-1">Criar nova senha</h1>
            <p className="text-gray-400 text-sm">Escolha uma senha segura para sua conta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Alert */}
            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{formError}</p>
              </div>
            )}

            {/* Nova senha */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nova senha <span className="text-red-400">*</span>
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

            {/* Confirmar senha */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirmar nova senha <span className="text-red-400">*</span>
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

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Salvar nova senha
            </Button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-300 transition-colors">
            ← Voltar para home
          </Link>
        </div>
      </div>
    </div>
  )
}
