import { useEffect, useState, useRef } from 'react'
import { Filter, TrendingDown, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { EnvelopeCard } from '../components/EnvelopeCard'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { formatCurrency } from '../utils/currency'

type FiltroCategoria = 'todas' | 'essencial' | 'importante' | 'desejavel' | 'estouradas' | 'em_risco'
type OrdenacaoCategoria = 'nome' | 'percentual_desc' | 'percentual_asc' | 'valor_desc'

export function Envelopes() {
  const [filtro, setFiltro] = useState<FiltroCategoria>('todas')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoCategoria>('percentual_desc')
  const isMounted = useRef(true) // Track if component is mounted

  const {
    orcamentoAtual,
    isLoading,
    initialize,
    initialized,
    getEnvelopesDigitais,
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
          <p className="text-gray-400">Visualize seus gastos por categoria</p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 text-gray-500" size={48} />
            <h2 className="text-xl font-semibold text-gray-100 mb-2">
              Nenhum orçamento ativo
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
        <p className="text-gray-400">
          {format(new Date(orcamentoAtual.mes_referencia), 'MMMM yyyy', { locale: ptBR })}
        </p>
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
              <EnvelopeCard key={envelope.categoria.id} envelope={envelope} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
