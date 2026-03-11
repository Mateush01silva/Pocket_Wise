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
  created_at: string
}

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

  const [hasAccess, setHasAccess] = useState(false)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const [mensagens, setMensagens] = useState<AssistenteMensagem[]>([])
  const [isFetchingHistory, setIsFetchingHistory] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tone, setToneState] = useState<PersonalityTone>('parceiro')

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
        // 1. Verifica master flag
        const { data: accessData } = await (supabase as any)
          .from('ai_feature_access')
          .select('id, enabled')
          .eq('user_id', user!.id)
          .maybeSingle() as { data: { id: string; enabled: boolean } | null }

        if (cancelled) return

        if (!accessData?.enabled) {
          if (!cancelled) setHasAccess(false)
          return
        }

        // 2. Verifica permissão específica 'assistente'
        const { data: permData } = await (supabase as any)
          .from('ai_feature_permissions')
          .select('enabled')
          .eq('access_id', accessData.id)
          .eq('feature_key', 'assistente')
          .maybeSingle() as { data: { enabled: boolean } | null }

        if (cancelled) return

        if (!permData?.enabled) {
          if (!cancelled) setHasAccess(false)
          return
        }

        if (!cancelled) setHasAccess(true)

        // 3. Carregar tom de personalidade
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
  // Carregar histórico de mensagens (chamado pela página do Assistente)
  // -------------------------------------------------------------------------
  const loadHistorico = useCallback(async () => {
    if (!user || !activeFamilyId || !hasAccess || !supabase) return

    setIsFetchingHistory(true)
    try {
      const { data } = await (supabase as any)
        .from('assistente_mensagens')
        .select('id, role, conteudo, tone, created_at')
        .eq('family_id', activeFamilyId)
        .order('created_at', { ascending: true })
        .limit(100) as { data: AssistenteMensagem[] | null }

      if (data) setMensagens(data)
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

    // Adiciona mensagem do usuário otimisticamente
    const mensagemUser: AssistenteMensagem = {
      id: `temp-${Date.now()}`,
      role: 'user',
      conteudo: textoTrimmed,
      tone: null,
      created_at: new Date().toISOString(),
    }
    setMensagens((prev) => [...prev, mensagemUser])
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        resposta: string
        tone: PersonalityTone
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
        // Remove a mensagem otimista em caso de erro
        setMensagens((prev) => prev.filter((m) => m.id !== mensagemUser.id))
        return
      }

      if (data) {
        // Adiciona resposta da IA
        const mensagemIA: AssistenteMensagem = {
          id: `temp-ia-${Date.now()}`,
          role: 'assistant',
          conteudo: data.resposta,
          tone: data.tone,
          created_at: new Date().toISOString(),
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
    loadHistorico,
    enviar,
    setTone,
  }
}
