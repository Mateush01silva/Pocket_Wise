import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFamilyStore } from '../store/useFamilyStore'
import { consultorService } from '../services/consultorService'
import type { ConsultorPermissionsWithDetails } from '../types'

interface ConsultorPermissionsState {
  isConsultor: boolean
  permissions: ConsultorPermissionsWithDetails | null
  isLoading: boolean
  // Atalhos individuais (false quando não é consultor ou permissão não concedida)
  canCreateEnvelopes: boolean
  canCreateCategories: boolean
  canManageAccounts: boolean
  canViewEnvelopes: boolean
  canViewPocks: boolean
  canViewCaixinhas: boolean
}

export function useConsultorPermissions(): ConsultorPermissionsState {
  const { user } = useAuth()
  const members = useFamilyStore((state) => state.members)
  const family = useFamilyStore((state) => state.family)

  const [permissions, setPermissions] = useState<ConsultorPermissionsWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const userId = user?.id || ''
  const currentMember = members.find((m) => m.user_id === userId)
  const isConsultor = currentMember?.member_type === 'consultor'

  useEffect(() => {
    if (!isConsultor || !family?.id) {
      setPermissions(null)
      return
    }

    let cancelled = false
    setIsLoading(true)

    consultorService.getConsultorPermissions(family.id).then(({ data }) => {
      if (!cancelled) {
        setPermissions(data)
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [isConsultor, family?.id, userId])

  if (!isConsultor) {
    return {
      isConsultor: false,
      permissions: null,
      isLoading: false,
      canCreateEnvelopes: false,
      canCreateCategories: false,
      canManageAccounts: false,
      canViewEnvelopes: true,
      canViewPocks: true,
      canViewCaixinhas: true,
    }
  }

  return {
    isConsultor: true,
    permissions,
    isLoading,
    canCreateEnvelopes: permissions?.can_create_envelopes ?? false,
    canCreateCategories: permissions?.can_create_categories ?? false,
    canManageAccounts: permissions?.can_manage_accounts ?? false,
    canViewEnvelopes: permissions?.can_view_envelopes ?? true,
    canViewPocks: permissions?.can_view_pocks ?? true,
    canViewCaixinhas: permissions?.can_view_caixinhas ?? true,
  }
}
