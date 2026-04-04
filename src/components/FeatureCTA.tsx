import { useNavigate } from 'react-router-dom'
import { Trophy, Bot, ShoppingCart, Check } from 'lucide-react'

type CTAFeature = 'pocks' | 'ai_assistant' | 'posso_comprar_ai'

interface FeatureConfig {
  icon: React.ComponentType<{ className?: string }>
  name: string
  bullets: string[]
}

const FEATURE_CONFIGS: Record<CTAFeature, FeatureConfig> = {
  pocks: {
    icon: Trophy,
    name: 'Pocks — Saúde Financeira',
    bullets: [
      'Score mensal de 0 a 100 baseado no seu comportamento real',
      'Acompanhe sua evolução mês a mês com histórico de 6 meses',
      'Streaks de meses consecutivos dentro do orçamento com bônus de pontos',
    ],
  },
  ai_assistant: {
    icon: Bot,
    name: 'Assistente Financeiro IA',
    bullets: [
      'Converse sobre suas finanças em linguagem natural',
      'Respostas baseadas nos seus dados reais de envelopes e gastos',
      'Escolha a personalidade que faz mais sentido pra você',
    ],
  },
  posso_comprar_ai: {
    icon: ShoppingCart,
    name: 'Posso Comprar? com IA',
    bullets: [
      'Pergunte em linguagem natural: "posso comprar um tênis de R$300?"',
      'A IA analisa seus envelopes e te responde com contexto real',
      'Simule compras e veja o impacto no seu orçamento antes de decidir',
    ],
  },
}

export function FeatureCTA({ feature }: { feature: CTAFeature }) {
  const navigate = useNavigate()
  const config = FEATURE_CONFIGS[feature]
  const Icon = config.icon

  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <div className="max-w-md w-full text-center">
        {/* Ícone */}
        <div
          className="flex items-center justify-center w-20 h-20 rounded-2xl mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #7C3AED22, #7C3AED44)', border: '1px solid #7C3AED55' }}
        >
          <Icon className="w-10 h-10 text-secondary-400" />
        </div>

        {/* Badge */}
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: '#7C3AED22', color: '#a78bfa', border: '1px solid #7C3AED44' }}
        >
          Exclusivo Mestre
        </span>

        {/* Nome da feature */}
        <h2 className="text-2xl font-bold text-gray-100 mb-2">{config.name}</h2>

        {/* Bullet points */}
        <ul className="text-left space-y-3 mb-8 mt-6">
          {config.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-300 text-sm">
              <Check className="w-5 h-5 text-secondary-400 shrink-0 mt-0.5" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {/* Botão principal */}
        <button
          onClick={() => navigate('/app/assinatura')}
          className="w-full py-3 px-6 rounded-xl font-semibold text-white mb-3 transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
        >
          Assinar Mestre — R$18,90/mês
        </button>

        {/* Links secundários */}
        <button
          onClick={() => navigate('/app/assinatura?ciclo=anual')}
          className="block w-full text-sm text-secondary-400 hover:text-secondary-300 transition-colors mb-2"
        >
          Ver plano anual (R$14,66/mês)
        </button>
        <button
          onClick={() => navigate('/app/assinatura')}
          className="block w-full text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          Ver todos os planos
        </button>
      </div>
    </div>
  )
}

