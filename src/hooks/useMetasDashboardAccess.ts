import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface UseMetasDashboardAccessState {
  hasBetaAccess: boolean
  isChecking: boolean
}

/**
 * Verifica se o usuário tem acesso ao dashboard beta de Metas e Sonhos.
 * Lê ai_feature_access.metas_dashboard_beta para o usuário logado.
 */
export function useMetasDashboardAccess(): UseMetasDashboardAccessState {
  const { user } = useAuth()
  const [hasBetaAccess, setHasBetaAccess] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (!user) {
      setHasBetaAccess(false)
      setIsChecking(false)
      return
    }

    let cancelled = false

    async function checkAccess() {
      setIsChecking(true)

      if (!supabase) {
        setHasBetaAccess(false)
        setIsChecking(false)
        return
      }

      try {
        let enabled = false

        const { data: byUserId } = await (supabase as any)
          .from('ai_feature_access')
          .select('metas_dashboard_beta')
          .eq('user_id', user!.id)
          .maybeSingle() as { data: { metas_dashboard_beta: boolean } | null }

        if (byUserId !== null) {
          enabled = byUserId?.metas_dashboard_beta ?? false
        } else if (user!.email) {
          const { data: byEmail } = await (supabase as any)
            .from('ai_feature_access')
            .select('metas_dashboard_beta')
            .eq('email', user!.email)
            .maybeSingle() as { data: { metas_dashboard_beta: boolean } | null }
          enabled = byEmail?.metas_dashboard_beta ?? false
        }

        if (!cancelled) setHasBetaAccess(enabled)
      } catch {
        if (!cancelled) setHasBetaAccess(false)
      } finally {
        if (!cancelled) setIsChecking(false)
      }
    }

    checkAccess()
    return () => { cancelled = true }
  }, [user])

  return { hasBetaAccess, isChecking }
}
