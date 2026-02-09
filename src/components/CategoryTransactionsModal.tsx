import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { CurrencyInput } from './ui/CurrencyInput'
import { formatCurrency } from '../utils/currency'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Lancamento, Categoria, CategoriaPrioridade } from '../types'
import { TrendingDown, Calendar, Edit2, Check, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { useOrcamentosStore } from '../store'

interface CategoryTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  categoria: Categoria
  subcategorias: Categoria[]
  transacoes: Lancamento[]
  mesReferencia: string
  valorOrcado: number
  valorGasto: number
  categoriaBudgetId?: string  // ID da categoria budget para permitir edição
  prioridade?: CategoriaPrioridade // Prioridade atual do envelope
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
}: CategoryTransactionsModalProps) {
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [novoValorOrcado, setNovoValorOrcado] = useState(valorOrcado)
  const [novaPrioridade, setNovaPrioridade] = useState<CategoriaPrioridade | undefined>(prioridade)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingPrioridade, setIsSavingPrioridade] = useState(false)

  const updateCategoriaBudget = useOrcamentosStore((state) => state.updateCategoriaBudget)

  const getSubcategoriaNome = (subcategoriaId: string | null | undefined) => {
    if (!subcategoriaId) return null
    const subcat = subcategorias.find(s => s.id === subcategoriaId)
    return subcat?.nome
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
      alert('Erro ao atualizar o orçamento. Tente novamente.')
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
      alert('Erro ao atualizar a classificação. Tente novamente.')
    } finally {
      setIsSavingPrioridade(false)
    }
  }

  // Recalcular valores quando o orçamento for editado
  const valorOrcadoAtual = isEditingBudget ? novoValorOrcado : valorOrcado
  const percentualUsadoAtual = valorOrcadoAtual > 0 ? (valorGasto / valorOrcadoAtual) * 100 : 0
  const valorDisponivelAtual = valorOrcadoAtual - valorGasto

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={categoria.nome}
      description={`Transações de ${format(new Date(mesReferencia), 'MMMM yyyy', { locale: ptBR })}`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Resumo */}
        <div className="bg-dark-800 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Orçado</span>
            {isEditingBudget ? (
              <div className="flex items-center gap-2">
                <div className="w-32">
                  <CurrencyInput
                    value={novoValorOrcado}
                    onChange={setNovoValorOrcado}
                    placeholder="R$ 0,00"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="p-1 h-8 w-8"
                >
                  <Check size={16} className="text-green-400" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="p-1 h-8 w-8"
                >
                  <X size={16} className="text-red-400" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-100">
                  {formatCurrency(valorOrcado)}
                </span>
                {categoriaBudgetId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStartEdit}
                    className="p-1 h-8 w-8 opacity-60 hover:opacity-100"
                    title="Editar valor orçado"
                  >
                    <Edit2 size={14} className="text-gray-400" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Gasto</span>
            <span className="text-lg font-semibold text-red-400">
              {formatCurrency(valorGasto)}
            </span>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-dark-700">
            <span className="text-sm text-gray-400">Disponível</span>
            <span
              className={cn(
                'text-lg font-semibold',
                valorDisponivelAtual >= 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {formatCurrency(valorDisponivelAtual)}
            </span>
          </div>

          {/* Barra de progresso */}
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

          {/* Feedback ao editar */}
          {isEditingBudget && novoValorOrcado !== valorOrcado && (
            <div className="pt-2 text-xs text-gray-400 flex items-center gap-2">
              <span>Novo disponível:</span>
              <span className={cn(
                'font-medium',
                (novoValorOrcado - valorGasto) >= 0 ? 'text-green-400' : 'text-red-400'
              )}>
                {formatCurrency(novoValorOrcado - valorGasto)}
              </span>
            </div>
          )}
        </div>

        {/* Classificação / Prioridade */}
        {categoriaBudgetId && novaPrioridade && (
          <div className="bg-dark-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-3">Classificação</p>
            <div className="flex gap-2">
              {([
                { value: 'essencial' as CategoriaPrioridade, label: 'Essencial', color: 'border-red-500 bg-red-500/10 text-red-400', activeColor: 'border-red-500 bg-red-500/20 text-red-300 ring-2 ring-red-500/50' },
                { value: 'importante' as CategoriaPrioridade, label: 'Importante', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-400', activeColor: 'border-yellow-500 bg-yellow-500/20 text-yellow-300 ring-2 ring-yellow-500/50' },
                { value: 'desejavel' as CategoriaPrioridade, label: 'Desejável', color: 'border-blue-500 bg-blue-500/10 text-blue-400', activeColor: 'border-blue-500 bg-blue-500/20 text-blue-300 ring-2 ring-blue-500/50' },
              ]).map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSavePrioridade(option.value)}
                  disabled={isSavingPrioridade}
                  className={cn(
                    'flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all',
                    novaPrioridade === option.value ? option.activeColor : option.color,
                    'hover:opacity-80 disabled:opacity-50'
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

        {/* Lista de Transações */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <TrendingDown size={16} />
            Despesas
          </h3>

          {transacoes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma transação nesta categoria
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {transacoes.map((transacao) => (
                <div
                  key={transacao.id}
                  className="bg-dark-800 rounded-lg p-4 hover:bg-dark-700 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-100 font-medium">
                          {transacao.observacao || `Despesa em ${categoria.nome}`}
                        </p>
                        {getSubcategoriaNome(transacao.subcategoria_id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30">
                            {getSubcategoriaNome(transacao.subcategoria_id)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Calendar size={12} className="text-gray-500" />
                        <span className="text-xs text-gray-500">
                          {format(parseISO(transacao.data), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            transacao.status === 'pago' && 'bg-green-500/20 text-green-400',
                            transacao.status === 'pendente' && 'bg-yellow-500/20 text-yellow-400',
                            transacao.status === 'projetado' && 'bg-blue-500/20 text-blue-400'
                          )}
                        >
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
                    <span className="text-lg font-semibold text-red-400 ml-4">
                      {formatCurrency(transacao.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
