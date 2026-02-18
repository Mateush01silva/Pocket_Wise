import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { Eye, EyeOff, AlertCircle, CheckCircle, KeyRound, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Mode = 'loading' | 'error' | 'form' | 'success'

// Ler o hash SINCRONAMENTE na inicialização do módulo, antes que o
// Supabase limpe assincronamente os parâmetros da URL.
const _rawHash = typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
const _hashParams = new URLSearchParams(_rawHash)
const INITIAL_ERROR = _hashParams.get('error')
const INITIAL_ERROR_CODE = _hashParams.get('error_code')
const INITIAL_ERROR_DESC = _hashParams.get('error_description')
const INITIAL_ACCESS_TOKEN = _hashParams.get('access_token')
const INITIAL_TYPE = _hashParams.get('type')

export function ResetPassword() {
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>(() => {
    if (INITIAL_ERROR) return 'error'
    if (INITIAL_ACCESS_TOKEN && INITIAL_TYPE === 'recovery') return 'form'
    return 'loading'
  })

  const [errorTitle, setErrorTitle] = useState(() => {
    if (!INITIAL_ERROR) return ''
    return INITIAL_ERROR_CODE === 'otp_expired' ? 'Link expirado' : 'Link inválido'
  })

  const [errorMessage, setErrorMessage] = useState(() => {
    if (!INITIAL_ERROR) return ''
    if (INITIAL_ERROR_CODE === 'otp_expired') {
      return 'Este link de recuperação expirou. Os links são válidos por 1 hora e só podem ser usados uma vez.'
    }
    return (INITIAL_ERROR_DESC?.replace(/\+/g, ' ') || 'O link de recuperação é inválido ou já foi utilizado.')
  })

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const settledRef = useRef(false)

  // Password strength
  const passwordStrength = () => {
    if (!password) return { text: '', color: '' }
    if (password.length < 6) return { text: 'Muito fraca', color: 'text-red-400' }
    if (password.length < 8) return { text: 'Fraca', color: 'text-yellow-400' }
    if (password.length < 12) return { text: 'Boa', color: 'text-green-400' }
    return { text: 'Forte', color: 'text-green-400' }
  }
  const strength = passwordStrength()

  useEffect(() => {
    // Hash já foi parseado sincronamente — não precisa de lógica adicional
    if (mode !== 'loading') return
    if (!supabase) {
      setErrorTitle('Configuração inválida')
      setErrorMessage('O serviço de autenticação não está configurado.')
      setMode('error')
      return
    }

    const settle = (newMode: Mode) => {
      if (!settledRef.current) {
        settledRef.current = true
        setMode(newMode)
      }
    }

    // Fallback 1: verificar se Supabase já estabeleceu uma sessão de recuperação
    // (hash foi limpo antes do nosso código rodar)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        settle('form')
      }
    })

    // Fallback 2: escutar evento PASSWORD_RECOVERY caso ainda não tenha disparado
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        settle('form')
      } else if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session) {
        settle('form')
      }
    })

    // Timeout: se nenhum dos fallbacks detectar sessão, mostra erro
    const timeout = setTimeout(() => {
      if (!settledRef.current) {
        settledRef.current = true
        setErrorTitle('Link inválido')
        setErrorMessage(
          'Não foi possível verificar o link de recuperação. Solicite um novo link e tente novamente.'
        )
        setMode('error')
      }
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [mode])

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
      // Encerrar a sessão de recuperação após redefinir a senha
      await supabase.auth.signOut()
      setMode('success')
    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err)
      setFormError(err.message || 'Erro ao atualizar a senha. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const Logo = () => (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center gap-2 mb-4">
        <img
          src="/Logo_PocketWise.jpeg"
          alt="PocketWise"
          className="w-12 h-12 rounded-lg object-cover"
        />
        <span className="text-3xl font-bold text-gray-100">
          Pocket<span className="text-primary-500">Wise</span>
        </span>
      </div>
    </div>
  )

  // — Loading —
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Verificando link de recuperação...</p>
        </div>
      </div>
    )
  }

  // — Erro —
  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Logo />
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
                💡 Solicite um novo link — ele chegará em instantes no seu e-mail.
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

  // — Sucesso —
  if (mode === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Logo />
          <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm text-center space-y-6">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">Senha atualizada!</h2>
              <p className="text-gray-400 text-sm">
                Sua senha foi redefinida com sucesso. Faça login com a nova senha.
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

  // — Formulário —
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Logo />
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mb-1">Criar nova senha</h1>
            <p className="text-gray-400 text-sm">Escolha uma senha segura para sua conta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                <p className={`text-xs mt-1 ${strength.color}`}>Força: {strength.text}</p>
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
