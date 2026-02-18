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
  prioridade?: CategoriaPrioridade
  despesa_fixa?: boolean
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
// CONTAS BANCÁRIAS
// =====================================================

export type TipoConta =
  | 'conta_corrente'
  | 'poupanca'
  | 'carteira_digital'
  | 'dinheiro'
  | 'investimento'
  | 'outra'

export interface ContaBancaria {
  id: string
  user_id: string | null
  family_id: string | null
  nome: string
  tipo: TipoConta
  saldo_inicial: number
  saldo_atual: number
  cor: string
  icone: string | null
  ativo: boolean
  instituicao: string | null // Nome do banco (ex: "Nubank", "Inter")
  agencia: string | null
  numero_conta: string | null
  created_at: string
  updated_at: string
}

// Input para criar conta
export interface CreateContaBancariaInput {
  user_id?: string | null
  family_id: string
  nome: string
  tipo: TipoConta
  saldo_inicial: number
  cor?: string
  icone?: string | null
  ativo?: boolean
  instituicao?: string | null
  agencia?: string | null
  numero_conta?: string | null
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
  conta_id: string | null // Conta bancária vinculada
  parcela_atual: number | null
  parcela_total: number | null
  grupo_parcelas_id: string | null
  status: LancamentoStatus
  data_vencimento_fatura: string | null
  assinatura_id: string | null
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
  conta_id?: string | null
  parcela_atual?: number | null
  parcela_total?: number | null
  grupo_parcelas_id?: string | null
  status?: LancamentoStatus
  data_vencimento_fatura?: string | null
  assinatura_id?: string | null
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
  prioridade?: CategoriaPrioridade
  despesa_fixa?: boolean
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
  id: string  // ID da CategoriaBudget para permitir edição direta
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
  substituir_existentes?: boolean // Se true, deleta categorias existentes antes de criar novas
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
// FAMILY INVITES & MEMBERS
// =====================================================

export type FamilyRole = 'admin' | 'editor' | 'viewer'
export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'expired'

// Membro da família com role
export interface FamilyMember {
  id: string
  family_id: string
  user_id: string
  role: FamilyRole
  joined_at: string
  created_at: string
  updated_at: string
}

// Membro com informações do usuário
export interface FamilyMemberWithUser extends FamilyMember {
  user_name: string
  patrimonio_base: number
  user_created_at: string
}

// Convite para família
export interface FamilyInvite {
  id: string
  family_id: string
  invited_by: string
  invited_email: string
  token: string
  role: FamilyRole
  status: InviteStatus
  message?: string | null
  expires_at: string
  accepted_at?: string | null
  accepted_by?: string | null
  created_at: string
  updated_at: string
}

// Convite com detalhes completos
export interface FamilyInviteWithDetails extends FamilyInvite {
  family_name: string
  invited_by_name: string
}

// =====================================================
// FORM TYPES (Family)
// =====================================================

export interface CreateFamilyInviteInput {
  family_id: string
  invited_email: string
  role?: FamilyRole
  message?: string
}

export interface AcceptFamilyInviteInput {
  token: string
  user_id: string
}

export interface UpdateFamilyMemberInput {
  id: string
  role: FamilyRole
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

// =====================================================
// CAIXINHAS (POTES DE OBJETIVOS)
// =====================================================

export type CaixinhaTipo = 'objetivo' | 'emergencia' | 'investimento'
export type TransacaoCaixinhaTipo = 'deposito' | 'retirada'

// Caixinha/Pote de objetivo
export interface Caixinha {
  id: string
  family_id: string
  criado_por: string
  nome: string
  tipo: CaixinhaTipo
  meta_valor: number | null // Valor da meta (opcional para investimentos)
  prazo_data: string | null // Date in YYYY-MM-DD format (opcional)
  icone: string | null // Emoji ou ícone
  saldo_atual: number
  ativa: boolean
  cor: string
  descricao: string | null
  created_at: string
  updated_at: string
}

// Caixinha com informações do criador e estatísticas
export interface CaixinhaComDetalhes extends Caixinha {
  criador_nome: string
  progresso_percentual: number | null // % de progresso em relação à meta
  valor_faltante: number | null // Quanto falta para atingir a meta
  total_transacoes: number // Total de transações (depósitos + retiradas)
}

// Transação de caixinha (depósito ou retirada)
export interface TransacaoCaixinha {
  id: string
  caixinha_id: string
  realizado_por: string
  valor: number
  tipo: TransacaoCaixinhaTipo
  descricao: string | null
  origem_mes_referencia: string | null // YYYY-MM-DD se veio de saldo mensal (para depósitos)
  destino_mes_referencia: string | null // YYYY-MM-DD para qual mês compor orçamento (para retiradas)
  created_at: string
}

// Transação com relações
export interface TransacaoCaixinhaComRelacoes extends TransacaoCaixinha {
  caixinha?: Caixinha
  realizado_por_nome?: string
}

// =====================================================
// FORM TYPES (Caixinhas)
// =====================================================

export interface CreateCaixinhaInput {
  family_id: string
  nome: string
  tipo: CaixinhaTipo
  meta_valor?: number | null
  prazo_data?: string | null
  icone?: string | null
  cor?: string
  descricao?: string | null
}

export interface UpdateCaixinhaInput extends Partial<CreateCaixinhaInput> {
  id: string
  ativa?: boolean
}

export interface CreateTransacaoCaixinhaInput {
  caixinha_id: string
  valor: number
  tipo: TransacaoCaixinhaTipo
  descricao?: string | null
  origem_mes_referencia?: string | null // Para depósitos: de qual mês vem o saldo
  destino_mes_referencia?: string | null // Para retiradas: para qual mês compor orçamento
}

// Input para alocar saldo mensal em múltiplas caixinhas
export interface AlocarSaldoMensalInput {
  mes_referencia: string // YYYY-MM
  alocacoes: Array<{
    caixinha_id: string
    valor: number
    descricao?: string
  }>
}

// =====================================================
// DASHBOARD CAIXINHAS
// =====================================================

export interface CaixinhasSummary {
  total_caixinhas: number
  total_guardado: number // Soma de todos os saldos
  total_metas: number // Soma de todas as metas
  progresso_geral: number // % médio de progresso
  caixinhas_ativas: number
  caixinhas_concluidas: number // Caixinhas que atingiram a meta
}

// =====================================================
// REBALANCEAMENTO INTELIGENTE
// =====================================================

// Histórico de rebalanceamento (transferência entre categorias)
export interface HistoricoRebalanceamento {
  id: string
  family_id: string
  realizado_por: string
  orcamento_id: string | null
  categoria_origem_id: string
  valor_transferido: number
  categoria_destino_id: string
  motivo: string | null
  foi_sugestao_automatica: boolean
  created_at: string
}

// Histórico com detalhes das categorias
export interface HistoricoRebalanceamentoComDetalhes extends HistoricoRebalanceamento {
  categoria_origem_nome: string
  categoria_origem_icone: string | null
  categoria_origem_cor: string | null
  categoria_origem_prioridade: CategoriaPrioridade
  categoria_destino_nome: string
  categoria_destino_icone: string | null
  categoria_destino_cor: string | null
  categoria_destino_prioridade: CategoriaPrioridade
  realizado_por_nome: string
}

// Sugestão de rebalanceamento gerada pelo algoritmo
export interface SugestaoRebalanceamento {
  categoria_origem: Categoria
  categoria_destino: Categoria
  valor_disponivel: number
  valor_sugerido: number
  motivo: string
  nivel_prioridade: 1 | 2 | 3 // 1 = melhor opção, 3 = última opção
}

// Input para criar rebalanceamento
export interface CreateRebalanceamentoInput {
  family_id: string
  orcamento_id?: string | null
  categoria_origem_id: string
  categoria_destino_id: string
  valor_transferido: number
  motivo?: string
  foi_sugestao_automatica?: boolean
}

// Resultado da análise de estouro
export interface AnaliseEstouro {
  categoria: Categoria
  valor_orcado: number
  valor_gasto: number
  valor_estouro: number
  percentual_estouro: number
  sugestoes: SugestaoRebalanceamento[]
}

// =====================================================
// ASSINATURAS
// =====================================================

export type FrequenciaAssinatura = 'mensal' | 'anual'

// Assinatura recorrente (Netflix, Spotify, etc)
export interface Assinatura {
  id: string
  user_id: string | null
  family_id: string | null
  nome: string
  logo_url: string | null // URL do logo ou emoji
  valor: number
  frequencia: FrequenciaAssinatura
  dia_cobranca: number // 1-31
  categoria_id: string
  subcategoria_id: string | null
  cartao_id: string | null // Cartão de crédito vinculado (se for pago no cartão)
  primeira_cobranca: string // YYYY-MM-DD
  ultima_cobranca: string | null // YYYY-MM-DD quando cancelada
  ativa: boolean
  created_at: string
  updated_at: string
}

// Histórico de alterações de valor
export interface HistoricoValorAssinatura {
  id: string
  assinatura_id: string
  valor_antigo: number
  valor_novo: number
  vigencia_inicio: string // YYYY-MM-DD
  created_at: string
}

// Assinatura com dados computados
export interface AssinaturaComDetalhes extends Assinatura {
  categoria_nome: string
  categoria_cor: string | null
  proxima_cobranca: string // YYYY-MM-DD
  total_pago_ano: number // Calculado
  lancamentos_gerados: number // Contagem
}

// =====================================================
// FORM TYPES (Assinaturas)
// =====================================================

export interface CreateAssinaturaInput {
  family_id: string
  nome: string
  logo_url?: string | null
  valor: number
  frequencia: FrequenciaAssinatura
  dia_cobranca: number
  categoria_id: string
  subcategoria_id?: string | null
  cartao_id?: string | null // Cartão de crédito vinculado
  primeira_cobranca: string
}

export interface UpdateAssinaturaInput extends Partial<CreateAssinaturaInput> {
  id: string
  ativa?: boolean
  ultima_cobranca?: string | null
}

// =====================================================
// DASHBOARD ASSINATURAS
// =====================================================

export interface AssinaturasSummary {
  total_assinaturas_ativas: number
  total_mensal: number
  total_anual: number
  assinatura_mais_cara: Assinatura | null
  categoria_com_mais_gastos: {
    categoria: Categoria
    total: number
    quantidade: number
  } | null
}
