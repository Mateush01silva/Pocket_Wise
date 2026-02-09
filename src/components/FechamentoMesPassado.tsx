import { useState } from 'react'
import { CheckCircle, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react'
import { Button } from './ui'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import type { CategoriaBudgetComRelacoes } from '../types'
import { formatCurrency } from '../utils/currency'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

interface FechamentoMesPassadoProps {
  categoriasBudget: CategoriaBudgetComRelacoes[]
  orcamentoId: string
  mesReferencia: string
  onRebalanceado?: () => void | Promise<void>
}

export function FechamentoMesPassado({
  categoriasBudget,
  orcamentoId,
  mesReferencia,
  onRebalanceado,
}: FechamentoMesPassadoProps) {
  const [isLoading, setIsLoading] = useState(false)
  const updateCategoriaBudget = useOrcamentosStore((state) => state.updateCategoriaBudget)

  // Apenas despesas
  const despesas = categoriasBudget.filter(
    (cat) => cat.categoria?.tipo === 'despesa'
  )

  // Categorias estouradas (gastaram mais que o orçado)
  const categoriasEstouradas = despesas.filter(
    (cat) => cat.valor_disponivel !== undefined && cat.valor_disponivel < 0
  )

  // Categorias com sobra (gastaram menos que o orçado)
  const categoriasComSobra = despesas.filter(
    (cat) => cat.valor_disponivel !== undefined && cat.valor_disponivel > 0
  )

  const totalEstouro = categoriasEstouradas.reduce(
    (sum, cat) => sum + Math.abs(cat.valor_disponivel || 0), 0
  )

  const totalSobra = categoriasComSobra.reduce(
    (sum, cat) => sum + (cat.valor_disponivel || 0), 0
  )

  // Se não há estouros, mês fechou bem
  if (categoriasEstouradas.length === 0) {
    return null
  }

  const mesFormatado = format(parseISO(mesReferencia), 'MMMM yyyy', { locale: ptBR })
  const sobraCobreEstouro = totalSobra >= totalEstouro
  const valorFaltante = Math.max(0, totalEstouro - totalSobra)

  const handleAutoRebalancear = async () => {
    setIsLoading(true)
    try {
      let sobraRestante = totalSobra

      // 1. Para cada categoria estourada, ajustar orçamento para o valor gasto real
      for (const cat of categoriasEstouradas) {
        const valorGasto = cat.valor_gasto || 0
        // O novo orçado é o que foi gasto (para zerar o estouro)
        await updateCategoriaBudget(cat.id, valorGasto)
      }

      // 2. Para cada categoria com sobra, reduzir proporcionalmente
      if (categoriasComSobra.length > 0 && totalEstouro > 0) {
        // Quanto precisamos tirar das sobras (limitado ao total de sobra disponível)
        const totalParaRedistribuir = Math.min(totalEstouro, totalSobra)

        for (const cat of categoriasComSobra) {
          if (sobraRestante <= 0) break

          const sobraCat = cat.valor_disponivel || 0
          // Proporção da sobra desta categoria em relação ao total de sobras
          const proporcao = sobraCat / totalSobra
          const reducao = Math.min(
            sobraCat,
            Math.round(totalParaRedistribuir * proporcao * 100) / 100
          )

          const novoOrcado = cat.valor_orcado - reducao
          await updateCategoriaBudget(cat.id, Math.max(0, novoOrcado))
          sobraRestante -= reducao
        }
      }

      await onRebalanceado?.()

      if (sobraCobreEstouro) {
        toast.success(`Mês de ${mesFormatado} rebalanceado! Todos os envelopes ajustados.`)
      } else {
        toast.success(
          `Rebalanceamento parcial realizado. Ainda faltam ${formatCurrency(valorFaltante)} para cobrir todos os estouros.`
        )
      }
    } catch (error) {
      console.error('Erro ao auto-rebalancear:', error)
      toast.error('Erro ao rebalancear mês passado')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-5">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="text-amber-400 mt-0.5 flex-shrink-0" size={22} />
        <div className="flex-1">
          <h3 className="text-amber-400 font-semibold text-base mb-1">
            {mesFormatado} - Envelopes com estouro
          </h3>
          <p className="text-gray-400 text-sm">
            {categoriasEstouradas.length} envelope(s) estouraram neste mês que já passou.
            Rebalanceie automaticamente para ajustar os orçamentos ao gasto real.
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-red-500/10 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Total Estourado</p>
          <p className="text-lg font-bold text-red-400">{formatCurrency(totalEstouro)}</p>
          <p className="text-xs text-gray-500">{categoriasEstouradas.length} envelope(s)</p>
        </div>
        <div className="bg-green-500/10 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Sobra Disponível</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totalSobra)}</p>
          <p className="text-xs text-gray-500">{categoriasComSobra.length} envelope(s)</p>
        </div>
        <div className={`${sobraCobreEstouro ? 'bg-green-500/10' : 'bg-red-500/10'} rounded-lg p-3 text-center`}>
          <p className="text-xs text-gray-400 mb-1">
            {sobraCobreEstouro ? 'Saldo após ajuste' : 'Ainda faltará'}
          </p>
          <p className={`text-lg font-bold ${sobraCobreEstouro ? 'text-green-400' : 'text-red-400'}`}>
            {sobraCobreEstouro
              ? formatCurrency(totalSobra - totalEstouro)
              : formatCurrency(valorFaltante)
            }
          </p>
          <p className="text-xs text-gray-500">
            {sobraCobreEstouro ? 'Cobre tudo' : 'Edite o orçamento'}
          </p>
        </div>
      </div>

      {/* Lista de estouros com transferências */}
      <div className="space-y-2 mb-4">
        {categoriasEstouradas.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 bg-dark-800/50 rounded-lg px-3 py-2 text-sm">
            <span className="text-gray-300 flex-1 truncate">{cat.categoria?.nome}</span>
            <span className="text-gray-500">
              {formatCurrency(cat.valor_orcado)} <ArrowRight size={12} className="inline mx-1" /> {formatCurrency(cat.valor_gasto || 0)}
            </span>
            <span className="text-red-400 font-medium whitespace-nowrap">
              +{formatCurrency(Math.abs(cat.valor_disponivel || 0))}
            </span>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleAutoRebalancear}
          isLoading={isLoading}
          className="flex-shrink-0"
        >
          <RefreshCw size={16} className="mr-2" />
          Auto-Rebalancear
        </Button>

        {!sobraCobreEstouro && (
          <p className="text-xs text-amber-400">
            A sobra dos outros envelopes não cobre todo o estouro.
            Após o rebalanceamento, edite o orçamento deste mês para ajustar os valores.
          </p>
        )}
      </div>
    </div>
  )
}
