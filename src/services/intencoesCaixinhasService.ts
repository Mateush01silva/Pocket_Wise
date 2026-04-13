// @ts-nocheck
/**
 * intencoesCaixinhasService.ts
 * Gerencia as intenções de aporte mensal em caixinhas de Objetivos & Reservas.
 * Tabela: caixinha_intencoes_mensais (migration 052)
 *
 * Operações:
 * - upsertIntencao: salva ou atualiza a intenção de um mês
 * - getIntencoesPorMes: busca todas as intenções de um mês como Record<caixinha_id, valor_planejado>
 * - deleteIntencao: remove uma intenção específica
 */

import { supabase, getUserFamilyId } from '../lib/supabase'
import type { CaixinhaIntencaoMensal } from '../types'

export const intencoesCaixinhasService = {
  /**
   * Salva ou atualiza a intenção de aporte para uma caixinha num dado mês.
   * Se valor_planejado = 0, deleta o registro (intenção zerada = sem planejamento).
   */
  async upsertIntencao(
    caixinhaId: string,
    mesReferencia: string, // YYYY-MM-DD
    valorPlanejado: number
  ): Promise<{ error: Error | null }> {
    if (!supabase) return { error: new Error('Supabase not configured') }

    if (valorPlanejado <= 0) {
      // Deletar intenção zerada
      const { error } = await supabase
        .from('caixinha_intencoes_mensais')
        .delete()
        .eq('caixinha_id', caixinhaId)
        .eq('mes_referencia', mesReferencia)
      return { error }
    }

    const { error } = await supabase
      .from('caixinha_intencoes_mensais')
      .upsert(
        {
          caixinha_id: caixinhaId,
          mes_referencia: mesReferencia,
          valor_planejado: valorPlanejado,
        },
        { onConflict: 'caixinha_id,mes_referencia' }
      )

    return { error }
  },

  /**
   * Busca todas as intenções para um mês, indexadas por caixinha_id.
   * Retorna Record<string, number> — chave: caixinha_id, valor: valor_planejado
   */
  async getIntencoesPorMes(
    mesReferencia: string
  ): Promise<{ data: Record<string, number>; error: Error | null }> {
    if (!supabase) return { data: {}, error: new Error('Supabase not configured') }

    const familyId = await getUserFamilyId()
    if (!familyId) return { data: {}, error: new Error('User has no family') }

    // Buscar caixinhas da família para filtrar as intenções
    const { data: caixinhas, error: caixinhasError } = await supabase
      .from('caixinhas')
      .select('id')
      .eq('family_id', familyId)

    if (caixinhasError || !caixinhas) return { data: {}, error: caixinhasError }

    const caixinhaIds = caixinhas.map((c: { id: string }) => c.id)
    if (caixinhaIds.length === 0) return { data: {}, error: null }

    const { data, error } = await supabase
      .from('caixinha_intencoes_mensais')
      .select('caixinha_id, valor_planejado')
      .eq('mes_referencia', mesReferencia)
      .in('caixinha_id', caixinhaIds)

    if (error || !data) return { data: {}, error }

    const result: Record<string, number> = {}
    for (const row of data) {
      result[row.caixinha_id] = row.valor_planejado
    }

    return { data: result, error: null }
  },

  /**
   * Salva todas as intenções de um mês de uma vez (bulk upsert).
   * Recebe Record<caixinha_id, valor_planejado>.
   * Pula entradas com valor=0 (deleção não é feita em bulk para simplificar).
   */
  async bulkUpsertIntencoes(
    intencoes: Record<string, number>,
    mesReferencia: string
  ): Promise<{ error: Error | null }> {
    if (!supabase) return { error: new Error('Supabase not configured') }

    const rows = Object.entries(intencoes)
      .filter(([, valor]) => valor > 0)
      .map(([caixinha_id, valor_planejado]) => ({
        caixinha_id,
        mes_referencia: mesReferencia,
        valor_planejado,
      }))

    // Deletar intenções zeradas
    const zeradas = Object.entries(intencoes)
      .filter(([, valor]) => valor <= 0)
      .map(([caixinha_id]) => caixinha_id)

    if (zeradas.length > 0) {
      await supabase
        .from('caixinha_intencoes_mensais')
        .delete()
        .eq('mes_referencia', mesReferencia)
        .in('caixinha_id', zeradas)
    }

    if (rows.length === 0) return { error: null }

    const { error } = await supabase
      .from('caixinha_intencoes_mensais')
      .upsert(rows, { onConflict: 'caixinha_id,mes_referencia' })

    return { error }
  },
}
