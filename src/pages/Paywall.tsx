import { Button } from '../components/ui'
import { Check, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function Paywall() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-100 mb-4">
            Seu teste de 7 dias terminou
          </h1>
          <p className="text-xl text-gray-400">
            Continue no controle total das suas finanças
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Plano Mensal */}
          <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-100 mb-2">Mensal</h3>
            <div className="mb-6">
              <span className="text-5xl font-bold text-gray-100">R$ 12,90</span>
              <span className="text-gray-400">/mês</span>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                'Cancele quando quiser',
                'Todas as funcionalidades',
                'Família completa incluída',
                'Suporte prioritário',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <Check className="w-5 h-5 text-green-400" />
                  {item}
                </li>
              ))}
            </ul>

            <Button className="w-full" size="lg">
              Assinar Mensal
            </Button>
          </div>

          {/* Plano Anual */}
          <div className="bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border-2 border-primary-500 rounded-2xl p-8 relative">
            <div className="absolute -top-4 right-8 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
              Mais Popular
            </div>

            <h3 className="text-2xl font-bold text-gray-100 mb-2">Anual</h3>
            <div className="mb-2">
              <span className="text-5xl font-bold text-gray-100">R$ 119,90</span>
              <span className="text-gray-400">/ano</span>
            </div>
            <p className="text-sm text-green-400 mb-6">Economize R$ 34,90 • R$ 9,99/mês</p>

            <ul className="space-y-3 mb-8">
              {[
                '2 meses grátis',
                'Todas as funcionalidades',
                'Família completa incluída',
                'Suporte prioritário',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300">
                  <Check className="w-5 h-5 text-green-400" />
                  {item}
                </li>
              ))}
            </ul>

            <Button className="w-full" size="lg">
              Assinar Anual
            </Button>
          </div>
        </div>

        {/* FAQ Mini */}
        <div className="bg-dark-800/30 border border-dark-700 rounded-xl p-6 text-center">
          <p className="text-gray-400 mb-4">
            💳 Pagamento 100% seguro • 🔒 Cancele quando quiser
          </p>
          <button
            onClick={() => navigate('/app')}
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            Voltar para o app (apenas leitura)
          </button>
        </div>
      </div>
    </div>
  )
}
