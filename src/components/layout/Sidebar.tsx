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
} from 'lucide-react'
import { cn } from '../../lib/cn'

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/app', icon: LayoutDashboard },
  { name: 'Transações', path: '/app/transacoes', icon: Receipt },
  { name: 'Cartões', path: '/app/cartoes', icon: CreditCard },
  { name: 'Contas', path: '/app/contas', icon: Landmark },
  { name: 'Fluxo de Caixa', path: '/app/fluxo-caixa', icon: BarChart3 },
  { name: 'Relatórios', path: '/app/relatorios', icon: FileBarChart },
  { name: 'Categorias', path: '/app/categorias', icon: FolderTree },
  { name: 'Orçamentos', path: '/app/orcamento', icon: Wallet },
  { name: 'Envelopes', path: '/app/envelopes', icon: Package },
  { name: 'Caixinhas', path: '/app/caixinhas', icon: PiggyBank },
  { name: 'Projeções', path: '/app/projecoes', icon: TrendingUp },
  { name: 'Assinaturas', path: '/app/assinaturas', icon: Repeat },
  { name: 'Família', path: '/app/familia', icon: Users },
  { name: 'Configurações', path: '/app/configuracoes', icon: Settings },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()

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

            return (
              <li key={item.path}>
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
