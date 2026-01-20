import { useEffect, useState, useRef } from 'react'
import { Plus, Copy, Calendar, Edit2 } from 'lucide-react'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BudgetSummaryCard } from '../components/BudgetSummaryCard'
import { PossoComprarWidget } from '../components/PossoComprarWidget'
import { BudgetPlanningModal } from '../components/BudgetPlanningModal'
import { BudgetAlertsCard } from '../components/BudgetAlertsCard'
import { BudgetComparativeReport } from '../components/BudgetComparativeReport'
import { CategoryTransactionsModal } from '../components/CategoryTransactionsModal'
import { DetectorEstouro } from '../components/DetectorEstouro'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { useTransacoesStore } from '../store/useTransacoesStore'
import { useCategoriasStore } from '../store/useCategoriasStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import { IconRenderer } from '../lib/iconRenderer'
import type { EnvelopeDigital } from '../types'

export function Budgets() {
  // Garantir que sempre inicia no mês atual real
  const mesRealAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const [mesAtual, setMesAtualInterno] = useState(mesRealAtual)

  // Wrapper para logar mudanças
  const setMesAtual = (novoMes: string) => {
    console.log('🎯 setMesAtual CHAMADO:', {
      mesAnterior: mesAtual,
      mesNovo: novoMes,
      stack: new Error().stack?.split('\n')[2] // Mostra quem chamou
    })
    setMesAtualInterno(novoMes)
  }

  const [isCreating, setIsCreating] = useState(false)
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false)
  const [selectedEnvelope, setSelectedEnvelope] = useState<EnvelopeDigital | null>(null)
  const isMounted = useRef(true) // Track if component is mounted

  // Debug: Log do mês atual no console
  useEffect(() => {
    console.log('🔍 DEBUG - Mês Real Atual:', mesRealAtual)
    console.log('🔍 DEBUG - Mês Selecionado:', mesAtual)
  }, [mesAtual, mesRealAtual])

  // Use selectors for each store value/function to keep identities stable
  const orcamentoAtual = useOrcamentosStore((state) => state.orcamentoAtual)
  const getCategoriasBudgetComDados = useOrcamentosStore((state) => state.getCategoriasBudgetComDados)
  const isLoading = useOrcamentosStore((state) => state.isLoading)
  const initialize = useOrcamentosStore((state) => state.initialize)
  const initialized = useOrcamentosStore((state) => state.initialized)
  const orcamentos = useOrcamentosStore((state) => state.orcamentos)
  const getOrcamentoDoMes = useOrcamentosStore((state) => state.getOrcamentoDoMes)
  const getProjecaoMensal = useOrcamentosStore((state) => state.getProjecaoMensal)
  const getEnvelopesDigitais = useOrcamentosStore((state) => state.getEnvelopesDigitais)
  const setOrcamentoAtual = useOrcamentosStore((state) => state.setOrcamentoAtual)
  const copiarOrcamentoMesAnterior = useOrcamentosStore((state) => state.copiarOrcamentoMesAnterior)
  const createOrcamento = useOrcamentosStore((state) => state.createOrcamento)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)

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

    if (initialized) {
      console.log('🔄 useEffect DISPARADO - Buscando orçamento para:', mesAtual)
      console.log('📋 Orçamentos disponíveis no store:', orcamentos.map(o => ({
        id: o.id,
        mes_referencia: o.mes_referencia
      })))

      const orcamento = getOrcamentoDoMes(mesAtual)
      console.log('🔍 Resultado da busca:', orcamento ? {
        id: orcamento.id,
        mes_referencia: orcamento.mes_referencia
      } : 'NENHUM ORÇAMENTO ENCONTRADO')

      if (isMounted.current) {
        setOrcamentoAtual(orcamento || null)
      }
    }

    return () => {
      isMounted.current = false
    }
  }, [initialized, mesAtual, orcamentos, getOrcamentoDoMes, setOrcamentoAtual])

  const handleCurrentMonth = () => {
    setMesAtual(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  }

  const projecao = orcamentoAtual ? getProjecaoMensal(orcamentoAtual.id) : null
  const envelopes = orcamentoAtual ? getEnvelopesDigitais(orcamentoAtual.id) : []
  const categoriasBudgetComDados = orcamentoAtual ? getCategoriasBudgetComDados(orcamentoAtual.id) : []
  const totalOrcado = categoriasBudgetComDados.reduce((sum, cb) => sum + cb.valor_orcado, 0)

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

  const handleCriarDoZero = async () => {
    if (isMounted.current) {
      setIsCreating(true)
    }
    try {
      const novoOrcamento = await createOrcamento({
        family_id: 'local-storage-family',
        mes_referencia: mesAtual,
        meta_poupanca: 0,
        meta_poupanca_percentual: null,
        dia_inicio_ciclo: 1,
        metodo_calculo: 'conservador',
        status: 'ativo',
      })
      if (novoOrcamento && isMounted.current) {
        setOrcamentoAtual(novoOrcamento)
      }
    } catch (error) {
      console.error('Erro ao criar orçamento:', error)
      alert('Erro ao criar orçamento. Tente novamente.')
    } finally {
      if (isMounted.current) {
        setIsCreating(false)
      }
    }
  }

  const handleEnvelopeClick = (envelope: EnvelopeDigital) => {
    setSelectedEnvelope(envelope)
  }

  const handleCloseModal = () => {
    setSelectedEnvelope(null)
  }

  // Filtrar transações do envelope selecionado
  const getEnvelopeTransactions = (envelope: EnvelopeDigital | null) => {
    if (!envelope || !orcamentoAtual) return []

    const anoMes = orcamentoAtual.mes_referencia.substring(0, 7)
    return lancamentos.filter(
      (l) =>
        l.categoria_id === envelope.categoria.id &&
        l.tipo === 'despesa' &&
        l.data.substring(0, 7) === anoMes &&
        l.status === 'pago'
    ).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }

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

          {/* Seletor de Mês e Ano */}
          <div className="flex items-center gap-3 mt-2">
            <MonthYearSelector
              value={mesAtual}
              onChange={setMesAtual}
              hasData={false}
            />
            {mesAtual !== mesRealAtual && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCurrentMonth}
                className="text-xs"
              >
                Hoje
              </Button>
            )}
          </div>
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
              <Button onClick={handleCopiarMesAnterior} isLoading={isCreating} disabled={isCreating}>
                <Copy size={16} className="mr-2" />
                Copiar Mês Anterior
              </Button>
              <Button variant="ghost" onClick={handleCriarDoZero} isLoading={isCreating} disabled={isCreating}>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Orçamentos</h1>

          {/* Seletor de Mês e Ano */}
          <div className="flex items-center gap-3">
            <MonthYearSelector
              value={mesAtual}
              onChange={setMesAtual}
              hasData={!!orcamentoAtual}
            />
            {mesAtual !== mesRealAtual && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCurrentMonth}
                className="text-xs"
              >
                Hoje
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPlanningModalOpen(true)}
          >
            <Edit2 size={16} className="mr-2" />
            Editar Orçamento
          </Button>
        </div>
      </div>

      {/* Grid principal */}
      <div className="space-y-6">
        {/* Linha 1: Resumo + Alertas */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Resumo do orçamento */}
          <div className="lg:col-span-2">
            {projecao && <BudgetSummaryCard projecao={projecao} />}
          </div>

          {/* Alertas */}
          <div>
            <BudgetAlertsCard orcamentoId={orcamentoAtual.id} />
          </div>
        </div>

        {/* Detector de Estouro */}
        <DetectorEstouro
          categoriasBudget={categoriasBudgetComDados}
          orcamentoId={orcamentoAtual.id}
          onRebalanceado={async () => {
            // Recarregar dados após rebalanceamento
            await initialize()
          }}
        />

        {/* Linha 2: Envelopes + Widget */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Coluna esquerda: Envelopes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Envelopes Digitais */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Envelopes Digitais</CardTitle>
                <span className="text-sm text-gray-400">
                  {envelopes.length} categorias • {formatCurrency(totalOrcado)} total
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {envelopes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>Nenhuma categoria orçada ainda.</p>
                  <Button className="mt-4" size="sm" onClick={() => setIsPlanningModalOpen(true)}>
                    <Plus size={16} className="mr-2" />
                    Adicionar Categorias
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {envelopes.map((envelope) => {
                    const { categoria, valor_orcado, valor_gasto, valor_disponivel, percentual_usado, status } = envelope

                    return (
                      <div
                        key={categoria.id}
                        onClick={() => handleEnvelopeClick(envelope)}
                        className="p-4 bg-dark-700/30 rounded-lg hover:bg-dark-700/50 transition-colors border border-dark-600 cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <IconRenderer iconName={categoria.icone} size={24} className="text-gray-300" />
                            <div>
                              <p className="font-medium text-gray-200">{categoria.nome}</p>
                              <p className="text-xs text-gray-500 capitalize">{envelope.prioridade}</p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p
                              className={cn(
                                'font-bold text-lg',
                                valor_disponivel >= 0 ? 'text-green-400' : 'text-red-400'
                              )}
                            >
                              {formatCurrency(valor_disponivel)}
                            </p>
                            <p className="text-xs text-gray-500">disponível</p>
                          </div>
                        </div>

                        {/* Barra de progresso */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">
                              {formatCurrency(valor_gasto)} de {formatCurrency(valor_orcado)}
                            </span>
                            <span
                              className={cn(
                                'font-medium',
                                status === 'saudavel'
                                  ? 'text-green-400'
                                  : status === 'atencao'
                                    ? 'text-yellow-400'
                                    : 'text-red-400'
                              )}
                            >
                              {percentual_usado.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full transition-all duration-300',
                                status === 'saudavel'
                                  ? 'bg-green-500'
                                  : status === 'atencao'
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              )}
                              style={{ width: `${Math.min(percentual_usado, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
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

        {/* Linha 3: Relatório Comparativo */}
        <BudgetComparativeReport orcamentoId={orcamentoAtual.id} />
      </div>

      {/* Modal de Planejamento */}
      <BudgetPlanningModal
        isOpen={isPlanningModalOpen}
        onClose={() => setIsPlanningModalOpen(false)}
        orcamento={orcamentoAtual || undefined}
        mesReferencia={mesAtual}
      />

      {/* Modal de Transações */}
      {selectedEnvelope && orcamentoAtual && (
        <CategoryTransactionsModal
          isOpen={!!selectedEnvelope}
          onClose={handleCloseModal}
          categoria={selectedEnvelope.categoria}
          subcategorias={categorias.filter(c => c.categoria_pai_id === selectedEnvelope.categoria.id)}
          transacoes={getEnvelopeTransactions(selectedEnvelope)}
          mesReferencia={orcamentoAtual.mes_referencia}
          valorOrcado={selectedEnvelope.valor_orcado}
          valorGasto={selectedEnvelope.valor_gasto}
        />
      )}
    </div>
  )
}
