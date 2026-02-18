import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { AlertCircle, CheckCircle, Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function ForgotPassword() {
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!email) {
      setError('Digite seu email')
      return
    }

    if (!email.includes('@')) {
      setError('Email inválido')
      return
    }

    setIsLoading(true)
    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (err: any) {
      console.error('Erro ao enviar email:', err)
      setError(err.message || 'Erro ao enviar email. Tente novamente.')
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
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Recuperar senha</h1>
          <p className="text-gray-400">Digite seu email para receber o link de recuperação</p>
        </div>

        {/* Form */}
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 backdrop-blur-sm">
          {success ? (
            /* Success Message */
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-green-400" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-100 mb-2">
                  Email enviado!
                </h2>
                <p className="text-gray-400">
                  Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  💡 Não recebeu? Verifique sua caixa de spam ou tente novamente em alguns minutos.
                </p>
              </div>

              <Link to="/login">
                <Button className="w-full">
                  Voltar para login
                </Button>
              </Link>
            </div>
          ) : (
            /* Form */
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

              {/* Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-300">
                  Enviaremos um link seguro para você criar uma nova senha.
                </p>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Enviar link de recuperação
              </Button>

              {/* Back to Login */}
              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Voltar para login
                </Link>
              </div>
            </form>
          )}
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
