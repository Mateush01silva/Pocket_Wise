// @ts-nocheck
/**
 * historicoMensalService.ts
 * Gerencia o histórico mensal de contribuições por caixinha.
 * Tabela: caixinha_historico_mensal (migration 053)
 *
 * Responsabilidades:
 * - buildHistoricoMensal: popula/atualiza registros a partir de transacoes_caixinhas
 * - upsertMesAtual: atualiza o registro do mês atual após um depósito
 * - getHistorico: retorna N meses mais recentes de uma caixinha
 */

import { supabase, getUserFamilyId } from '../lib/supabase'
import { format, startOfMonth, subMonths, parseISO } from 'date-fns'
import type { CaixinhaHistoricoMensal, TransacaoCaixinha } from '../types'

/**
 * Agrupa transações de uma caixinha por mês de referência.
 * Retorna Record<'YYYY-MM-01', { depositado: number, houve: boolean }>
 */
function agruparTransacoesPorMes(
  transacoes: TransacaoCaixinha[]
): Record<string, { depositado: number; houve: boolean }> {
  const mapa: Record<string, { depositado: number; houve: boolean }> = {}

  for (const t of transacoes) {
    if (t.tipo !== 'deposito') continue
    const mesKey = format(startOfMonth(parseISO(t.created_at)), 'yyyy-MM-dd')
    if (!mapa[mesKey]) mapa[mesKey] = { depositado: 0, houve: false }
    mapa[mesKey].depositado += t.valor
    mapa[mesKey].houve = true
  }

  return mapa
}

export const historicoMensalService = {
  /**
   * Popula retroativamente o histórico mensal de uma caixinha a partir das
   * transacoes_caixinhas existentes.
   *
   * Ignora meses pausados (não tem como saber retroativamente, então eles
   * ficam como houve_deposito=false, mes_pausado=false — registro honesto).
   *
   * Usa UPSERT para ser idempotente.
   */
  async buildHistoricoMensal(
    caixinhaId: string,
    transacoes: TransacaoCaixinha[],
    intencoesPorMes: Record<string, number> = {}
  ): Promise<{ error: Error | null }> {
    if (!supabase) return { error: new Error('Supabase not configured') }

    const depositos = transacoes.filter((t) => t.tipo === 'deposito')
    if (depositos.length === 0) return { error: null }

    const porMes = agruparTransacoesPorMes(transacoes)

    const rows = Object.entries(porMes).map(([mes_referencia, { depositado, houve }]) => ({
      caixinha_id: caixinhaId,
      mes_referencia,
      houve_deposito: houve,
      valor_depositado: depositado,
      valor_planejado: intencoesPorMes[mes_referencia] ?? null,
      mes_pausado: false,
    }))

    if (rows.length === 0) return { error: null }

    const { error } = await supabase
      .from('caixinha_historico_mensal')
      .upsert(rows, { onConflict: 'caixinha_id,mes_referencia' })

    return { error }
  },

  /**
   * Registra/atualiza o mês atual após um depósito.
   * Chamado pelo createTransacao após um depósito bem-sucedido.
   */
  async upsertMesAtual(
    caixinhaId: string,
    valorDeposito: number,
    intencaoMes: number | null = null
  ): Promise<{ error: Error | null }> {
    if (!supabase) return { error: new Error('Supabase not configured') }

    const mesAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd')

    // Buscar registro existente para somar ao depositado
    const { data: existing } = await supabase
      .from('caixinha_historico_mensal')
      .select('valor_depositado')
      .eq('caixinha_id', caixinhaId)
      .eq('mes_referencia', mesAtual)
      .single()

    const valorAcumulado = (existing?.valor_depositado ?? 0) + valorDeposito

    const { error } = await supabase
      .from('caixinha_historico_mensal')
      .upsert(
        {
          caixinha_id: caixinhaId,
          mes_referencia: mesAtual,
          houve_deposito: true,
          valor_depositado: valorAcumulado,
          valor_planejado: intencaoMes,
          mes_pausado: false,
        },
        { onConflict: 'caixinha_id,mes_referencia' }
      )

    return { error }
  },

  /**
   * Marca um mês como pausado para uma caixinha.
   * Chamado quando a caixinha é pausada e o mês vira sem depósito.
   */
  async marcarMesPausado(
    caixinhaId: string,
    mesReferencia: string
  ): Promise<{ error: Error | null }> {
    if (!supabase) return { error: new Error('Supabase not configured') }

    const { error } = await supabase
      .from('caixinha_historico_mensal')
      .upsert(
        {
          caixinha_id: caixinhaId,
          mes_referencia: mesReferencia,
          houve_deposito: false,
          valor_depositado: 0,
          valor_planejado: null,
          mes_pausado: true,
        },
        { onConflict: 'caixinha_id,mes_referencia' }
      )

    return { error }
  },

  /**
   * Retorna os últimos N meses de histórico de uma caixinha, do mais antigo ao mais recente.
   */
  async getHistorico(
    caixinhaId: string,
    quantidade: number = 6
  ): Promise<{ data: CaixinhaHistoricoMensal[]; error: Error | null }> {
    if (!supabase) return { data: [], error: new Error('Supabase not configured') }

    const { data, error } = await supabase
      .from('caixinha_historico_mensal')
      .select('*')
      .eq('caixinha_id', caixinhaId)
      .order('mes_referencia', { ascending: false })
      .limit(quantidade)

    if (error || !data) return { data: [], error }

    // Retornar do mais antigo ao mais recente para a mini-timeline
    return {
      data: [...data].sort(
        (a, b) => new Date(a.mes_referencia).getTime() - new Date(b.mes_referencia).getTime()
      ),
      error: null,
    }
  },

  /**
   * Busca o histórico de múltiplas caixinhas de uma vez.
   * Retorna Record<caixinha_id, CaixinhaHistoricoMensal[]>
   */
  async getHistoricoMultiplas(
    caixinhaIds: string[],
    quantidade: number = 6
  ): Promise<{ data: Record<string, CaixinhaHistoricoMensal[]>; error: Error | null }> {
    if (!supabase || caixinhaIds.length === 0) return { data: {}, error: null }

    const { data, error } = await supabase
      .from('caixinha_historico_mensal')
      .select('*')
      .in('caixinha_id', caixinhaIds)
      .order('mes_referencia', { ascending: false })

    if (error || !data) return { data: {}, error }

    const result: Record<string, CaixinhaHistoricoMensal[]> = {}
    for (const caixinhaId of caixinhaIds) {
      const historicoDaCaixinha = data
        .filter((h) => h.caixinha_id === caixinhaId)
        .slice(0, quantidade)
        .sort((a, b) => new Date(a.mes_referencia).getTime() - new Date(b.mes_referencia).getTime())
      result[caixinhaId] = historicoDaCaixinha
    }

    return { data: result, error: null }
  },
}
