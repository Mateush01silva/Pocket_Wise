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
import { historicoMensalService } from './historicoMensalService'
import type {
  Caixinha,
  CaixinhaComDetalhes,
  TransacaoCaixinha,
  TransacaoCaixinhaComRelacoes,
  CreateCaixinhaInput,
  UpdateCaixinhaInput,
  AtualizarValorMercadoInput,
  CreateTransacaoCaixinhaInput,
  AlocarSaldoMensalInput,
  CaixinhasSummary,
  TransferirEntreCaixinhasInput,
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
        subtipo_investimento: input.tipo === 'investimento' ? (input.subtipo_investimento || null) : null,
        conta_investimento_id: input.tipo === 'investimento' ? (input.conta_investimento_id || null) : null,
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
   * Atualizar valor de mercado de uma caixinha de investimento.
   * Calcula o delta (variação) e aplica na conta bancária vinculada, se houver.
   * - saldo_atual = total aportado (imutável por este método)
   * - valor_mercado = valor atual de mercado (atualizado aqui)
   * - delta = novo_valor - valor_mercado_anterior (aplica na conta vinculada)
   */
  async atualizarValorMercado(input: AtualizarValorMercadoInput): Promise<DbResult<Caixinha>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    // Buscar caixinha atual para calcular o delta
    const { data: caixinha, error: fetchError } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('id, family_id, tipo, saldo_atual, valor_mercado, conta_investimento_id')
      .eq('id', input.caixinha_id)
      .eq('family_id', familyId)
      .single()

    if (fetchError || !caixinha) {
      return { data: null, error: fetchError || new Error('Caixinha não encontrada') }
    }

    if (caixinha.tipo !== 'investimento') {
      return { data: null, error: new Error('Apenas caixinhas de investimento suportam atualização de mercado') }
    }

    // Calcular delta:
    // Se valor_mercado ainda não foi definido, a baseline é saldo_atual (total aportado)
    const valorAnterior = caixinha.valor_mercado ?? caixinha.saldo_atual
    const delta = input.novo_valor_mercado - valorAnterior

    // Atualizar valor_mercado na caixinha
    const { data: updatedCaixinha, error: updateError } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .update({
        valor_mercado: input.novo_valor_mercado,
        data_valor_mercado: new Date().toISOString(),
      })
      .eq('id', input.caixinha_id)
      .select()
      .single()

    if (updateError) {
      return { data: null, error: updateError }
    }

    // Se há conta vinculada e houve variação, atualizar o saldo da conta
    if (caixinha.conta_investimento_id && delta !== 0) {
      const { data: conta, error: contaError } = await supabase
        // @ts-ignore
        .from('contas_bancarias')
        .select('id, saldo_atual')
        .eq('id', caixinha.conta_investimento_id)
        .single()

      if (!contaError && conta) {
        // Sem Math.max(0): investimentos podem ter valor de mercado abaixo do aportado
        const novoSaldoConta = conta.saldo_atual + delta
        const { error: updateContaError } = await supabase
          // @ts-ignore
          .from('contas_bancarias')
          .update({ saldo_atual: novoSaldoConta })
          .eq('id', caixinha.conta_investimento_id)
          .select()

        if (updateContaError) {
          console.error('Erro ao atualizar saldo da conta vinculada:', updateContaError)
        }
      } else if (contaError) {
        console.error('Erro ao buscar conta vinculada:', contaError)
      }
    }

    return { data: updatedCaixinha, error: null }
  },

  /**
   * Atualizar o status de uma caixinha de Objetivos & Reservas.
   * - 'pausada': mantém ativa=true mas pausa aportes; incrementa meses_pausados no fechamento do mês
   * - 'ativa': retoma a caixinha pausada
   * - 'concluida': arquiva (ativa=false) sem deletar — histórico preservado
   */
  async updateStatus(
    id: string,
    status: 'ativa' | 'pausada' | 'concluida'
  ): Promise<DbResult<Caixinha>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    const { data: existing } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('family_id, tipo, saldo_atual')
      .eq('id', id)
      .single()

    if (!existing || existing.family_id !== familyId) {
      return { data: null, error: new Error('Caixinha not found or access denied') }
    }

    // Concluída: exige saldo zero (usuário deve retirar antes)
    if (status === 'concluida' && existing.saldo_atual > 0) {
      return {
        data: null,
        error: new Error(
          `Retire o saldo (${existing.saldo_atual.toFixed(2)}) antes de concluir a caixinha.`
        ),
      }
    }

    const updatePayload: Record<string, unknown> = { status }
    // Sincronizar ativa com o status para compatibilidade com código existente
    if (status === 'concluida') {
      updatePayload.ativa = false
    } else {
      updatePayload.ativa = true
    }

    const { data, error } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .update(updatePayload)
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

    // Progresso e metas: apenas caixinhas não-investimento (objetivo e emergência)
    const caixinhas_objetivos = caixinhas.filter((c) => c.tipo !== 'investimento')
    const total_metas = caixinhas_objetivos.reduce((sum, c) => sum + (c.meta_valor || 0), 0)
    const caixinhas_com_meta = caixinhas_objetivos.filter((c) => c.meta_valor && c.meta_valor > 0)
    const progresso_geral =
      caixinhas_com_meta.length > 0
        ? caixinhas_com_meta.reduce((sum, c) => {
            if (c.meta_valor && c.meta_valor > 0) {
              return sum + (c.saldo_atual / c.meta_valor) * 100
            }
            return sum
          }, 0) / caixinhas_com_meta.length
        : 0

    const caixinhas_concluidas = caixinhas_objetivos.filter(
      (c) => c.meta_valor && c.saldo_atual >= c.meta_valor
    ).length

    // Métricas exclusivas de investimento
    const caixinhas_investimento = caixinhas.filter((c) => c.tipo === 'investimento')
    const total_investido = caixinhas_investimento.reduce((sum, c) => sum + (c.saldo_atual || 0), 0)
    // Só conta valor_mercado quando foi explicitamente definido
    const caixinhas_com_cotacao = caixinhas_investimento.filter((c) => c.valor_mercado !== null)
    const total_valor_mercado = caixinhas_com_cotacao.reduce((sum, c) => sum + (c.valor_mercado || 0), 0)
    // Para calcular rentabilidade, comparar apenas as caixinhas que têm cotação
    const investido_com_cotacao = caixinhas_com_cotacao.reduce((sum, c) => sum + (c.saldo_atual || 0), 0)
    const rentabilidade_total = total_valor_mercado - investido_com_cotacao
    const rentabilidade_percentual = investido_com_cotacao > 0
      ? (rentabilidade_total / investido_com_cotacao) * 100
      : null

    return {
      data: {
        total_caixinhas,
        total_guardado,
        total_metas,
        progresso_geral,
        caixinhas_ativas: total_caixinhas,
        caixinhas_concluidas,
        total_investido,
        total_valor_mercado,
        rentabilidade_total,
        rentabilidade_percentual,
      },
      error: null,
    }
  },

  /**
   * Transfere valor de mercado de uma caixinha de investimento para outra,
   * preservando a rentabilidade proporcional de ambas.
   *
   * - cost_basis transferido = valor_mercado_transferir * (saldo_atual_source / valor_mercado_source)
   * - valor_mercado de ambas é ajustado diretamente, SEM passar por atualizarValorMercado
   *   (para evitar o delta incorreto na conta bancária vinculada)
   * - Contas bancárias são ajustadas apenas se source e dest tiverem contas DIFERENTES
   */
  async transferirEntreCaixinhas(input: TransferirEntreCaixinhasInput): Promise<DbResult<{ source: Caixinha; dest: Caixinha }>> {
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

    if (input.source_id === input.dest_id) {
      return { data: null, error: new Error('Origem e destino devem ser caixinhas diferentes') }
    }

    // Fetch both caixinhas
    const { data: source, error: sourceErr } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('id, family_id, nome, tipo, saldo_atual, valor_mercado, conta_investimento_id')
      .eq('id', input.source_id)
      .eq('family_id', familyId)
      .single()

    if (sourceErr || !source) {
      return { data: null, error: sourceErr || new Error('Caixinha de origem não encontrada') }
    }

    const { data: dest, error: destErr } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('id, family_id, nome, tipo, saldo_atual, valor_mercado, conta_investimento_id')
      .eq('id', input.dest_id)
      .eq('family_id', familyId)
      .single()

    if (destErr || !dest) {
      return { data: null, error: destErr || new Error('Caixinha de destino não encontrada') }
    }

    if (source.tipo !== 'investimento' || dest.tipo !== 'investimento') {
      return { data: null, error: new Error('Transferência disponível apenas entre caixinhas de investimento') }
    }

    const valorMercadoSource = source.valor_mercado ?? source.saldo_atual
    if (input.valor_mercado_transferir <= 0) {
      return { data: null, error: new Error('O valor a transferir deve ser maior que zero') }
    }
    if (input.valor_mercado_transferir > valorMercadoSource) {
      return { data: null, error: new Error('Valor excede o valor de mercado disponível na caixinha de origem') }
    }

    // Proporção: quanto do custo (saldo_atual) corresponde ao valor de mercado transferido
    const costBasis = valorMercadoSource > 0
      ? input.valor_mercado_transferir * (source.saldo_atual / valorMercadoSource)
      : input.valor_mercado_transferir

    if (costBasis > source.saldo_atual + 0.01) {
      return { data: null, error: new Error('Custo proporcional excede o saldo disponível') }
    }

    // Retirada na origem (trigger do banco atualiza saldo_atual)
    const { error: retiradaErr } = await supabase
      // @ts-ignore
      .from('transacoes_caixinhas')
      .insert({
        caixinha_id: input.source_id,
        realizado_por: currentUser.id,
        valor: Math.round(costBasis * 100) / 100,
        tipo: 'retirada',
        descricao: `Transferência para ${dest.nome}`,
      })

    if (retiradaErr) {
      return { data: null, error: retiradaErr }
    }

    // Depósito no destino (trigger do banco atualiza saldo_atual)
    const { error: depositoErr } = await supabase
      // @ts-ignore
      .from('transacoes_caixinhas')
      .insert({
        caixinha_id: input.dest_id,
        realizado_por: currentUser.id,
        valor: Math.round(costBasis * 100) / 100,
        tipo: 'deposito',
        descricao: `Transferência de ${source.nome}`,
      })

    if (depositoErr) {
      return { data: null, error: depositoErr }
    }

    // Ajustar valor_mercado diretamente (sem passar por atualizarValorMercado)
    const novoValorMercadoSource = Math.max(0, valorMercadoSource - input.valor_mercado_transferir)
    const valorMercadoDest = dest.valor_mercado ?? dest.saldo_atual
    const novoValorMercadoDest = valorMercadoDest + input.valor_mercado_transferir

    const now = new Date().toISOString()

    const { data: updatedSource, error: updateSourceErr } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .update({ valor_mercado: novoValorMercadoSource, data_valor_mercado: now })
      .eq('id', input.source_id)
      .select()
      .single()

    if (updateSourceErr) {
      return { data: null, error: updateSourceErr }
    }

    const { data: updatedDest, error: updateDestErr } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .update({ valor_mercado: novoValorMercadoDest, data_valor_mercado: now })
      .eq('id', input.dest_id)
      .select()
      .single()

    if (updateDestErr) {
      return { data: null, error: updateDestErr }
    }

    return { data: { source: updatedSource, dest: updatedDest }, error: null }
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

    // Construir objeto de inserção
    // destino_mes_referencia pode não existir na tabela ainda (requer migration 013)
    const insertData: Record<string, unknown> = {
      caixinha_id: input.caixinha_id,
      realizado_por: currentUser.id,
      valor: input.valor,
      tipo: input.tipo,
      descricao: input.descricao || null,
      origem_mes_referencia: input.origem_mes_referencia || null,
    }

    // Adicionar destino_mes_referencia apenas se fornecido
    // Isso permite que a aplicação funcione mesmo sem a coluna no banco
    if (input.destino_mes_referencia) {
      insertData.destino_mes_referencia = input.destino_mes_referencia
    }

    const { data, error } = await supabase
      // @ts-ignore
      .from('transacoes_caixinhas')
      .insert(insertData)
      .select()
      .single()

    // Atualizar histórico mensal após depósito em caixinha de objetivo/emergência
    if (!error && data && input.tipo === 'deposito') {
      const { data: caixinhaInfo } = await supabase
        .from('caixinhas')
        .select('tipo')
        .eq('id', input.caixinha_id)
        .single()
      if (caixinhaInfo && caixinhaInfo.tipo !== 'investimento') {
        historicoMensalService.upsertMesAtual(input.caixinha_id, input.valor).catch(() => {
          // Falha silenciosa — não afeta o depósito em si
        })
      }
    }

    return { data, error }
  },

  /**
   * Buscar todas as transações de caixinhas da família (incluindo caixinhas inativas)
   * Usado para calcular o saldo acumulado corretamente após deletar caixinhas
   */
  async getAllTransacoesFamilia(): Promise<DbListResult<TransacaoCaixinha>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family'), count: null }
    }

    // Buscar todos os IDs de caixinhas da família (ativas e inativas)
    const { data: todasCaixinhas } = await supabase
      // @ts-ignore
      .from('caixinhas')
      .select('id')
      .eq('family_id', familyId)

    const ids = (todasCaixinhas || []).map((c: { id: string }) => c.id)
    if (ids.length === 0) {
      return { data: [], error: null, count: 0 }
    }

    const { data, error, count } = await supabase
      // @ts-ignore
      .from('transacoes_caixinhas')
      .select('*', { count: 'exact' })
      .in('caixinha_id', ids)
      .order('created_at', { ascending: false })

    return { data, error, count }
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
