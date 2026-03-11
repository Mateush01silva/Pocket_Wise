import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { PersonalityTone } from './usePossoComprarIA'

// ============================================================================
// TYPES
// ============================================================================

export interface AssistenteMensagem {
  id: string
  role: 'user' | 'assistant'
  conteudo: string
  tone?: PersonalityTone | null
  message_type: 'manual' | 'proactive'
  is_read: boolean
  trigger_key?: string | null
  created_at: string
}

// Gatilhos de alerta (chip vermelho) vs análise (chip âmbar)
export const ALERT_TRIGGER_KEYS = new Set([
  'envelope_estourado_2x',
  'conta_sem_cobertura',
  'desequilibrio_casal_2x',
])

interface UseAssistenteIAState {
  // Acesso
  hasAccess: boolean
  isCheckingAccess: boolean
  // Chat
  mensagens: AssistenteMensagem[]
  isFetchingHistory: boolean
  isLoading: boolean
  error: string | null
  // Preferências
  tone: PersonalityTone
  // Badge de proativas não lidas
  mensagensProativasNaoLidas: number
}

interface UseAssistenteIAActions {
  loadHistorico: () => Promise<void>
  enviar: (mensagem: string) => Promise<void>
  setTone: (tone: PersonalityTone) => Promise<void>
}

export type UseAssistenteIAReturn = UseAssistenteIAState & UseAssistenteIAActions

// ============================================================================
// HOOK
// ============================================================================

export function useAssistenteIA(): UseAssistenteIAReturn {
  const { user, activeFamilyId } = useAuth()

  const [hasAccess,    setHasAccess]    = useState(false)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const [mensagens,    setMensagens]    = useState<AssistenteMensagem[]>([])
  const [isFetchingHistory, setIsFetchingHistory] = useState(false)
  const [isLoading,    setIsLoading]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [tone,         setToneState]    = useState<PersonalityTone>('parceiro')
  const [mensagensProativasNaoLidas, setMensagensProativasNaoLidas] = useState(0)

  // -------------------------------------------------------------------------
  // Verificar acesso ao montar
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
        // 1. Master flag — tenta por user_id; fallback por email (RLS aceita os dois)
        let accessData: { id: string; enabled: boolean } | null = null

        const { data: byUserId } = await (supabase as any)
          .from('ai_feature_access')
          .select('id, enabled')
          .eq('user_id', user!.id)
          .maybeSingle() as { data: { id: string; enabled: boolean } | null }

        accessData = byUserId

        // Fallback: registro seed pode ter user_id=NULL mas RLS aceita por email
        if (!accessData && user!.email) {
          const { data: byEmail } = await (supabase as any)
            .from('ai_feature_access')
            .select('id, enabled')
            .eq('email', user!.email)
            .maybeSingle() as { data: { id: string; enabled: boolean } | null }
          accessData = byEmail
        }

        if (cancelled) return

        if (!accessData?.enabled) {
          if (!cancelled) setHasAccess(false)
          return
        }

        // 2. Permissão 'assistente'
        const { data: permData } = await (supabase as any)
          .from('ai_feature_permissions')
          .select('enabled')
          .eq('access_id', accessData.id)
          .eq('feature_key', 'assistente')
          .maybeSingle() as { data: { enabled: boolean } | null }

        if (cancelled) return

        // Se permData for null (sem linha), assume habilitado quando master flag = true
        if (permData !== null && !permData?.enabled) {
          if (!cancelled) setHasAccess(false)
          return
        }

        if (!cancelled) setHasAccess(true)

        // 3. Tom de personalidade
        const { data: prefData } = await (supabase as any)
          .from('user_ai_preferences')
          .select('personality_tone')
          .eq('user_id', user!.id)
          .maybeSingle() as { data: { personality_tone: string } | null }

        if (!cancelled && prefData?.personality_tone) {
          setToneState(prefData.personality_tone as PersonalityTone)
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
  // Badge: contar proativas não lidas (atualiza quando acesso confirmado)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!hasAccess || !activeFamilyId || !supabase) return

    async function countUnread() {
      try {
        const { count } = await (supabase as any)
          .from('assistente_mensagens')
          .select('id', { count: 'exact', head: true })
          .eq('family_id', activeFamilyId)
          .eq('message_type', 'proactive')
          .eq('is_read', false) as { count: number | null }

        setMensagensProativasNaoLidas(count ?? 0)
      } catch {
        // Silencioso — não afeta o funcionamento do chat
      }
    }

    countUnread()
  }, [hasAccess, activeFamilyId])

  // -------------------------------------------------------------------------
  // Carregar histórico (chamado pela página do Assistente)
  // Após carregar, marca todas as proativas como lidas e zera o badge.
  // -------------------------------------------------------------------------
  const loadHistorico = useCallback(async () => {
    if (!user || !activeFamilyId || !hasAccess || !supabase) return

    setIsFetchingHistory(true)
    try {
      const { data } = await (supabase as any)
        .from('assistente_mensagens')
        .select('id, role, conteudo, tone, message_type, is_read, trigger_key, created_at')
        .eq('family_id', activeFamilyId)
        .order('created_at', { ascending: true })
        .limit(100) as { data: AssistenteMensagem[] | null }

      if (data) setMensagens(data)

      // Marca proativas como lidas (em background, não bloqueia o chat)
      const temNaoLidas = data?.some((m) => m.message_type === 'proactive' && !m.is_read)
      if (temNaoLidas) {
        setMensagensProativasNaoLidas(0)
        ;(supabase as any)
          .from('assistente_mensagens')
          .update({ is_read: true })
          .eq('family_id', activeFamilyId)
          .eq('message_type', 'proactive')
          .eq('is_read', false)
          .then(() => {/* silencioso */})
      }
    } catch (err) {
      console.error('useAssistenteIA: erro ao carregar histórico', err)
    } finally {
      setIsFetchingHistory(false)
    }
  }, [user, activeFamilyId, hasAccess])

  // -------------------------------------------------------------------------
  // Enviar mensagem via Edge Function
  // -------------------------------------------------------------------------
  const enviar = useCallback(async (mensagemTexto: string) => {
    if (!user || !activeFamilyId || !hasAccess || !supabase) return

    const textoTrimmed = mensagemTexto.trim()
    if (!textoTrimmed) return

    // Otimismo: adiciona mensagem do usuário imediatamente
    const mensagemUser: AssistenteMensagem = {
      id          : `temp-${Date.now()}`,
      role        : 'user',
      conteudo    : textoTrimmed,
      tone        : null,
      message_type: 'manual',
      is_read     : true,
      trigger_key : null,
      created_at  : new Date().toISOString(),
    }
    setMensagens((prev) => [...prev, mensagemUser])
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        resposta: string
        tone: PersonalityTone
        creditos_restantes?: number
        limite_manual?: number
      }>('assistente-financeiro', {
        body: { mensagem: textoTrimmed, family_id: activeFamilyId },
      })

      if (fnError) {
        const msg =
          (fnError as unknown as { context?: { error?: string } }).context?.error ||
          fnError.message ||
          'Erro ao consultar o assistente'
        const code = (fnError as unknown as { context?: { code?: string } }).context?.code
        if (code === 'FEATURE_NOT_ENABLED') {
          setHasAccess(false)
        } else {
          setError(msg)
        }
        setMensagens((prev) => prev.filter((m) => m.id !== mensagemUser.id))
        return
      }

      if (data) {
        const mensagemIA: AssistenteMensagem = {
          id          : `temp-ia-${Date.now()}`,
          role        : 'assistant',
          conteudo    : data.resposta,
          tone        : data.tone,
          message_type: 'manual',
          is_read     : true,
          trigger_key : null,
          created_at  : new Date().toISOString(),
        }
        setMensagens((prev) => [...prev, mensagemIA])
        setToneState(data.tone)
      }
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
      setMensagens((prev) => prev.filter((m) => m.id !== mensagemUser.id))
      console.error('useAssistenteIA enviar error:', err)
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

    await (supabase as any)
      .from('user_ai_preferences')
      .upsert(
        { user_id: user.id, personality_tone: newTone, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
  }, [user])

  return {
    hasAccess,
    isCheckingAccess,
    mensagens,
    isFetchingHistory,
    isLoading,
    error,
    tone,
    mensagensProativasNaoLidas,
    loadHistorico,
    enviar,
    setTone,
  }
}
