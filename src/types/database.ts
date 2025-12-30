/**
 * Supabase Database Types
 *
 * These types are based on the database schema.
 * In production, you can generate these automatically with:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          nome: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          nome: string
          patrimonio_base: number
          family_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nome: string
          patrimonio_base?: number
          family_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          patrimonio_base?: number
          family_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categorias: {
        Row: {
          id: string
          user_id: string | null
          family_id: string | null
          nome: string
          icone: string | null
          tipo: 'despesa' | 'receita'
          categoria_pai_id: string | null
          cor: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          family_id?: string | null
          nome: string
          icone?: string | null
          tipo: 'despesa' | 'receita'
          categoria_pai_id?: string | null
          cor?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          family_id?: string | null
          nome?: string
          icone?: string | null
          tipo?: 'despesa' | 'receita'
          categoria_pai_id?: string | null
          cor?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cartoes: {
        Row: {
          id: string
          user_id: string | null
          family_id: string | null
          nome: string
          dia_fechamento: number
          dia_vencimento: number
          limite: number | null
          cor: string
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          family_id?: string | null
          nome: string
          dia_fechamento: number
          dia_vencimento: number
          limite?: number | null
          cor?: string
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          family_id?: string | null
          nome?: string
          dia_fechamento?: number
          dia_vencimento?: number
          limite?: number | null
          cor?: string
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      lancamentos: {
        Row: {
          id: string
          family_id: string
          criado_por: string | null
          tipo: 'despesa' | 'receita'
          data: string
          valor: number
          categoria_id: string | null
          subcategoria_id: string | null
          observacao: string | null
          forma_pagamento: 'dinheiro' | 'debito' | 'credito' | 'pix' | 'transferencia' | 'boleto'
          cartao_id: string | null
          parcela_atual: number | null
          parcela_total: number | null
          grupo_parcelas_id: string | null
          status: 'pago' | 'pendente' | 'projetado'
          data_vencimento_fatura: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          criado_por?: string | null
          tipo: 'despesa' | 'receita'
          data: string
          valor: number
          categoria_id?: string | null
          subcategoria_id?: string | null
          observacao?: string | null
          forma_pagamento: 'dinheiro' | 'debito' | 'credito' | 'pix' | 'transferencia' | 'boleto'
          cartao_id?: string | null
          parcela_atual?: number | null
          parcela_total?: number | null
          grupo_parcelas_id?: string | null
          status?: 'pago' | 'pendente' | 'projetado'
          data_vencimento_fatura?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          criado_por?: string | null
          tipo?: 'despesa' | 'receita'
          data?: string
          valor?: number
          categoria_id?: string | null
          subcategoria_id?: string | null
          observacao?: string | null
          forma_pagamento?: 'dinheiro' | 'debito' | 'credito' | 'pix' | 'transferencia' | 'boleto'
          cartao_id?: string | null
          parcela_atual?: number | null
          parcela_total?: number | null
          grupo_parcelas_id?: string | null
          status?: 'pago' | 'pendente' | 'projetado'
          data_vencimento_fatura?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      planejamentos: {
        Row: {
          id: string
          family_id: string
          criado_por: string | null
          nome: string
          valor: number
          data_prevista: string
          categoria_id: string | null
          observacoes: string | null
          status: 'ativo' | 'concluido' | 'cancelado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          criado_por?: string | null
          nome: string
          valor: number
          data_prevista: string
          categoria_id?: string | null
          observacoes?: string | null
          status?: 'ativo' | 'concluido' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          criado_por?: string | null
          nome?: string
          valor?: number
          data_prevista?: string
          categoria_id?: string | null
          observacoes?: string | null
          status?: 'ativo' | 'concluido' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
      }
      receitas_projetadas: {
        Row: {
          id: string
          family_id: string
          criado_por: string | null
          descricao: string
          valor: number
          data_prevista: string
          categoria_id: string | null
          recorrente: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          criado_por?: string | null
          descricao: string
          valor: number
          data_prevista: string
          categoria_id?: string | null
          recorrente?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          criado_por?: string | null
          descricao?: string
          valor?: number
          data_prevista?: string
          categoria_id?: string | null
          recorrente?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_default_categories: {
        Args: {
          p_family_id: string
        }
        Returns: void
      }
    }
    Enums: {
      transaction_type: 'despesa' | 'receita'
      payment_method: 'dinheiro' | 'debito' | 'credito' | 'pix' | 'transferencia' | 'boleto'
      lancamento_status: 'pago' | 'pendente' | 'projetado'
      planejamento_status: 'ativo' | 'concluido' | 'cancelado'
    }
  }
}
