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
        parcela_atual: input.parcela_atual || null,
        parcela_total: input.parcela_total || null,
        grupo_parcelas_id: input.grupo_parcelas_id || null,
        data_vencimento_fatura: input.data_vencimento_fatura || null,
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
    const { data, error } = await supabase
      .from('lancamentos')
      .insert({
        ...input,
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

// Export all services
export const db = {
  lancamentos: lancamentosService,
  cartoes: cartoesService,
  categorias: categoriasService,
}
