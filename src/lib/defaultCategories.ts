import type { Categoria } from '../types'

/**
 * Categorias padrão que são criadas automaticamente
 * quando o usuário inicia o app pela primeira vez
 */

export const DEFAULT_CATEGORIES: Omit<Categoria, 'id' | 'user_id' | 'family_id' | 'created_at' | 'updated_at'>[] = [
  // ============================================
  // CATEGORIAS DE DESPESA
  // ============================================

  // Alimentação
  {
    nome: 'Alimentação',
    icone: 'utensils',
    tipo: 'despesa',
    cor: '#ef4444',
    categoria_pai_id: null,
  },
  {
    nome: 'Supermercado',
    icone: 'shopping-cart',
    tipo: 'despesa',
    cor: '#ef4444',
    categoria_pai_id: 'Alimentação', // Será substituído pelo ID real
  },
  {
    nome: 'Restaurante/Jantar Fora',
    icone: 'utensils',
    tipo: 'despesa',
    cor: '#ef4444',
    categoria_pai_id: 'Alimentação',
  },
  {
    nome: 'Delivery',
    icone: 'bike',
    tipo: 'despesa',
    cor: '#ef4444',
    categoria_pai_id: 'Alimentação',
  },
  {
    nome: 'Marmita',
    icone: 'package',
    tipo: 'despesa',
    cor: '#ef4444',
    categoria_pai_id: 'Alimentação',
  },
  {
    nome: 'Lanche/Cafeteria',
    icone: 'coffee',
    tipo: 'despesa',
    cor: '#ef4444',
    categoria_pai_id: 'Alimentação',
  },
  {
    nome: 'Padaria',
    icone: 'cake',
    tipo: 'despesa',
    cor: '#ef4444',
    categoria_pai_id: 'Alimentação',
  },

  // Transporte
  {
    nome: 'Transporte',
    icone: 'car',
    tipo: 'despesa',
    cor: '#f59e0b',
    categoria_pai_id: null,
  },
  {
    nome: 'Combustível',
    icone: 'fuel',
    tipo: 'despesa',
    cor: '#f59e0b',
    categoria_pai_id: 'Transporte',
  },
  {
    nome: 'Uber/99',
    icone: 'smartphone',
    tipo: 'despesa',
    cor: '#f59e0b',
    categoria_pai_id: 'Transporte',
  },
  {
    nome: 'Estacionamento',
    icone: 'square-parking',
    tipo: 'despesa',
    cor: '#f59e0b',
    categoria_pai_id: 'Transporte',
  },
  {
    nome: 'Manutenção Veículo',
    icone: 'wrench',
    tipo: 'despesa',
    cor: '#f59e0b',
    categoria_pai_id: 'Transporte',
  },
  {
    nome: 'IPVA/Seguro',
    icone: 'file-text',
    tipo: 'despesa',
    cor: '#f59e0b',
    categoria_pai_id: 'Transporte',
  },
  {
    nome: 'Transporte Público',
    icone: 'bus',
    tipo: 'despesa',
    cor: '#f59e0b',
    categoria_pai_id: 'Transporte',
  },

  // Moradia
  {
    nome: 'Moradia',
    icone: 'home',
    tipo: 'despesa',
    cor: '#3b82f6',
    categoria_pai_id: null,
  },
  {
    nome: 'Aluguel/Financiamento',
    icone: 'home',
    tipo: 'despesa',
    cor: '#3b82f6',
    categoria_pai_id: 'Moradia',
  },
  {
    nome: 'Condomínio',
    icone: 'building',
    tipo: 'despesa',
    cor: '#3b82f6',
    categoria_pai_id: 'Moradia',
  },
  {
    nome: 'Luz',
    icone: 'lightbulb',
    tipo: 'despesa',
    cor: '#3b82f6',
    categoria_pai_id: 'Moradia',
  },
  {
    nome: 'Água',
    icone: 'droplet',
    tipo: 'despesa',
    cor: '#3b82f6',
    categoria_pai_id: 'Moradia',
  },
  {
    nome: 'Internet',
    icone: 'wifi',
    tipo: 'despesa',
    cor: '#3b82f6',
    categoria_pai_id: 'Moradia',
  },
  {
    nome: 'Gás',
    icone: 'flame',
    tipo: 'despesa',
    cor: '#3b82f6',
    categoria_pai_id: 'Moradia',
  },
  {
    nome: 'IPTU',
    icone: 'file-text',
    tipo: 'despesa',
    cor: '#3b82f6',
    categoria_pai_id: 'Moradia',
  },

  // Saúde
  {
    nome: 'Saúde',
    icone: 'heart',
    tipo: 'despesa',
    cor: '#10b981',
    categoria_pai_id: null,
  },
  {
    nome: 'Farmácia',
    icone: 'pill',
    tipo: 'despesa',
    cor: '#10b981',
    categoria_pai_id: 'Saúde',
  },
  {
    nome: 'Consultas',
    icone: 'stethoscope',
    tipo: 'despesa',
    cor: '#10b981',
    categoria_pai_id: 'Saúde',
  },
  {
    nome: 'Exames',
    icone: 'activity',
    tipo: 'despesa',
    cor: '#10b981',
    categoria_pai_id: 'Saúde',
  },
  {
    nome: 'Plano de Saúde',
    icone: 'shield',
    tipo: 'despesa',
    cor: '#10b981',
    categoria_pai_id: 'Saúde',
  },
  {
    nome: 'Academia',
    icone: 'dumbbell',
    tipo: 'despesa',
    cor: '#10b981',
    categoria_pai_id: 'Saúde',
  },

  // Lazer
  {
    nome: 'Lazer',
    icone: 'smile',
    tipo: 'despesa',
    cor: '#ec4899',
    categoria_pai_id: null,
  },
  {
    nome: 'Streaming',
    icone: 'tv',
    tipo: 'despesa',
    cor: '#ec4899',
    categoria_pai_id: 'Lazer',
  },
  {
    nome: 'Cinema',
    icone: 'film',
    tipo: 'despesa',
    cor: '#ec4899',
    categoria_pai_id: 'Lazer',
  },
  {
    nome: 'Viagens',
    icone: 'plane',
    tipo: 'despesa',
    cor: '#ec4899',
    categoria_pai_id: 'Lazer',
  },
  {
    nome: 'Jogos',
    icone: 'gamepad',
    tipo: 'despesa',
    cor: '#ec4899',
    categoria_pai_id: 'Lazer',
  },
  {
    nome: 'Hobbies',
    icone: 'palette',
    tipo: 'despesa',
    cor: '#ec4899',
    categoria_pai_id: 'Lazer',
  },

  // Educação
  {
    nome: 'Educação',
    icone: 'book',
    tipo: 'despesa',
    cor: '#6366f1',
    categoria_pai_id: null,
  },
  {
    nome: 'Cursos Online',
    icone: 'graduation-cap',
    tipo: 'despesa',
    cor: '#6366f1',
    categoria_pai_id: 'Educação',
  },
  {
    nome: 'Livros',
    icone: 'book-open',
    tipo: 'despesa',
    cor: '#6366f1',
    categoria_pai_id: 'Educação',
  },
  {
    nome: 'Material Escolar',
    icone: 'pencil',
    tipo: 'despesa',
    cor: '#6366f1',
    categoria_pai_id: 'Educação',
  },
  {
    nome: 'Mensalidade',
    icone: 'school',
    tipo: 'despesa',
    cor: '#6366f1',
    categoria_pai_id: 'Educação',
  },

  // Vestuário
  {
    nome: 'Vestuário',
    icone: 'shirt',
    tipo: 'despesa',
    cor: '#f97316',
    categoria_pai_id: null,
  },
  {
    nome: 'Roupas',
    icone: 'shirt',
    tipo: 'despesa',
    cor: '#f97316',
    categoria_pai_id: 'Vestuário',
  },
  {
    nome: 'Calçados',
    icone: 'footprints',
    tipo: 'despesa',
    cor: '#f97316',
    categoria_pai_id: 'Vestuário',
  },
  {
    nome: 'Acessórios',
    icone: 'watch',
    tipo: 'despesa',
    cor: '#f97316',
    categoria_pai_id: 'Vestuário',
  },

  // Outros (Despesas)
  {
    nome: 'Outros',
    icone: 'more-horizontal',
    tipo: 'despesa',
    cor: '#6b7280',
    categoria_pai_id: null,
  },
  {
    nome: 'Presentes',
    icone: 'gift',
    tipo: 'despesa',
    cor: '#6b7280',
    categoria_pai_id: 'Outros',
  },
  {
    nome: 'Doações',
    icone: 'heart-handshake',
    tipo: 'despesa',
    cor: '#6b7280',
    categoria_pai_id: 'Outros',
  },
  {
    nome: 'Pets',
    icone: 'dog',
    tipo: 'despesa',
    cor: '#6b7280',
    categoria_pai_id: 'Outros',
  },
  {
    nome: 'Beleza/Cuidados Pessoais',
    icone: 'sparkles',
    tipo: 'despesa',
    cor: '#6b7280',
    categoria_pai_id: 'Outros',
  },

  // ============================================
  // CATEGORIAS DE RECEITA
  // ============================================

  {
    nome: 'Salário',
    icone: 'briefcase',
    tipo: 'receita',
    cor: '#10b981',
    categoria_pai_id: null,
  },
  {
    nome: 'Investimentos',
    icone: 'trending-up',
    tipo: 'receita',
    cor: '#3b82f6',
    categoria_pai_id: null,
  },
  {
    nome: 'Freelance',
    icone: 'code',
    tipo: 'receita',
    cor: '#8b5cf6',
    categoria_pai_id: null,
  },
  {
    nome: 'Presente',
    icone: 'gift',
    tipo: 'receita',
    cor: '#ec4899',
    categoria_pai_id: null,
  },
  {
    nome: 'Reembolso',
    icone: 'refresh-ccw',
    tipo: 'receita',
    cor: '#f59e0b',
    categoria_pai_id: null,
  },
  {
    nome: 'Outros',
    icone: 'more-horizontal',
    tipo: 'receita',
    cor: '#6b7280',
    categoria_pai_id: null,
  },
]

/**
 * Inicializar categorias padrão no LocalStorage
 * Retorna array de categorias com IDs gerados
 */
export function initializeDefaultCategories(): Categoria[] {
  const categorias: Categoria[] = []
  const parentMap = new Map<string, string>() // nome -> id

  // Primeiro, criar categorias principais (sem pai)
  DEFAULT_CATEGORIES.filter(cat => cat.categoria_pai_id === null).forEach(cat => {
    const id = crypto.randomUUID()
    const categoria: Categoria = {
      ...cat,
      id,
      user_id: null,
      family_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    categorias.push(categoria)
    parentMap.set(cat.nome, id)
  })

  // Depois, criar subcategorias (com pai)
  DEFAULT_CATEGORIES.filter(cat => cat.categoria_pai_id !== null).forEach(cat => {
    const parentId = parentMap.get(cat.categoria_pai_id as string)
    if (parentId) {
      const id = crypto.randomUUID()
      const categoria: Categoria = {
        ...cat,
        id,
        categoria_pai_id: parentId,
        user_id: null,
        family_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      categorias.push(categoria)
    }
  })

  return categorias
}
