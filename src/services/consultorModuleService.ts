// @ts-nocheck
import { supabase } from '../lib/supabase'
import type { DbResult } from '../types'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ConsultorDiagnosticGoal {
  id: string
  diagnostic_id: string
  family_id: string
  descricao: string
  prazo_meses: number | null
  valor_alvo: number | null
  prioridade: number
  created_at: string
}

export interface ConsultorDiagnostic {
  id: string
  family_id: string
  consultant_id: string
  renda_liquida_mensal: number
  gastos_fixos_mensais: number
  total_parcelas_dividas: number
  percentual_comprometimento: number | null
  saldo_disponivel: number | null
  created_at: string
  updated_at: string
  goals?: ConsultorDiagnosticGoal[]
}

export interface CreateDiagnosticInput {
  family_id: string
  renda_liquida_mensal: number
  gastos_fixos_mensais: number
  total_parcelas_dividas: number
  goals: Array<{ descricao: string; prazo_meses?: number | null; valor_alvo?: number | null; prioridade: number }>
}

export interface ConsultorDebt {
  id: string
  family_id: string
  diagnostic_id: string | null
  credor: string
  saldo_devedor: number
  taxa_juros: number | null
  taxa_juros_tipo: 'mensal' | 'anual'
  parcelas_restantes: number | null
  valor_parcela: number | null
  data_vencimento: string | null
  envelope_mensal_sugerido: number | null
  envelope_ajustado: number | null
  categoria_id: string | null
  status: 'ativa' | 'quitada' | 'renegociada'
  created_at: string
  updated_at: string
}

export interface CreateDebtInput {
  family_id: string
  diagnostic_id?: string | null
  credor: string
  saldo_devedor: number
  taxa_juros?: number | null
  taxa_juros_tipo?: 'mensal' | 'anual'
  parcelas_restantes?: number | null
  valor_parcela?: number | null
  data_vencimento?: string | null
  envelope_mensal_sugerido?: number | null
  envelope_ajustado?: number | null
  categoria_id?: string | null
}

export interface ConsultorSessionNote {
  id: string
  family_id: string
  consultant_id: string
  session_date: string
  content: string
  next_steps: string | null
  created_at: string
  updated_at: string
}

export interface CreateSessionNoteInput {
  family_id: string
  session_date: string
  content: string
  next_steps?: string | null
}

// ────────────────────────────────────────────────────────────
// Calculations
// ────────────────────────────────────────────────────────────

export function calcularComprometimento(
  rendaLiquida: number,
  gastosFixos: number,
  totalParcelas: number
): { percentual: number; saldoDisponivel: number } {
  if (rendaLiquida <= 0) return { percentual: 100, saldoDisponivel: 0 }
  const totalComprometido = gastosFixos + totalParcelas
  const percentual = Math.min((totalComprometido / rendaLiquida) * 100, 999)
  const saldoDisponivel = rendaLiquida - totalComprometido
  return {
    percentual: Math.round(percentual * 10) / 10,
    saldoDisponivel: Math.round(saldoDisponivel * 100) / 100,
  }
}

export function sugerirEnvelopeMensal(debt: Pick<ConsultorDebt, 'saldo_devedor' | 'taxa_juros' | 'taxa_juros_tipo' | 'parcelas_restantes' | 'valor_parcela'>): number {
  // If we already have parcela value, use it
  if (debt.valor_parcela && debt.valor_parcela > 0) return debt.valor_parcela

  // If we have balance and parcelas, compute simple average
  if (debt.saldo_devedor > 0 && debt.parcelas_restantes && debt.parcelas_restantes > 0) {
    const taxaMensal = debt.taxa_juros
      ? debt.taxa_juros_tipo === 'anual'
        ? debt.taxa_juros / 12 / 100
        : debt.taxa_juros / 100
      : 0

    if (taxaMensal > 0) {
      // Price/payment formula: PMT = PV * i / (1 - (1+i)^-n)
      const n = debt.parcelas_restantes
      const pmt = (debt.saldo_devedor * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -n))
      return Math.round(pmt * 100) / 100
    }

    return Math.round((debt.saldo_devedor / debt.parcelas_restantes) * 100) / 100
  }

  return 0
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

export const consultorModuleService = {
  // ── Diagnostics ──────────────────────────────────────────

  async getDiagnostics(familyId: string): Promise<DbResult<ConsultorDiagnostic[]>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase
        .from('consultant_diagnostics')
        .select('*, goals:consultant_diagnostic_goals(*)')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })

      if (error) return { data: null, error }
      return { data: data as ConsultorDiagnostic[], error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async getLatestDiagnostic(familyId: string): Promise<DbResult<ConsultorDiagnostic | null>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase
        .from('consultant_diagnostics')
        .select('*, goals:consultant_diagnostic_goals(*)')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return { data: null, error }
      return { data: data as ConsultorDiagnostic | null, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async createDiagnostic(input: CreateDiagnosticInput, consultantId: string): Promise<DbResult<ConsultorDiagnostic>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { percentual, saldoDisponivel } = calcularComprometimento(
        input.renda_liquida_mensal,
        input.gastos_fixos_mensais,
        input.total_parcelas_dividas
      )

      const { data: diag, error: diagError } = await supabase
        .from('consultant_diagnostics')
        .insert({
          family_id: input.family_id,
          consultant_id: consultantId,
          renda_liquida_mensal: input.renda_liquida_mensal,
          gastos_fixos_mensais: input.gastos_fixos_mensais,
          total_parcelas_dividas: input.total_parcelas_dividas,
          percentual_comprometimento: percentual,
          saldo_disponivel: saldoDisponivel,
        })
        .select()
        .single()

      if (diagError) return { data: null, error: diagError }

      if (input.goals.length > 0) {
        const goalsToInsert = input.goals.map((g, i) => ({
          diagnostic_id: diag.id,
          family_id: input.family_id,
          descricao: g.descricao,
          prazo_meses: g.prazo_meses ?? null,
          valor_alvo: g.valor_alvo ?? null,
          prioridade: g.prioridade ?? i + 1,
        }))

        const { error: goalsError } = await supabase
          .from('consultant_diagnostic_goals')
          .insert(goalsToInsert)

        if (goalsError) return { data: null, error: goalsError }
      }

      const { data: full } = await supabase
        .from('consultant_diagnostics')
        .select('*, goals:consultant_diagnostic_goals(*)')
        .eq('id', diag.id)
        .single()

      return { data: full as ConsultorDiagnostic, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  // ── Debts ─────────────────────────────────────────────────

  async getDebts(familyId: string): Promise<DbResult<ConsultorDebt[]>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase
        .from('consultant_debts')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: true })

      if (error) return { data: null, error }
      return { data: data as ConsultorDebt[], error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async createDebt(input: CreateDebtInput): Promise<DbResult<ConsultorDebt>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase
        .from('consultant_debts')
        .insert(input)
        .select()
        .single()

      if (error) return { data: null, error }
      return { data: data as ConsultorDebt, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async updateDebt(id: string, updates: Partial<ConsultorDebt>): Promise<DbResult<ConsultorDebt>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase
        .from('consultant_debts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data: null, error }
      return { data: data as ConsultorDebt, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async deleteDebt(id: string): Promise<DbResult<boolean>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { error } = await supabase
        .from('consultant_debts')
        .delete()
        .eq('id', id)

      if (error) return { data: null, error }
      return { data: true, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  // ── Session Notes ─────────────────────────────────────────

  async getSessionNotes(familyId: string): Promise<DbResult<ConsultorSessionNote[]>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase
        .from('consultant_session_notes')
        .select('*')
        .eq('family_id', familyId)
        .order('session_date', { ascending: false })

      if (error) return { data: null, error }
      return { data: data as ConsultorSessionNote[], error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async createSessionNote(input: CreateSessionNoteInput, consultantId: string): Promise<DbResult<ConsultorSessionNote>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase
        .from('consultant_session_notes')
        .insert({ ...input, consultant_id: consultantId })
        .select()
        .single()

      if (error) return { data: null, error }
      return { data: data as ConsultorSessionNote, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async updateSessionNote(id: string, updates: Pick<ConsultorSessionNote, 'content' | 'next_steps' | 'session_date'>): Promise<DbResult<ConsultorSessionNote>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase
        .from('consultant_session_notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data: null, error }
      return { data: data as ConsultorSessionNote, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async deleteSessionNote(id: string): Promise<DbResult<boolean>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { error } = await supabase
        .from('consultant_session_notes')
        .delete()
        .eq('id', id)

      if (error) return { data: null, error }
      return { data: true, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },
}
