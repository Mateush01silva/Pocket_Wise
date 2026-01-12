import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Categoria } from '../types'
import { db } from '../services/database'
import { initializeDefaultCategories } from '../lib/defaultCategories'

interface CategoriasState {
  categorias: Categoria[]
  isLoading: boolean
  error: string | null
  initialized: boolean
}

interface CategoriasActions {
  // Inicialização
  initialize: () => Promise<void>

  // CRUD
  fetchCategorias: () => Promise<void>
  createCategoria: (categoria: Omit<Categoria, 'id' | 'created_at' | 'updated_at'>) => Promise<Categoria | null>
  updateCategoria: (id: string, data: Partial<Categoria>) => Promise<void>
  deleteCategoria: (id: string) => Promise<void>

  // Queries
  getCategoriaById: (id: string) => Categoria | undefined
  getCategoriasPrincipais: (tipo?: 'despesa' | 'receita') => Categoria[]
  getSubcategorias: (categoriaPaiId: string) => Categoria[]
  getCategoriasByTipo: (tipo: 'despesa' | 'receita') => Categoria[]
}

type CategoriasStore = CategoriasState & CategoriasActions

export const useCategoriasStore = create<CategoriasStore>()(
  persist(
    immer((set, get) => ({
      // Estado inicial
      categorias: [],
      isLoading: false,
      error: null,
      initialized: false,

      // Inicializar categorias padrão na primeira vez
      initialize: async () => {
        const { initialized, categorias } = get()

        if (initialized && categorias.length > 0) {
          return
        }

        set({ isLoading: true, error: null })

        try {
          // Tentar buscar do banco
          const { data, error } = await db.categorias.getAll()

          if (error) throw error

          if (data && data.length > 0) {
            set({ categorias: data, initialized: true, isLoading: false })
          } else {
            // Se não tem dados, criar categorias padrão
            const defaultCategorias = initializeDefaultCategories()

            // Salvar no banco
            for (const categoria of defaultCategorias) {
              await db.categorias.create(categoria)
            }

            // Buscar novamente para pegar com IDs corretos
            const { data: newData } = await db.categorias.getAll()
            set({ categorias: newData || defaultCategorias, initialized: true, isLoading: false })
          }
        } catch (error) {
          console.error('Erro ao inicializar categorias:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Buscar todas as categorias
      fetchCategorias: async () => {
        set({ isLoading: true, error: null })

        try {
          const { data, error } = await db.categorias.getAll()

          if (error) throw error

          set({ categorias: data || [], isLoading: false })
        } catch (error) {
          console.error('Erro ao buscar categorias:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Criar categoria
      createCategoria: async (categoriaData) => {
        set({ isLoading: true, error: null })

        try {
          const { data, error } = await db.categorias.create(categoriaData)

          if (error) throw error
          if (!data) return null

          set((state) => {
            state.categorias.push(data)
            state.isLoading = false
          })

          return data
        } catch (error) {
          console.error('Erro ao criar categoria:', error)
          set({ error: (error as Error).message, isLoading: false })
          return null
        }
      },

      // Atualizar categoria
      updateCategoria: async (id, updateData) => {
        set({ isLoading: true, error: null })

        try {
          const { data, error } = await db.categorias.update({ id, ...updateData })

          if (error) throw error
          if (!data) return

          set((state) => {
            const index = state.categorias.findIndex((c) => c.id === id)
            if (index !== -1) {
              state.categorias[index] = data
            }
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao atualizar categoria:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Deletar categoria
      deleteCategoria: async (id) => {
        set({ isLoading: true, error: null })

        try {
          const { error } = await db.categorias.delete(id)

          if (error) throw error

          set((state) => {
            state.categorias = state.categorias.filter((c) => c.id !== id)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao deletar categoria:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Queries

      getCategoriaById: (id) => {
        return get().categorias.find((c) => c.id === id)
      },

      getCategoriasPrincipais: (tipo) => {
        const { categorias } = get()
        return categorias.filter((c) => {
          const isPrincipal = c.categoria_pai_id === null
          if (tipo) {
            return isPrincipal && c.tipo === tipo
          }
          return isPrincipal
        })
      },

      getSubcategorias: (categoriaPaiId) => {
        return get().categorias.filter((c) => c.categoria_pai_id === categoriaPaiId)
      },

      getCategoriasByTipo: (tipo) => {
        return get().categorias.filter((c) => c.tipo === tipo)
      },
    })),
    {
      name: 'pocketwise-categorias-store',
      partialize: (state) => ({
        categorias: state.categorias,
        initialized: state.initialized,
      }),
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.error('Erro ao hidratar store de categorias:', error)
            // Limpar storage corrompido
            try {
              localStorage.removeItem('pocketwise-categorias-store')
            } catch (e) {
              console.error('Erro ao limpar storage:', e)
            }
          }
        }
      },
    }
  )
)
