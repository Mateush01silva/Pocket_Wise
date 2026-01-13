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
  ativo?: boolean
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
  categoria_pai_id: string | null
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
// ORÇAMENTOS MENSAIS (Budget System)
// =====================================================

export type CategoriaPrioridade = 'essencial' | 'importante' | 'desejavel'
export type OrcamentoStatus = 'rascunho' | 'ativo' | 'fechado'
export type SaudeFinanceira = 'saudavel' | 'atencao' | 'critico'
export type TipoAlerta = 'categoria_80' | 'categoria_90' | 'categoria_100' | 'gasto_incomum' | 'meta_atingida' | 'fatura_proxima'

// Orçamento mensal principal
export interface OrcamentoMensal {
  id: string
  family_id: string
  criado_por: string | null
  mes_referencia: string // YYYY-MM-01
  meta_poupanca: number
  meta_poupanca_percentual: number | null // se null, usa valor fixo
  dia_inicio_ciclo: number // 1-31, default 1
  metodo_calculo: 'conservador' | 'otimista'
  status: OrcamentoStatus
  created_at: string
  updated_at: string
}

// Categoria com valor orçado
export interface CategoriaBudget {
  id: string
  orcamento_id: string
  categoria_id: string
  valor_orcado: number
  prioridade: CategoriaPrioridade
  created_at: string
  updated_at: string
}

// Categoria budget com relações
export interface CategoriaBudgetComRelacoes extends CategoriaBudget {
  categoria?: Categoria
  valor_gasto?: number // calculado
  valor_disponivel?: number // calculado
  percentual_usado?: number // calculado
  status?: SaudeFinanceira // calculado
}

// Alerta de orçamento
export interface AlertaOrcamento {
  id: string
  family_id: string
  user_id: string | null
  orcamento_id: string | null
  tipo: TipoAlerta
  titulo: string
  mensagem: string
  categoria_id: string | null
  lido: boolean
  created_at: string
}

// Orçamento completo com relações
export interface OrcamentoMensalCompleto extends OrcamentoMensal {
  categorias_budget: CategoriaBudgetComRelacoes[]
  receitas_projetadas: ReceitaProjetada[]
  total_orcado: number // calculado
  total_gasto: number // calculado
  total_receitas_planejadas: number // calculado
  saldo_projetado: number // calculado
}

// =====================================================
// DASHBOARD ORÇAMENTÁRIO
// =====================================================

export interface SaldoAtual {
  valor: number
  receitas_recebidas: number
  despesas_pagas: number
  data_calculo: string
}

export interface ProjecaoMensal {
  saldo_atual: number
  receitas_futuras: number
  despesas_futuras_confirmadas: number
  despesas_orcadas_nao_lancadas: number
  saldo_projetado_fim_mes: number
  saude: SaudeFinanceira
  percentual_mes_decorrido: number
  percentual_orcamento_usado: number
}

export interface CategoriaEmRisco {
  categoria: Categoria
  valor_orcado: number
  valor_gasto: number
  percentual_usado: number
  margem_restante: number
}

export interface SimulacaoCompra {
  pode_comprar: boolean
  nivel: 'ok' | 'atencao' | 'critico'
  mensagem: string
  impacto_categoria: number
  impacto_saldo_final: number
  margem_restante_categoria: number
}

// =====================================================
// ENVELOPE DIGITAL
// =====================================================

export interface EnvelopeDigital {
  categoria: Categoria
  valor_orcado: number
  valor_gasto: number
  valor_disponivel: number
  percentual_usado: number
  status: SaudeFinanceira
  prioridade: CategoriaPrioridade
  ultimas_transacoes: Lancamento[]
}

// =====================================================
// RELATÓRIOS
// =====================================================

export interface ComparativoCategoria {
  categoria: Categoria
  valor_orcado: number
  valor_gasto: number
  desvio: number
  percentual_desvio: number
  status: 'dentro' | 'atencao' | 'estourado'
}

export interface EvolucaoMensal {
  mes: string // YYYY-MM
  total_orcado: number
  total_gasto: number
  meta_poupanca: number
  poupanca_real: number
  taxa_aderencia: number
}

export interface AnalisePlanejamento {
  mes_referencia: string
  total_categorias: number
  categorias_dentro_orcamento: number
  categorias_estouradas: number
  taxa_aderencia_global: number
  economia_vs_planejado: number
  categorias_com_maior_desvio: ComparativoCategoria[]
}

// =====================================================
// FORM TYPES (Budget)
// =====================================================

export interface CreateOrcamentoInput {
  family_id: string
  mes_referencia: string
  meta_poupanca: number
  meta_poupanca_percentual?: number | null
  dia_inicio_ciclo?: number
  metodo_calculo?: 'conservador' | 'otimista'
  status?: OrcamentoStatus
}

export interface UpdateOrcamentoInput extends Partial<CreateOrcamentoInput> {
  id: string
}

export interface CreateCategoriaBudgetInput {
  orcamento_id: string
  categoria_id: string
  valor_orcado: number
  prioridade?: CategoriaPrioridade
}

export interface UpdateCategoriaBudgetInput extends Partial<CreateCategoriaBudgetInput> {
  id: string
}

export interface CreateAlertaInput {
  family_id: string
  user_id?: string | null
  orcamento_id?: string | null
  tipo: TipoAlerta
  titulo: string
  mensagem: string
  categoria_id?: string | null
}

export interface BulkCategoriaBudgetInput {
  orcamento_id: string
  categorias: Array<{
    categoria_id: string
    valor_orcado: number
    prioridade: CategoriaPrioridade
  }>
}

// =====================================================
// CONFIGURAÇÕES DE ORÇAMENTO
// =====================================================

export interface ConfiguracaoOrcamento {
  id: string
  family_id: string
  dia_inicio_ciclo: number // 1-31
  metodo_calculo: 'conservador' | 'otimista'
  alertas_ativados: boolean
  alerta_80_porcento: boolean
  alerta_90_porcento: boolean
  alerta_100_porcento: boolean
  alerta_gastos_incomuns: boolean
  alerta_metas_atingidas: boolean
  template_orcamento_id: string | null // para copiar mês anterior
  created_at: string
  updated_at: string
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
