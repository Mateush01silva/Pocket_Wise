import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react'
import type { SaudeFinanceira } from '../types'
import { cn } from '../lib/cn'

interface HealthIndicatorProps {
  saude: SaudeFinanceira
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const healthConfig = {
  saudavel: {
    icon: CheckCircle,
    label: 'Saudável',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  atencao: {
    icon: AlertTriangle,
    label: 'Atenção',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  critico: {
    icon: AlertCircle,
    label: 'Crítico',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
}

const sizeConfig = {
  sm: {
    icon: 16,
    text: 'text-xs',
    padding: 'px-2 py-1',
  },
  md: {
    icon: 20,
    text: 'text-sm',
    padding: 'px-3 py-1.5',
  },
  lg: {
    icon: 24,
    text: 'text-base',
    padding: 'px-4 py-2',
  },
}

export function HealthIndicator({
  saude,
  size = 'md',
  showLabel = true,
  className,
}: HealthIndicatorProps) {
  const config = healthConfig[saude]
  const sizes = sizeConfig[size]
  const Icon = config.icon

  if (!showLabel) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          config.bgColor,
          config.borderColor,
          'border',
          sizes.padding,
          className
        )}
      >
        <Icon className={cn(config.color)} size={sizes.icon} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full',
        config.bgColor,
        config.borderColor,
        'border',
        sizes.padding,
        className
      )}
    >
      <Icon className={cn(config.color)} size={sizes.icon} />
      <span className={cn('font-medium', config.color, sizes.text)}>{config.label}</span>
    </div>
  )
}
