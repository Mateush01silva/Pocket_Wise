import { useEffect, useState, useRef } from 'react'
import { Filter, TrendingDown, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { EnvelopeCard } from '../components/EnvelopeCard'
import { CategoryTransactionsModal } from '../components/CategoryTransactionsModal'
import { MonthYearSelector } from '../components/MonthYearSelector'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { useTransacoesStore } from '../store/useTransacoesStore'
import { useCategoriasStore } from '../store/useCategoriasStore'
import { formatCurrency } from '../utils/currency'
import type { EnvelopeDigital } from '../types'

type FiltroCategoria = 'todas' | 'essencial' | 'importante' | 'desejavel' | 'estouradas' | 'em_risco'
type OrdenacaoCategoria = 'nome' | 'percentual_desc' | 'percentual_asc' | 'valor_desc'

export function Envelopes() {
  const mesRealAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const [mesAtual, setMesAtual] = useState(mesRealAtual)
  const [filtro, setFiltro] = useState<FiltroCategoria>('todas')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoCategoria>('percentual_desc')
  const [selectedEnvelope, setSelectedEnvelope] = useState<EnvelopeDigital | null>(null)
  const isMounted = useRef(true) // Track if component is mounted

  // Use selectors for each store value/function to keep identities stable
  const orcamentoAtual = useOrcamentosStore((state) => state.orcamentoAtual)
  const isLoading = useOrcamentosStore((state) => state.isLoading)
  const initialize = useOrcamentosStore((state) => state.initialize)
  const initialized = useOrcamentosStore((state) => state.initialized)
  const getEnvelopesDigitais = useOrcamentosStore((state) => state.getEnvelopesDigitais)
  const getOrcamentoDoMes = useOrcamentosStore((state) => state.getOrcamentoDoMes)
  const setOrcamentoAtual = useOrcamentosStore((state) => state.setOrcamentoAtual)
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
      const orcamento = getOrcamentoDoMes(mesAtual)
      if (isMounted.current) {
        setOrcamentoAtual(orcamento || null)
      }
    }

    return () => {
      isMounted.current = false
    }
  }, [initialized, mesAtual, getOrcamentoDoMes, setOrcamentoAtual])

  const handlePreviousMonth = () => {
    const newDate = subMonths(new Date(mesAtual), 1)
    setMesAtual(format(startOfMonth(newDate), 'yyyy-MM-dd'))
  }

  const handleNextMonth = () => {
    const newDate = addMonths(new Date(mesAtual), 1)
    setMesAtual(format(startOfMonth(newDate), 'yyyy-MM-dd'))
  }

  const handleCurrentMonth = () => {
    setMesAtual(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
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
        <div className="text-gray-400">Carregando envelopes...</div>
      </div>
    )
  }

  if (!orcamentoAtual) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Envelopes Digitais</h1>

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
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 text-gray-500" size={48} />
            <h2 className="text-xl font-semibold text-gray-100 mb-2">
              Nenhum orçamento para {format(new Date(mesAtual), 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <p className="text-gray-400 mb-6">
              Crie um orçamento para ver seus envelopes digitais
            </p>
            <Button onClick={() => window.location.href = '/budgets'}>
              Ir para Orçamentos
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const todosEnvelopes = getEnvelopesDigitais(orcamentoAtual.id)

  // Aplicar filtros
  let envelopesFiltrados = todosEnvelopes.filter((env) => {
    if (filtro === 'todas') return true
    if (filtro === 'estouradas') return env.status === 'critico'
    if (filtro === 'em_risco') return env.percentual_usado >= 80
    return env.prioridade === filtro
  })

  // Aplicar ordenação
  envelopesFiltrados = [...envelopesFiltrados].sort((a, b) => {
    switch (ordenacao) {
      case 'nome':
        return a.categoria.nome.localeCompare(b.categoria.nome)
      case 'percentual_desc':
        return b.percentual_usado - a.percentual_usado
      case 'percentual_asc':
        return a.percentual_usado - b.percentual_usado
      case 'valor_desc':
        return b.valor_orcado - a.valor_orcado
      default:
        return 0
    }
  })

  // Estatísticas
  const totalOrcado = todosEnvelopes.reduce((sum, env) => sum + env.valor_orcado, 0)
  const totalGasto = todosEnvelopes.reduce((sum, env) => sum + env.valor_gasto, 0)
  const totalDisponivel = todosEnvelopes.reduce((sum, env) => sum + env.valor_disponivel, 0)
  const percentualGeralUsado = totalOrcado > 0 ? (totalGasto / totalOrcado) * 100 : 0

  const envelopesSaudaveis = todosEnvelopes.filter((e) => e.status === 'saudavel').length
  const envelopesAtencao = todosEnvelopes.filter((e) => e.status === 'atencao').length
  const envelopesCriticos = todosEnvelopes.filter((e) => e.status === 'critico').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Envelopes Digitais</h1>

        {/* Seletor de Mês e Ano */}
        <div className="flex items-center gap-3 mt-2">
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

      {/* Cards de resumo */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Total Orçado</span>
              <TrendingDown size={16} className="text-primary-500" />
            </div>
            <p className="text-2xl font-bold text-gray-100">{formatCurrency(totalOrcado)}</p>
            <p className="text-xs text-gray-500 mt-1">{todosEnvelopes.length} envelopes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Total Gasto</span>
              <TrendingDown size={16} className="text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-400">{formatCurrency(totalGasto)}</p>
            <p className="text-xs text-gray-500 mt-1">{percentualGeralUsado.toFixed(1)}% usado</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Disponível</span>
              <TrendingDown size={16} className="text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(totalDisponivel)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {((totalDisponivel / totalOrcado) * 100).toFixed(1)}% restante
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Saúde Geral</span>
              <Filter size={16} className="text-gray-500" />
            </div>
            <div className="flex gap-2 mt-3">
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-green-400">{envelopesSaudaveis}</p>
                <p className="text-xs text-gray-500">OK</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-yellow-400">{envelopesAtencao}</p>
                <p className="text-xs text-gray-500">Atenção</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-red-400">{envelopesCriticos}</p>
                <p className="text-xs text-gray-500">Crítico</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e ordenação */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <span className="text-sm text-gray-400">Filtrar:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={filtro === 'todas' ? 'primary' : 'ghost'}
                onClick={() => setFiltro('todas')}
              >
                Todas ({todosEnvelopes.length})
              </Button>
              <Button
                size="sm"
                variant={filtro === 'essencial' ? 'primary' : 'ghost'}
                onClick={() => setFiltro('essencial')}
              >
                Essenciais
              </Button>
              <Button
                size="sm"
                variant={filtro === 'importante' ? 'primary' : 'ghost'}
                onClick={() => setFiltro('importante')}
              >
                Importantes
              </Button>
              <Button
                size="sm"
                variant={filtro === 'desejavel' ? 'primary' : 'ghost'}
                onClick={() => setFiltro('desejavel')}
              >
                Desejáveis
              </Button>
              <Button
                size="sm"
                variant={filtro === 'em_risco' ? 'danger' : 'ghost'}
                onClick={() => setFiltro('em_risco')}
              >
                Em Risco (≥80%)
              </Button>
              <Button
                size="sm"
                variant={filtro === 'estouradas' ? 'danger' : 'ghost'}
                onClick={() => setFiltro('estouradas')}
              >
                Estouradas
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-400">Ordenar:</span>
              <Select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as OrdenacaoCategoria)}
                className="w-48"
              >
                <option value="percentual_desc">% Usado (maior)</option>
                <option value="percentual_asc">% Usado (menor)</option>
                <option value="valor_desc">Valor (maior)</option>
                <option value="nome">Nome (A-Z)</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de envelopes */}
      {envelopesFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 text-gray-500" size={48} />
            <h3 className="text-lg font-semibold text-gray-100 mb-2">
              Nenhum envelope encontrado
            </h3>
            <p className="text-gray-400">
              Tente ajustar os filtros para ver mais envelopes
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-gray-400">
            Mostrando {envelopesFiltrados.length} de {todosEnvelopes.length} envelopes
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {envelopesFiltrados.map((envelope) => (
              <EnvelopeCard
                key={envelope.categoria.id}
                envelope={envelope}
                onClick={() => handleEnvelopeClick(envelope)}
              />
            ))}
          </div>
        </>
      )}

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
