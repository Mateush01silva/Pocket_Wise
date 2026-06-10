import { useEffect, useState, useCallback } from 'react'
import { Plus, Filter, Calendar, RefreshCw, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { confirmDialog } from '../components/ui/ConfirmDialog'
import { toast } from 'sonner'
import { SubscriptionCard } from '../components/SubscriptionCard'
import { SubscriptionModal } from '../components/SubscriptionModal'
import { CancelSubscriptionModal } from '../components/CancelSubscriptionModal'
import { SubscriptionStats } from '../components/SubscriptionStats'
import { useAssinaturasStore } from '../store/useAssinaturasStore'
import { usePermissions } from '../hooks/usePermissions'
import type { Assinatura, AssinaturaComDetalhes } from '../types'

export function Subscriptions() {
  const { canEdit } = usePermissions()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [editingAssinatura, setEditingAssinatura] = useState<Assinatura | undefined>()
  const [cancelingAssinatura, setCancelingAssinatura] = useState<AssinaturaComDetalhes | null>(null)
  const [showInactive, setShowInactive] = useState(true) // Mostrar inativas por padrão
  const [sortBy, setSortBy] = useState<'nome' | 'valor' | 'proxima_cobranca'>('nome')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const initialize = useAssinaturasStore((state) => state.initialize)
  const initialized = useAssinaturasStore((state) => state.initialized)
  const isLoading = useAssinaturasStore((state) => state.isLoading)
  const getAssinaturasComDetalhes = useAssinaturasStore((state) => state.getAssinaturasComDetalhes)
  const getSummary = useAssinaturasStore((state) => state.getSummary)
  const cancelarAssinatura = useAssinaturasStore((state) => state.cancelarAssinatura)
  const deleteAssinatura = useAssinaturasStore((state) => state.deleteAssinatura)
  const sincronizarLancamentosAssinaturas = useAssinaturasStore((state) => state.sincronizarLancamentosAssinaturas)
  const regenerarTodosLancamentosAssinaturas = useAssinaturasStore((state) => state.regenerarTodosLancamentosAssinaturas)

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialized, initialize])

  const assinaturas = getAssinaturasComDetalhes()
  const summary = getSummary()

  // Filtrar assinaturas
  const assinaturasFiltradas = assinaturas
    .filter((a) => showInactive || a.ativa)
    .sort((a, b) => {
      switch (sortBy) {
        case 'nome':
          return a.nome.localeCompare(b.nome)
        case 'valor': {
          const valorA = a.frequencia === 'mensal' ? a.valor : a.valor / 12
          const valorB = b.frequencia === 'mensal' ? b.valor : b.valor / 12
          return valorB - valorA
        }
        case 'proxima_cobranca':
          return a.proxima_cobranca.localeCompare(b.proxima_cobranca)
        default:
          return 0
      }
    })

  const handleEdit = (assinatura: AssinaturaComDetalhes) => {
    setEditingAssinatura(assinatura)
    setIsModalOpen(true)
  }

  const handleCancel = (assinatura: AssinaturaComDetalhes) => {
    setCancelingAssinatura(assinatura)
    setIsCancelModalOpen(true)
  }

  const handleConfirmCancel = async (dataUltimaCobranca: string) => {
    if (!cancelingAssinatura) return
    await cancelarAssinatura(cancelingAssinatura.id, dataUltimaCobranca)
    setCancelingAssinatura(null)
  }

  const handleDelete = async (assinatura: AssinaturaComDetalhes) => {
    const confirmacao = await confirmDialog({
      title: `Deletar a assinatura "${assinatura.nome}"?`,
      message: 'Todos os dados e lançamentos vinculados serão removidos. Esta ação não pode ser desfeita.',
      confirmLabel: 'Deletar',
      danger: true,
    })
    if (confirmacao) {
      await deleteAssinatura(assinatura.id)
      toast.success('Assinatura deletada')
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingAssinatura(undefined)
  }

  // Sincronizar lançamentos do mês atual
  const handleSyncSubscriptions = useCallback(async () => {
    setIsSyncing(true)
    try {
      const resultado = await sincronizarLancamentosAssinaturas(new Date())
      if (resultado.criados > 0) {
        toast.success(`${resultado.criados} lançamento(s) criado(s): ${resultado.assinaturas.join(', ')}`)
      } else {
        toast.info('Todos os lançamentos de assinaturas já estão sincronizados para este mês!')
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error)
      toast.error('Não foi possível sincronizar os lançamentos. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSyncing(false)
    }
  }, [sincronizarLancamentosAssinaturas])

  // Regenerar todos os lançamentos de assinaturas (corrige faturas)
  const handleRegenerateLancamentos = useCallback(async () => {
    const confirmacao = await confirmDialog({
      title: 'Regenerar lançamentos das assinaturas?',
      message:
        'Isso vai remover todos os lançamentos PROJETADOS das assinaturas ativas e gerá-los novamente com as datas de fatura corrigidas.\n\nLançamentos já pagos ou pendentes NÃO serão afetados.',
      confirmLabel: 'Regenerar',
    })
    if (!confirmacao) return

    setIsRegenerating(true)
    try {
      const resultado = await regenerarTodosLancamentosAssinaturas()
      toast.success(
        `Regeneração concluída: ${resultado.removidos} removidos, ${resultado.criados} criados (${resultado.assinaturas.length} assinatura(s))`
      )
    } catch (error) {
      console.error('Erro ao regenerar:', error)
      toast.error('Não foi possível regenerar os lançamentos. Verifique sua conexão e tente novamente.')
    } finally {
      setIsRegenerating(false)
    }
  }, [regenerarTodosLancamentosAssinaturas])

  if (isLoading && !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Carregando assinaturas...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-100">Assinaturas</h1>
          <p className="text-gray-400 mt-1">Gerencie suas assinaturas recorrentes</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {canEdit && (
            <Button
              variant="secondary"
              onClick={handleSyncSubscriptions}
              disabled={isSyncing || isRegenerating}
              title="Gera os lançamentos de assinaturas para o mês atual"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Mês'}
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Nova Assinatura
            </Button>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      <SubscriptionStats summary={summary} />

      {/* Filtros e Ordenação */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Toggle Inativas */}
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showInactive
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              {showInactive ? 'Mostrar apenas ativas' : 'Mostrar canceladas'}
            </button>

            {/* Ordenação */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="nome">Nome</option>
                <option value="valor">Valor</option>
                <option value="proxima_cobranca">Próxima Cobrança</option>
              </select>
            </div>

            {/* Contador */}
            <div className="ml-auto flex items-center gap-4">
              <span className="text-sm text-gray-400">
                {assinaturasFiltradas.length} assinatura(s)
              </span>

              {/* Regenerar Faturas - botão discreto */}
              <button
                onClick={handleRegenerateLancamentos}
                disabled={isRegenerating || isSyncing}
                title="Corrigir datas de fatura de todas as assinaturas"
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? 'Corrigindo...' : 'Corrigir Faturas'}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Assinaturas */}
      {assinaturasFiltradas.length === 0 ? (
        <Card className="text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-gray-500" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-300">
                {showInactive ? 'Nenhuma assinatura encontrada' : 'Nenhuma assinatura ativa'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {showInactive
                  ? 'Crie sua primeira assinatura para começar'
                  : 'Todas as suas assinaturas estão canceladas'}
              </p>
            </div>
            {!showInactive && canEdit && (
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-5 h-5 mr-2" />
                Nova Assinatura
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assinaturasFiltradas.map((assinatura) => (
            <SubscriptionCard
              key={assinatura.id}
              assinatura={assinatura}
              onEdit={canEdit ? handleEdit : undefined}
              onCancel={canEdit ? handleCancel : undefined}
              onDelete={canEdit ? handleDelete : undefined}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingAssinatura={editingAssinatura}
      />

      <CancelSubscriptionModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false)
          setCancelingAssinatura(null)
        }}
        assinatura={cancelingAssinatura}
        onConfirm={handleConfirmCancel}
      />
    </div>
  )
}
