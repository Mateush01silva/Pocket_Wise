/**
 * MiniTimeline.tsx
 * Mini linha do tempo dos últimos 6 meses de contribuições de uma caixinha.
 * Mostra: verde (depositou), vermelho (não depositou), cinza P (pausado), azul tracejado (mês atual)
 */

import { format, parseISO, isSameMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CaixinhaHistoricoMensal } from '../types'

interface MiniTimelineProps {
  historico: CaixinhaHistoricoMensal[]
  streak: number
  className?: string
}

export function MiniTimeline({ historico, streak, className = '' }: MiniTimelineProps) {
  if (historico.length === 0) return null

  const hoje = new Date()

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-1">
        {historico.map((mes) => {
          const dataMes = parseISO(mes.mes_referencia)
          const isMesAtual = isSameMonth(dataMes, hoje)
          const label = format(dataMes, 'MMM', { locale: ptBR })

          let circleClass = ''
          let title = ''
          let content: React.ReactNode = null

          if (mes.mes_pausado) {
            circleClass = 'bg-dark-600 border border-dark-500 text-gray-500'
            title = `${label}: pausada`
            content = <span className="text-xs font-bold">P</span>
          } else if (isMesAtual) {
            circleClass = 'border-2 border-dashed border-blue-400 text-blue-400 bg-transparent'
            title = `${label}: em andamento`
            content = null
          } else if (mes.houve_deposito) {
            circleClass = 'bg-green-500 border border-green-400'
            title = `${label}: depositou`
            content = null
          } else {
            circleClass = 'bg-red-900/40 border border-red-800 text-red-600'
            title = `${label}: sem depósito`
            content = null
          }

          return (
            <div
              key={mes.mes_referencia}
              className={`w-6 h-6 rounded-full flex items-center justify-center cursor-default ${circleClass}`}
              title={title}
            >
              {content}
            </div>
          )
        })}
      </div>
      {streak > 0 && (
        <p className="text-xs text-gray-500">
          🔥 {streak} {streak === 1 ? 'mês seguido' : 'meses seguidos'}
        </p>
      )}
    </div>
  )
}
