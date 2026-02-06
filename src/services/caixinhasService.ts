// @ts-nocheck
/**
 * Caixinhas Service - Gerenciamento de caixinhas/potes de objetivos
 *
 * Este serviço gerencia todas as operações relacionadas a:
 * - CRUD de caixinhas
 * - Transações de caixinhas (depósitos e retiradas)
 * - Alocação de saldo mensal em caixinhas
 *
 * NOTA: Este arquivo usa @ts-nocheck porque as novas tabelas
 * (caixinhas, transacoes_caixinhas) ainda não foram adicionadas ao tipo Database.
 * Após rodar a migration 006_create_caixinhas_tables.sql, será necessário:
 * 1. Rodar: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
 * 2. Remover o @ts-nocheck no topo deste arquivo
 */

import { supabase, getCurrentUser, getUserFamilyId } from '../lib/supabase'
import type {
  Caixinha,
  CaixinhaComDetalhes,
  TransacaoCaixinha,
  TransacaoCaixinhaComRelacoes,
  CreateCaixinhaInput,
  UpdateCaixinhaInput,
  CreateTransacaoCaixinhaInput,
  AlocarSaldoMensalInput,
  CaixinhasSummary,
  DbResult,
  DbListResult,
} from '../types'

// =====================================================
// CAIXINHAS SERVICE
// =====================================================

export const caixinhasService = {
  /**
   * Listar todas as caixinhas da família
   */
  async getCaixinhas(): Promise<DbListResult<CaixinhaComDetalhes>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family'), count: null }
    }

    const { data, error, count } = await supabase
      // @ts-ignore
      .from('caixinhas_with_creator')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId)
      .eq('ativa', true)
      .order('created_at', { ascending: false })

    return { data, error, count }
  },

  /**
   * Obter uma caixinha específica por ID
   */
  async getCaixinhaById(id: string): Promise<DbResult<CaixinhaComDetalhes>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    const { data, error } = await supabase
      // @ts-ignore
      .from('caixinhas_with_creator')
      .select('*')
      .eq('id', id)
      .eq('family_id', familyId)
      .single()

    return { data, error }
  },

  /**
   * Criar nova caixinha
   */
  async createCaixinha(input: CreateCaixinhaInput): Promise<DbResult<Caixinha>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    // Validar que family_id corresponde
    if (input.family_id !== familyId) {
      return { data: null, error: new Error('Invalid family_id') }
    }

    const { data, error } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .insert({
        family_id: input.family_id,
        criado_por: currentUser.id,
        nome: input.nome,
        tipo: input.tipo,
        meta_valor: input.meta_valor || null,
        prazo_data: input.prazo_data || null,
        icone: input.icone || null,
        cor: input.cor || '#6366f1',
        descricao: input.descricao || null,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Atualizar caixinha
   */
  async updateCaixinha(input: UpdateCaixinhaInput): Promise<DbResult<Caixinha>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    // Verificar se a caixinha pertence à família
    const { data: existingCaixinha } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('family_id')
      .eq('id', input.id)
      .single()

    if (!existingCaixinha || existingCaixinha.family_id !== familyId) {
      return { data: null, error: new Error('Caixinha not found or access denied') }
    }

    const { id, ...updateData } = input

    const { data, error } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Deletar caixinha (marca como inativa)
   */
  async deleteCaixinha(id: string): Promise<DbResult<boolean>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    // Verificar se a caixinha pertence à família
    const { data: existingCaixinha } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('family_id, saldo_atual')
      .eq('id', id)
      .single()

    if (!existingCaixinha || existingCaixinha.family_id !== familyId) {
      return { data: null, error: new Error('Caixinha not found or access denied') }
    }

    // Avisar se tem saldo
    if (existingCaixinha.saldo_atual > 0) {
      return {
        data: null,
        error: new Error(
          `Caixinha possui saldo de R$ ${existingCaixinha.saldo_atual.toFixed(2)}. Retire o saldo antes de deletar.`
        ),
      }
    }

    // Marcar como inativa ao invés de deletar
    const { error } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .update({ ativa: false })
      .eq('id', id)

    if (error) {
      return { data: null, error }
    }

    return { data: true, error: null }
  },

  /**
   * Obter resumo/estatísticas das caixinhas
   */
  async getCaixinhasSummary(): Promise<DbResult<CaixinhasSummary>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    const { data: caixinhas, error } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('*')
      .eq('family_id', familyId)
      .eq('ativa', true)

    if (error || !caixinhas) {
      return { data: null, error }
    }

    const total_caixinhas = caixinhas.length
    const total_guardado = caixinhas.reduce((sum, c) => sum + (c.saldo_atual || 0), 0)
    const total_metas = caixinhas.reduce((sum, c) => sum + (c.meta_valor || 0), 0)

    const caixinhas_com_meta = caixinhas.filter((c) => c.meta_valor && c.meta_valor > 0)
    const progresso_geral =
      caixinhas_com_meta.length > 0
        ? caixinhas_com_meta.reduce((sum, c) => {
            if (c.meta_valor && c.meta_valor > 0) {
              return sum + (c.saldo_atual / c.meta_valor) * 100
            }
            return sum
          }, 0) / caixinhas_com_meta.length
        : 0

    const caixinhas_concluidas = caixinhas.filter(
      (c) => c.meta_valor && c.saldo_atual >= c.meta_valor
    ).length

    return {
      data: {
        total_caixinhas,
        total_guardado,
        total_metas,
        progresso_geral,
        caixinhas_ativas: total_caixinhas,
        caixinhas_concluidas,
      },
      error: null,
    }
  },
}

// =====================================================
// TRANSACOES CAIXINHAS SERVICE
// =====================================================

export const transacoesCaixinhasService = {
  /**
   * Listar transações de uma caixinha
   */
  async getTransacoes(caixinhaId: string): Promise<DbListResult<TransacaoCaixinha>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family'), count: null }
    }

    // Verificar se a caixinha pertence à família
    const { data: caixinha } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('family_id')
      .eq('id', caixinhaId)
      .single()

    if (!caixinha || caixinha.family_id !== familyId) {
      return { data: null, error: new Error('Caixinha not found or access denied'), count: null }
    }

    const { data, error, count } = await supabase
      // @ts-ignore
      .from('transacoes_caixinhas')
      .select('*', { count: 'exact' })
      .eq('caixinha_id', caixinhaId)
      .order('created_at', { ascending: false })

    return { data, error, count }
  },

  /**
   * Criar transação (depósito ou retirada)
   */
  async createTransacao(input: CreateTransacaoCaixinhaInput): Promise<DbResult<TransacaoCaixinha>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    // Verificar se a caixinha pertence à família
    const { data: caixinha } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('family_id, saldo_atual')
      .eq('id', input.caixinha_id)
      .single()

    if (!caixinha || caixinha.family_id !== familyId) {
      return { data: null, error: new Error('Caixinha not found or access denied') }
    }

    // Validar retirada (não pode retirar mais do que tem)
    if (input.tipo === 'retirada' && input.valor > caixinha.saldo_atual) {
      return {
        data: null,
        error: new Error(
          `Saldo insuficiente. Disponível: R$ ${caixinha.saldo_atual.toFixed(2)}`
        ),
      }
    }

    const { data, error } = await supabase
      // @ts-ignore
      .from('transacoes_caixinhas')
      .insert({
        caixinha_id: input.caixinha_id,
        realizado_por: currentUser.id,
        valor: input.valor,
        tipo: input.tipo,
        descricao: input.descricao || null,
        origem_mes_referencia: input.origem_mes_referencia || null,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Deletar transação (reverte o saldo automaticamente via trigger)
   */
  async deleteTransacao(id: string): Promise<DbResult<boolean>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    // Verificar se a transação pertence a uma caixinha da família
    const { data: transacao } = await supabase
      // @ts-ignore
      .from('transacoes_caixinhas')
      .select('caixinha_id')
      .eq('id', id)
      .single()

    if (!transacao) {
      return { data: null, error: new Error('Transaction not found') }
    }

    const { data: caixinha } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('family_id')
      .eq('id', transacao.caixinha_id)
      .single()

    if (!caixinha || caixinha.family_id !== familyId) {
      return { data: null, error: new Error('Access denied') }
    }

    const { error } = await supabase
      // @ts-ignore
      .from('transacoes_caixinhas')
      .delete()
      .eq('id', id)

    if (error) {
      return { data: null, error }
    }

    return { data: true, error: null }
  },

  /**
   * Alocar saldo mensal em múltiplas caixinhas de uma vez
   */
  async alocarSaldoMensal(input: AlocarSaldoMensalInput): Promise<DbResult<boolean>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    // Validar que todas as caixinhas pertencem à família
    const caixinhasIds = input.alocacoes.map((a) => a.caixinha_id)
    const { data: caixinhas } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('id, family_id')
      .in('id', caixinhasIds)

    if (!caixinhas || caixinhas.length !== caixinhasIds.length) {
      return { data: null, error: new Error('One or more caixinhas not found') }
    }

    const invalidCaixinha = caixinhas.find((c) => c.family_id !== familyId)
    if (invalidCaixinha) {
      return { data: null, error: new Error('Access denied to one or more caixinhas') }
    }

    // Criar todas as transações
    // Garantir que origem_mes_referencia seja uma data completa (YYYY-MM-DD)
    const mesRefCompleto = input.mes_referencia.length === 7
      ? `${input.mes_referencia}-01`
      : input.mes_referencia

    const transacoes = input.alocacoes.map((alocacao) => ({
      caixinha_id: alocacao.caixinha_id,
      realizado_por: currentUser.id,
      valor: alocacao.valor,
      tipo: 'deposito' as const,
      descricao: alocacao.descricao || `Alocação de saldo de ${input.mes_referencia}`,
      origem_mes_referencia: mesRefCompleto,
    }))

    const { error } = await supabase
      // @ts-ignore
      .from('transacoes_caixinhas')
      .insert(transacoes)

    if (error) {
      return { data: null, error }
    }

    return { data: true, error: null }
  },
}
