import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { confirmDialog } from '../components/ui/ConfirmDialog'
import { usePlan } from '../hooks/usePlan'
import {
  Plus,
  Landmark,
  Wallet,
  Smartphone,
  DollarSign,
  TrendingUp,
  HelpCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowLeftRight,
} from 'lucide-react'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import { usePermissions } from '../hooks/usePermissions'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui'
import { BankAccountModal } from '../components/BankAccountModal'
import { AdjustBalanceModal } from '../components/AdjustBalanceModal'
import { TransferirContasModal } from '../components/TransferirContasModal'
import { formatCurrency } from '../utils/currency'
import type { ContaBancaria, TipoConta } from '../types'

const ICONE_POR_TIPO: Record<TipoConta, React.ReactNode> = {
  conta_corrente: <Landmark size={20} />,
  poupanca: <Wallet size={20} />,
  carteira_digital: <Smartphone size={20} />,
  dinheiro: <DollarSign size={20} />,
  investimento: <TrendingUp size={20} />,
  outra: <HelpCircle size={20} />,
}

const LABEL_POR_TIPO: Record<TipoConta, string> = {
  conta_corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  carteira_digital: 'Carteira Digital',
  dinheiro: 'Dinheiro',
  investimento: 'Investimento',
  outra: 'Outra',
}

export function BankAccounts() {
  const { canEdit } = usePermissions()
  const navigate = useNavigate()
  const { getLimit } = usePlan()
  const contas = useContasBancariasStore((state) => state.contas)
  const fetchContas = useContasBancariasStore((state) => state.fetchContas)
  const deleteConta = useContasBancariasStore((state) => state.deleteConta)
  const getSaldoTotal = useContasBancariasStore((state) => state.getSaldoTotal)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [contaToEdit, setContaToEdit] = useState<ContaBancaria | undefined>()
  const [saldosVisiveis, setSaldosVisiveis] = useState(true)
  const [contaToAdjust, setContaToAdjust] = useState<ContaBancaria | undefined>()
  const [contaToTransfer, setContaToTransfer] = useState<ContaBancaria | undefined>()

  // Buscar contas ao carregar
  useEffect(() => {
    fetchContas()
  }, [fetchContas])

  const contasAtivas = useMemo(
    () => contas.filter((c) => c.ativo),
    [contas]
  )

  const contasInativas = useMemo(
    () => contas.filter((c) => !c.ativo),
    [contas]
  )

  const saldoTotal = useMemo(() => getSaldoTotal(), [contas, getSaldoTotal])

  const handleOpenNewAccount = () => {
    const limit = getLimit('accounts')
    if (contasAtivas.length >= limit) {
      toast.error(`Você atingiu o limite do Explorador (${limit} conta). Assine o Planejador para adicionar mais.`, {
        action: { label: 'Assinar Planejador', onClick: () => navigate('/app/assinatura') },
      })
      return
    }
    setContaToEdit(undefined)
    setIsModalOpen(true)
  }

  const handleEdit = (conta: ContaBancaria) => {
    setContaToEdit(conta)
    setIsModalOpen(true)
  }

  const handleDelete = async (conta: ContaBancaria) => {
    const ok = await confirmDialog({
      title: `${conta.ativo ? 'Desativar' : 'Excluir'} a conta "${conta.nome}"?`,
      message: conta.ativo
        ? 'A conta será desativada e não aparecerá mais nas listagens.'
        : 'Esta ação não pode ser desfeita.',
      confirmLabel: conta.ativo ? 'Desativar' : 'Excluir',
      danger: true,
    })
    if (!ok) return

    try {
      await deleteConta(conta.id)
      toast.success('Conta removida com sucesso!')
    } catch (error) {
      console.error('Erro ao deletar conta:', error)
      toast.error('Não foi possível remover a conta. Verifique se não há transações associadas a ela.')
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setContaToEdit(undefined)
  }

  const handleAdjustBalance = (conta: ContaBancaria) => {
    setContaToAdjust(conta)
  }

  const handleCloseAdjustModal = () => {
    setContaToAdjust(undefined)
  }

  const handleTransfer = (conta: ContaBancaria) => {
    setContaToTransfer(conta)
  }

  const handleCloseTransferModal = () => {
    setContaToTransfer(undefined)
  }

  const renderConta = (conta: ContaBancaria) => {
    const saldoPositivo = conta.saldo_atual >= 0

    return (
      <Card
        key={conta.id}
        className="hover:shadow-xl transition-shadow relative overflow-hidden"
      >
        {/* Barra de cor no topo */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: conta.cor || '#6b7280' }}
        />

        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${conta.cor}20` }}
              >
                {conta.icone || ICONE_POR_TIPO[conta.tipo]}
              </div>
              <div>
                <div className="text-base font-semibold text-gray-100">{conta.nome}</div>
                <div className="text-xs text-gray-500 font-normal">
                  {LABEL_POR_TIPO[conta.tipo]}
                </div>
              </div>
            </CardTitle>
            {canEdit && (
              <div className="flex gap-1">
                {contasAtivas.length >= 2 && (
                  <button
                    onClick={() => handleTransfer(conta)}
                    className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-blue-400"
                    title="Transferir entre contas"
                  >
                    <ArrowLeftRight size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleAdjustBalance(conta)}
                  className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-green-400"
                  title="Ajustar saldo"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => handleEdit(conta)}
                  className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-primary-400"
                  title="Editar conta"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(conta)}
                  className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-red-400"
                  title={conta.ativo ? 'Desativar conta' : 'Excluir conta'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Saldo Atual */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Saldo Atual</p>
            {saldosVisiveis ? (
              <p
                className={`text-2xl font-bold ${
                  saldoPositivo ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {formatCurrency(conta.saldo_atual)}
              </p>
            ) : (
              <p className="text-2xl font-bold text-gray-400">••••••</p>
            )}
          </div>

          {/* Informações Bancárias */}
          {(conta.instituicao || conta.agencia || conta.numero_conta) && (
            <div className="pt-3 border-t border-dark-700 space-y-1">
              {conta.instituicao && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Instituição:</span>
                  <span className="text-gray-300">{conta.instituicao}</span>
                </div>
              )}
              {conta.agencia && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Agência:</span>
                  <span className="text-gray-300">{conta.agencia}</span>
                </div>
              )}
              {conta.numero_conta && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Conta:</span>
                  <span className="text-gray-300">{conta.numero_conta}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Contas Bancárias</h1>
          <p className="text-gray-400">
            {contasAtivas.length} contas ativas • Gerencie seus saldos e movimentações
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setSaldosVisiveis(!saldosVisiveis)}
            variant="secondary"
            size="sm"
          >
            {saldosVisiveis ? <EyeOff size={16} /> : <Eye size={16} />}
          </Button>
          {canEdit && (
            <Button onClick={handleOpenNewAccount}>
              <Plus size={16} className="mr-2" />
              Nova Conta
            </Button>
          )}
        </div>
      </div>

      {/* Resumo Geral */}
      {contasAtivas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Saldo Total</p>
                  {saldosVisiveis ? (
                    <p className="text-2xl font-bold text-gray-100">
                      {formatCurrency(saldoTotal)}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-gray-400">••••••</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-primary-500/10 rounded-full flex items-center justify-center">
                  <Wallet className="text-primary-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Contas Ativas</p>
                  <p className="text-2xl font-bold text-gray-100">{contasAtivas.length}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Landmark className="text-green-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Saldo Médio</p>
                  {saldosVisiveis ? (
                    <p className="text-2xl font-bold text-gray-100">
                      {formatCurrency(
                        contasAtivas.length > 0 ? saldoTotal / contasAtivas.length : 0
                      )}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-gray-400">••••••</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="text-blue-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contas Ativas */}
      {contasAtivas.length > 0 ? (
        <div>
          <h2 className="text-xl font-bold text-gray-100 mb-4">Contas Ativas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contasAtivas.map(renderConta)}
          </div>
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center">
            <div className="w-16 h-16 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Landmark className="text-gray-500" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">
              Nenhuma conta cadastrada
            </h3>
            <p className="text-gray-500 mb-4">
              Adicione sua primeira conta para começar a gerenciar seus saldos
            </p>
            <Button onClick={handleOpenNewAccount}>
              <Plus size={16} className="mr-2" />
              Adicionar Conta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Contas Inativas */}
      {contasInativas.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-400 mb-4">Contas Inativas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {contasInativas.map(renderConta)}
          </div>
        </div>
      )}

      {/* Modal de Conta */}
      <BankAccountModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        conta={contaToEdit}
      />

      {/* Modal de Ajuste de Saldo */}
      {contaToAdjust && (
        <AdjustBalanceModal
          isOpen={!!contaToAdjust}
          onClose={handleCloseAdjustModal}
          conta={contaToAdjust}
        />
      )}

      {/* Modal de Transferência entre Contas */}
      {contaToTransfer && (
        <TransferirContasModal
          isOpen={!!contaToTransfer}
          onClose={handleCloseTransferModal}
          contaOrigem={contaToTransfer}
        />
      )}
    </div>
  )
}
