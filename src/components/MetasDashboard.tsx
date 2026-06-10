/**
 * MetasDashboard.tsx
 * Dashboard melhorado de Metas e Sonhos (caixinhas objetivo/emergencia).
 * Renderizado apenas quando metas_dashboard_beta = true em ai_feature_access.
 *
 * Funcionalidades:
 * - Resumo geral: total conquistado, aportado este mês, contagem no prazo/em risco
 * - Agrupamento por horizonte temporal (curto/médio/longo/sem prazo)
 * - Badge de status por caixinha (no_prazo, atencao, em_risco, pausada, concluida)
 * - Projeção de conclusão baseada na média dos últimos 3 meses
 * - Mini-timeline de 6 meses + streak
 * - Drag-to-reorder via HTML5 DnD dentro do mesmo grupo
 */

import { useState, useRef } from 'react'
import {
  ArrowUpCircle, ArrowDownCircle, History, PauseCircle, PlayCircle,
  GripVertical, ChevronDown,
} from 'lucide-react'
import { format, differenceInDays, parseISO, isSameMonth, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from './ui/Button'
import { LearningTooltip } from './ui/LearningTooltip'
import { learningContent } from '../lib/learningContent'
import { MiniTimeline } from './MiniTimeline'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import {
  calcularBadgeStatus,
  calcularStreak,
  agruparPorHorizonte,
  formatarProjecaoConclusao,
  calcularAporteSugerido,
} from '../lib/caixinhasCalculations'
import type { CaixinhaComDetalhes, CaixinhaHistoricoMensal } from '../types'
import type { BadgeStatus } from '../lib/caixinhasCalculations'

interface MetasDashboardProps {
  caixinhas: CaixinhaComDetalhes[]
  historicoMensal: Record<string, CaixinhaHistoricoMensal[]>
  canEdit: boolean
  onDepositar: (c: CaixinhaComDetalhes) => void
  onRetirar: (c: CaixinhaComDetalhes) => void
  onConcluirMeta: (c: CaixinhaComDetalhes) => void
  onPausar: (c: CaixinhaComDetalhes) => void
  onRetomar: (c: CaixinhaComDetalhes) => void
  onHistorico: (c: CaixinhaComDetalhes) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit: (c: any) => void
  onReorder: (id: string, newOrder: number) => void
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function BadgeChip({ status }: { status: BadgeStatus }) {
  const config: Record<BadgeStatus, { label: string; className: string }> = {
    no_prazo:  { label: 'No prazo',   className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    atencao:   { label: 'Atenção',    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    em_risco:  { label: 'Em risco',   className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    pausada:   { label: 'Pausada',    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    concluida: { label: 'Concluída',  className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    sem_prazo: { label: 'Sem prazo',  className: 'bg-dark-600/80 text-gray-500 border-dark-500' },
  }
  const { label, className } = config[status]
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', className)}>
      {label}
    </span>
  )
}

// ─── Single card ──────────────────────────────────────────────────────────────

interface CardProps {
  caixinha: CaixinhaComDetalhes
  historico: CaixinhaHistoricoMensal[]
  canEdit: boolean
  isDragging: boolean
  onDepositar: () => void
  onRetirar: () => void
  onConcluirMeta: () => void
  onPausar: () => void
  onRetomar: () => void
  onHistorico: () => void
  onEdit: () => void
  dragHandleProps: {
    draggable: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragEnd: () => void
  }
}

function MetaCaixinhaCard({
  caixinha,
  historico,
  canEdit,
  isDragging,
  onDepositar,
  onRetirar,
  onConcluirMeta,
  onPausar,
  onRetomar,
  onHistorico,
  onEdit,
  dragHandleProps,
}: CardProps) {
  const saldoConquistado = (caixinha as any).saldo_conquistado as number | undefined ?? caixinha.saldo_atual
  const badge = calcularBadgeStatus(
    {
      status: caixinha.status ?? 'ativa',
      meta_valor: caixinha.meta_valor,
      prazo_data: caixinha.prazo_data ?? null,
      saldo_conquistado: saldoConquistado,
      meses_pausados: caixinha.meses_pausados ?? 0,
    },
    historico
  )
  const streak = calcularStreak(historico)
  const progresso = caixinha.meta_valor
    ? Math.min((saldoConquistado / caixinha.meta_valor) * 100, 100)
    : null
  const projecao = formatarProjecaoConclusao(caixinha.meta_valor, saldoConquistado, historico)
  const aporteSugerido = calcularAporteSugerido(
    caixinha.meta_valor,
    saldoConquistado,
    caixinha.prazo_data ?? null,
    caixinha.meses_pausados ?? 0
  )

  const diasPrazo = caixinha.prazo_data
    ? differenceInDays(parseISO(caixinha.prazo_data), new Date())
    : null
  const metaAtingida = progresso !== null && progresso >= 100

  const progressColor =
    badge === 'em_risco' ? 'bg-red-500' :
    badge === 'atencao'  ? 'bg-yellow-500' :
    metaAtingida         ? 'bg-green-500' :
                           'bg-blue-500'

  return (
    <div
      className={cn(
        'bg-dark-800 border border-dark-700 rounded-xl overflow-hidden transition-all',
        isDragging && 'opacity-50 scale-95',
        caixinha.status === 'pausada' && 'opacity-70',
      )}
      style={{ borderLeft: `4px solid ${caixinha.cor}` }}
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-4 pb-0">
        {canEdit && (
          <div
            {...dragHandleProps}
            className="mt-1 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0"
            title="Arrastar para reordenar"
          >
            <GripVertical size={16} />
          </div>
        )}
        <span className="text-2xl shrink-0">{caixinha.icone}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-100 truncate">{caixinha.nome}</p>
              <p className="text-xs text-gray-500">
                {caixinha.tipo === 'emergencia' ? '🏥 Emergência' : '🎯 Objetivo'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <BadgeChip status={badge} />
              {canEdit && (
                <button
                  onClick={onEdit}
                  className="text-gray-600 hover:text-gray-400 p-1"
                  title="Editar" aria-label="Editar"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Duplo saldo */}
        <div className="space-y-1">
          {saldoConquistado !== caixinha.saldo_atual ? (
            <>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-green-400 font-medium">Já conquistei</span>
                <span className="text-base font-bold text-green-400">
                  {formatCurrency(saldoConquistado)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400">Disponível agora</span>
                <span className="text-sm font-semibold text-primary-400">
                  {formatCurrency(caixinha.saldo_atual)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-400">Saldo atual</span>
              <span className="text-xl font-bold text-primary-400">
                {formatCurrency(caixinha.saldo_atual)}
              </span>
            </div>
          )}
          {caixinha.meta_valor && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Meta: {formatCurrency(caixinha.meta_valor)}</span>
              <span>{progresso?.toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Barra de progresso */}
        {progresso !== null && (
          <div className="w-full bg-dark-700 rounded-full h-2">
            <div
              className={cn('h-2 rounded-full transition-all', progressColor)}
              style={{ width: `${progresso}%` }}
            />
          </div>
        )}

        {/* Faltam + prazo */}
        {caixinha.valor_faltante !== null && caixinha.valor_faltante > 0 && (
          <p className="text-xs text-gray-500">Faltam: {formatCurrency(caixinha.valor_faltante)}</p>
        )}
        {caixinha.prazo_data && diasPrazo !== null && (
          <p className="text-xs text-gray-500">
            Prazo: {format(parseISO(caixinha.prazo_data), 'dd/MM/yyyy', { locale: ptBR })}
            {' '}
            <span className={cn(diasPrazo < 0 ? 'text-red-400' : 'text-gray-600')}>
              ({diasPrazo < 0 ? `${Math.abs(diasPrazo)} dias atrás` : `${diasPrazo} dias`})
            </span>
          </p>
        )}

        {/* Aporte sugerido + projeção */}
        {aporteSugerido !== null && aporteSugerido > 0 && (
          <p className="text-xs text-gray-500">
            Aporte sugerido: <span className="text-gray-300 font-medium">{formatCurrency(aporteSugerido)}/mês</span>
            {projecao && (
              <> · No ritmo atual: <span className="text-gray-300">{projecao}</span></>
            )}
          </p>
        )}

        {/* Meta atingida */}
        {metaAtingida && caixinha.saldo_atual > 0 && caixinha.status !== 'concluida' && (
          <div className="text-xs text-green-400 font-medium">✅ Meta atingida!</div>
        )}

        {/* Mini-timeline */}
        {historico.length > 0 && (
          <MiniTimeline historico={historico} streak={streak} />
        )}

        {/* Ações */}
        {canEdit && (
          <div className="space-y-2 pt-1">
            {caixinha.status === 'pausada' ? (
              <div className="flex gap-2">
                {caixinha.saldo_atual > 0 && (
                  <Button size="sm" variant="secondary" className="flex-1" onClick={onRetirar}>
                    <ArrowDownCircle size={14} className="mr-1" />
                    Retirar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 text-green-400 hover:text-green-300"
                  onClick={onRetomar}
                >
                  <PlayCircle size={14} className="mr-1" />
                  Retomar
                </Button>
              </div>
            ) : metaAtingida && caixinha.saldo_atual > 0 ? (
              <LearningTooltip content={learningContent.caixinhaConcluirMeta} position="top">
                <Button
                  size="sm"
                  variant="primary"
                  className="w-full bg-green-600 hover:bg-green-500"
                  onClick={onConcluirMeta}
                >
                  🏆 Concluir meta
                </Button>
              </LearningTooltip>
            ) : caixinha.status !== 'concluida' ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={onDepositar}>
                    <ArrowUpCircle size={14} className="mr-1" />
                    Depositar
                  </Button>
                  {caixinha.saldo_atual > 0 && (
                    <Button size="sm" variant="secondary" className="flex-1" onClick={onRetirar}>
                      <ArrowDownCircle size={14} className="mr-1" />
                      Retirar
                    </Button>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-gray-600 hover:text-yellow-400"
                  onClick={onPausar}
                >
                  <PauseCircle size={14} className="mr-1" />
                  Pausar
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="w-full text-gray-500 hover:text-gray-300"
          onClick={onHistorico}
        >
          <History size={14} className="mr-1" />
          Histórico / Desfazer
        </Button>
      </div>
    </div>
  )
}

// ─── Draggable group ──────────────────────────────────────────────────────────

interface GroupProps {
  title: string
  caixinhas: CaixinhaComDetalhes[]
  historicoMensal: Record<string, CaixinhaHistoricoMensal[]>
  canEdit: boolean
  onDepositar: (c: CaixinhaComDetalhes) => void
  onRetirar: (c: CaixinhaComDetalhes) => void
  onConcluirMeta: (c: CaixinhaComDetalhes) => void
  onPausar: (c: CaixinhaComDetalhes) => void
  onRetomar: (c: CaixinhaComDetalhes) => void
  onHistorico: (c: CaixinhaComDetalhes) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit: (c: any) => void
  onReorder: (id: string, newOrder: number) => void
}

function MetasGroup({
  title,
  caixinhas,
  historicoMensal,
  canEdit,
  onDepositar, onRetirar, onConcluirMeta, onPausar, onRetomar, onHistorico, onEdit,
  onReorder,
}: GroupProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOverIdRef = useRef<string | null>(null)

  if (caixinhas.length === 0) return null

  const handleDragStart = (id: string) => {
    setDraggingId(id)
  }
  const handleDragEnd = () => {
    if (draggingId && dragOverIdRef.current && draggingId !== dragOverIdRef.current) {
      const overIndex = caixinhas.findIndex((c) => c.id === dragOverIdRef.current)
      if (overIndex !== -1) {
        onReorder(draggingId, overIndex)
      }
    }
    setDraggingId(null)
    dragOverIdRef.current = null
  }
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    dragOverIdRef.current = id
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        onDragOver={(e) => e.preventDefault()}
      >
        {caixinhas.map((caixinha) => (
          <div
            key={caixinha.id}
            onDragOver={(e) => handleDragOver(e, caixinha.id)}
          >
            <MetaCaixinhaCard
              caixinha={caixinha}
              historico={historicoMensal[caixinha.id] ?? []}
              canEdit={canEdit}
              isDragging={draggingId === caixinha.id}
              onDepositar={() => onDepositar(caixinha)}
              onRetirar={() => onRetirar(caixinha)}
              onConcluirMeta={() => onConcluirMeta(caixinha)}
              onPausar={() => onPausar(caixinha)}
              onRetomar={() => onRetomar(caixinha)}
              onHistorico={() => onHistorico(caixinha)}
              onEdit={() => onEdit(caixinha)}
              dragHandleProps={{
                draggable: true,
                onDragStart: () => handleDragStart(caixinha.id),
                onDragEnd: handleDragEnd,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MetasDashboard({
  caixinhas,
  historicoMensal,
  canEdit,
  onDepositar, onRetirar, onConcluirMeta, onPausar, onRetomar, onHistorico, onEdit,
  onReorder,
}: MetasDashboardProps) {
  const [showConcluidas, setShowConcluidas] = useState(false)

  const hoje = new Date()
  const mesAtual = startOfMonth(hoje)

  // Separar ativas/pausadas das concluídas
  const caixinhasAtivas = caixinhas.filter((c) => c.status !== 'concluida')
  const caixinhasConcluidas = caixinhas.filter((c) => c.status === 'concluida')

  const grupos = agruparPorHorizonte(caixinhasAtivas)

  // ─── Resumo geral ───────────────────────────────────────────────────────────
  const totalConquistado = caixinhasAtivas.reduce((sum, c) => {
    const sc = (c as any).saldo_conquistado as number | undefined ?? c.saldo_atual
    return sum + sc
  }, 0)

  const aportadoMes = caixinhasAtivas.reduce((sum, c) => {
    const h = historicoMensal[c.id] ?? []
    const mesH = h.find((m) => isSameMonth(parseISO(m.mes_referencia), mesAtual))
    return sum + (mesH?.valor_depositado ?? 0)
  }, 0)

  const badgeCounts = caixinhasAtivas.reduce(
    (acc, c) => {
      const badge = calcularBadgeStatus(
        {
          status: c.status ?? 'ativa',
          meta_valor: c.meta_valor,
          prazo_data: c.prazo_data ?? null,
          saldo_conquistado: (c as any).saldo_conquistado ?? c.saldo_atual,
          meses_pausados: c.meses_pausados ?? 0,
        },
        historicoMensal[c.id] ?? []
      )
      if (badge === 'no_prazo') acc.noPrazo++
      else if (badge === 'em_risco') acc.emRisco++
      return acc
    },
    { noPrazo: 0, emRisco: 0 }
  )

  const HORIZONTE_LABELS: Record<string, string> = {
    curto: 'Curto Prazo — até 12 meses',
    medio: 'Médio Prazo — 1 a 3 anos',
    longo: 'Longo Prazo — acima de 3 anos',
    sem_prazo: 'Sem Prazo Definido',
  }

  return (
    <div className="space-y-6">
      {/* Resumo geral */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total conquistado</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(totalConquistado)}</p>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Aportado este mês</p>
          <p className="text-xl font-bold text-primary-400">{formatCurrency(aportadoMes)}</p>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Situação</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold text-green-400">{badgeCounts.noPrazo} ✓</span>
            {badgeCounts.emRisco > 0 && (
              <span className="text-sm font-bold text-red-400">{badgeCounts.emRisco} ⚠</span>
            )}
          </div>
        </div>
      </div>

      {/* Grupos por horizonte */}
      {(['curto', 'medio', 'longo', 'sem_prazo'] as const).map((key) => (
        <MetasGroup
          key={key}
          title={HORIZONTE_LABELS[key]}
          caixinhas={grupos[key]}
          historicoMensal={historicoMensal}
          canEdit={canEdit}
          onDepositar={onDepositar}
          onRetirar={onRetirar}
          onConcluirMeta={onConcluirMeta}
          onPausar={onPausar}
          onRetomar={onRetomar}
          onHistorico={onHistorico}
          onEdit={onEdit}
          onReorder={onReorder}
        />
      ))}

      {/* Arquivadas (concluídas) */}
      {caixinhasConcluidas.length > 0 && (
        <div>
          <button
            onClick={() => setShowConcluidas((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronDown
              size={16}
              className={cn('transition-transform', showConcluidas && 'rotate-180')}
            />
            Ver arquivadas ({caixinhasConcluidas.length})
          </button>
          {showConcluidas && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {caixinhasConcluidas.map((c) => (
                <div
                  key={c.id}
                  className="bg-dark-800/50 border border-dark-700/50 rounded-xl p-4 opacity-60"
                  style={{ borderLeft: `4px solid ${c.cor}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{c.icone}</span>
                    <div>
                      <p className="font-medium text-gray-300">{c.nome}</p>
                      <p className="text-xs text-blue-400">Concluída · {formatCurrency(c.saldo_atual)} retirado</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full mt-3 text-gray-500 hover:text-gray-300"
                    onClick={() => onHistorico(c)}
                  >
                    <History size={14} className="mr-1" />
                    Ver histórico
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {caixinhasAtivas.length === 0 && caixinhasConcluidas.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">Nenhuma meta criada ainda.</p>
      )}
    </div>
  )
}
