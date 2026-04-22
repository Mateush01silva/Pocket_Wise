/**
 * Database Service - Abstraction layer for LocalStorage and Supabase
 *
 * This service provides a unified interface for data operations
 * that works with both LocalStorage (MVP) and Supabase (Production)
 */

import { supabase, useLocalStorage, getUserFamilyId, getCurrentUser } from '../lib/supabase'
import { LocalStorageService, STORAGE_KEYS } from './localStorage'
import type {
  Lancamento,
  CreateLancamentoInput,
  UpdateLancamentoInput,
  Cartao,
  CreateCartaoInput,
  UpdateCartaoInput,
  ContaBancaria,
  CreateContaBancariaInput,
  Categoria,
  CreateCategoriaInput,
  UpdateCategoriaInput,
  LancamentoFilters,
  DbResult,
  DbListResult,
} from '../types'

// =====================================================
// LANCAMENTOS (Transactions) Service
// =====================================================

export const lancamentosService = {
  /**
   * Get all lancamentos for the user's family with optional filters
   */
  async getAll(filters?: LancamentoFilters): Promise<DbListResult<Lancamento>> {
    if (useLocalStorage) {
      // LocalStorage implementation
      let lancamentos = LocalStorageService.get<Lancamento[]>(STORAGE_KEYS.TRANSACTIONS) || []

      // Apply filters
      if (filters) {
        if (filters.tipo) {
          lancamentos = lancamentos.filter((l) => l.tipo === filters.tipo)
        }
        if (filters.categoria_id) {
          lancamentos = lancamentos.filter((l) => l.categoria_id === filters.categoria_id)
        }
        if (filters.cartao_id) {
          lancamentos = lancamentos.filter((l) => l.cartao_id === filters.cartao_id)
        }
        if (filters.status) {
          lancamentos = lancamentos.filter((l) => l.status === filters.status)
        }
        if (filters.data_inicio) {
          lancamentos = lancamentos.filter((l) => l.data >= filters.data_inicio!)
        }
        if (filters.data_fim) {
          lancamentos = lancamentos.filter((l) => l.data <= filters.data_fim!)
        }
      }

      return {
        data: lancamentos,
        error: null,
        count: lancamentos.length,
      }
    }

    // Supabase implementation
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family'), count: null }
    }

    let query = supabase
      .from('lancamentos')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId)
      .order('data', { ascending: false })

    // Apply filters
    if (filters) {
      if (filters.tipo) query = query.eq('tipo', filters.tipo)
      if (filters.categoria_id) query = query.eq('categoria_id', filters.categoria_id)
      if (filters.cartao_id) query = query.eq('cartao_id', filters.cartao_id)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.forma_pagamento) query = query.eq('forma_pagamento', filters.forma_pagamento)
      if (filters.data_inicio) query = query.gte('data', filters.data_inicio)
      if (filters.data_fim) query = query.lte('data', filters.data_fim)
      if (filters.valor_min) query = query.gte('valor', filters.valor_min)
      if (filters.valor_max) query = query.lte('valor', filters.valor_max)
    }

    const { data, error, count } = await query

    return { data: data as Lancamento[] | null, error, count }
  },

  /**
   * Get a single lancamento by ID
   */
  async getById(id: string): Promise<DbResult<Lancamento>> {
    if (useLocalStorage) {
      const lancamentos = LocalStorageService.get<Lancamento[]>(STORAGE_KEYS.TRANSACTIONS) || []
      const lancamento = lancamentos.find((l) => l.id === id)
      return { data: lancamento || null, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
      .from('lancamentos')
      .select('*')
      .eq('id', id)
      .single()

    return { data: data as Lancamento | null, error }
  },

  /**
   * Create a new lancamento
   */
  async create(input: CreateLancamentoInput): Promise<DbResult<Lancamento>> {
    if (useLocalStorage) {
      const lancamentos = LocalStorageService.get<Lancamento[]>(STORAGE_KEYS.TRANSACTIONS) || []
      const newLancamento: Lancamento = {
        id: crypto.randomUUID(),
        ...input,
        subcategoria_id: input.subcategoria_id || null,
        observacao: input.observacao || null,
        cartao_id: input.cartao_id || null,
        conta_id: input.conta_id || null,
        parcela_atual: input.parcela_atual || null,
        parcela_total: input.parcela_total || null,
        grupo_parcelas_id: input.grupo_parcelas_id || null,
        data_vencimento_fatura: input.data_vencimento_fatura || null,
        assinatura_id: input.assinatura_id || null,
        criado_por: null,
        status: input.status || 'pendente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      lancamentos.push(newLancamento)
      LocalStorageService.set(STORAGE_KEYS.TRANSACTIONS, lancamentos)
      return { data: newLancamento, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const user = await getCurrentUser()
    const familyId = await getUserFamilyId()
    const { data, error } = await supabase
      .from('lancamentos')
      .insert({
        ...input,
        family_id: familyId,
        criado_por: user?.id || null,
      } as any)
      .select()
      .single()

    return { data: data as Lancamento | null, error }
  },

  /**
   * Update an existing lancamento
   */
  async update(input: UpdateLancamentoInput): Promise<DbResult<Lancamento>> {
    const { id, ...updateData } = input

    if (useLocalStorage) {
      const lancamentos = LocalStorageService.get<Lancamento[]>(STORAGE_KEYS.TRANSACTIONS) || []
      const index = lancamentos.findIndex((l) => l.id === id)
      if (index === -1) {
        return { data: null, error: new Error('Lancamento not found') }
      }
      lancamentos[index] = {
        ...lancamentos[index],
        ...updateData,
        updated_at: new Date().toISOString(),
      }
      LocalStorageService.set(STORAGE_KEYS.TRANSACTIONS, lancamentos)
      return { data: lancamentos[index], error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
    // @ts-ignore - Supabase types will be generated later
      .from('lancamentos')
      // @ts-expect-error - Supabase types
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single()

    return { data: data as Lancamento | null, error }
  },

  /**
   * Delete a lancamento
   */
  async delete(id: string): Promise<DbResult<void>> {
    if (useLocalStorage) {
      const lancamentos = LocalStorageService.get<Lancamento[]>(STORAGE_KEYS.TRANSACTIONS) || []
      const filtered = lancamentos.filter((l) => l.id !== id)
      LocalStorageService.set(STORAGE_KEYS.TRANSACTIONS, filtered)
      return { data: undefined as void, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { error } = await supabase.from('lancamentos').delete().eq('id', id)

    return { data: undefined as void, error }
  },
}

// =====================================================
// CARTOES (Credit Cards) Service
// =====================================================

export const cartoesService = {
  async getAll(): Promise<DbListResult<Cartao>> {
    if (useLocalStorage) {
      const cartoes = LocalStorageService.get<Cartao[]>(STORAGE_KEYS.CREDIT_CARDS) || []
      return { data: cartoes, error: null, count: cartoes.length }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    const { data, error, count } = await supabase
      .from('cartoes')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId as string)
      .eq('ativo', true)

    return { data: data as Cartao[] | null, error, count }
  },

  async create(input: CreateCartaoInput): Promise<DbResult<Cartao>> {
    if (useLocalStorage) {
      const cartoes = LocalStorageService.get<Cartao[]>(STORAGE_KEYS.CREDIT_CARDS) || []
      const newCartao: Cartao = {
        id: crypto.randomUUID(),
        user_id: input.user_id || null,
        family_id: input.family_id || null,
        nome: input.nome,
        dia_fechamento: input.dia_fechamento,
        dia_vencimento: input.dia_vencimento,
        limite: input.limite || null,
        cor: input.cor || '#6366f1',
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      cartoes.push(newCartao)
      LocalStorageService.set(STORAGE_KEYS.CREDIT_CARDS, cartoes)
      return { data: newCartao, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    const { data, error } = await supabase
      .from('cartoes')
      .insert({
        ...input,
        family_id: familyId,
      } as any)
      .select()
      .single()

    return { data: data as Cartao | null, error }
  },

  async update(input: UpdateCartaoInput): Promise<DbResult<Cartao>> {
    const { id, ...updateData } = input

    if (useLocalStorage) {
      const cartoes = LocalStorageService.get<Cartao[]>(STORAGE_KEYS.CREDIT_CARDS) || []
      const index = cartoes.findIndex((c) => c.id === id)
      if (index === -1) {
        return { data: null, error: new Error('Cartao not found') }
      }
      cartoes[index] = {
        ...cartoes[index],
        ...updateData,
        updated_at: new Date().toISOString(),
      }
      LocalStorageService.set(STORAGE_KEYS.CREDIT_CARDS, cartoes)
      return { data: cartoes[index], error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
    // @ts-ignore - Supabase types will be generated later
      .from('cartoes')
      // @ts-expect-error - Supabase types
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single()

    return { data: data as Cartao | null, error }
  },

  async delete(id: string): Promise<DbResult<void>> {
    if (useLocalStorage) {
      const cartoes = LocalStorageService.get<Cartao[]>(STORAGE_KEYS.CREDIT_CARDS) || []
      const filtered = cartoes.filter((c) => c.id !== id)
      LocalStorageService.set(STORAGE_KEYS.CREDIT_CARDS, filtered)
      return { data: undefined as void, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    // @ts-ignore - Supabase types will be generated later
    // Soft delete - set ativo to false
    const { error } = await supabase.from('cartoes').update({ ativo: false } as any).eq('id', id)

    return { data: undefined as void, error }
  },
}

// =====================================================
// CONTAS BANCÁRIAS Service
// =====================================================

export const contasBancariasService = {
  async getAll(): Promise<DbListResult<ContaBancaria>> {
    if (useLocalStorage) {
      const contas = LocalStorageService.get<ContaBancaria[]>(STORAGE_KEYS.BANK_ACCOUNTS) || []
      return { data: contas, error: null, count: contas.length }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    const { data, error, count } = await (supabase as any)
      .from('contas_bancarias')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId as string)
      .order('nome')

    return { data: data as ContaBancaria[] | null, error, count }
  },

  async create(input: CreateContaBancariaInput): Promise<DbResult<ContaBancaria>> {
    if (useLocalStorage) {
      const contas = LocalStorageService.get<ContaBancaria[]>(STORAGE_KEYS.BANK_ACCOUNTS) || []
      const newConta: ContaBancaria = {
        id: crypto.randomUUID(),
        user_id: input.user_id || null,
        family_id: input.family_id,
        nome: input.nome,
        tipo: input.tipo,
        saldo_inicial: input.saldo_inicial,
        saldo_atual: input.saldo_inicial, // Saldo atual começa igual ao inicial
        cor: input.cor || '#6366f1',
        icone: input.icone || null,
        ativo: input.ativo ?? true,
        instituicao: input.instituicao || null,
        agencia: input.agencia || null,
        numero_conta: input.numero_conta || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      contas.push(newConta)
      LocalStorageService.set(STORAGE_KEYS.BANK_ACCOUNTS, contas)
      return { data: newConta, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    const { data, error } = await (supabase as any)
      .from('contas_bancarias')
      .insert({
        ...input,
        family_id: familyId,
        saldo_atual: input.saldo_inicial,
      })
      .select()
      .single()

    return { data: data as ContaBancaria | null, error }
  },

  async update(input: Partial<ContaBancaria> & { id: string }): Promise<DbResult<ContaBancaria>> {
    const { id, ...updateData } = input

    if (useLocalStorage) {
      const contas = LocalStorageService.get<ContaBancaria[]>(STORAGE_KEYS.BANK_ACCOUNTS) || []
      const index = contas.findIndex((c) => c.id === id)
      if (index === -1) {
        return { data: null, error: new Error('Conta not found') }
      }
      contas[index] = {
        ...contas[index],
        ...updateData,
        updated_at: new Date().toISOString(),
      }
      LocalStorageService.set(STORAGE_KEYS.BANK_ACCOUNTS, contas)
      return { data: contas[index], error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await (supabase as any)
      .from('contas_bancarias')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    return { data: data as ContaBancaria | null, error }
  },

  async delete(id: string): Promise<DbResult<void>> {
    if (useLocalStorage) {
      const contas = LocalStorageService.get<ContaBancaria[]>(STORAGE_KEYS.BANK_ACCOUNTS) || []
      const filtered = contas.filter((c) => c.id !== id)
      LocalStorageService.set(STORAGE_KEYS.BANK_ACCOUNTS, filtered)
      return { data: undefined as void, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    // Hard delete - remove completamente do banco
    const { error } = await (supabase as any)
      .from('contas_bancarias')
      .delete()
      .eq('id', id)

    return { data: undefined as void, error }
  },
}

// =====================================================
// CATEGORIAS Service
// =====================================================

export const categoriasService = {
  async getAll(): Promise<DbListResult<Categoria>> {
    if (useLocalStorage) {
      const categorias = LocalStorageService.get<Categoria[]>(STORAGE_KEYS.CATEGORIAS) || []
      return { data: categorias, error: null, count: categorias.length }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    const { data, error, count } = await supabase
      .from('categorias')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId as string)
      .order('nome')

    return { data: data as Categoria[] | null, error, count }
  },

  async create(input: CreateCategoriaInput): Promise<DbResult<Categoria>> {
    if (useLocalStorage) {
      const categorias = LocalStorageService.get<Categoria[]>(STORAGE_KEYS.CATEGORIAS) || []
      const newCategoria: Categoria = {
        id: crypto.randomUUID(),
        user_id: input.user_id || null,
        family_id: input.family_id || null,
        nome: input.nome,
        icone: input.icone || null,
        tipo: input.tipo,
        categoria_pai_id: input.categoria_pai_id || null,
        cor: input.cor || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      categorias.push(newCategoria)
      LocalStorageService.set(STORAGE_KEYS.CATEGORIAS, categorias)
      return { data: newCategoria, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    const { data, error } = await supabase
      .from('categorias')
      .insert({
        ...input,
        family_id: familyId,
      } as any)
      .select()
      .single()

    return { data: data as Categoria | null, error }
  },

  async update(input: UpdateCategoriaInput): Promise<DbResult<Categoria>> {
    const { id, ...updateData } = input

    if (useLocalStorage) {
      const categorias = LocalStorageService.get<Categoria[]>(STORAGE_KEYS.CATEGORIAS) || []
      const index = categorias.findIndex((c) => c.id === id)
      if (index === -1) {
        return { data: null, error: new Error('Categoria not found') }
      }
      categorias[index] = {
        ...categorias[index],
        ...updateData,
        updated_at: new Date().toISOString(),
      }
      LocalStorageService.set(STORAGE_KEYS.CATEGORIAS, categorias)
      return { data: categorias[index], error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
    // @ts-ignore - Supabase types will be generated later
      .from('categorias')
      // @ts-expect-error - Supabase types
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single()

    return { data: data as Categoria | null, error }
  },

  async delete(id: string): Promise<DbResult<void>> {
    if (useLocalStorage) {
      const categorias = LocalStorageService.get<Categoria[]>(STORAGE_KEYS.CATEGORIAS) || []
      const filtered = categorias.filter((c) => c.id !== id)
      LocalStorageService.set(STORAGE_KEYS.CATEGORIAS, filtered)
      return { data: undefined as void, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { error } = await supabase.from('categorias').delete().eq('id', id)

    return { data: undefined as void, error }
  },
}

// =====================================================
// ORÇAMENTOS MENSAIS Service
// =====================================================

export const orcamentosService = {
  async getAll(filters?: { family_id?: string; mes_referencia?: string; status?: string }): Promise<DbListResult<import('../types').OrcamentoMensal>> {
    if (useLocalStorage) {
      let orcamentos = LocalStorageService.get<import('../types').OrcamentoMensal[]>(STORAGE_KEYS.ORCAMENTOS_MENSAIS) || []

      if (filters) {
        if (filters.mes_referencia) {
          orcamentos = orcamentos.filter((o) => o.mes_referencia === filters.mes_referencia)
        }
        if (filters.status) {
          orcamentos = orcamentos.filter((o) => o.status === filters.status)
        }
      }

      return { data: orcamentos, error: null, count: orcamentos.length }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    let query = supabase
      .from('orcamentos_mensais')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId as string)
      .order('mes_referencia', { ascending: false })

    if (filters?.mes_referencia) query = query.eq('mes_referencia', filters.mes_referencia)
    if (filters?.status) query = query.eq('status', filters.status)

    const { data, error, count } = await query
    return { data: data as any, error, count }
  },

  async getById(id: string): Promise<DbResult<import('../types').OrcamentoMensal>> {
    if (useLocalStorage) {
      const orcamentos = LocalStorageService.get<import('../types').OrcamentoMensal[]>(STORAGE_KEYS.ORCAMENTOS_MENSAIS) || []
      const orcamento = orcamentos.find((o) => o.id === id)
      return { data: orcamento || null, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
      .from('orcamentos_mensais')
      .select('*')
      .eq('id', id)
      .single()

    return { data: data as any, error }
  },

  async create(input: import('../types').CreateOrcamentoInput): Promise<DbResult<import('../types').OrcamentoMensal>> {
    if (useLocalStorage) {
      const orcamentos = LocalStorageService.get<import('../types').OrcamentoMensal[]>(STORAGE_KEYS.ORCAMENTOS_MENSAIS) || []
      const newOrcamento: import('../types').OrcamentoMensal = {
        id: crypto.randomUUID(),
        ...input,
        criado_por: null,
        dia_inicio_ciclo: input.dia_inicio_ciclo || 1,
        metodo_calculo: input.metodo_calculo || 'conservador',
        status: input.status || 'rascunho',
        meta_poupanca_percentual: input.meta_poupanca_percentual || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      orcamentos.push(newOrcamento)
      LocalStorageService.set(STORAGE_KEYS.ORCAMENTOS_MENSAIS, orcamentos)
      return { data: newOrcamento, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const user = await getCurrentUser()
    const familyId = await getUserFamilyId()
    const { data, error} = await supabase
      .from('orcamentos_mensais')
      .insert({
        ...input,
        family_id: familyId,
        criado_por: user?.id || null,
      } as any)
      .select()
      .single()

    return { data: data as any, error }
  },

  async update(input: import('../types').UpdateOrcamentoInput): Promise<DbResult<import('../types').OrcamentoMensal>> {
    const { id, ...updateData } = input

    if (useLocalStorage) {
      const orcamentos = LocalStorageService.get<import('../types').OrcamentoMensal[]>(STORAGE_KEYS.ORCAMENTOS_MENSAIS) || []
      const index = orcamentos.findIndex((o) => o.id === id)
      if (index === -1) {
        return { data: null, error: new Error('Orçamento not found') }
      }
      orcamentos[index] = {
        ...orcamentos[index],
        ...updateData,
        updated_at: new Date().toISOString(),
      }
      LocalStorageService.set(STORAGE_KEYS.ORCAMENTOS_MENSAIS, orcamentos)
      return { data: orcamentos[index], error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
      .from('orcamentos_mensais')
      // @ts-ignore - Supabase types will be generated later
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single()

    return { data: data as any, error }
  },

  async delete(id: string): Promise<DbResult<void>> {
    if (useLocalStorage) {
      const orcamentos = LocalStorageService.get<import('../types').OrcamentoMensal[]>(STORAGE_KEYS.ORCAMENTOS_MENSAIS) || []
      const filtered = orcamentos.filter((o) => o.id !== id)
      LocalStorageService.set(STORAGE_KEYS.ORCAMENTOS_MENSAIS, filtered)

      // Deletar categorias budget relacionadas
      const categoriasBudget = LocalStorageService.get<import('../types').CategoriaBudget[]>(STORAGE_KEYS.CATEGORIAS_BUDGET) || []
      const filteredCategorias = categoriasBudget.filter((cb) => cb.orcamento_id !== id)
      LocalStorageService.set(STORAGE_KEYS.CATEGORIAS_BUDGET, filteredCategorias)

      return { data: undefined as void, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { error } = await supabase.from('orcamentos_mensais').delete().eq('id', id)
    return { data: undefined as void, error }
  },

  async fechar(id: string): Promise<DbResult<import('../types').OrcamentoMensal>> {
    if (useLocalStorage) {
      const orcamentos = LocalStorageService.get<import('../types').OrcamentoMensal[]>(STORAGE_KEYS.ORCAMENTOS_MENSAIS) || []
      const index = orcamentos.findIndex((o) => o.id === id)
      if (index === -1) return { data: null, error: new Error('Orçamento não encontrado') }
      orcamentos[index] = { ...orcamentos[index], status: 'fechado' as any }
      LocalStorageService.set(STORAGE_KEYS.ORCAMENTOS_MENSAIS, orcamentos)
      return { data: orcamentos[index], error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
      .from('orcamentos_mensais')
      .update({ status: 'fechado' } as any)
      .eq('id', id)
      .select()
      .single()

    return { data: data as any, error }
  },
}

// =====================================================
// CATEGORIAS BUDGET Service
// =====================================================

export const categoriasBudgetService = {
  async getAll(orcamento_id: string): Promise<DbListResult<import('../types').CategoriaBudget>> {
    if (useLocalStorage) {
      const categoriasBudget = LocalStorageService.get<import('../types').CategoriaBudget[]>(STORAGE_KEYS.CATEGORIAS_BUDGET) || []
      const filtered = categoriasBudget.filter((cb) => cb.orcamento_id === orcamento_id)
      return { data: filtered, error: null, count: filtered.length }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const { data, error, count } = await supabase
      .from('categorias_budget')
      .select('*', { count: 'exact' })
      .eq('orcamento_id', orcamento_id)

    return { data: data as any, error, count }
  },

  async create(input: import('../types').CreateCategoriaBudgetInput): Promise<DbResult<import('../types').CategoriaBudget>> {
    if (useLocalStorage) {
      const categoriasBudget = LocalStorageService.get<import('../types').CategoriaBudget[]>(STORAGE_KEYS.CATEGORIAS_BUDGET) || []
      const newCategoriaBudget: import('../types').CategoriaBudget = {
        id: crypto.randomUUID(),
        ...input,
        prioridade: input.prioridade || 'importante',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      categoriasBudget.push(newCategoriaBudget)
      LocalStorageService.set(STORAGE_KEYS.CATEGORIAS_BUDGET, categoriasBudget)
      return { data: newCategoriaBudget, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
      .from('categorias_budget')
      .insert(input as any)
      .select()
      .single()

    return { data: data as any, error }
  },

  async bulkCreate(inputs: import('../types').BulkCategoriaBudgetInput): Promise<DbResult<import('../types').CategoriaBudget[]>> {
    if (useLocalStorage) {
      let categoriasBudget = LocalStorageService.get<import('../types').CategoriaBudget[]>(STORAGE_KEYS.CATEGORIAS_BUDGET) || []

      // Se substituir_existentes for true, deletar categorias antigas deste orçamento
      if (inputs.substituir_existentes) {
        categoriasBudget = categoriasBudget.filter((cb) => cb.orcamento_id !== inputs.orcamento_id)
      }

      const newCategorias = inputs.categorias.map((cat) => ({
        id: crypto.randomUUID(),
        orcamento_id: inputs.orcamento_id,
        categoria_id: cat.categoria_id,
        valor_orcado: cat.valor_orcado,
        prioridade: cat.prioridade,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      categoriasBudget.push(...newCategorias)
      LocalStorageService.set(STORAGE_KEYS.CATEGORIAS_BUDGET, categoriasBudget)
      return { data: newCategorias as any, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    // Se substituir_existentes for true, deletar categorias antigas primeiro
    if (inputs.substituir_existentes) {
      await supabase
        .from('categorias_budget')
        .delete()
        .eq('orcamento_id', inputs.orcamento_id)
    }

    const insertData = inputs.categorias.map((cat) => ({
      orcamento_id: inputs.orcamento_id,
      categoria_id: cat.categoria_id,
      valor_orcado: cat.valor_orcado,
      prioridade: cat.prioridade,
    }))

    const { data, error } = await supabase
      .from('categorias_budget')
      .insert(insertData as any)
      .select()

    return { data: data as any, error }
  },

  async update(input: import('../types').UpdateCategoriaBudgetInput): Promise<DbResult<import('../types').CategoriaBudget>> {
    const { id, ...updateData } = input

    if (useLocalStorage) {
      const categoriasBudget = LocalStorageService.get<import('../types').CategoriaBudget[]>(STORAGE_KEYS.CATEGORIAS_BUDGET) || []
      const index = categoriasBudget.findIndex((cb) => cb.id === id)
      if (index === -1) {
        return { data: null, error: new Error('Categoria budget not found') }
      }
      categoriasBudget[index] = {
        ...categoriasBudget[index],
        ...updateData,
        updated_at: new Date().toISOString(),
      }
      LocalStorageService.set(STORAGE_KEYS.CATEGORIAS_BUDGET, categoriasBudget)
      return { data: categoriasBudget[index], error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
      .from('categorias_budget')
      // @ts-ignore - Supabase types will be generated later
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single()

    return { data: data as any, error }
  },

  async delete(id: string): Promise<DbResult<void>> {
    if (useLocalStorage) {
      const categoriasBudget = LocalStorageService.get<import('../types').CategoriaBudget[]>(STORAGE_KEYS.CATEGORIAS_BUDGET) || []
      const filtered = categoriasBudget.filter((cb) => cb.id !== id)
      LocalStorageService.set(STORAGE_KEYS.CATEGORIAS_BUDGET, filtered)
      return { data: undefined as void, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { error } = await supabase.from('categorias_budget').delete().eq('id', id)
    return { data: undefined as void, error }
  },
}

// =====================================================
// ALERTAS ORÇAMENTO Service
// =====================================================

export const alertasOrcamentoService = {
  async getAll(filters?: { lido?: boolean }): Promise<DbListResult<import('../types').AlertaOrcamento>> {
    if (useLocalStorage) {
      let alertas = LocalStorageService.get<import('../types').AlertaOrcamento[]>(STORAGE_KEYS.ALERTAS_ORCAMENTO) || []

      if (filters?.lido !== undefined) {
        alertas = alertas.filter((a) => a.lido === filters.lido)
      }

      return { data: alertas, error: null, count: alertas.length }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    let query = supabase
      .from('alertas_orcamento')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId as string)
      .order('created_at', { ascending: false })

    if (filters?.lido !== undefined) {
      query = query.eq('lido', filters.lido)
    }

    const { data, error, count } = await query
    return { data: data as any, error, count }
  },

  async create(input: import('../types').CreateAlertaInput): Promise<DbResult<import('../types').AlertaOrcamento>> {
    if (useLocalStorage) {
      const alertas = LocalStorageService.get<import('../types').AlertaOrcamento[]>(STORAGE_KEYS.ALERTAS_ORCAMENTO) || []
      const newAlerta: import('../types').AlertaOrcamento = {
        id: crypto.randomUUID(),
        ...input,
        user_id: input.user_id || null,
        orcamento_id: input.orcamento_id || null,
        categoria_id: input.categoria_id || null,
        lido: false,
        created_at: new Date().toISOString(),
      }
      alertas.push(newAlerta)
      LocalStorageService.set(STORAGE_KEYS.ALERTAS_ORCAMENTO, alertas)
      return { data: newAlerta, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
      .from('alertas_orcamento')
      .insert(input as any)
      .select()
      .single()

    return { data: data as any, error }
  },

  async marcarComoLido(id: string): Promise<DbResult<import('../types').AlertaOrcamento>> {
    if (useLocalStorage) {
      const alertas = LocalStorageService.get<import('../types').AlertaOrcamento[]>(STORAGE_KEYS.ALERTAS_ORCAMENTO) || []
      const index = alertas.findIndex((a) => a.id === id)
      if (index === -1) {
        return { data: null, error: new Error('Alerta not found') }
      }
      alertas[index] = { ...alertas[index], lido: true }
      LocalStorageService.set(STORAGE_KEYS.ALERTAS_ORCAMENTO, alertas)
      return { data: alertas[index], error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
      .from('alertas_orcamento')
      // @ts-ignore - Supabase types will be generated later
      .update({ lido: true } as any)
      .eq('id', id)
      .select()
      .single()

    return { data: data as any, error }
  },

  async delete(id: string): Promise<DbResult<void>> {
    if (useLocalStorage) {
      const alertas = LocalStorageService.get<import('../types').AlertaOrcamento[]>(STORAGE_KEYS.ALERTAS_ORCAMENTO) || []
      const filtered = alertas.filter((a) => a.id !== id)
      LocalStorageService.set(STORAGE_KEYS.ALERTAS_ORCAMENTO, filtered)
      return { data: undefined as void, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { error } = await supabase.from('alertas_orcamento').delete().eq('id', id)
    return { data: undefined as void, error }
  },
}

// =====================================================
// ASSINATURAS Service
// =====================================================

export const assinaturasService = {
  async getAll(filters?: { ativa?: boolean }): Promise<DbListResult<import('../types').Assinatura>> {
    if (useLocalStorage) {
      let assinaturas = LocalStorageService.get<import('../types').Assinatura[]>(STORAGE_KEYS.ASSINATURAS) || []

      if (filters?.ativa !== undefined) {
        assinaturas = assinaturas.filter((a) => a.ativa === filters.ativa)
      }

      return { data: assinaturas, error: null, count: assinaturas.length }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    // Para Supabase, usar user_id ao invés de family_id
    const user = await getCurrentUser()
    if (!user) {
      return { data: [], error: null, count: 0 }
    }

    let query = (supabase as any)
      .from('assinaturas')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('nome')

    if (filters?.ativa !== undefined) {
      query = query.eq('ativa', filters.ativa)
    }

    const { data, error, count } = await query
    return { data: data as import('../types').Assinatura[] | null, error, count }
  },

  async getById(id: string): Promise<DbResult<import('../types').Assinatura>> {
    if (useLocalStorage) {
      const assinaturas = LocalStorageService.get<import('../types').Assinatura[]>(STORAGE_KEYS.ASSINATURAS) || []
      const assinatura = assinaturas.find((a) => a.id === id)
      return { data: assinatura || null, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await (supabase as any)
      .from('assinaturas')
      .select('*')
      .eq('id', id)
      .single()

    return { data: data as import('../types').Assinatura | null, error }
  },

  async create(input: import('../types').CreateAssinaturaInput): Promise<DbResult<import('../types').Assinatura>> {
    if (useLocalStorage) {
      const assinaturas = LocalStorageService.get<import('../types').Assinatura[]>(STORAGE_KEYS.ASSINATURAS) || []
      const newAssinatura: import('../types').Assinatura = {
        id: crypto.randomUUID(),
        user_id: null,
        family_id: input.family_id,
        nome: input.nome,
        logo_url: input.logo_url || null,
        valor: input.valor,
        frequencia: input.frequencia,
        dia_cobranca: input.dia_cobranca,
        categoria_id: input.categoria_id,
        subcategoria_id: input.subcategoria_id || null,
        cartao_id: input.cartao_id || null,
        primeira_cobranca: input.primeira_cobranca,
        ultima_cobranca: null,
        ativa: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      assinaturas.push(newAssinatura)
      LocalStorageService.set(STORAGE_KEYS.ASSINATURAS, assinaturas)
      return { data: newAssinatura, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    // Para Supabase, usar user_id ao invés de family_id
    const user = await getCurrentUser()
    if (!user) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const { data, error } = await (supabase as any)
      .from('assinaturas')
      .insert({
        user_id: user.id,
        nome: input.nome,
        logo_url: input.logo_url || null,
        valor: input.valor,
        frequencia: input.frequencia,
        dia_cobranca: input.dia_cobranca,
        categoria_id: input.categoria_id,
        subcategoria_id: input.subcategoria_id || null,
        primeira_cobranca: input.primeira_cobranca,
        ativa: true,
      } as any)
      .select()
      .single()

    return { data: data as import('../types').Assinatura | null, error }
  },

  async update(input: import('../types').UpdateAssinaturaInput): Promise<DbResult<import('../types').Assinatura>> {
    const { id, ...updateData } = input

    if (useLocalStorage) {
      const assinaturas = LocalStorageService.get<import('../types').Assinatura[]>(STORAGE_KEYS.ASSINATURAS) || []
      const index = assinaturas.findIndex((a) => a.id === id)
      if (index === -1) {
        return { data: null, error: new Error('Assinatura not found') }
      }
      assinaturas[index] = {
        ...assinaturas[index],
        ...updateData,
        updated_at: new Date().toISOString(),
      }
      LocalStorageService.set(STORAGE_KEYS.ASSINATURAS, assinaturas)
      return { data: assinaturas[index], error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await (supabase as any)
      .from('assinaturas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    return { data: data as import('../types').Assinatura | null, error }
  },

  async delete(id: string): Promise<DbResult<void>> {
    if (useLocalStorage) {
      const assinaturas = LocalStorageService.get<import('../types').Assinatura[]>(STORAGE_KEYS.ASSINATURAS) || []
      const filtered = assinaturas.filter((a) => a.id !== id)
      LocalStorageService.set(STORAGE_KEYS.ASSINATURAS, filtered)
      return { data: undefined as void, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { error } = await (supabase as any).from('assinaturas').delete().eq('id', id)
    return { data: undefined as void, error }
  },
}

// =====================================================
// HISTÓRICO VALOR ASSINATURAS Service
// =====================================================

export const historicoValorAssinaturasService = {
  async getByAssinaturaId(assinaturaId: string): Promise<DbListResult<import('../types').HistoricoValorAssinatura>> {
    if (useLocalStorage) {
      const historico = LocalStorageService.get<import('../types').HistoricoValorAssinatura[]>(
        STORAGE_KEYS.HISTORICO_VALOR_ASSINATURAS
      ) || []
      const filtered = historico.filter((h) => h.assinatura_id === assinaturaId)
      return { data: filtered, error: null, count: filtered.length }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const { data, error, count } = await (supabase as any)
      .from('historico_valor_assinaturas')
      .select('*', { count: 'exact' })
      .eq('assinatura_id', assinaturaId)
      .order('vigencia_inicio', { ascending: false })

    return { data: data as import('../types').HistoricoValorAssinatura[] | null, error, count }
  },

  async create(assinaturaId: string, valorAntigo: number, valorNovo: number, vigenciaInicio: string): Promise<DbResult<import('../types').HistoricoValorAssinatura>> {
    if (useLocalStorage) {
      const historico = LocalStorageService.get<import('../types').HistoricoValorAssinatura[]>(
        STORAGE_KEYS.HISTORICO_VALOR_ASSINATURAS
      ) || []

      const newHistorico: import('../types').HistoricoValorAssinatura = {
        id: crypto.randomUUID(),
        assinatura_id: assinaturaId,
        valor_antigo: valorAntigo,
        valor_novo: valorNovo,
        vigencia_inicio: vigenciaInicio,
        created_at: new Date().toISOString(),
      }

      historico.push(newHistorico)
      LocalStorageService.set(STORAGE_KEYS.HISTORICO_VALOR_ASSINATURAS, historico)
      return { data: newHistorico, error: null }
    }

    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await (supabase as any)
      .from('historico_valor_assinaturas')
      .insert({
        assinatura_id: assinaturaId,
        valor_antigo: valorAntigo,
        valor_novo: valorNovo,
        vigencia_inicio: vigenciaInicio,
      } as any)
      .select()
      .single()

    return { data: data as import('../types').HistoricoValorAssinatura | null, error }
  },
}

// Export all services
export const db = {
  lancamentos: lancamentosService,
  cartoes: cartoesService,
  contas: contasBancariasService,
  categorias: categoriasService,
  orcamentos: orcamentosService,
  categoriasBudget: categoriasBudgetService,
  alertas: alertasOrcamentoService,
  assinaturas: assinaturasService,
  historicoValorAssinaturas: historicoValorAssinaturasService,
}
