import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ============================================================================
// TYPES
// ============================================================================

export type PersonalityTone = 'conservador' | 'parceiro' | 'provocador' | 'hype'

interface IAResponse {
  resposta: string
  usos_usados: number
  usos_restantes: number
  limite: number
  tone: PersonalityTone
}

interface UsePossoComprarIAState {
  hasAccess: boolean
  isCheckingAccess: boolean
  isLoading: boolean
  resposta: string | null
  usosUsados: number
  usosRestantes: number
  limite: number
  tone: PersonalityTone
  error: string | null
  limiteAtingido: boolean
}

interface UsePossoComprarIAActions {
  perguntar: (pergunta: string) => Promise<void>
  resetResposta: () => void
  setTone: (tone: PersonalityTone) => Promise<void>
}

export type UsePossoComprarIAReturn = UsePossoComprarIAState & UsePossoComprarIAActions

// ============================================================================
// HOOK
// ============================================================================

export function usePossoComprarIA(): UsePossoComprarIAReturn {
  const { user, activeFamilyId } = useAuth()

  const [hasAccess, setHasAccess] = useState(false)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [resposta, setResposta] = useState<string | null>(null)
  const [usosUsados, setUsosUsados] = useState(0)
  const [usosRestantes, setUsosRestantes] = useState(30)
  const [limite, setLimite] = useState(30)
  const [tone, setToneState] = useState<PersonalityTone>('parceiro')
  const [error, setError] = useState<string | null>(null)
  const [limiteAtingido, setLimiteAtingido] = useState(false)

  // -------------------------------------------------------------------------
  // Verificar acesso e carregar preferências ao montar
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setHasAccess(false)
      setIsCheckingAccess(false)
      return
    }

    let cancelled = false

    async function checkAccess() {
      setIsCheckingAccess(true)

      if (!supabase) {
        setHasAccess(false)
        setIsCheckingAccess(false)
        return
      }

      try {
        // Verificar feature flag
        // Usa (supabase as any) pois as novas tabelas são consultadas via
        // supabase-js sem regeneração automática de tipos — padrão do projeto.
        const { data: accessData } = await (supabase as any)
          .from('ai_feature_access')
          .select('enabled')
          .eq('user_id', user!.id)
          .maybeSingle() as { data: { enabled: boolean } | null }

        if (cancelled) return

        if (accessData?.enabled) {
          setHasAccess(true)

          // Carregar preferência de tom
          const { data: prefData } = await (supabase as any)
            .from('user_ai_preferences')
            .select('personality_tone')
            .eq('user_id', user!.id)
            .maybeSingle() as { data: { personality_tone: string } | null }

          if (!cancelled && prefData?.personality_tone) {
            setToneState(prefData.personality_tone as PersonalityTone)
          }

          // Carregar uso do mês atual + configuração de créditos em paralelo
          const mesAtual = new Date().toISOString().substring(0, 7)
          const [usageRes, configRes] = await Promise.all([
            (supabase as any)
              .from('ai_usage_log')
              .select('feature_type')
              .eq('user_id', user!.id)
              .eq('mes_referencia', mesAtual) as Promise<{ data: Array<{ feature_type: string | null }> | null }>,
            (supabase as any)
              .from('ai_credits_config')
              .select('creditos_proativas')
              .eq('user_id', user!.id)
              .maybeSingle() as Promise<{ data: { creditos_proativas: number } | null }>,
          ])

          if (!cancelled) {
            // Exclui proativas do contador manual — mesma lógica da Edge Function
            const usados = (usageRes.data ?? []).filter((r) => r.feature_type !== 'proativa').length
            const limiteManual = 30 - (configRes.data?.creditos_proativas ?? 10)
            setUsosUsados(usados)
            setLimite(limiteManual)
            setUsosRestantes(Math.max(0, limiteManual - usados))
            setLimiteAtingido(usados >= limiteManual)
          }
        } else {
          if (!cancelled) setHasAccess(false)
        }
      } catch {
        if (!cancelled) setHasAccess(false)
      } finally {
        if (!cancelled) setIsCheckingAccess(false)
      }
    }

    checkAccess()
    return () => { cancelled = true }
  }, [user])

  // -------------------------------------------------------------------------
  // Fazer pergunta à IA via Edge Function
  // -------------------------------------------------------------------------
  const perguntar = useCallback(async (pergunta: string) => {
    if (!user || !activeFamilyId || !hasAccess || !supabase) return

    setIsLoading(true)
    setError(null)
    setResposta(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke<IAResponse>(
        'posso-comprar-ia',
        {
          body: { pergunta, family_id: activeFamilyId },
        }
      )

      if (fnError) {
        // Erro retornado pela Edge Function (pode ter corpo JSON com código)
        const msg = (fnError as unknown as { context?: { error?: string; code?: string } }).context?.error
          || fnError.message
          || 'Erro ao consultar a IA'

        const code = (fnError as unknown as { context?: { code?: string } }).context?.code

        if (code === 'MONTHLY_LIMIT_REACHED') {
          setLimiteAtingido(true)
          setError(`Você atingiu o limite de ${limite} consultas este mês. O limite renova em 1° do próximo mês. 🎯`)
        } else if (code === 'FEATURE_NOT_ENABLED') {
          setHasAccess(false)
        } else {
          setError(msg)
        }
        return
      }

      if (data) {
        setResposta(data.resposta)
        setUsosUsados(data.usos_usados)
        setUsosRestantes(data.usos_restantes)
        setLimite(data.limite)
        setLimiteAtingido(data.usos_restantes <= 0)
        setToneState(data.tone)
      }
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
      console.error('usePossoComprarIA error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user, activeFamilyId, hasAccess])

  // -------------------------------------------------------------------------
  // Salvar tom de personalidade
  // -------------------------------------------------------------------------
  const setTone = useCallback(async (newTone: PersonalityTone) => {
    if (!user || !supabase) return
    setToneState(newTone)

    // Upsert no Supabase (salva para a Edge Function usar no próximo prompt)
    await (supabase as any)
      .from('user_ai_preferences')
      .upsert(
        { user_id: user.id, personality_tone: newTone, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
  }, [user])

  // -------------------------------------------------------------------------
  // Limpar resposta
  // -------------------------------------------------------------------------
  const resetResposta = useCallback(() => {
    setResposta(null)
    setError(null)
  }, [])

  return {
    hasAccess,
    isCheckingAccess,
    isLoading,
    resposta,
    usosUsados,
    usosRestantes,
    limite,
    tone,
    error,
    limiteAtingido,
    perguntar,
    resetResposta,
    setTone,
  }
}
