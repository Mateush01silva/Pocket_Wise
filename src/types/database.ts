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
      orcamentos_mensais: {
        Row: {
          id: string
          family_id: string
          criado_por: string | null
          mes_referencia: string
          meta_poupanca: number
          meta_poupanca_percentual: number | null
          dia_inicio_ciclo: number
          metodo_calculo: 'conservador' | 'otimista'
          status: 'rascunho' | 'ativo' | 'fechado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          criado_por?: string | null
          mes_referencia: string
          meta_poupanca: number
          meta_poupanca_percentual?: number | null
          dia_inicio_ciclo?: number
          metodo_calculo?: 'conservador' | 'otimista'
          status?: 'rascunho' | 'ativo' | 'fechado'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          criado_por?: string | null
          mes_referencia?: string
          meta_poupanca?: number
          meta_poupanca_percentual?: number | null
          dia_inicio_ciclo?: number
          metodo_calculo?: 'conservador' | 'otimista'
          status?: 'rascunho' | 'ativo' | 'fechado'
          created_at?: string
          updated_at?: string
        }
      }
      categorias_budget: {
        Row: {
          id: string
          orcamento_id: string
          categoria_id: string
          valor_orcado: number
          prioridade: 'essencial' | 'importante' | 'desejavel'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          orcamento_id: string
          categoria_id: string
          valor_orcado: number
          prioridade?: 'essencial' | 'importante' | 'desejavel'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          orcamento_id?: string
          categoria_id?: string
          valor_orcado?: number
          prioridade?: 'essencial' | 'importante' | 'desejavel'
          created_at?: string
          updated_at?: string
        }
      }
      alertas_orcamento: {
        Row: {
          id: string
          family_id: string
          user_id: string | null
          orcamento_id: string | null
          tipo: 'categoria_80' | 'categoria_90' | 'categoria_100' | 'gasto_incomum' | 'meta_atingida' | 'fatura_proxima'
          titulo: string
          mensagem: string
          categoria_id: string | null
          lido: boolean
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          user_id?: string | null
          orcamento_id?: string | null
          tipo: 'categoria_80' | 'categoria_90' | 'categoria_100' | 'gasto_incomum' | 'meta_atingida' | 'fatura_proxima'
          titulo: string
          mensagem: string
          categoria_id?: string | null
          lido?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          user_id?: string | null
          orcamento_id?: string | null
          tipo?: 'categoria_80' | 'categoria_90' | 'categoria_100' | 'gasto_incomum' | 'meta_atingida' | 'fatura_proxima'
          titulo?: string
          mensagem?: string
          categoria_id?: string | null
          lido?: boolean
          created_at?: string
        }
      }
      configuracoes_orcamento: {
        Row: {
          id: string
          family_id: string
          dia_inicio_ciclo: number
          metodo_calculo: 'conservador' | 'otimista'
          alertas_ativados: boolean
          alerta_80_porcento: boolean
          alerta_90_porcento: boolean
          alerta_100_porcento: boolean
          alerta_gastos_incomuns: boolean
          alerta_metas_atingidas: boolean
          template_orcamento_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          dia_inicio_ciclo?: number
          metodo_calculo?: 'conservador' | 'otimista'
          alertas_ativados?: boolean
          alerta_80_porcento?: boolean
          alerta_90_porcento?: boolean
          alerta_100_porcento?: boolean
          alerta_gastos_incomuns?: boolean
          alerta_metas_atingidas?: boolean
          template_orcamento_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          dia_inicio_ciclo?: number
          metodo_calculo?: 'conservador' | 'otimista'
          alertas_ativados?: boolean
          alerta_80_porcento?: boolean
          alerta_90_porcento?: boolean
          alerta_100_porcento?: boolean
          alerta_gastos_incomuns?: boolean
          alerta_metas_atingidas?: boolean
          template_orcamento_id?: string | null
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
      categoria_prioridade: 'essencial' | 'importante' | 'desejavel'
      orcamento_status: 'rascunho' | 'ativo' | 'fechado'
      tipo_alerta: 'categoria_80' | 'categoria_90' | 'categoria_100' | 'gasto_incomum' | 'meta_atingida' | 'fatura_proxima'
      metodo_calculo: 'conservador' | 'otimista'
    }
  }
}
