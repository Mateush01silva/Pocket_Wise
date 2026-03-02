import { useState, useEffect, useMemo } from 'react'
import {
  PiggyBank, Plus, Target, TrendingUp, TrendingDown, Wallet,
  Edit2, Trash2, ArrowUpCircle, ArrowDownCircle, History,
  RefreshCw, AlertCircle, BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui'
import { CaixinhaModal } from '../components/CaixinhaModal'
import { MovimentarCaixinhaModal } from '../components/MovimentarCaixinhaModal'
import { HistoricoCaixinhaModal } from '../components/HistoricoCaixinhaModal'
import { AtualizarCotacaoModal } from '../components/AtualizarCotacaoModal'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { usePermissions } from '../hooks/usePermissions'
import { useTransacoesStore } from '../store'
import { formatCurrency } from '../utils/currency'
import { format, differenceInDays, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { LearningTooltip } from '../components/ui/LearningTooltip'
import { learningContent } from '../lib/learningContent'
import { calcularSaldoAcumuladoNaoAlocado } from '../lib/financialCalculations'
import type { Caixinha, CaixinhaComDetalhes } from '../types'

const SUBTIPO_LABELS: Record<string, string> = {
  renda_fixa: '🏦 Renda Fixa',
  renda_variavel: '📊 Renda Variável',
  fii: '🏢 FII',
  cripto: '🪙 Cripto',
  internacional: '🌎 Internacional',
  outro: '💼 Outro',
}

export function Caixinhas() {
  const { canEdit } = usePermissions()
  const {
    caixinhas,
    summary,
    isLoadingCaixinhas,
    initialize,
    deleteCaixinha,
    getCaixinhaById,
    fetchTransacoes: fetchTransacoesCaixinha,
    todasTransacoesFamily,
    fetchAllTransacoesFamily,
  } = useCaixinhasStore()

  const lancamentos = useTransacoesStore((state) => state.lancamentos)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCaixinha, setEditingCaixinha] = useState<Caixinha | undefined>()
  const [movimentarCaixinha, setMovimentarCaixinha] = useState<CaixinhaComDetalhes | null>(null)
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'deposito' | 'retirada'>('deposito')
  const [historicoCaixinha, setHistoricoCaixinha] = useState<CaixinhaComDetalhes | null>(null)
  const [cotacaoCaixinha, setCotacaoCaixinha] = useState<CaixinhaComDetalhes | null>(null)
  const [isConcluindoMeta, setIsConcluindoMeta] = useState(false)

  const { totalDisponivel: saldoDisponivelParaDeposito, mesesComSaldo } = useMemo(() => {
    return calcularSaldoAcumuladoNaoAlocado(lancamentos, todasTransacoesFamily)
  }, [lancamentos, todasTransacoesFamily])

  // Separar caixinhas por tipo
  const caixinhasInvestimento = useMemo(
    () => caixinhas.filter((c) => c.tipo === 'investimento'),
    [caixinhas]
  )
  const caixinhasOutras = useMemo(
    () => caixinhas.filter((c) => c.tipo !== 'investimento'),
    [caixinhas]
  )

  useEffect(() => {
    initialize()
  }, [initialize])

  // Buscar transações de todas as caixinhas ativas (para histórico)
  useEffect(() => {
    if (caixinhas.length > 0) {
      caixinhas
        .filter(c => c.ativa)
        .forEach(c => {
          fetchTransacoesCaixinha(c.id).catch(err => {
            console.error('Erro ao buscar transações da caixinha:', err)
          })
        })
    }
  }, [caixinhas, fetchTransacoesCaixinha])

  // Buscar todas as transações da família (incl. inativas) para cálculo de saldo
  useEffect(() => {
    fetchAllTransacoesFamily().catch(err => {
      console.error('Erro ao buscar transações da família:', err)
    })
  }, [fetchAllTransacoesFamily])

  const handleEdit = (caixinha: Caixinha) => {
    setEditingCaixinha(caixinha)
    setIsModalOpen(true)
  }

  const handleDelete = async (caixinha: Caixinha) => {
    if (caixinha.saldo_atual > 0) {
      toast.error(`Não é possível deletar. Caixinha possui saldo de ${formatCurrency(caixinha.saldo_atual)}`)
      return
    }
    if (!confirm(`Deseja realmente deletar a caixinha "${caixinha.nome}"?`)) return
    const success = await deleteCaixinha(caixinha.id)
    if (success) {
      toast.success('Caixinha deletada com sucesso')
    } else {
      toast.error('Erro ao deletar caixinha')
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCaixinha(undefined)
  }

  const handleDepositar = (caixinha: CaixinhaComDetalhes) => {
    setMovimentarCaixinha(caixinha)
    setTipoMovimentacao('deposito')
  }

  const handleRetirar = (caixinha: CaixinhaComDetalhes) => {
    setMovimentarCaixinha(caixinha)
    setTipoMovimentacao('retirada')
  }

  const handleConcluirMeta = (caixinha: CaixinhaComDetalhes) => {
    if (!confirm(`🎉 Parabéns! Sua meta "${caixinha.nome}" foi concluída!\n\nPara arquivar esta caixinha, retire o saldo disponível (${formatCurrency(caixinha.saldo_atual)}) no próximo passo.`)) return
    setIsConcluindoMeta(true)
    setMovimentarCaixinha(caixinha)
    setTipoMovimentacao('retirada')
  }

  const handleConcluirMetaSuccess = async () => {
    if (!movimentarCaixinha) return
    // Pegar saldo atualizado do store após a retirada
    const caixinhaAtualizada = getCaixinhaById(movimentarCaixinha.id)
    if (caixinhaAtualizada && caixinhaAtualizada.saldo_atual === 0) {
      const success = await deleteCaixinha(caixinhaAtualizada.id)
      if (success) {
        toast.success(`🎉 Meta "${movimentarCaixinha.nome}" concluída e arquivada com sucesso!`)
      }
    } else if (!caixinhaAtualizada || caixinhaAtualizada.saldo_atual === 0) {
      // Caixinha não encontrada no store mas pode ter sido atualizada — tenta deletar mesmo assim
      await deleteCaixinha(movimentarCaixinha.id)
      toast.success(`🎉 Meta "${movimentarCaixinha.nome}" concluída e arquivada com sucesso!`)
    }
    setIsConcluindoMeta(false)
    setMovimentarCaixinha(null)
  }

  const handleCloseMovimentar = () => {
    setIsConcluindoMeta(false)
    setMovimentarCaixinha(null)
  }

  const handleHistorico = (caixinha: CaixinhaComDetalhes) => setHistoricoCaixinha(caixinha)
  const handleCloseHistorico = () => setHistoricoCaixinha(null)

  const handleAtualizarCotacao = (caixinha: CaixinhaComDetalhes) => setCotacaoCaixinha(caixinha)
  const handleCloseCotacao = () => setCotacaoCaixinha(null)

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'objetivo': return '🎯 Objetivo'
      case 'emergencia': return '🏥 Emergência'
      case 'investimento': return '📈 Investimento'
      default: return tipo
    }
  }

  const getProgressColor = (percentual: number) => {
    if (percentual >= 100) return 'bg-green-500'
    if (percentual >= 75) return 'bg-blue-500'
    if (percentual >= 50) return 'bg-yellow-500'
    return 'bg-gray-500'
  }

  // Verifica se a cotação está desatualizada (foi feito aporte após a última cotação)
  const isCotacaoDesatualizada = (caixinha: CaixinhaComDetalhes) => {
    if (!caixinha.data_valor_mercado) return false
    return caixinha.updated_at > caixinha.data_valor_mercado
  }

  // Métricas de investimento (para o painel de resumo)
  const hasInvestimentos = caixinhasInvestimento.length > 0
  const investimentosComCotacao = caixinhasInvestimento.filter(c => c.valor_mercado !== null)

  return (
    <>
      <CaixinhaModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingCaixinha={editingCaixinha}
      />

      {historicoCaixinha && (
        <HistoricoCaixinhaModal
          isOpen={true}
          onClose={handleCloseHistorico}
          caixinha={historicoCaixinha}
          canEdit={canEdit}
        />
      )}

      {movimentarCaixinha && (
        <MovimentarCaixinhaModal
          isOpen={true}
          onClose={handleCloseMovimentar}
          caixinha={movimentarCaixinha}
          tipo={tipoMovimentacao}
          saldoDisponivelParaDeposito={saldoDisponivelParaDeposito}
          mesesComSaldo={mesesComSaldo}
          onSuccess={isConcluindoMeta ? handleConcluirMetaSuccess : undefined}
        />
      )}

      {cotacaoCaixinha && (
        <AtualizarCotacaoModal
          isOpen={true}
          onClose={handleCloseCotacao}
          caixinha={cotacaoCaixinha}
        />
      )}

      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Caixinhas</h1>
            <p className="text-gray-400">Gerencie seus objetivos financeiros e investimentos</p>
          </div>
          {canEdit && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus size={16} className="mr-2" />
              Nova Caixinha
            </Button>
          )}
        </div>

        {/* Summary Cards — Geral */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <LearningTooltip content={learningContent.caixinhaTotalGuardado} position="bottom">
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Total Guardado</p>
                      <p className="text-2xl font-bold text-primary-400">
                        {formatCurrency(summary.total_guardado)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-primary-500/10 rounded-full flex items-center justify-center">
                      <PiggyBank className="text-primary-500" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </LearningTooltip>

            <LearningTooltip content={learningContent.caixinhaMetaTotal} position="bottom">
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Meta Total</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {formatCurrency(summary.total_metas)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                      <Target className="text-blue-500" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </LearningTooltip>

            <LearningTooltip content={learningContent.caixinhaProgressoGeral} position="bottom">
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Progresso Médio</p>
                      <p className="text-2xl font-bold text-green-400">
                        {summary.progresso_geral.toFixed(1)}%
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                      <TrendingUp className="text-green-500" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </LearningTooltip>

            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Caixinhas Ativas</p>
                    <p className="text-2xl font-bold text-gray-100">
                      {summary.caixinhas_ativas}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
                    <Wallet className="text-yellow-500" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Painel de Investimentos — exibido apenas se houver caixinhas de investimento */}
        {hasInvestimentos && summary && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={20} className="text-primary-400" />
              <h2 className="text-xl font-bold text-gray-100">Carteira de Investimentos</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Total Investido */}
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm text-gray-400 mb-1">Total Aportado</p>
                  <p className="text-2xl font-bold text-gray-100">
                    {formatCurrency(summary.total_investido)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {caixinhasInvestimento.length} posição(ões)
                  </p>
                </CardContent>
              </Card>

              {/* Valor de Mercado */}
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm text-gray-400 mb-1">Valor de Mercado</p>
                  {investimentosComCotacao.length > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-primary-400">
                        {formatCurrency(summary.total_valor_mercado)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {investimentosComCotacao.length} de {caixinhasInvestimento.length} com cotação
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-gray-500">—</p>
                      <p className="text-xs text-yellow-600 mt-1">Nenhuma cotação registrada</p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Rentabilidade Total */}
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm text-gray-400 mb-1">Rentabilidade</p>
                  {investimentosComCotacao.length > 0 ? (
                    <>
                      <p className={`text-2xl font-bold ${
                        summary.rentabilidade_total > 0
                          ? 'text-green-400'
                          : summary.rentabilidade_total < 0
                          ? 'text-red-400'
                          : 'text-gray-400'
                      }`}>
                        {summary.rentabilidade_total > 0 ? '+' : ''}
                        {formatCurrency(summary.rentabilidade_total)}
                      </p>
                      {summary.rentabilidade_percentual !== null && (
                        <p className={`text-xs mt-1 font-medium ${
                          summary.rentabilidade_percentual > 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {summary.rentabilidade_percentual > 0 ? '+' : ''}
                          {summary.rentabilidade_percentual.toFixed(2)}%
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-gray-500">—</p>
                      <p className="text-xs text-gray-600 mt-1">Atualize as cotações</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Lista de Caixinhas de Investimento */}
        {caixinhasInvestimento.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
              📈 Investimentos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {caixinhasInvestimento.map((caixinha) => {
                const rentabilidade = caixinha.valor_mercado !== null
                  ? caixinha.valor_mercado - caixinha.saldo_atual
                  : null
                const rentabilidadePercent = rentabilidade !== null && caixinha.saldo_atual > 0
                  ? (rentabilidade / caixinha.saldo_atual) * 100
                  : null
                const cotacaoDesatualizada = isCotacaoDesatualizada(caixinha)

                return (
                  <Card key={caixinha.id} style={{ borderLeft: `4px solid ${caixinha.cor}` }}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{caixinha.icone}</span>
                          <div>
                            <CardTitle className="text-base">{caixinha.nome}</CardTitle>
                            <p className="text-xs text-gray-500">
                              {caixinha.subtipo_investimento
                                ? SUBTIPO_LABELS[caixinha.subtipo_investimento]
                                : getTipoLabel(caixinha.tipo)}
                            </p>
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEdit(caixinha)}
                              className="text-gray-400 hover:text-primary-400 p-1"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(caixinha)}
                              className="text-gray-400 hover:text-red-400 p-1"
                              title="Deletar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="space-y-3">
                        {/* Grid: Aportado | Valor Mercado */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-dark-700 rounded p-2">
                            <p className="text-xs text-gray-500 mb-0.5">Aportado</p>
                            <p className="text-sm font-semibold text-gray-200">
                              {formatCurrency(caixinha.saldo_atual)}
                            </p>
                          </div>
                          <div className="bg-dark-700 rounded p-2">
                            <p className="text-xs text-gray-500 mb-0.5">Valor Mercado</p>
                            {caixinha.valor_mercado !== null ? (
                              <p className="text-sm font-semibold text-primary-400">
                                {formatCurrency(caixinha.valor_mercado)}
                              </p>
                            ) : (
                              <p className="text-xs text-yellow-600 font-medium mt-0.5">Não atualizado</p>
                            )}
                          </div>
                        </div>

                        {/* Rentabilidade */}
                        {rentabilidade !== null && (
                          <div className={`flex items-center justify-between rounded p-2 ${
                            rentabilidade > 0
                              ? 'bg-green-500/10'
                              : rentabilidade < 0
                              ? 'bg-red-500/10'
                              : 'bg-dark-700'
                          }`}>
                            <div className="flex items-center gap-1">
                              {rentabilidade > 0
                                ? <TrendingUp size={14} className="text-green-400" />
                                : rentabilidade < 0
                                ? <TrendingDown size={14} className="text-red-400" />
                                : <span className="text-gray-500 text-xs">—</span>
                              }
                              <span className="text-xs text-gray-400">Rentabilidade</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-bold ${
                                rentabilidade > 0 ? 'text-green-400' : rentabilidade < 0 ? 'text-red-400' : 'text-gray-400'
                              }`}>
                                {rentabilidade > 0 ? '+' : ''}{formatCurrency(rentabilidade)}
                              </span>
                              {rentabilidadePercent !== null && (
                                <span className={`text-xs ml-1 ${
                                  rentabilidadePercent > 0 ? 'text-green-500' : 'text-red-500'
                                }`}>
                                  ({rentabilidadePercent > 0 ? '+' : ''}{rentabilidadePercent.toFixed(2)}%)
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Alerta cotação desatualizada */}
                        {cotacaoDesatualizada && (
                          <div className="flex items-center gap-1.5 text-yellow-500">
                            <AlertCircle size={12} />
                            <span className="text-xs">Cotação desatualizada (aporte recente)</span>
                          </div>
                        )}

                        {/* Data última cotação */}
                        {caixinha.data_valor_mercado && !cotacaoDesatualizada && (
                          <p className="text-xs text-gray-600">
                            Atualizado {formatDistanceToNow(new Date(caixinha.data_valor_mercado), { locale: ptBR, addSuffix: true })}
                          </p>
                        )}

                        {/* Meta (se tiver) */}
                        {caixinha.meta_valor && (
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Meta: {formatCurrency(caixinha.meta_valor)}</span>
                              <span>{((caixinha.saldo_atual / caixinha.meta_valor) * 100).toFixed(1)}% aportado</span>
                            </div>
                            <div className="w-full bg-dark-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-primary-500 transition-all"
                                style={{ width: `${Math.min((caixinha.saldo_atual / caixinha.meta_valor) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {canEdit && (
                          <div className="space-y-2 pt-1">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1"
                                onClick={() => handleDepositar(caixinha)}
                              >
                                <ArrowUpCircle size={14} className="mr-1" />
                                Aportar
                              </Button>
                              {caixinha.saldo_atual > 0 && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="flex-1"
                                  onClick={() => handleRetirar(caixinha)}
                                >
                                  <ArrowDownCircle size={14} className="mr-1" />
                                  Retirar
                                </Button>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={!caixinha.valor_mercado || cotacaoDesatualizada ? 'primary' : 'secondary'}
                              className="w-full"
                              onClick={() => handleAtualizarCotacao(caixinha)}
                            >
                              <RefreshCw size={14} className="mr-1" />
                              Atualizar Cotação
                            </Button>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-gray-500 hover:text-gray-300"
                          onClick={() => handleHistorico(caixinha)}
                        >
                          <History size={14} className="mr-1" />
                          Histórico / Desfazer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Lista de Outras Caixinhas (objetivo + emergência) */}
        {caixinhasOutras.length > 0 && (
          <div>
            {hasInvestimentos && (
              <h2 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                🎯 Objetivos & Reservas
              </h2>
            )}
            {!hasInvestimentos && (
              <h2 className="text-xl font-bold text-gray-100 mb-4">Minhas Caixinhas</h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {caixinhasOutras.map((caixinha) => {
                const progresso = caixinha.progresso_percentual || 0
                const progressoWidth = Math.min(progresso, 100)

                return (
                  <Card key={caixinha.id} style={{ borderLeft: `4px solid ${caixinha.cor}` }}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{caixinha.icone}</span>
                          <div>
                            <CardTitle className="text-base">{caixinha.nome}</CardTitle>
                            <p className="text-xs text-gray-500">{getTipoLabel(caixinha.tipo)}</p>
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEdit(caixinha)}
                              className="text-gray-400 hover:text-primary-400 p-1"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(caixinha)}
                              className="text-gray-400 hover:text-red-400 p-1"
                              title="Deletar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Saldo */}
                        <div>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm text-gray-400">Saldo Atual</span>
                            <span className="text-xl font-bold text-primary-400">
                              {formatCurrency(caixinha.saldo_atual)}
                            </span>
                          </div>
                          {caixinha.meta_valor && (
                            <div className="flex justify-between items-baseline text-xs text-gray-500">
                              <span>Meta: {formatCurrency(caixinha.meta_valor)}</span>
                              <span>{progresso.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {caixinha.meta_valor && (
                          <div className="w-full bg-dark-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${getProgressColor(progresso)}`}
                              style={{ width: `${progressoWidth}%` }}
                            />
                          </div>
                        )}

                        {caixinha.valor_faltante !== null && caixinha.valor_faltante > 0 && (
                          <p className="text-xs text-gray-500">
                            Faltam: {formatCurrency(caixinha.valor_faltante)}
                          </p>
                        )}

                        {caixinha.prazo_data && (
                          <p className="text-xs text-gray-500">
                            Prazo: {format(new Date(caixinha.prazo_data), 'dd/MM/yyyy', { locale: ptBR })}
                            {' '}
                            ({differenceInDays(new Date(caixinha.prazo_data), new Date())} dias)
                          </p>
                        )}

                        {progresso >= 100 && caixinha.saldo_atual > 0 && (
                          <div className="text-xs text-green-400 font-medium">
                            ✅ Meta atingida!
                          </div>
                        )}

                        {/* Actions */}
                        {canEdit && (
                          <div className="space-y-2 pt-2">
                            {progresso >= 100 && caixinha.saldo_atual > 0 ? (
                              <Button
                                size="sm"
                                variant="primary"
                                className="w-full bg-green-600 hover:bg-green-500"
                                onClick={() => handleConcluirMeta(caixinha)}
                              >
                                🏆 Concluir meta
                              </Button>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="flex-1"
                                  onClick={() => handleDepositar(caixinha)}
                                >
                                  <ArrowUpCircle size={14} className="mr-1" />
                                  Depositar
                                </Button>
                                {caixinha.saldo_atual > 0 && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => handleRetirar(caixinha)}
                                  >
                                    <ArrowDownCircle size={14} className="mr-1" />
                                    Retirar
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full mt-1 text-gray-500 hover:text-gray-300"
                          onClick={() => handleHistorico(caixinha)}
                        >
                          <History size={14} className="mr-1" />
                          Histórico / Desfazer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoadingCaixinhas && caixinhas.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <PiggyBank className="mx-auto mb-4 text-gray-600" size={48} />
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  Nenhuma caixinha criada
                </h3>
                <p className="text-gray-500 mb-4">
                  Crie sua primeira caixinha para começar a guardar dinheiro para seus objetivos
                </p>
                {canEdit && (
                  <Button onClick={() => setIsModalOpen(true)}>
                    <Plus size={16} className="mr-2" />
                    Criar Primeira Caixinha
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingCaixinhas && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Carregando caixinhas...</p>
          </div>
        )}
      </div>
    </>
  )
}
