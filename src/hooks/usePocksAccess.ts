import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface UsePocksAccessState {
  hasAccess: boolean
  isCheckingAccess: boolean
}

/**
 * Verifica acesso ao sistema Pocks.
 * Usa a mesma master flag de ai_feature_access.enabled (mesmo padrão do useAssistenteIA).
 * Usuários com ai_feature_access.enabled = true têm acesso automático ao Pocks.
 */
export function usePocksAccess(): UsePocksAccessState {
  const { user } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)

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
        // Tenta por user_id primeiro
        let enabled = false

        const { data: byUserId } = await (supabase as any)
          .from('ai_feature_access')
          .select('enabled')
          .eq('user_id', user!.id)
          .maybeSingle() as { data: { enabled: boolean } | null }

        if (byUserId !== null) {
          enabled = byUserId?.enabled ?? false
        } else if (user!.email) {
          // Fallback por email (registros seed podem ter user_id=NULL)
          const { data: byEmail } = await (supabase as any)
            .from('ai_feature_access')
            .select('enabled')
            .eq('email', user!.email)
            .maybeSingle() as { data: { enabled: boolean } | null }
          enabled = byEmail?.enabled ?? false
        }

        if (!cancelled) setHasAccess(enabled)
      } catch {
        if (!cancelled) setHasAccess(false)
      } finally {
        if (!cancelled) setIsCheckingAccess(false)
      }
    }

    checkAccess()
    return () => { cancelled = true }
  }, [user])

  return { hasAccess, isCheckingAccess }
}
