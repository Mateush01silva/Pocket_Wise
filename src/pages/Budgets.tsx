import { useEffect, useState, useRef } from 'react'
import { Plus, Copy, Calendar } from 'lucide-react'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BudgetSummaryCard } from '../components/BudgetSummaryCard'
import { PossoComprarWidget } from '../components/PossoComprarWidget'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'

export function Budgets() {
  const [mesAtual] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [isCreating, setIsCreating] = useState(false)
  const isMounted = useRef(true) // Track if component is mounted

  const {
    orcamentoAtual,
    categoriasBudget,
    isLoading,
    initialize,
    initialized,
    getOrcamentoDoMes,
    getProjecaoMensal,
    setOrcamentoAtual,
    copiarOrcamentoMesAnterior,
  } = useOrcamentosStore()

  useEffect(() => {
    isMounted.current = true

    if (!initialized) {
      initialize()
    }

    return () => {
      isMounted.current = false
    }
  }, [initialized, initialize])

  useEffect(() => {
    isMounted.current = true

    if (initialized && !orcamentoAtual) {
      const orcamento = getOrcamentoDoMes(mesAtual)
      if (orcamento && isMounted.current) {
        setOrcamentoAtual(orcamento)
      }
    }

    return () => {
      isMounted.current = false
    }
  }, [initialized, orcamentoAtual, mesAtual, getOrcamentoDoMes, setOrcamentoAtual])

  const projecao = orcamentoAtual ? getProjecaoMensal(orcamentoAtual.id) : null

  const handleCopiarMesAnterior = async () => {
    if (isMounted.current) {
      setIsCreating(true)
    }
    try {
      const novoOrcamento = await copiarOrcamentoMesAnterior(mesAtual)
      if (novoOrcamento && isMounted.current) {
        setOrcamentoAtual(novoOrcamento)
      }
    } finally {
      if (isMounted.current) {
        setIsCreating(false)
      }
    }
  }

  const totalOrcado = categoriasBudget.reduce((sum, cb) => sum + cb.valor_orcado, 0)

  if (isLoading || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Carregando orçamentos...</div>
      </div>
    )
  }

  // Se não tem orçamento para o mês atual
  if (!orcamentoAtual) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Orçamentos</h1>
          <p className="text-gray-400">Planeje e acompanhe seus gastos mensais</p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-12 text-center space-y-6">
            <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto">
              <Calendar className="text-primary-500" size={32} />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">
                Nenhum orçamento para {format(new Date(mesAtual), 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <p className="text-gray-400">
                Crie seu primeiro orçamento ou copie do mês anterior para começar a controlar seus
                gastos.
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={handleCopiarMesAnterior} isLoading={isCreating}>
                <Copy size={16} className="mr-2" />
                Copiar Mês Anterior
              </Button>
              <Button variant="ghost">
                <Plus size={16} className="mr-2" />
                Criar do Zero
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Orçamentos</h1>
          <p className="text-gray-400">
            {format(new Date(orcamentoAtual.mes_referencia), 'MMMM yyyy', { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <Calendar size={16} className="mr-2" />
            Mudar Mês
          </Button>
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            Novo Orçamento
          </Button>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: Resumo e Categorias */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resumo do orçamento */}
          {projecao && <BudgetSummaryCard projecao={projecao} />}

          {/* Lista de categorias com orçamento */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Categorias Orçadas</CardTitle>
                <span className="text-sm text-gray-400">
                  {categoriasBudget.length} categorias • {formatCurrency(totalOrcado)} total
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {categoriasBudget.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>Nenhuma categoria orçada ainda.</p>
                  <Button className="mt-4" size="sm">
                    Adicionar Categorias
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {categoriasBudget.slice(0, 10).map((cb) => (
                    <div
                      key={cb.id}
                      className="flex justify-between items-center p-3 bg-dark-700/30 rounded-lg hover:bg-dark-700/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-200">Categoria #{cb.categoria_id.slice(0, 8)}</p>
                        <p className="text-xs text-gray-500 capitalize">{cb.prioridade}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-primary-400">{formatCurrency(cb.valor_orcado)}</p>
                      </div>
                    </div>
                  ))}
                  {categoriasBudget.length > 10 && (
                    <button className="w-full text-center py-2 text-sm text-gray-400 hover:text-gray-300">
                      Ver todas ({categoriasBudget.length})
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna direita: Widget Posso Comprar */}
        <div className="space-y-6">
          <PossoComprarWidget orcamentoId={orcamentoAtual.id} />

          {/* Card de meta de poupança */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meta de Poupança</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Meta mensal:</span>
                  <span className="font-medium text-green-400">
                    {formatCurrency(orcamentoAtual.meta_poupanca)}
                  </span>
                </div>
                {orcamentoAtual.meta_poupanca_percentual && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Percentual:</span>
                    <span className="font-medium text-gray-200">
                      {orcamentoAtual.meta_poupanca_percentual}%
                    </span>
                  </div>
                )}
                {projecao && (
                  <div className="pt-3 border-t border-dark-700">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Projeção:</span>
                      <span
                        className={cn(
                          'font-medium',
                          projecao.saldo_projetado_fim_mes >= orcamentoAtual.meta_poupanca
                            ? 'text-green-400'
                            : 'text-yellow-400'
                        )}
                      >
                        {formatCurrency(projecao.saldo_projetado_fim_mes)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
