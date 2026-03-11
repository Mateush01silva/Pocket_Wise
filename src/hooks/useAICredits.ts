import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ============================================================================
// CONSTANTS
// ============================================================================

export const AI_TOTAL_LIMIT = 30 // pool total imutável por mês

// ============================================================================
// TYPES
// ============================================================================

export interface AICreditsState {
  // Configuração do usuário
  creditosProativas: number     // créditos reservados para proativas (0-30)
  limiteManual: number          // créditos disponíveis para consultas manuais

  // Uso do mês atual
  usadoPossoComprar: number     // "Posso Comprar?" + legados NULL
  usadoAssistente: number       // chat do Assistente
  usadoProativas: number        // mensagens automáticas (Fase 3)
  usadoManual: number           // posso_comprar + assistente (total manual)
  totalUsado: number            // todos os tipos

  // Saldo
  creditosRestantes: number     // limiteManual - usadoManual (mín 0)

  // Renovação
  dataRenovacao: Date

  // Status
  isLoading: boolean
  isSaving: boolean
}

interface AICreditsActions {
  refresh: () => Promise<void>
  saveCreditsConfig: (creditos_proativas: number) => Promise<void>
}

export type UseAICreditsReturn = AICreditsState & AICreditsActions

// ============================================================================
// HELPERS
// ============================================================================

function getCurrentMes(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getDataRenovacao(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

function buildDefaultState(creditosProativas = 10): AICreditsState {
  const limiteManual = AI_TOTAL_LIMIT - creditosProativas
  return {
    creditosProativas,
    limiteManual,
    usadoPossoComprar: 0,
    usadoAssistente: 0,
    usadoProativas: 0,
    usadoManual: 0,
    totalUsado: 0,
    creditosRestantes: limiteManual,
    dataRenovacao: getDataRenovacao(),
    isLoading: true,
    isSaving: false,
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useAICredits(): UseAICreditsReturn {
  const { user } = useAuth()
  const [state, setState] = useState<AICreditsState>(buildDefaultState)

  // -------------------------------------------------------------------------
  // Buscar dados do banco (uso do mês + configuração)
  // -------------------------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setState((prev) => ({ ...prev, isLoading: false }))
      return
    }

    setState((prev) => ({ ...prev, isLoading: true }))

    try {
      const mesRef = getCurrentMes()

      // Busca em paralelo: uso do mês + configuração do usuário
      const [usageRes, configRes] = await Promise.all([
        (supabase as any)
          .from('ai_usage_log')
          .select('feature_type')
          .eq('user_id', user.id)
          .eq('mes_referencia', mesRef) as Promise<{ data: Array<{ feature_type: string | null }> | null }>,
        (supabase as any)
          .from('ai_credits_config')
          .select('creditos_proativas')
          .eq('user_id', user.id)
          .maybeSingle() as Promise<{ data: { creditos_proativas: number } | null }>,
      ])

      const rows = usageRes.data ?? []
      const creditosProativas = configRes.data?.creditos_proativas ?? 10
      const limiteManual = AI_TOTAL_LIMIT - creditosProativas

      // Breakdown por tipo (NULL legado = posso_comprar)
      const usadoPossoComprar = rows.filter(
        (r) => r.feature_type === 'posso_comprar' || r.feature_type === null
      ).length
      const usadoAssistente = rows.filter((r) => r.feature_type === 'assistente').length
      const usadoProativas  = rows.filter((r) => r.feature_type === 'proativa').length
      const usadoManual     = usadoPossoComprar + usadoAssistente
      const totalUsado      = rows.length
      const creditosRestantes = Math.max(0, limiteManual - usadoManual)

      setState({
        creditosProativas,
        limiteManual,
        usadoPossoComprar,
        usadoAssistente,
        usadoProativas,
        usadoManual,
        totalUsado,
        creditosRestantes,
        dataRenovacao: getDataRenovacao(),
        isLoading: false,
        isSaving: false,
      })
    } catch (err) {
      console.error('useAICredits: erro ao buscar dados', err)
      setState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [user])

  // Fetch na montagem
  useEffect(() => {
    refresh()
  }, [refresh])

  // -------------------------------------------------------------------------
  // Salvar configuração de créditos proativos
  // -------------------------------------------------------------------------
  const saveCreditsConfig = useCallback(async (creditos: number) => {
    if (!user || !supabase) return

    setState((prev) => ({ ...prev, isSaving: true }))

    try {
      await (supabase as any)
        .from('ai_credits_config')
        .upsert(
          { user_id: user.id, creditos_proativas: creditos, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )

      // Atualiza estado local imediatamente (sem re-fetch)
      setState((prev) => {
        const limiteManual = AI_TOTAL_LIMIT - creditos
        return {
          ...prev,
          creditosProativas: creditos,
          limiteManual,
          creditosRestantes: Math.max(0, limiteManual - prev.usadoManual),
          isSaving: false,
        }
      })
    } catch (err) {
      console.error('useAICredits: erro ao salvar configuração', err)
      setState((prev) => ({ ...prev, isSaving: false }))
    }
  }, [user])

  return { ...state, refresh, saveCreditsConfig }
}
