import * as LucideIcons from 'lucide-react'
import type { LucideProps } from 'lucide-react'

// Mapeamento de nomes de ícones (kebab-case) para componentes Lucide
const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  // Alimentação
  'utensils': LucideIcons.Utensils,
  'shopping-cart': LucideIcons.ShoppingCart,
  'bike': LucideIcons.Bike,
  'package': LucideIcons.Package,
  'coffee': LucideIcons.Coffee,
  'cake': LucideIcons.Cake,

  // Transporte
  'car': LucideIcons.Car,
  'fuel': LucideIcons.Fuel,
  'smartphone': LucideIcons.Smartphone,
  'square-parking': LucideIcons.SquareParking,
  'wrench': LucideIcons.Wrench,
  'file-text': LucideIcons.FileText,
  'bus': LucideIcons.Bus,

  // Moradia
  'home': LucideIcons.Home,
  'building': LucideIcons.Building,
  'lightbulb': LucideIcons.Lightbulb,
  'droplet': LucideIcons.Droplet,
  'wifi': LucideIcons.Wifi,
  'flame': LucideIcons.Flame,

  // Saúde
  'heart': LucideIcons.Heart,
  'pill': LucideIcons.Pill,
  'stethoscope': LucideIcons.Stethoscope,
  'activity': LucideIcons.Activity,
  'shield': LucideIcons.Shield,
  'dumbbell': LucideIcons.Dumbbell,

  // Lazer
  'smile': LucideIcons.Smile,
  'tv': LucideIcons.Tv,
  'film': LucideIcons.Film,
  'plane': LucideIcons.Plane,
  'gamepad': LucideIcons.Gamepad,
  'palette': LucideIcons.Palette,

  // Educação
  'book': LucideIcons.Book,
  'graduation-cap': LucideIcons.GraduationCap,
  'book-open': LucideIcons.BookOpen,
  'pencil': LucideIcons.Pencil,
  'school': LucideIcons.School,

  // Vestuário
  'shirt': LucideIcons.Shirt,
  'footprints': LucideIcons.Footprints,
  'watch': LucideIcons.Watch,

  // Finanças
  'piggy-bank': LucideIcons.PiggyBank,
  'trending-up': LucideIcons.TrendingUp,
  'trending-down': LucideIcons.TrendingDown,
  'wallet': LucideIcons.Wallet,
  'credit-card': LucideIcons.CreditCard,
  'banknote': LucideIcons.Banknote,
  'coins': LucideIcons.Coins,
  'landmark': LucideIcons.Landmark,
  'dollar-sign': LucideIcons.DollarSign,

  // Pets
  'dog': LucideIcons.Dog,
  'cat': LucideIcons.Cat,
  'fish': LucideIcons.Fish,

  // Outros
  'gift': LucideIcons.Gift,
  'shopping-bag': LucideIcons.ShoppingBag,
  'tag': LucideIcons.Tag,
  'circle-help': LucideIcons.CircleHelp,
  'circle': LucideIcons.Circle,
  'square': LucideIcons.Square,
  'star': LucideIcons.Star,
  'zap': LucideIcons.Zap,
  'briefcase': LucideIcons.Briefcase,
  'users': LucideIcons.Users,
  'user': LucideIcons.User,
  'phone': LucideIcons.Phone,
  'mail': LucideIcons.Mail,
  'calendar': LucideIcons.Calendar,
  'clock': LucideIcons.Clock,
  'map-pin': LucideIcons.MapPin,
  'music': LucideIcons.Music,
  'headphones': LucideIcons.Headphones,
  'camera': LucideIcons.Camera,
  'image': LucideIcons.Image,
  'video': LucideIcons.Video,
  'tool': LucideIcons.Tool,
  'settings': LucideIcons.Settings,
}

// Função helper para verificar se é emoji
function isEmoji(str: string | null | undefined): boolean {
  if (!str) return false
  // Se tiver apenas letras ASCII, hífens ou underscores = texto em inglês (nome de ícone)
  const isEnglishText = /^[a-zA-Z\-_]+$/.test(str)
  return !isEnglishText
}

interface IconRendererProps extends Omit<LucideProps, 'ref'> {
  iconName: string | null | undefined
  fallback?: React.ReactNode
}

/**
 * Componente que renderiza ícones do Lucide React ou emojis
 * @param iconName - Nome do ícone (kebab-case) ou emoji
 * @param fallback - Componente de fallback se o ícone não for encontrado
 * @param ...props - Props do Lucide (size, className, etc.)
 */
export function IconRenderer({ iconName, fallback, ...props }: IconRendererProps) {
  // Se não tem ícone, retorna fallback
  if (!iconName) {
    return fallback ? <>{fallback}</> : null
  }

  // Se é emoji, renderiza diretamente
  if (isEmoji(iconName)) {
    return <span className={props.className}>{iconName}</span>
  }

  // Tenta encontrar o componente de ícone no mapa
  const IconComponent = iconMap[iconName.toLowerCase()]

  if (IconComponent) {
    return <IconComponent {...props} />
  }

  // Se não encontrou o ícone, retorna fallback ou null
  return fallback ? <>{fallback}</> : null
}

/**
 * Função helper para obter ícone seguro (apenas emojis)
 * Mantida para compatibilidade com código existente
 */
export function getSafeIcon(icon: string | null | undefined, fallback: string = ''): string {
  return isEmoji(icon) ? (icon || fallback) : fallback
}
