// @ts-nocheck
/**
 * Rebalanceamento Service - Sistema inteligente de rebalanceamento de orçamento
 *
 * Este serviço implementa o algoritmo de sugestões inteligentes para
 * rebalanceamento automático quando uma categoria estoura o orçamento.
 *
 * ALGORITMO DE PRIORIZAÇÃO:
 * 1. Categorias DESEJÁVEIS com saldo sobrando (primeira escolha)
 * 2. Categorias IMPORTANTES com muito saldo disponível (>50%)
 * 3. Caixinhas de emergência (com autorização do usuário)
 * 4. Categorias ESSENCIAIS (última opção, apenas se crítico)
 *
 * NOTA: Este arquivo usa @ts-nocheck porque a nova tabela
 * historico_rebalanceamentos ainda não foi adicionada ao tipo Database.
 */

import { supabase, getCurrentUser, getUserFamilyId } from '../lib/supabase'
import { formatCurrency } from '../utils/currency'
import type {
  Categoria,
  CategoriaBudgetComRelacoes,
  SugestaoRebalanceamento,
  AnaliseEstouro,
  CreateRebalanceamentoInput,
  HistoricoRebalanceamento,
  HistoricoRebalanceamentoComDetalhes,
  DbResult,
  DbListResult,
  CategoriaPrioridade,
} from '../types'

// =====================================================
// ALGORITMO DE SUGESTÕES INTELIGENTES
// =====================================================

/**
 * Gera sugestões inteligentes de rebalanceamento para cobrir um déficit
 */
export async function gerarSugestoesRebalanceamento(
  categoriaEstourada: CategoriaBudgetComRelacoes,
  valorNecessario: number,
  todasCategoriasBudget: CategoriaBudgetComRelacoes[]
): Promise<SugestaoRebalanceamento[]> {
  const sugestoes: SugestaoRebalanceamento[] = []
  let valorRestante = valorNecessario

  console.log('🔍 Gerando sugestões:', {
    categoriaEstourada: categoriaEstourada.categoria?.nome,
    valorNecessario,
    totalCategorias: todasCategoriasBudget.length,
  })

  // Log de todas as categorias para debug
  console.log('📊 Todas as categorias:', todasCategoriasBudget.map(cat => ({
    nome: cat.categoria?.nome,
    prioridade: cat.categoria?.prioridade,
    valor_orcado: cat.valor_orcado,
    valor_disponivel: cat.valor_disponivel,
    tem_categoria: !!cat.categoria,
  })))

  // Filtrar apenas categorias com saldo disponível
  const categoriasComSaldo = todasCategoriasBudget.filter(
    (cat) =>
      cat.id !== categoriaEstourada.id && // Não sugerir a própria categoria
      cat.valor_disponivel &&
      cat.valor_disponivel > 0 &&
      cat.categoria // Tem categoria vinculada
  )

  console.log('✅ Categorias com saldo disponível:', categoriasComSaldo.length)

  if (categoriasComSaldo.length === 0) {
    console.warn('⚠️ Nenhuma categoria com saldo encontrada!')
    return []
  }

  // =====================================================
  // NÍVEL 1: Categorias DESEJÁVEIS com saldo
  // =====================================================
  const desejaveisComSaldo = categoriasComSaldo
    .filter((cat) => cat.categoria?.prioridade === 'desejavel')
    .sort((a, b) => (b.valor_disponivel || 0) - (a.valor_disponivel || 0))

  console.log(`🟢 Desejáveis encontradas: ${desejaveisComSaldo.length}`, desejaveisComSaldo.map(cat => ({
    nome: cat.categoria?.nome,
    disponivel: cat.valor_disponivel,
  })))

  for (const catBudget of desejaveisComSaldo) {
    if (!catBudget.categoria || valorRestante <= 0) break

    const valorDisponivel = catBudget.valor_disponivel || 0
    const valorSugerido = Math.min(valorDisponivel, valorRestante)

    sugestoes.push({
      categoria_origem: catBudget.categoria,
      categoria_destino: categoriaEstourada.categoria!,
      valor_disponivel: valorDisponivel,
      valor_sugerido: valorSugerido,
      motivo: `${catBudget.categoria.nome} é categoria desejável com ${formatCurrency(valorDisponivel)} disponíveis`,
      nivel_prioridade: 1, // Melhor opção
    })

    valorRestante -= valorSugerido
  }

  // =====================================================
  // NÍVEL 2: Categorias IMPORTANTES com muito saldo (>50%)
  // =====================================================
  if (valorRestante > 0) {
    const importantesComMuitoSaldo = categoriasComSaldo
      .filter((cat) => {
        if (cat.categoria?.prioridade !== 'importante') return false
        if (!cat.valor_orcado || cat.valor_orcado === 0) return false

        const percentualDisponivel = (cat.valor_disponivel || 0) / cat.valor_orcado
        return percentualDisponivel > 0.5 // Mais de 50% disponível
      })
      .sort((a, b) => (b.valor_disponivel || 0) - (a.valor_disponivel || 0))

    for (const catBudget of importantesComMuitoSaldo) {
      if (!catBudget.categoria || valorRestante <= 0) break

      const valorDisponivel = catBudget.valor_disponivel || 0
      const maxSugerido = valorDisponivel * 0.7 // Sugerir até 70% do disponível
      const valorSugerido = Math.min(maxSugerido, valorRestante)
      const percentualDisponivel = ((valorDisponivel / (catBudget.valor_orcado || 1)) * 100).toFixed(0)

      sugestoes.push({
        categoria_origem: catBudget.categoria,
        categoria_destino: categoriaEstourada.categoria!,
        valor_disponivel: valorDisponivel,
        valor_sugerido: valorSugerido,
        motivo: `${catBudget.categoria.nome} tem ${percentualDisponivel}% do orçamento disponível`,
        nivel_prioridade: 2,
      })

      valorRestante -= valorSugerido
    }
  }

  // =====================================================
  // NÍVEL 3: Categorias ESSENCIAIS (último recurso)
  // =====================================================
  // Só sugerir essenciais se ainda faltar valor para cobrir
  if (valorRestante > 0) {
    const essenciaisComSaldo = categoriasComSaldo
      .filter((cat) => cat.categoria?.prioridade === 'essencial')
      .sort((a, b) => (b.valor_disponivel || 0) - (a.valor_disponivel || 0))

    for (const catBudget of essenciaisComSaldo) {
      if (!catBudget.categoria || valorRestante <= 0) break

      const valorDisponivel = catBudget.valor_disponivel || 0
      const maxSugerido = valorDisponivel * 0.3 // Apenas 30% do disponível
      const valorSugerido = Math.min(maxSugerido, valorRestante)

      sugestoes.push({
        categoria_origem: catBudget.categoria,
        categoria_destino: categoriaEstourada.categoria!,
        valor_disponivel: valorDisponivel,
        valor_sugerido: valorSugerido,
        motivo: `⚠️ ${catBudget.categoria.nome} é essencial. Use apenas se extremamente necessário`,
        nivel_prioridade: 3, // Última opção
      })

      valorRestante -= valorSugerido
    }
  }

  return sugestoes
}

/**
 * Analisa estouro de categoria e gera relatório com sugestões
 */
export async function analisarEstouroCategoria(
  categoriaId: string,
  orcamentoId: string
): Promise<DbResult<AnaliseEstouro>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  try {
    // Buscar orçamento para obter mes_referencia
    const { data: orcamento } = await supabase
      // @ts-ignore
      .from('orcamentos_mensais')
      .select('mes_referencia')
      .eq('id', orcamentoId)
      .single()

    if (!orcamento) {
      return { data: null, error: new Error('Orçamento não encontrado') }
    }

    const anoMes = orcamento.mes_referencia.substring(0, 7) // YYYY-MM

    console.log('📅 Mês de referência do orçamento:', orcamento.mes_referencia, '→ Buscando lançamentos de:', anoMes)

    // Buscar categoria budget específica
    const { data: catBudget, error: catError } = await supabase
      // @ts-ignore
      .from('categorias_budget')
      .select(`
        *,
        categoria:categorias(*)
      `)
      .eq('id', categoriaId)
      .eq('orcamento_id', orcamentoId)
      .single()

    if (catError || !catBudget) {
      console.error('❌ Erro ao buscar categoria budget:', catError)
      return { data: null, error: catError || new Error('Categoria não encontrada') }
    }

    if (!catBudget.categoria) {
      console.error('❌ Categoria não tem relação com categorias:', catBudget)
      return { data: null, error: new Error('Categoria sem relação') }
    }

    console.log('✅ Categoria budget encontrada:', catBudget)

    // Debug: buscar TODOS os lançamentos da categoria para ver se existem
    const { data: todosLancamentos } = await supabase
      // @ts-ignore
      .from('lancamentos')
      .select('valor, data, status')
      .eq('categoria_id', catBudget.categoria.id)
      .eq('tipo', 'despesa')

    console.log('📋 TODOS os lançamentos da categoria (qualquer mês):', todosLancamentos)

    // Calcular valor gasto (buscar lançamentos DO MÊS)
    const { data: lancamentos } = await supabase
      // @ts-ignore
      .from('lancamentos')
      .select('valor, data')
      .eq('categoria_id', catBudget.categoria.id)
      .eq('tipo', 'despesa')
      .eq('status', 'pago')
      .gte('data', `${anoMes}-01`)
      .lt('data', `${anoMes}-32`) // Pega todo o mês

    console.log(`✅ Lançamentos encontrados (${anoMes}):`, lancamentos?.length || 0, lancamentos)

    const valorGasto = lancamentos?.reduce((sum, l) => sum + l.valor, 0) || 0
    const valorOrcado = catBudget.valor_orcado || 0
    const valorDisponivel = valorOrcado - valorGasto

    // Se não há estouro, retornar sem sugestões
    if (valorDisponivel >= 0) {
      return {
        data: {
          categoria: catBudget.categoria,
          valor_orcado: valorOrcado,
          valor_gasto: valorGasto,
          valor_estouro: 0,
          percentual_estouro: 0,
          sugestoes: [],
        },
        error: null,
      }
    }

    const valorEstouro = Math.abs(valorDisponivel)
    const percentualEstouro = (valorEstouro / valorOrcado) * 100

    // Buscar todas as outras categorias do orçamento
    const { data: todasCategorias } = await supabase
      // @ts-ignore
      .from('categorias_budget')
      .select(`
        *,
        categoria:categorias(*)
      `)
      .eq('orcamento_id', orcamentoId)

    // Calcular saldo disponível para cada categoria DO MÊS
    const categoriasComSaldo: CategoriaBudgetComRelacoes[] = []
    for (const cat of todasCategorias || []) {
      const { data: catLancamentos } = await supabase
        // @ts-ignore
        .from('lancamentos')
        .select('valor, data')
        .eq('categoria_id', cat.categoria.id)
        .eq('tipo', 'despesa')
        .eq('status', 'pago')
        .gte('data', `${anoMes}-01`)
        .lt('data', `${anoMes}-32`) // Pega todo o mês

      const gasto = catLancamentos?.reduce((sum, l) => sum + l.valor, 0) || 0
      const disponivel = (cat.valor_orcado || 0) - gasto

      categoriasComSaldo.push({
        ...cat,
        valor_gasto: gasto,
        valor_disponivel: disponivel,
        percentual_usado: cat.valor_orcado > 0 ? (gasto / cat.valor_orcado) * 100 : 0,
      })
    }

    // Gerar sugestões inteligentes
    const sugestoes = await gerarSugestoesRebalanceamento(
      { ...catBudget, valor_gasto: valorGasto, valor_disponivel: valorDisponivel },
      valorEstouro,
      categoriasComSaldo
    )

    return {
      data: {
        categoria: catBudget.categoria,
        valor_orcado: valorOrcado,
        valor_gasto: valorGasto,
        valor_estouro: valorEstouro,
        percentual_estouro: percentualEstouro,
        sugestoes,
      },
      error: null,
    }
  } catch (error) {
    console.error('Erro ao analisar estouro:', error)
    return { data: null, error: error as Error }
  }
}

// =====================================================
// EXECUÇÃO DE REBALANCEAMENTO
// =====================================================

export const rebalanceamentoService = {
  /**
   * Executar rebalanceamento (transferir valor entre categorias)
   */
  async executarRebalanceamento(
    input: CreateRebalanceamentoInput
  ): Promise<DbResult<HistoricoRebalanceamento>> {
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

    // Validar que categorias são diferentes
    if (input.categoria_origem_id === input.categoria_destino_id) {
      return { data: null, error: new Error('Origem e destino devem ser diferentes') }
    }

    try {
      // Buscar categorias_budget de origem e destino
      const { data: catOrigem } = await supabase
        // @ts-ignore
        .from('categorias_budget')
        .select('id, valor_orcado')
        .eq('orcamento_id', input.orcamento_id)
        .eq('categoria_id', input.categoria_origem_id)
        .single()

      const { data: catDestino } = await supabase
        // @ts-ignore
        .from('categorias_budget')
        .select('id, valor_orcado')
        .eq('orcamento_id', input.orcamento_id)
        .eq('categoria_id', input.categoria_destino_id)
        .single()

      if (!catOrigem || !catDestino) {
        return { data: null, error: new Error('Categorias não encontradas no orçamento') }
      }

      // Atualizar valor_orcado da categoria origem (diminuir)
      const { error: errorOrigem } = await supabase
        // @ts-ignore
        .from('categorias_budget')
        .update({
          valor_orcado: catOrigem.valor_orcado - input.valor_transferido,
        })
        .eq('id', catOrigem.id)

      if (errorOrigem) {
        console.error('Erro ao atualizar categoria origem:', errorOrigem)
        return { data: null, error: errorOrigem }
      }

      // Atualizar valor_orcado da categoria destino (aumentar)
      const { error: errorDestino } = await supabase
        // @ts-ignore
        .from('categorias_budget')
        .update({
          valor_orcado: catDestino.valor_orcado + input.valor_transferido,
        })
        .eq('id', catDestino.id)

      if (errorDestino) {
        console.error('Erro ao atualizar categoria destino:', errorDestino)
        // Reverter a origem
        await supabase
          // @ts-ignore
          .from('categorias_budget')
          .update({
            valor_orcado: catOrigem.valor_orcado,
          })
          .eq('id', catOrigem.id)
        return { data: null, error: errorDestino }
      }

      // Registrar no histórico
      const { data, error } = await supabase
        // @ts-ignore
        .from('historico_rebalanceamentos')
        .insert({
          family_id: input.family_id,
          realizado_por: currentUser.id,
          orcamento_id: input.orcamento_id || null,
          categoria_origem_id: input.categoria_origem_id,
          categoria_destino_id: input.categoria_destino_id,
          valor_transferido: input.valor_transferido,
          motivo: input.motivo || null,
          foi_sugestao_automatica: input.foi_sugestao_automatica || false,
        })
        .select()
        .single()

      return { data, error }
    } catch (error) {
      console.error('Erro ao executar rebalanceamento:', error)
      return { data: null, error: error as Error }
    }
  },

  /**
   * Buscar histórico de rebalanceamentos
   */
  async getHistorico(
    orcamentoId?: string
  ): Promise<DbListResult<HistoricoRebalanceamentoComDetalhes>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family'), count: null }
    }

    let query = supabase
      // @ts-ignore
      .from('rebalanceamentos_com_detalhes')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId)

    if (orcamentoId) {
      query = query.eq('orcamento_id', orcamentoId)
    }

    const { data, error, count } = await query.order('created_at', { ascending: false })

    return { data, error, count }
  },

  /**
   * Desfazer rebalanceamento (deletar registro)
   */
  async desfazerRebalanceamento(id: string): Promise<DbResult<boolean>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    // Verificar que o rebalanceamento pertence à família
    const { data: rebalanceamento } = await supabase
      // @ts-ignore
      .from('historico_rebalanceamentos')
      .select('family_id')
      .eq('id', id)
      .single()

    if (!rebalanceamento || rebalanceamento.family_id !== familyId) {
      return { data: null, error: new Error('Rebalanceamento not found or access denied') }
    }

    const { error } = await supabase
      // @ts-ignore
      .from('historico_rebalanceamentos')
      .delete()
      .eq('id', id)

    if (error) {
      return { data: null, error }
    }

    return { data: true, error: null }
  },
}
