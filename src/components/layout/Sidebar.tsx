import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Landmark,
  BarChart3,
  TrendingUp,
  Settings,
  Wallet,
  Users,
  FolderTree,
  Package,
  PiggyBank,
  Repeat,
  FileBarChart,
  GraduationCap,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { useLearningModeStore } from '../../store/useLearningModeStore'
import { useUserPreferencesStore } from '../../store/useUserPreferencesStore'
import { LearningTooltipMenu } from '../ui/LearningTooltip'
import { learningContent } from '../../lib/learningContent'

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  learningKey?: keyof typeof learningContent
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/app', icon: LayoutDashboard, learningKey: 'menuDashboard' },
  { name: 'Transações', path: '/app/transacoes', icon: Receipt, learningKey: 'menuTransacoes' },
  { name: 'Cartões', path: '/app/cartoes', icon: CreditCard, learningKey: 'menuCartoes' },
  { name: 'Contas', path: '/app/contas', icon: Landmark, learningKey: 'menuContas' },
  { name: 'Fluxo de Caixa', path: '/app/fluxo-caixa', icon: BarChart3, learningKey: 'menuFluxoCaixa' },
  { name: 'Relatórios', path: '/app/relatorios', icon: FileBarChart, learningKey: 'menuRelatorios' },
  { name: 'Categorias', path: '/app/categorias', icon: FolderTree, learningKey: 'menuCategorias' },
  { name: 'Envelopes', path: '/app/envelopes', icon: Package, learningKey: 'menuEnvelopes' },
  { name: 'Caixinhas', path: '/app/caixinhas', icon: PiggyBank, learningKey: 'menuCaixinhas' },
  { name: 'Projeções', path: '/app/projecoes', icon: TrendingUp, learningKey: 'menuProjecoes' },
  { name: 'Assinaturas', path: '/app/assinaturas', icon: Repeat, learningKey: 'menuAssinaturas' },
  { name: 'Família', path: '/app/familia', icon: Users, learningKey: 'menuFamilia' },
  { name: 'Configurações', path: '/app/configuracoes', icon: Settings, learningKey: 'menuConfiguracoes' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const isLearningMode = useLearningModeStore((state) => state.isEnabled)
  const toggleLearningMode = useLearningModeStore((state) => state.toggleLearningMode)
  const userName = useUserPreferencesStore((state) => state.nome)
  const userAvatar = useUserPreferencesStore((state) => state.avatarUrl)

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen w-64 bg-dark-900 border-r border-dark-700/50 flex flex-col z-50 transition-transform duration-300",
      "lg:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo */}
      <div className="p-6 border-b border-dark-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">PocketWise</h1>
            <p className="text-xs text-gray-500">Gestão Financeira</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            const content = item.learningKey ? learningContent[item.learningKey] : null

            const linkElement = (
              <Link
                to={item.path}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-primary-500/10 text-primary-400 shadow-lg shadow-primary-500/20'
                    : 'text-gray-400 hover:bg-dark-800 hover:text-gray-200'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            )

            return (
              <li key={item.path}>
                {content ? (
                  <LearningTooltipMenu content={content}>
                    {linkElement}
                  </LearningTooltipMenu>
                ) : (
                  linkElement
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer: User info + Learning Mode */}
      <div className="p-4 border-t border-dark-700/50 space-y-3">
        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-dark-800/50">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center shrink-0 overflow-hidden">
            {userAvatar ? (
              <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-white">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{userName}</p>
            <p className="text-xs text-gray-500 truncate">Plano Free</p>
          </div>
        </div>

        {/* Learning Mode Toggle - Compact */}
        <button
          onClick={toggleLearningMode}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200",
            isLearningMode
              ? "bg-amber-500/10 border border-amber-500/20"
              : "bg-dark-800/30 hover:bg-dark-800/50"
          )}
          title={isLearningMode ? "Desativar modo de aprendizagem" : "Ativar modo de aprendizagem"}
        >
          <GraduationCap className={cn(
            "w-4 h-4 shrink-0",
            isLearningMode ? "text-amber-400" : "text-gray-500"
          )} />
          <span className={cn(
            "text-xs flex-1 text-left",
            isLearningMode ? "text-amber-400" : "text-gray-500"
          )}>
            Modo Aprendizagem
          </span>
          <div className={cn(
            "w-7 h-4 rounded-full transition-all duration-200 relative shrink-0",
            isLearningMode ? "bg-amber-500" : "bg-dark-600"
          )}>
            <div className={cn(
              "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200",
              isLearningMode ? "left-3.5" : "left-0.5"
            )} />
          </div>
        </button>
      </div>
    </aside>
  )
}
