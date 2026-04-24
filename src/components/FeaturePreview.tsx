import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlan } from '../hooks/usePlan'
import type { Feature } from '../hooks/usePlan'
import { useConsultorPermissions } from '../hooks/useConsultorPermissions'
import type { ReactNode } from 'react'

interface FeaturePreviewProps {
  feature: Feature
  title: string
  subtitle: string
  requiredTier: 'planejador' | 'mestre'
  children: ReactNode
}

const TIER_LABELS: Record<'planejador' | 'mestre', string> = {
  planejador: 'Planejador',
  mestre: 'Mestre',
}

const TIER_PRICES: Record<'planejador' | 'mestre', string> = {
  planejador: 'R$12,90/mês',
  mestre: 'R$18,90/mês',
}

export function FeaturePreview({
  feature,
  title,
  subtitle,
  requiredTier,
  children,
}: FeaturePreviewProps) {
  const navigate = useNavigate()
  const { featureAccess } = usePlan()
  const { isConsultor } = useConsultorPermissions()
  const access = featureAccess(feature)

  // Consultores accedem com as permissões do plano do cliente — sem paywall próprio
  if (isConsultor || access === 'full' || access === 'limited') {
    return <>{children}</>
  }

  // preview: mostrar conteúdo embaçado com overlay
  return (
    <div className="relative w-full h-full min-h-[400px]">
      {/* Conteúdo embaçado */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: 'blur(6px)' }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay centralizado */}
      <div className="absolute inset-0 flex items-center justify-center bg-dark-900/60 backdrop-blur-sm rounded-xl z-10">
        <div className="text-center max-w-sm mx-auto px-6 py-8 bg-dark-800/90 border border-dark-600 rounded-2xl shadow-2xl">
          {/* Ícone */}
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary-500/10 border border-secondary-500/20 mx-auto mb-4">
            <Lock className="w-7 h-7 text-secondary-400" />
          </div>

          {/* Título */}
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            {title} disponível no plano{' '}
            <span className="text-secondary-400">{TIER_LABELS[requiredTier]}</span>
          </h3>

          {/* Subtítulo */}
          <p className="text-sm text-gray-400 mb-6">{subtitle}</p>

          {/* Botão primário */}
          <button
            onClick={() => navigate('/app/assinatura')}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white mb-3 transition-all"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
          >
            Ver planos
          </button>

          {/* Botão secundário */}
          <button
            onClick={() =>
              navigate(
                requiredTier === 'planejador'
                  ? '/app/assinatura'
                  : '/app/assinatura'
              )
            }
            className="w-full py-2 px-4 rounded-xl text-sm font-medium text-secondary-300 border border-secondary-500/30 hover:bg-secondary-500/10 transition-all"
          >
            Assinar {TIER_LABELS[requiredTier]} — {TIER_PRICES[requiredTier]}
          </button>
        </div>
      </div>
    </div>
  )
}
