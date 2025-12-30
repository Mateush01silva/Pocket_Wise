// =====================================================
// DATABASE TYPES - Correspond to Supabase Schema
// =====================================================

// Enums - Matching Supabase ENUM types
export type TransactionType = 'despesa' | 'receita'
export type PaymentMethod =
  | 'dinheiro'
  | 'debito'
  | 'credito'
  | 'pix'
  | 'transferencia'
  | 'boleto'

export type LancamentoStatus = 'pago' | 'pendente' | 'projetado'
export type PlanejamentoStatus = 'ativo' | 'concluido' | 'cancelado'

// =====================================================
// FAMILIES
// =====================================================

export interface Family {
  id: string
  nome: string
  created_at: string
  updated_at: string
}

// =====================================================
// USERS
// =====================================================

export interface User {
  id: string // UUID from auth.users
  nome: string
  patrimonio_base: number
  family_id: string | null
  created_at: string
  updated_at: string
}

// User com dados de autenticação do Supabase
export interface UserWithAuth extends User {
  email: string
  avatar_url?: string
}

// =====================================================
// CATEGORIAS
// =====================================================

export interface Categoria {
  id: string
  user_id: string | null
  family_id: string | null
  nome: string
  icone: string | null
  tipo: TransactionType
  categoria_pai_id: string | null
  cor: string | null
  created_at: string
  updated_at: string
}

// Categoria com subcategorias
export interface CategoriaComSubcategorias extends Categoria {
  subcategorias?: Categoria[]
}

// =====================================================
// CARTÕES
// =====================================================

export interface Cartao {
  id: string
  user_id: string | null
  family_id: string | null
  nome: string
  dia_fechamento: number // 1-31
  dia_vencimento: number // 1-31
  limite: number | null
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

// =====================================================
// LANÇAMENTOS (Transações)
// =====================================================

export interface Lancamento {
  id: string
  family_id: string
  criado_por: string | null
  tipo: TransactionType
  data: string // Date in YYYY-MM-DD format
  valor: number
  categoria_id: string | null
  subcategoria_id: string | null
  observacao: string | null
  forma_pagamento: PaymentMethod
  cartao_id: string | null
  parcela_atual: number | null
  parcela_total: number | null
  grupo_parcelas_id: string | null
  status: LancamentoStatus
  data_vencimento_fatura: string | null
  created_at: string
  updated_at: string
}

// Lançamento com relações populadas
export interface LancamentoComRelacoes extends Lancamento {
  categoria?: Categoria
  subcategoria?: Categoria
  cartao?: Cartao
  criador?: User
}

// =====================================================
// PLANEJAMENTOS
// =====================================================

export interface Planejamento {
  id: string
  family_id: string
  criado_por: string | null
  nome: string
  valor: number
  data_prevista: string // Date in YYYY-MM-DD format
  categoria_id: string | null
  observacoes: string | null
  status: PlanejamentoStatus
  created_at: string
  updated_at: string
}

// Planejamento com relações
export interface PlanejamentoComRelacoes extends Planejamento {
  categoria?: Categoria
  criador?: User
}

// =====================================================
// RECEITAS PROJETADAS
// =====================================================

export interface ReceitaProjetada {
  id: string
  family_id: string
  criado_por: string | null
  descricao: string
  valor: number
  data_prevista: string // Date in YYYY-MM-DD format
  categoria_id: string | null
  recorrente: boolean
  created_at: string
  updated_at: string
}

// Receita projetada com relações
export interface ReceitaProjetadaComRelacoes extends ReceitaProjetada {
  categoria?: Categoria
  criador?: User
}

// =====================================================
// DASHBOARD & ANALYTICS
// =====================================================

export interface DashboardStats {
  totalReceitas: number
  totalDespesas: number
  saldo: number
  taxaPoupanca: number
  projecaoMensal: number
}

export interface GastoPorCategoria {
  categoria_id: string
  categoria_nome: string
  categoria_cor: string | null
  total: number
  percentual: number
}

export interface GastoPorMes {
  mes: string // YYYY-MM format
  receitas: number
  despesas: number
  saldo: number
}

// =====================================================
// SUBSCRIPTION (SaaS Billing)
// =====================================================

export interface Subscription {
  id: string
  user_id: string
  plan: 'free' | 'premium' | 'family'
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  current_period_end: string
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

// =====================================================
// FORM TYPES (for creating/updating records)
// =====================================================

export interface CreateLancamentoInput {
  family_id: string
  tipo: TransactionType
  data: string
  valor: number
  categoria_id: string | null
  subcategoria_id?: string | null
  observacao?: string | null
  forma_pagamento: PaymentMethod
  cartao_id?: string | null
  parcela_atual?: number | null
  parcela_total?: number | null
  grupo_parcelas_id?: string | null
  status?: LancamentoStatus
  data_vencimento_fatura?: string | null
}

export interface UpdateLancamentoInput extends Partial<CreateLancamentoInput> {
  id: string
}

export interface CreateCartaoInput {
  user_id?: string | null
  family_id?: string | null
  nome: string
  dia_fechamento: number
  dia_vencimento: number
  limite?: number | null
  cor?: string
}

export interface UpdateCartaoInput extends Partial<CreateCartaoInput> {
  id: string
}

export interface CreateCategoriaInput {
  user_id?: string | null
  family_id?: string | null
  nome: string
  icone?: string | null
  tipo: TransactionType
  categoria_pai_id?: string | null
  cor?: string | null
}

export interface UpdateCategoriaInput extends Partial<CreateCategoriaInput> {
  id: string
}

export interface CreatePlanejamentoInput {
  family_id: string
  nome: string
  valor: number
  data_prevista: string
  categoria_id?: string | null
  observacoes?: string | null
}

export interface UpdatePlanejamentoInput extends Partial<CreatePlanejamentoInput> {
  id: string
  status?: PlanejamentoStatus
}

export interface CreateReceitaProjetadaInput {
  family_id: string
  descricao: string
  valor: number
  data_prevista: string
  categoria_id?: string | null
  recorrente?: boolean
}

export interface UpdateReceitaProjetadaInput extends Partial<CreateReceitaProjetadaInput> {
  id: string
}

// =====================================================
// FILTER & QUERY TYPES
// =====================================================

export interface LancamentoFilters {
  tipo?: TransactionType
  categoria_id?: string
  cartao_id?: string
  status?: LancamentoStatus
  forma_pagamento?: PaymentMethod
  data_inicio?: string
  data_fim?: string
  valor_min?: number
  valor_max?: number
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// =====================================================
// UTILITY TYPES
// =====================================================

// Type helper for database responses
export type DbResult<T> = {
  data: T | null
  error: Error | null
}

// Type helper for database list responses
export type DbListResult<T> = {
  data: T[] | null
  error: Error | null
  count: number | null
}
