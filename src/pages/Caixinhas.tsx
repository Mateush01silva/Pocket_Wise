import { useState, useEffect } from 'react'
import { PiggyBank, Plus, Target, TrendingUp, Wallet, Edit2, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui'
import { CaixinhaModal } from '../components/CaixinhaModal'
import { MovimentarCaixinhaModal } from '../components/MovimentarCaixinhaModal'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { formatCurrency } from '../utils/currency'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { LearningTooltip } from '../components/ui/LearningTooltip'
import { learningContent } from '../lib/learningContent'
import type { Caixinha, CaixinhaComDetalhes } from '../types'

export function Caixinhas() {
  const {
    caixinhas,
    summary,
    isLoadingCaixinhas,
    initialize,
    deleteCaixinha,
  } = useCaixinhasStore()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCaixinha, setEditingCaixinha] = useState<Caixinha | undefined>()
  const [movimentarCaixinha, setMovimentarCaixinha] = useState<CaixinhaComDetalhes | null>(null)
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'deposito' | 'retirada'>('deposito')

  useEffect(() => {
    initialize()
  }, [initialize])

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

  const handleCloseMovimentar = () => {
    setMovimentarCaixinha(null)
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'objetivo':
        return '🎯 Objetivo'
      case 'emergencia':
        return '🏥 Emergência'
      case 'investimento':
        return '💰 Investimento'
      default:
        return tipo
    }
  }

  const getProgressColor = (percentual: number) => {
    if (percentual >= 100) return 'bg-green-500'
    if (percentual >= 75) return 'bg-blue-500'
    if (percentual >= 50) return 'bg-yellow-500'
    return 'bg-gray-500'
  }

  return (
    <>
      <CaixinhaModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingCaixinha={editingCaixinha}
      />

      {/* Modal de Depositar/Retirar */}
      {movimentarCaixinha && (
        <MovimentarCaixinhaModal
          isOpen={true}
          onClose={handleCloseMovimentar}
          caixinha={movimentarCaixinha}
          tipo={tipoMovimentacao}
        />
      )}

      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Caixinhas</h1>
            <p className="text-gray-400">Gerencie seus objetivos financeiros e poupanças</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Nova Caixinha
          </Button>
        </div>

        {/* Summary Cards */}
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

        {/* Caixinhas List */}
        <div>
          <h2 className="text-xl font-bold text-gray-100 mb-4">Minhas Caixinhas</h2>

          {isLoadingCaixinhas ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Carregando caixinhas...</p>
            </div>
          ) : caixinhas.length === 0 ? (
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
                  <Button onClick={() => setIsModalOpen(true)}>
                    <Plus size={16} className="mr-2" />
                    Criar Primeira Caixinha
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {caixinhas.map((caixinha) => {
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

                        {/* Info adicional */}
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

                        {progresso >= 100 && (
                          <div className="text-xs text-green-400 font-medium">
                            ✅ Meta atingida!
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
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
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
