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
  { name: 'Orçamentos', path: '/app/orcamento', icon: Wallet, learningKey: 'menuOrcamentos' },
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

      {/* Learning Mode Toggle */}
      <div className="px-4 pt-4">
        <button
          onClick={toggleLearningMode}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
            isLearningMode
              ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 shadow-lg shadow-amber-500/10"
              : "bg-dark-800/50 border border-dark-700/50 hover:bg-dark-800 hover:border-dark-600"
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
            isLearningMode
              ? "bg-gradient-to-br from-amber-400 to-orange-500"
              : "bg-dark-700"
          )}>
            <GraduationCap className={cn(
              "w-4 h-4 transition-colors",
              isLearningMode ? "text-white" : "text-gray-400"
            )} />
          </div>
          <div className="flex-1 text-left">
            <p className={cn(
              "text-sm font-medium transition-colors",
              isLearningMode ? "text-amber-300" : "text-gray-400"
            )}>
              Modo Aprendizagem
            </p>
            <p className="text-xs text-gray-500">
              {isLearningMode ? "Ativo - passe o mouse" : "Desativado"}
            </p>
          </div>
          <div className={cn(
            "w-10 h-5 rounded-full transition-all duration-300 relative",
            isLearningMode ? "bg-amber-500" : "bg-dark-600"
          )}>
            <div className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300",
              isLearningMode ? "left-5" : "left-0.5"
            )} />
          </div>
        </button>

        {isLearningMode && (
          <p className="text-xs text-amber-400/70 mt-2 px-2 animate-pulse">
            Passe o mouse sobre os elementos para aprender
          </p>
        )}
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

      {/* User info */}
      <div className="p-4 border-t border-dark-700/50">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-dark-800/50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center">
            <span className="text-sm font-semibold text-white">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">Usuário</p>
            <p className="text-xs text-gray-500 truncate">Plano Free</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
