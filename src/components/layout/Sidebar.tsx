import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Landmark,
  BarChart3,
  Settings,
  Users,
  FolderTree,
  Package,
  PiggyBank,
  Repeat,
  FileBarChart,
  GraduationCap,
  LogOut,
  Bot,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { useLearningModeStore } from '../../store/useLearningModeStore'
import { useUserPreferencesStore } from '../../store/useUserPreferencesStore'
import { useAuth } from '../../contexts/AuthContext'
import { LearningTooltipMenu } from '../ui/LearningTooltip'
import { learningContent } from '../../lib/learningContent'
import { FamilySwitcher } from '../ui/FamilySwitcher'
import { useAssistenteIA } from '../../hooks/useAssistenteIA'
import { usePlan } from '../../hooks/usePlan'

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
  { name: 'Assinaturas', path: '/app/assinaturas', icon: Repeat, learningKey: 'menuAssinaturas' },
  { name: 'Família', path: '/app/familia', icon: Users, learningKey: 'menuFamilia' },
  { name: 'Configurações', path: '/app/configuracoes', icon: Settings, learningKey: 'menuConfiguracoes' },
  { name: 'Pocks', path: '/app/pocks', icon: Trophy },
  { name: 'Assistente IA', path: '/app/assistente', icon: Bot },
  { name: 'Assinatura', path: '/app/assinatura', icon: Wallet },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ isOpen, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, userProfile, subscription } = useAuth()
  const isLearningMode = useLearningModeStore((state) => state.isEnabled)
  const toggleLearningMode = useLearningModeStore((state) => state.toggleLearningMode)
  const prefsName = useUserPreferencesStore((state) => state.nome)
  const { mensagensProativasNaoLidas } = useAssistenteIA()
  const { tier } = usePlan()

  const userName = userProfile?.full_name || prefsName
  const userAvatar = userProfile?.avatar_url || null

  const planLabel = (() => {
    if (subscription?.status === 'trial') return 'Explorador (Trial)'
    if (subscription?.status === 'active') {
      if (tier === 'mestre') return 'Mestre'
      return 'Planejador'
    }
    return 'Explorador'
  })()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Erro ao sair:', error)
    }
  }

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-dark-900 border-r border-dark-700/50 flex flex-col z-50 transition-all duration-300",
      "lg:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className={cn("border-b border-dark-700/50 flex items-center", isCollapsed ? "p-3 justify-center" : "p-6")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
          <img
            src="/Logo_PocketWise.jpeg"
            alt="PocketWise"
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold gradient-text">PocketWise</h1>
              <p className="text-xs text-gray-500">Gestão Financeira</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            const content = item.learningKey ? learningContent[item.learningKey] : null

            const isAssistente = item.path === '/app/assistente'
            const isPocks = item.path === '/app/pocks'

            const iconNode = isAssistente ? (
              <div className="relative shrink-0">
                <Icon className="w-5 h-5" />
                {mensagensProativasNaoLidas > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-amber-500 rounded-full text-[9px] font-bold text-dark-900 flex items-center justify-center leading-none">
                    {mensagensProativasNaoLidas > 9 ? '9+' : mensagensProativasNaoLidas}
                  </span>
                )}
              </div>
            ) : (
              <Icon className="w-5 h-5 shrink-0" />
            )

            const labelNode = !isCollapsed && (
              <span className="font-medium">{item.name}</span>
            )

            const badgeNode = !isCollapsed && (isPocks || isAssistente) && (
              <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary-500/20 text-secondary-400">
                {tier === 'mestre' ? '' : 'Pro'}
              </span>
            )

            const linkElement = (
              <Link
                to={item.path}
                onClick={onClose}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  'flex items-center rounded-lg transition-all duration-200',
                  isCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3',
                  isActive
                    ? 'bg-primary-500/10 text-primary-400 shadow-lg shadow-primary-500/20'
                    : 'text-gray-400 hover:bg-dark-800 hover:text-gray-200'
                )}
              >
                {iconNode}
                {labelNode}
                {badgeNode}
              </Link>
            )

            return (
              <li key={item.path}>
                {content && !isCollapsed ? (
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
      <div className={cn("border-t border-dark-700/50 space-y-2", isCollapsed ? "p-2" : "p-4")}>
        {/* Seletor de família (só aparece se o usuário pertencer a mais de uma família) */}
        {!isCollapsed && <FamilySwitcher />}

        {/* User info */}
        <div className={cn(
          "flex items-center rounded-lg bg-dark-800/50",
          isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2"
        )}>
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center shrink-0 overflow-hidden"
            title={isCollapsed ? userName : undefined}
          >
            {userAvatar ? (
              <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-white">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">{planLabel}</p>
            </div>
          )}
        </div>

        {/* Botão Sair */}
        <button
          onClick={handleLogout}
          title={isCollapsed ? "Sair da conta" : undefined}
          className={cn(
            "w-full flex items-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200",
            isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="text-sm">Sair da conta</span>}
        </button>

        {/* Learning Mode Toggle - Compact */}
        <button
          onClick={toggleLearningMode}
          title={isCollapsed
            ? (isLearningMode ? "Desativar modo de aprendizagem" : "Ativar modo de aprendizagem")
            : undefined
          }
          className={cn(
            "w-full flex items-center rounded-lg transition-all duration-200",
            isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2",
            isLearningMode
              ? "bg-amber-500/10 border border-amber-500/20"
              : "bg-dark-800/30 hover:bg-dark-800/50"
          )}
        >
          <GraduationCap className={cn(
            "w-4 h-4 shrink-0",
            isLearningMode ? "text-amber-400" : "text-gray-500"
          )} />
          {!isCollapsed && (
            <>
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
            </>
          )}
        </button>

        {/* Botão colapsar/expandir — apenas desktop */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? "Expandir menu" : "Minimizar menu"}
            className={cn(
              "hidden lg:flex w-full items-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-800/50 transition-all duration-200",
              isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="text-xs">Minimizar menu</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  )
}
