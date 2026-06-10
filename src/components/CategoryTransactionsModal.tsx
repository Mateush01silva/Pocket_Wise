import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { CurrencyInput } from './ui/CurrencyInput'
import { formatCurrency } from '../utils/currency'
import { format, parseISO, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Lancamento, Categoria, CategoriaPrioridade } from '../types'
import { TrendingDown, Calendar, Edit2, Check, X, Columns } from 'lucide-react'
import { cn } from '../lib/cn'
import { useOrcamentosStore, useTransacoesStore } from '../store'
import { getMesEnvelope, calcularGastoPorCategoria } from '../lib/budgetCalculations'

interface CategoryTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  categoria: Categoria
  subcategorias: Categoria[]
  transacoes: Lancamento[]
  mesReferencia: string
  valorOrcado: number
  valorGasto: number
  categoriaBudgetId?: string
  prioridade?: CategoriaPrioridade
  canEdit?: boolean
}

export function CategoryTransactionsModal({
  isOpen,
  onClose,
  categoria,
  subcategorias,
  transacoes,
  mesReferencia,
  valorOrcado,
  valorGasto,
  categoriaBudgetId,
  prioridade,
  canEdit = true,
}: CategoryTransactionsModalProps) {
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [novoValorOrcado, setNovoValorOrcado] = useState(valorOrcado)
  const [novaPrioridade, setNovaPrioridade] = useState<CategoriaPrioridade | undefined>(prioridade)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingPrioridade, setIsSavingPrioridade] = useState(false)
  const [showComparison, setShowComparison] = useState(false)

  // Mês de comparação: padrão = mês anterior ao mesReferencia
  const defaultCmpMes = useMemo(() => {
    const [year, month] = mesReferencia.substring(0, 7).split('-').map(Number)
    return format(subMonths(new Date(year, month - 1, 1), 1), 'yyyy-MM')
  }, [mesReferencia])

  const [mesCmp, setMesCmp] = useState(defaultCmpMes)

  // Opções de comparação: últimos 12 meses (excluindo o mês atual)
  const mesCmpOptions = useMemo(() => {
    const [year, month] = mesReferencia.substring(0, 7).split('-').map(Number)
    const base = new Date(year, month - 1, 1)
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(base, i + 1)
      return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy', { locale: ptBR }) }
    })
  }, [mesReferencia])

  const updateCategoriaBudget = useOrcamentosStore((state) => state.updateCategoriaBudget)
  const orcamentos = useOrcamentosStore((state) => state.orcamentos)
  const categoriasBudget = useOrcamentosStore((state) => state.categoriasBudget)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)

  // Dados do mês de comparação
  const cmpTransacoes = useMemo(() => {
    if (!showComparison) return []
    return lancamentos
      .filter(l =>
        l.categoria_id === categoria.id &&
        l.tipo === 'despesa' &&
        getMesEnvelope(l) === mesCmp &&
        (l.status === 'pago' || l.status === 'projetado')
      )
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [showComparison, lancamentos, categoria.id, mesCmp])

  const cmpValorGasto = useMemo(() => {
    if (!showComparison) return 0
    return calcularGastoPorCategoria(lancamentos, categoria.id, mesCmp)
  }, [showComparison, lancamentos, categoria.id, mesCmp])

  const cmpValorOrcado = useMemo(() => {
    if (!showComparison) return 0
    const cmpOrc = orcamentos.find(o => o.mes_referencia.startsWith(mesCmp))
    if (!cmpOrc) return 0
    const cb = categoriasBudget.find(cb => cb.orcamento_id === cmpOrc.id && cb.categoria_id === categoria.id)
    return cb?.valor_orcado ?? 0
  }, [showComparison, orcamentos, categoriasBudget, categoria.id, mesCmp])

  const getSubcategoriaNome = (subcategoriaId: string | null | undefined) => {
    if (!subcategoriaId) return null
    return subcategorias.find(s => s.id === subcategoriaId)?.nome ?? null
  }

  const handleStartEdit = () => {
    setNovoValorOrcado(valorOrcado)
    setIsEditingBudget(true)
  }

  const handleCancelEdit = () => {
    setIsEditingBudget(false)
    setNovoValorOrcado(valorOrcado)
  }

  const handleSaveEdit = async () => {
    if (!categoriaBudgetId) return
    setIsSaving(true)
    try {
      await updateCategoriaBudget(categoriaBudgetId, novoValorOrcado)
      setIsEditingBudget(false)
    } catch (error) {
      console.error('Erro ao atualizar orçamento:', error)
      toast.error('Erro ao atualizar o orçamento. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePrioridade = async (newPrioridade: CategoriaPrioridade) => {
    if (!categoriaBudgetId || newPrioridade === novaPrioridade) return
    setIsSavingPrioridade(true)
    try {
      await updateCategoriaBudget(categoriaBudgetId, valorOrcado, newPrioridade)
      setNovaPrioridade(newPrioridade)
    } catch (error) {
      console.error('Erro ao atualizar prioridade:', error)
      toast.error('Erro ao atualizar a classificação. Tente novamente.')
    } finally {
      setIsSavingPrioridade(false)
    }
  }

  const valorOrcadoAtual = isEditingBudget ? novoValorOrcado : valorOrcado
  const percentualUsadoAtual = valorOrcadoAtual > 0 ? (valorGasto / valorOrcadoAtual) * 100 : 0
  const valorDisponivelAtual = valorOrcadoAtual - valorGasto

  const cmpValorDisponivel = cmpValorOrcado - cmpValorGasto
  const cmpPercentualUsado = cmpValorOrcado > 0 ? (cmpValorGasto / cmpValorOrcado) * 100 : 0

  // Renderiza um card de transação (reutilizado nas duas colunas)
  const TransactionCard = ({ transacao }: { transacao: Lancamento }) => (
    <div className="bg-dark-800 rounded-lg p-3 hover:bg-dark-700 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-gray-100 font-medium text-sm truncate">
              {transacao.observacao || `Despesa em ${categoria.nome}`}
            </p>
            {getSubcategoriaNome(transacao.subcategoria_id) && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30 shrink-0">
                {getSubcategoriaNome(transacao.subcategoria_id)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Calendar size={11} className="text-gray-500 shrink-0" />
            <span className="text-xs text-gray-500">
              {format(parseISO(transacao.data), "dd 'de' MMMM", { locale: ptBR })}
            </span>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              transacao.status === 'pago' && 'bg-green-500/20 text-green-400',
              transacao.status === 'pendente' && 'bg-yellow-500/20 text-yellow-400',
              transacao.status === 'projetado' && 'bg-blue-500/20 text-blue-400'
            )}>
              {transacao.status === 'pago' && 'Pago'}
              {transacao.status === 'pendente' && 'Pendente'}
              {transacao.status === 'projetado' && 'Projetado'}
            </span>
            {transacao.forma_pagamento && (
              <span className="text-xs text-gray-500">
                • {transacao.forma_pagamento === 'dinheiro' && 'Dinheiro'}
                {transacao.forma_pagamento === 'debito' && 'Débito'}
                {transacao.forma_pagamento === 'credito' && 'Crédito'}
                {transacao.forma_pagamento === 'pix' && 'PIX'}
                {transacao.forma_pagamento === 'transferencia' && 'Transferência'}
                {transacao.forma_pagamento === 'boleto' && 'Boleto'}
              </span>
            )}
          </div>
        </div>
        <span className="text-base font-semibold text-red-400 shrink-0">
          {formatCurrency(transacao.valor)}
        </span>
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={categoria.nome}
      description={`Transações de ${format(parseISO(mesReferencia), 'MMMM yyyy', { locale: ptBR })}`}
      maxWidth={showComparison ? '5xl' : '2xl'}
    >
      {/* Botão comparar */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowComparison(v => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
            showComparison
              ? 'bg-primary-500/20 text-primary-400 border-primary-500/40 hover:bg-primary-500/30'
              : 'bg-dark-800 text-gray-400 border-dark-600 hover:text-gray-200 hover:border-dark-500'
          )}
        >
          <Columns size={13} />
          {showComparison ? 'Ocultar comparação' : 'Comparar mês'}
        </button>
      </div>

      <div className={cn(
        showComparison ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'
      )}>

        {/* ── COLUNA ESQUERDA: mês atual ── */}
        <div className="space-y-6">
          {showComparison && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {format(parseISO(mesReferencia), 'MMMM yyyy', { locale: ptBR })}
            </p>
          )}

          {/* Resumo */}
          <div className="bg-dark-800 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Orçado</span>
              {isEditingBudget ? (
                <div className="flex items-center gap-2">
                  <div className="w-32">
                    <CurrencyInput value={novoValorOrcado} onChange={setNovoValorOrcado} placeholder="R$ 0,00" />
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleSaveEdit} disabled={isSaving} className="p-1 h-8 w-8">
                    <Check size={16} className="text-green-400" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={isSaving} className="p-1 h-8 w-8">
                    <X size={16} className="text-red-400" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-100">{formatCurrency(valorOrcado)}</span>
                  {categoriaBudgetId && canEdit && (
                    <Button size="sm" variant="ghost" onClick={handleStartEdit} className="p-1 h-8 w-8 opacity-60 hover:opacity-100" title="Editar valor orçado">
                      <Edit2 size={14} className="text-gray-400" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Gasto</span>
              <span className="text-lg font-semibold text-red-400">{formatCurrency(valorGasto)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-dark-700">
              <span className="text-sm text-gray-400">Disponível</span>
              <span className={cn('text-lg font-semibold', valorDisponivelAtual >= 0 ? 'text-green-400' : 'text-red-400')}>
                {formatCurrency(valorDisponivelAtual)}
              </span>
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    percentualUsadoAtual < 80 && 'bg-green-500',
                    percentualUsadoAtual >= 80 && percentualUsadoAtual < 100 && 'bg-yellow-500',
                    percentualUsadoAtual >= 100 && 'bg-red-500'
                  )}
                  style={{ width: `${Math.min(percentualUsadoAtual, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{percentualUsadoAtual.toFixed(1)}% usado</span>
                <span>{transacoes.length} transações</span>
              </div>
            </div>
            {isEditingBudget && novoValorOrcado !== valorOrcado && (
              <div className="pt-2 text-xs text-gray-400 flex items-center gap-2">
                <span>Novo disponível:</span>
                <span className={cn('font-medium', (novoValorOrcado - valorGasto) >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {formatCurrency(novoValorOrcado - valorGasto)}
                </span>
              </div>
            )}
          </div>

          {/* Classificação — apenas na coluna do mês atual */}
          {categoriaBudgetId && novaPrioridade && (
            <div className="bg-dark-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-3">Classificação</p>
              <div className="flex gap-2">
                {([
                  { value: 'essencial' as CategoriaPrioridade, label: 'Essencial', activeColor: 'border-red-500 bg-red-500/20 text-red-300 ring-2 ring-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]' },
                  { value: 'importante' as CategoriaPrioridade, label: 'Importante', activeColor: 'border-yellow-500 bg-yellow-500/20 text-yellow-300 ring-2 ring-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.15)]' },
                  { value: 'desejavel' as CategoriaPrioridade, label: 'Desejável', activeColor: 'border-blue-500 bg-blue-500/20 text-blue-300 ring-2 ring-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.15)]' },
                ]).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSavePrioridade(option.value)}
                    disabled={isSavingPrioridade}
                    className={cn(
                      'flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all',
                      novaPrioridade === option.value ? option.activeColor : 'border-dark-600 bg-dark-700 text-gray-500 hover:text-gray-300 hover:border-dark-500',
                      'disabled:opacity-50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                A classificação afeta as sugestões de rebalanceamento entre envelopes
              </p>
            </div>
          )}

          {/* Transações do mês atual */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <TrendingDown size={16} />
              Despesas
            </h3>
            {transacoes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhuma transação nesta categoria</div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {transacoes.map(t => <TransactionCard key={t.id} transacao={t} />)}
              </div>
            )}
          </div>
        </div>

        {/* ── COLUNA DIREITA: mês de comparação ── */}
        {showComparison && (
          <div className="space-y-6 md:border-l md:border-dark-700/50 md:pl-6">
            {/* Seletor de mês */}
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">Comparar com</p>
              <select
                value={mesCmp}
                onChange={e => setMesCmp(e.target.value)}
                className="flex-1 px-2 py-1 bg-dark-700 border border-dark-600 rounded-lg text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {mesCmpOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Resumo do mês de comparação */}
            <div className="bg-dark-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Orçado</span>
                <span className={cn('text-lg font-semibold', cmpValorOrcado > 0 ? 'text-gray-100' : 'text-gray-500')}>
                  {cmpValorOrcado > 0 ? formatCurrency(cmpValorOrcado) : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Gasto</span>
                <span className="text-lg font-semibold text-red-400">{formatCurrency(cmpValorGasto)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-dark-700">
                <span className="text-sm text-gray-400">Disponível</span>
                <span className={cn('text-lg font-semibold', cmpValorDisponivel >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {cmpValorOrcado > 0 ? formatCurrency(cmpValorDisponivel) : '—'}
                </span>
              </div>
              {cmpValorOrcado > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        cmpPercentualUsado < 80 && 'bg-green-500',
                        cmpPercentualUsado >= 80 && cmpPercentualUsado < 100 && 'bg-yellow-500',
                        cmpPercentualUsado >= 100 && 'bg-red-500'
                      )}
                      style={{ width: `${Math.min(cmpPercentualUsado, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{cmpPercentualUsado.toFixed(1)}% usado</span>
                    <span>{cmpTransacoes.length} transações</span>
                  </div>
                </div>
              )}

              {/* Diferença entre meses */}
              {cmpValorGasto > 0 && (
                <div className="pt-2 border-t border-dark-700/50">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Diferença no gasto</span>
                    <span className={cn(
                      'text-sm font-semibold',
                      valorGasto > cmpValorGasto ? 'text-red-400' : 'text-green-400'
                    )}>
                      {valorGasto > cmpValorGasto ? '+' : ''}{formatCurrency(valorGasto - cmpValorGasto)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Transações do mês de comparação */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <TrendingDown size={16} />
                Despesas
              </h3>
              {cmpTransacoes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Nenhuma transação nesta categoria</div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {cmpTransacoes.map(t => <TransactionCard key={t.id} transacao={t} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
