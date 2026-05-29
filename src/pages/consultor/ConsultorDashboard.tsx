import { useState } from 'react'
import { ClipboardList, CreditCard, FileText, TrendingUp, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { DiagnosticoWizard } from './DiagnosticoWizard'
import { GestorDividas } from './GestorDividas'
import { HistoricoSessoes } from './HistoricoSessoes'
import { PainelEvolucao } from './PainelEvolucao'

type Tab = 'diagnostico' | 'dividas' | 'sessoes' | 'evolucao'

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'diagnostico',
    label: 'Diagnóstico',
    icon: ClipboardList,
    description: 'Wizard de diagnóstico financeiro',
  },
  {
    id: 'dividas',
    label: 'Dívidas',
    icon: CreditCard,
    description: 'Gestão de passivos e envelopes',
  },
  {
    id: 'sessoes',
    label: 'Sessões',
    icon: FileText,
    description: 'Registro de sessões e notas',
  },
  {
    id: 'evolucao',
    label: 'Evolução',
    icon: TrendingUp,
    description: 'Painel histórico Pocks',
  },
]

interface ConsultorDashboardProps {
  familyId: string
  familyName: string
  onClose: () => void
}

export function ConsultorDashboard({ familyId, familyName, onClose }: ConsultorDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('diagnostico')

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex flex-col w-full max-w-3xl bg-dark-900 border-l border-dark-700/60 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-dark-700/50 bg-dark-800/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4 text-primary-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Atendimento Consultivo</p>
              <h2 className="font-semibold text-gray-100 truncate">{familyName}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-dark-700/50 transition-all shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-dark-700/50 bg-dark-800/40 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                  isActive
                    ? 'border-primary-500 text-primary-400 bg-primary-500/5'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-dark-700/30'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'diagnostico' && (
            <DiagnosticoWizard familyId={familyId} />
          )}
          {activeTab === 'dividas' && (
            <GestorDividas familyId={familyId} />
          )}
          {activeTab === 'sessoes' && (
            <HistoricoSessoes familyId={familyId} />
          )}
          {activeTab === 'evolucao' && (
            <PainelEvolucao familyId={familyId} />
          )}
        </div>
      </div>
    </div>
  )
}
