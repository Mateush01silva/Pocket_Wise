import { TrendingDown, TrendingUp, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { useOrcamentosStore } from '../store'
import { useCategoriasStore } from '../store'
import { useTransacoesStore } from '../store'
import { gerarComparativoCategoria, calcularTaxaAderencia } from '../lib/budgetCalculations'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'

interface BudgetComparativeReportProps {
  orcamentoId: string
  className?: string
}

export function BudgetComparativeReport({ orcamentoId, className }: BudgetComparativeReportProps) {
  const orcamentos = useOrcamentosStore((state) => state.orcamentos)
  const categoriasBudget = useOrcamentosStore((state) => state.categoriasBudget)
  const categorias = useCategoriasStore((state) => state.categorias)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)

  const orcamento = orcamentos.find((o) => o.id === orcamentoId)
  if (!orcamento) return null

  const categoriasBudgetDoOrcamento = categoriasBudget.filter((cb) => cb.orcamento_id === orcamentoId)
  const comparativo = gerarComparativoCategoria(
    categoriasBudgetDoOrcamento,
    lancamentos,
    categorias,
    orcamento.mes_referencia
  )
  const taxaAderencia = calcularTaxaAderencia(comparativo)

  // Estatísticas gerais
  const totalOrcado = comparativo.reduce((sum, c) => sum + c.valor_orcado, 0)
  const totalGasto = comparativo.reduce((sum, c) => sum + c.valor_gasto, 0)
  const economiaTotal = totalOrcado - totalGasto

  const categoriasDentro = comparativo.filter((c) => c.status === 'dentro')
  const categoriasAtencao = comparativo.filter((c) => c.status === 'atencao')
  const categoriasEstouradas = comparativo.filter((c) => c.status === 'estourado')

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target size={20} className="text-primary-500" />
            Relatório: Planejado x Realizado
          </CardTitle>
          <div className="text-right">
            <p className="text-xs text-gray-500">Taxa de Aderência</p>
            <p
              className={cn(
                'text-2xl font-bold',
                taxaAderencia >= 80
                  ? 'text-green-400'
                  : taxaAderencia >= 60
                    ? 'text-yellow-400'
                    : 'text-red-400'
              )}
            >
              {taxaAderencia.toFixed(0)}%
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Resumo Geral */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/30">
            <p className="text-xs text-gray-400 mb-1">Dentro do Orçamento</p>
            <p className="text-2xl font-bold text-green-400">{categoriasDentro.length}</p>
          </div>

          <div className="text-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <p className="text-xs text-gray-400 mb-1">Atenção</p>
            <p className="text-2xl font-bold text-yellow-400">{categoriasAtencao.length}</p>
          </div>

          <div className="text-center p-3 bg-red-500/10 rounded-lg border border-red-500/30">
            <p className="text-xs text-gray-400 mb-1">Estouradas</p>
            <p className="text-2xl font-bold text-red-400">{categoriasEstouradas.length}</p>
          </div>
        </div>

        {/* Totais */}
        <div className="space-y-2 p-4 bg-dark-700/30 rounded-lg border border-dark-600">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Orçado:</span>
            <span className="font-medium text-gray-200">{formatCurrency(totalOrcado)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Gasto:</span>
            <span className="font-medium text-gray-200">{formatCurrency(totalGasto)}</span>
          </div>

          <div className="h-px bg-dark-600 my-2" />

          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-200">Economia:</span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'font-bold text-lg',
                  economiaTotal >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {formatCurrency(economiaTotal)}
              </span>
              {economiaTotal >= 0 ? (
                <TrendingDown size={18} className="text-green-400" />
              ) : (
                <TrendingUp size={18} className="text-red-400" />
              )}
            </div>
          </div>
        </div>

        {/* Lista de Categorias */}
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Detalhamento por Categoria</h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {comparativo
              .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))
              .map((comp) => {
                const economia = comp.valor_orcado - comp.valor_gasto

                return (
                  <div
                    key={comp.categoria.id}
                    className="p-3 bg-dark-700/30 rounded-lg border border-dark-600 hover:bg-dark-700/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{comp.categoria.icone}</span>
                        <span className="font-medium text-gray-200">{comp.categoria.nome}</span>
                      </div>

                      <div
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          comp.status === 'dentro' && 'bg-green-500/20 text-green-400',
                          comp.status === 'atencao' && 'bg-yellow-500/20 text-yellow-400',
                          comp.status === 'estourado' && 'bg-red-500/20 text-red-400'
                        )}
                      >
                        {comp.status === 'dentro' && '✓ Dentro'}
                        {comp.status === 'atencao' && '⚠ Atenção'}
                        {comp.status === 'estourado' && '✗ Estourado'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Orçado:</span>
                        <p className="font-medium text-gray-300">{formatCurrency(comp.valor_orcado)}</p>
                      </div>

                      <div>
                        <span className="text-gray-500">Gasto:</span>
                        <p className="font-medium text-gray-300">{formatCurrency(comp.valor_gasto)}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span
                        className={cn(
                          'font-medium',
                          economia >= 0 ? 'text-green-400' : 'text-red-400'
                        )}
                      >
                        {economia >= 0 ? 'Economizou' : 'Excedeu'} {formatCurrency(Math.abs(economia))}
                      </span>
                      <span
                        className={cn(
                          'font-medium',
                          comp.percentual_desvio <= 0 ? 'text-green-400' : 'text-red-400'
                        )}
                      >
                        {comp.percentual_desvio > 0 ? '+' : ''}
                        {comp.percentual_desvio.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
