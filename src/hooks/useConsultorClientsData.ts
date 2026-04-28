import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type PocksStatus = 'calculated' | 'pending' | 'no_access'
export type PlanTier = 'explorador' | 'planejador' | 'mestre'

export interface ClientEnrichedData {
  family_id: string
  nome: string
  plan_tier: PlanTier
  can_view_pocks: boolean
  pocks_score: number | null
  pocks_status: PocksStatus
  last_transaction_date: string | null
  has_inactivity_alert: boolean
  negative_envelopes_count: number
}

export type SortOrder = 'alerta' | 'pocks' | 'atividade' | 'alfabetica'

interface UseConsultorClientsDataReturn {
  clients: ClientEnrichedData[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useConsultorClientsData(): UseConsultorClientsDataReturn {
  const [clients, setClients] = useState<ClientEnrichedData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!supabase) {
      setError('Supabase não configurado')
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    ;(supabase as any)
      .rpc('get_consultant_clients_enriched')
      .then(({ data, error: rpcError }: { data: any; error: any }) => {
        if (cancelled) return

        if (rpcError) {
          setError(rpcError.message ?? 'Erro ao buscar dados dos clientes')
          setIsLoading(false)
          return
        }

        if (!data?.success) {
          setError(data?.error ?? 'Erro ao buscar dados dos clientes')
          setIsLoading(false)
          return
        }

        setClients((data.data as ClientEnrichedData[]) ?? [])
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  return {
    clients,
    isLoading,
    error,
    refresh: () => setTick((t) => t + 1),
  }
}

// ── Sorting ────────────────────────────────────────────────────────────────

function alertPriority(c: ClientEnrichedData): number {
  if (c.negative_envelopes_count > 0) return 0   // crítico
  if (c.has_inactivity_alert) return 1             // inatividade
  return 2                                         // sem alerta
}

function pocksSortKey(c: ClientEnrichedData): number {
  if (c.pocks_status === 'calculated' && c.pocks_score !== null) return c.pocks_score
  if (c.pocks_status === 'pending') return 1000    // Mestre sem score → após calculados
  return 2000                                      // sem acesso → por último
}

export function sortClients(clients: ClientEnrichedData[], order: SortOrder): ClientEnrichedData[] {
  const sorted = [...clients]

  switch (order) {
    case 'alerta':
      return sorted.sort((a, b) => {
        const diff = alertPriority(a) - alertPriority(b)
        if (diff !== 0) return diff
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })

    case 'pocks':
      return sorted.sort((a, b) => {
        const aKey = pocksSortKey(a)
        const bKey = pocksSortKey(b)
        if (aKey !== bKey) return aKey - bKey
        // Dentro do grupo sem acesso: alfabética
        if (aKey >= 2000) return a.nome.localeCompare(b.nome, 'pt-BR')
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })

    case 'atividade':
      return sorted.sort((a, b) => {
        if (a.last_transaction_date && b.last_transaction_date) {
          const diff =
            new Date(b.last_transaction_date).getTime() -
            new Date(a.last_transaction_date).getTime()
          if (diff !== 0) return diff
          return a.nome.localeCompare(b.nome, 'pt-BR')
        }
        if (a.last_transaction_date) return -1
        if (b.last_transaction_date) return 1
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })

    case 'alfabetica':
      return sorted.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }
}
