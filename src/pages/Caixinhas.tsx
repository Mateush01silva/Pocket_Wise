import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlan } from '../hooks/usePlan'
import {
  PiggyBank, Plus, Target, TrendingUp, TrendingDown, Wallet,
  Edit2, Trash2, ArrowUpCircle, ArrowDownCircle, History,
  RefreshCw, AlertCircle, BarChart3, PauseCircle, PlayCircle, ArrowRightLeft, SlidersHorizontal,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui'
import { CaixinhaModal } from '../components/CaixinhaModal'
import { MovimentarCaixinhaModal } from '../components/MovimentarCaixinhaModal'
import { TransferirCaixinhaModal } from '../components/TransferirCaixinhaModal'
import { HistoricoCaixinhaModal } from '../components/HistoricoCaixinhaModal'
import { AtualizarCotacaoModal } from '../components/AtualizarCotacaoModal'
import { AjustarSaldoCaixinhaModal } from '../components/AjustarSaldoCaixinhaModal'
import { MiniTimeline } from '../components/MiniTimeline'
import { MetasDashboard } from '../components/MetasDashboard'
import { useMetasDashboardAccess } from '../hooks/useMetasDashboardAccess'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { usePermissions } from '../hooks/usePermissions'
import { useTransacoesStore } from '../store'
import { formatCurrency } from '../utils/currency'
import { format, differenceInDays, formatDistanceToNow } from 'date-fns'
import { historicoMensalService } from '../services/historicoMensalService'
import { calcularStreak } from '../lib/caixinhasCalculations'
import type { CaixinhaHistoricoMensal } from '../types'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { confirmDialog } from '../components/ui/ConfirmDialog'
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
  const navigate = useNavigate()
  const { getLimit } = usePlan()
  const {
    caixinhas,
    summary,
    isLoadingCaixinhas,
    initialize,
    deleteCaixinha,
    updateStatus,
    updateCaixinha,
    fetchTransacoes: fetchTransacoesCaixinha,
    todasTransacoesFamily,
    fetchAllTransacoesFamily,
  } = useCaixinhasStore()

  const { hasBetaAccess: metasBeta } = useMetasDashboardAccess()

  const lancamentos = useTransacoesStore((state) => state.lancamentos)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCaixinha, setEditingCaixinha] = useState<Caixinha | undefined>()
  const [movimentarCaixinha, setMovimentarCaixinha] = useState<CaixinhaComDetalhes | null>(null)
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'deposito' | 'retirada'>('deposito')
  const [historicoCaixinha, setHistoricoCaixinha] = useState<CaixinhaComDetalhes | null>(null)
  const [cotacaoCaixinha, setCotacaoCaixinha] = useState<CaixinhaComDetalhes | null>(null)
  const [transferirCaixinha, setTransferirCaixinha] = useState<CaixinhaComDetalhes | null>(null)
  const [ajustarSaldoCaixinha, setAjustarSaldoCaixinha] = useState<CaixinhaComDetalhes | null>(null)
  const [isConcluindoMeta, setIsConcluindoMeta] = useState(false)
  // Histórico mensal por caixinha: Record<caixinha_id, CaixinhaHistoricoMensal[]>
  const [historicoMensal, setHistoricoMensal] = useState<Record<string, CaixinhaHistoricoMensal[]>>({})

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

  // Carregar histórico mensal das caixinhas de Objetivos & Reservas
  useEffect(() => {
    const caixinhasParaHistorico = caixinhas.filter(
      (c) => c.ativa && c.tipo !== 'investimento'
    )
    if (caixinhasParaHistorico.length === 0) return

    historicoMensalService
      .getHistoricoMultiplas(caixinhasParaHistorico.map((c) => c.id))
      .then(({ data }) => {
        if (data) setHistoricoMensal(data)
      })
      .catch((err) => console.error('Erro ao buscar histórico mensal:', err))
  }, [caixinhas])

  const handleOpenNewCaixinha = () => {
    const limit = getLimit('caixinhas')
    if (caixinhas.length >= limit) {
      toast.error(`Você atingiu o limite do Explorador (${limit} caixinhas). Assine o Planejador para criar mais.`, {
        action: { label: 'Assinar Planejador', onClick: () => navigate('/app/assinatura') },
      })
      return
    }
    setEditingCaixinha(undefined)
    setIsModalOpen(true)
  }

  const handleEdit = (caixinha: Caixinha) => {
    setEditingCaixinha(caixinha)
    setIsModalOpen(true)
  }

  const handleDelete = async (caixinha: Caixinha) => {
    if (caixinha.saldo_atual > 0) {
      toast.error(`Não é possível deletar. Caixinha possui saldo de ${formatCurrency(caixinha.saldo_atual)}`)
      return
    }
    const okDeletar = await confirmDialog({
      title: `Deletar a caixinha "${caixinha.nome}"?`,
      message: 'O histórico de movimentações desta caixinha será perdido. Esta ação não pode ser desfeita.',
      confirmLabel: 'Deletar',
      danger: true,
    })
    if (!okDeletar) return
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

  const handleConcluirMeta = async (caixinha: CaixinhaComDetalhes) => {
    const ok = await confirmDialog({
      title: `🎉 Parabéns! Meta "${caixinha.nome}" atingida!`,
      message: `Para arquivar esta caixinha, retire o saldo disponível (${formatCurrency(caixinha.saldo_atual)}) no próximo passo. Se você fechar a retirada sem confirmar, a caixinha continua ativa.`,
      confirmLabel: 'Retirar e concluir',
    })
    if (!ok) return
    setIsConcluindoMeta(true)
    setMovimentarCaixinha(caixinha)
    setTipoMovimentacao('retirada')
  }

  const handleConcluirMetaSuccess = async () => {
    if (!movimentarCaixinha) return
    // Após a retirada do saldo, arquivar a caixinha (status='concluida')
    // Não deletar — histórico deve ser preservado
    const success = await updateStatus(movimentarCaixinha.id, 'concluida')
    if (success) {
      toast.success(`🎉 Meta "${movimentarCaixinha.nome}" concluída e arquivada com sucesso!`)
    } else {
      toast.error('Erro ao arquivar a caixinha. Verifique se o saldo foi zerado.')
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

  const handleTransferir = (caixinha: CaixinhaComDetalhes) => setTransferirCaixinha(caixinha)
  const handleCloseTransferir = () => setTransferirCaixinha(null)

  const handleAjustarSaldo = (caixinha: CaixinhaComDetalhes) => setAjustarSaldoCaixinha(caixinha)
  const handleCloseAjustarSaldo = () => setAjustarSaldoCaixinha(null)

  const handlePausar = async (caixinha: CaixinhaComDetalhes) => {
    const okPausar = await confirmDialog({
      title: `Pausar a caixinha "${caixinha.nome}"?`,
      message: 'O saldo é preservado e novos depósitos ficam bloqueados. Ao retomar, o prazo é estendido pelos meses em que ficou pausada (o streak não é quebrado).',
      confirmLabel: 'Pausar',
    })
    if (!okPausar) return
    const success = await updateStatus(caixinha.id, 'pausada')
    if (success) {
      toast.success(`Caixinha "${caixinha.nome}" pausada. Retome quando quiser.`)
    } else {
      toast.error('Erro ao pausar a caixinha.')
    }
  }

  const handleRetomar = async (caixinha: CaixinhaComDetalhes) => {
    const success = await updateStatus(caixinha.id, 'ativa')
    if (success) {
      toast.success(`Caixinha "${caixinha.nome}" retomada!`)
    } else {
      toast.error('Erro ao retomar a caixinha.')
    }
  }

  const handleReorder = async (id: string, newIndex: number) => {
    // Atualiza ordem_exibicao para o card arrastado dentro do grupo atual
    await updateCaixinha({ id, ordem_exibicao: newIndex })
  }

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

      {transferirCaixinha && (
        <TransferirCaixinhaModal
          isOpen={true}
          onClose={handleCloseTransferir}
          caixinha={transferirCaixinha}
        />
      )}

      {ajustarSaldoCaixinha && (
        <AjustarSaldoCaixinhaModal
          isOpen={true}
          onClose={handleCloseAjustarSaldo}
          caixinha={ajustarSaldoCaixinha}
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
            <Button onClick={handleOpenNewCaixinha}>
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

            <LearningTooltip content={learningContent.caixinhasAtivas} position="bottom">
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
            </LearningTooltip>
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
              <LearningTooltip content={learningContent.investimentoTotalAportado} position="bottom">
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
              </LearningTooltip>

              {/* Valor de Mercado */}
              <LearningTooltip content={learningContent.investimentoValorMercado} position="bottom">
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
              </LearningTooltip>

              {/* Rentabilidade Total */}
              <LearningTooltip content={learningContent.investimentoRentabilidade} position="bottom">
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
              </LearningTooltip>
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
                            <LearningTooltip content={learningContent.caixinhaTipoInvestimento} position="bottom">
                              <p className="text-xs text-gray-500 cursor-help">
                                {caixinha.subtipo_investimento
                                  ? SUBTIPO_LABELS[caixinha.subtipo_investimento]
                                  : getTipoLabel(caixinha.tipo)}
                              </p>
                            </LearningTooltip>
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
                          <LearningTooltip content={learningContent.investimentoRentabilidade} position="top">
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
                          </LearningTooltip>
                        )}

                        {/* Alerta cotação desatualizada */}
                        {cotacaoDesatualizada && (
                          <LearningTooltip content={learningContent.investimentoCotacaoDesatualizada} position="top">
                            <div className="flex items-center gap-1.5 text-yellow-500">
                              <AlertCircle size={12} />
                              <span className="text-xs">Cotação desatualizada (aporte recente)</span>
                            </div>
                          </LearningTooltip>
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
                            {caixinhasInvestimento.length > 1 && caixinha.saldo_atual > 0 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="w-full"
                                onClick={() => handleTransferir(caixinha)}
                              >
                                <ArrowRightLeft size={14} className="mr-1" />
                                Transferir para outra
                              </Button>
                            )}
                            <LearningTooltip content={learningContent.investimentoAtualizarCotacao} position="top">
                              <Button
                                size="sm"
                                variant={!caixinha.valor_mercado || cotacaoDesatualizada ? 'primary' : 'secondary'}
                                className="w-full"
                                onClick={() => handleAtualizarCotacao(caixinha)}
                              >
                                <RefreshCw size={14} className="mr-1" />
                                Atualizar Cotação
                              </Button>
                            </LearningTooltip>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full"
                              onClick={() => handleAjustarSaldo(caixinha)}
                            >
                              <SlidersHorizontal size={14} className="mr-1" />
                              Ajustar Saldo
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
            <h2 className={`mb-4 flex items-center gap-2 ${hasInvestimentos ? 'text-lg font-semibold text-gray-300' : 'text-xl font-bold text-gray-100'}`}>
              🎯 Metas e Sonhos
            </h2>

            {/* Dashboard melhorado (beta) */}
            {metasBeta ? (
              <MetasDashboard
                caixinhas={caixinhasOutras}
                historicoMensal={historicoMensal}
                canEdit={canEdit}
                onDepositar={handleDepositar}
                onRetirar={handleRetirar}
                onConcluirMeta={handleConcluirMeta}
                onPausar={handlePausar}
                onRetomar={handleRetomar}
                onHistorico={handleHistorico}
                onEdit={handleEdit}
                onReorder={handleReorder}
              />
            ) : (
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
                            <LearningTooltip
                              content={caixinha.tipo === 'emergencia'
                                ? learningContent.caixinhaTipoEmergencia
                                : learningContent.caixinhaTipoObjetivo}
                              position="bottom"
                            >
                              <p className="text-xs text-gray-500 cursor-help">{getTipoLabel(caixinha.tipo)}</p>
                            </LearningTooltip>
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
                        {/* Duplo Saldo: Conquistado + Disponível */}
                        <div className="space-y-1">
                          {caixinha.saldo_conquistado !== undefined && caixinha.saldo_conquistado !== caixinha.saldo_atual ? (
                            <>
                              <div className="flex justify-between items-baseline">
                                <span className="text-xs text-green-400 font-medium">Já conquistei</span>
                                <span className="text-base font-bold text-green-400">
                                  {formatCurrency(caixinha.saldo_conquistado)}
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
                              <span className="text-sm text-gray-400">Saldo Atual</span>
                              <span className="text-xl font-bold text-primary-400">
                                {formatCurrency(caixinha.saldo_atual)}
                              </span>
                            </div>
                          )}
                          {caixinha.meta_valor && (
                            <div className="flex justify-between items-baseline text-xs text-gray-500">
                              <span>Meta: {formatCurrency(caixinha.meta_valor)}</span>
                              <span>{progresso.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar — baseado em saldo_conquistado */}
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

                        {/* Mini-timeline de contribuições dos últimos 6 meses */}
                        {historicoMensal[caixinha.id]?.length > 0 && (
                          <MiniTimeline
                            historico={historicoMensal[caixinha.id]}
                            streak={calcularStreak(historicoMensal[caixinha.id])}
                          />
                        )}

                        {/* Actions */}
                        {canEdit && (
                          <div className="space-y-2 pt-2">
                            {caixinha.status === 'pausada' ? (
                              <div className="space-y-2">
                                <div className="flex gap-2">
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
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="flex-1 text-green-400 hover:text-green-300"
                                    onClick={() => handleRetomar(caixinha)}
                                  >
                                    <PlayCircle size={14} className="mr-1" />
                                    Retomar
                                  </Button>
                                </div>
                              </div>
                            ) : progresso >= 100 && caixinha.saldo_atual > 0 ? (
                              <LearningTooltip content={learningContent.caixinhaConcluirMeta} position="top">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="w-full bg-green-600 hover:bg-green-500"
                                  onClick={() => handleConcluirMeta(caixinha)}
                                >
                                  🏆 Concluir meta
                                </Button>
                              </LearningTooltip>
                            ) : (
                              <div className="space-y-2">
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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="w-full text-gray-600 hover:text-yellow-400"
                                  onClick={() => handlePausar(caixinha)}
                                >
                                  <PauseCircle size={14} className="mr-1" />
                                  Pausar
                                </Button>
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
            )}
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
                  <Button onClick={handleOpenNewCaixinha}>
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
