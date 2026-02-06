import { create } from 'zustand'
import { isToday, isPast, parseISO } from 'date-fns'
import type { Lancamento, EnvelopeDigital } from '../types'

export type TipoNotificacao = 'urgente' | 'atencao' | 'info'

export interface Notificacao {
  id: string
  tipo: TipoNotificacao
  titulo: string
  descricao: string
  icone: 'alert' | 'clock' | 'envelope' | 'trending-down' | 'check'
  acao?: {
    label: string
    rota: string
  }
  criadaEm: Date
}

interface NotificacoesState {
  notificacoes: Notificacao[]

  // Computed
  getNotificacoes: () => Notificacao[]
  getContadorUrgentes: () => number
  getContadorTotal: () => number

  // Actions
  atualizarNotificacoes: (
    lancamentos: Lancamento[],
    envelopes: EnvelopeDigital[]
  ) => void
  limparNotificacao: (id: string) => void
}

export const useNotificacoesStore = create<NotificacoesState>()((set, get) => ({
  notificacoes: [],

  getNotificacoes: () => {
    return get().notificacoes.sort((a, b) => {
      // Ordenar por tipo (urgente > atencao > info) e depois por data
      const prioridade: Record<TipoNotificacao, number> = { urgente: 0, atencao: 1, info: 2 }
      if (prioridade[a.tipo] !== prioridade[b.tipo]) {
        return prioridade[a.tipo] - prioridade[b.tipo]
      }
      return b.criadaEm.getTime() - a.criadaEm.getTime()
    })
  },

  getContadorUrgentes: () => {
    return get().notificacoes.filter(n => n.tipo === 'urgente').length
  },

  getContadorTotal: () => {
    return get().notificacoes.length
  },

  atualizarNotificacoes: (lancamentos, envelopes) => {
    const novasNotificacoes: Notificacao[] = []

    // 1. Despesas vencidas (não pagas e data no passado)
    const despesasVencidas = lancamentos.filter(l => {
      if (l.tipo !== 'despesa') return false
      if (l.status === 'pago') return false
      if (l.forma_pagamento === 'credito') return false // Cartão vai para fatura
      const dataLancamento = parseISO(l.data)
      return isPast(dataLancamento) && !isToday(dataLancamento)
    })

    if (despesasVencidas.length > 0) {
      const totalVencido = despesasVencidas.reduce((sum, l) => sum + l.valor, 0)
      novasNotificacoes.push({
        id: 'despesas-vencidas',
        tipo: 'urgente',
        titulo: `${despesasVencidas.length} despesa(s) vencida(s)`,
        descricao: `Total: R$ ${totalVencido.toFixed(2).replace('.', ',')}`,
        icone: 'alert',
        acao: {
          label: 'Ver pendentes',
          rota: '/app/transacoes?status=pendente&periodo=todos'
        },
        criadaEm: new Date()
      })
    }

    // 2. Despesas para hoje
    const despesasHoje = lancamentos.filter(l => {
      if (l.tipo !== 'despesa') return false
      if (l.status === 'pago') return false
      if (l.forma_pagamento === 'credito') return false
      return isToday(parseISO(l.data))
    })

    if (despesasHoje.length > 0) {
      const totalHoje = despesasHoje.reduce((sum, l) => sum + l.valor, 0)
      novasNotificacoes.push({
        id: 'despesas-hoje',
        tipo: 'atencao',
        titulo: `${despesasHoje.length} despesa(s) para hoje`,
        descricao: `Total: R$ ${totalHoje.toFixed(2).replace('.', ',')}`,
        icone: 'clock',
        acao: {
          label: 'Ver transações',
          rota: '/app/transacoes?status=pendente'
        },
        criadaEm: new Date()
      })
    }

    // 3. Receitas pendentes (para conferir se já recebeu)
    const receitasPendentes = lancamentos.filter(l => {
      if (l.tipo !== 'receita') return false
      if (l.status === 'pago') return false
      const dataLancamento = parseISO(l.data)
      return isPast(dataLancamento) || isToday(dataLancamento)
    })

    if (receitasPendentes.length > 0) {
      const totalReceitas = receitasPendentes.reduce((sum, l) => sum + l.valor, 0)
      novasNotificacoes.push({
        id: 'receitas-pendentes',
        tipo: 'info',
        titulo: `${receitasPendentes.length} receita(s) para conferir`,
        descricao: `Total esperado: R$ ${totalReceitas.toFixed(2).replace('.', ',')}`,
        icone: 'check',
        acao: {
          label: 'Conferir',
          rota: '/app/transacoes?tipo=receita&status=pendente'
        },
        criadaEm: new Date()
      })
    }

    // 4. Envelopes estourados (críticos)
    const envelopesCriticos = envelopes.filter(e => e.status === 'critico')
    if (envelopesCriticos.length > 0) {
      novasNotificacoes.push({
        id: 'envelopes-criticos',
        tipo: 'urgente',
        titulo: `${envelopesCriticos.length} envelope(s) estourado(s)`,
        descricao: envelopesCriticos.slice(0, 3).map(e => e.categoria.nome).join(', '),
        icone: 'envelope',
        acao: {
          label: 'Ver envelopes',
          rota: '/app/envelopes'
        },
        criadaEm: new Date()
      })
    }

    // 5. Envelopes em risco (≥80%)
    const envelopesEmRisco = envelopes.filter(e => e.percentual_usado >= 80 && e.status !== 'critico')
    if (envelopesEmRisco.length > 0) {
      novasNotificacoes.push({
        id: 'envelopes-risco',
        tipo: 'atencao',
        titulo: `${envelopesEmRisco.length} envelope(s) em risco`,
        descricao: 'Mais de 80% do orçamento usado',
        icone: 'trending-down',
        acao: {
          label: 'Ver envelopes',
          rota: '/app/envelopes'
        },
        criadaEm: new Date()
      })
    }

    set({ notificacoes: novasNotificacoes })
  },

  limparNotificacao: (id) => {
    set(state => ({
      notificacoes: state.notificacoes.filter(n => n.id !== id)
    }))
  },
}))
