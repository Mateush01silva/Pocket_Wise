import { useState, useMemo } from 'react'
import { X, ArrowUpCircle, ArrowDownCircle, AlertTriangle, Calendar, Building2, Wallet } from 'lucide-react'
import { Button } from './ui/Button'
import { CurrencyInput } from './ui/CurrencyInput'
import { Input } from './ui/Input'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import { toast } from 'sonner'
import { format, addMonths, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CaixinhaComDetalhes, TransacaoCaixinhaTipo } from '../types'
import type { SaldoMesInfo } from '../lib/financialCalculations'

interface MovimentarCaixinhaModalProps {
  isOpen: boolean
  onClose: () => void
  caixinha: CaixinhaComDetalhes
  tipo: 'deposito' | 'retirada'
  saldoDisponivelParaDeposito?: number // Saldo disponível para depósito (de meses anteriores)
  mesesComSaldo?: SaldoMesInfo[] // Lista de meses com saldo disponível para alocar
}

export function MovimentarCaixinhaModal({
  isOpen,
  onClose,
  caixinha,
  tipo,
  saldoDisponivelParaDeposito = 0,
  mesesComSaldo = [],
}: MovimentarCaixinhaModalProps) {
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [mesDestino, setMesDestino] = useState<string>(() => format(startOfMonth(new Date()), 'yyyy-MM'))
  // Para depósitos, mês de origem padrão é o mês anterior (ou o mais antigo com saldo)
  const [mesOrigem, setMesOrigem] = useState<string>(() => {
    if (mesesComSaldo.length > 0) {
      return mesesComSaldo[0].mesRef // Mais antigo primeiro
    }
    return format(subMonths(startOfMonth(new Date()), 1), 'yyyy-MM')
  })
  const [isLoading, setIsLoading] = useState(false)
  const [origemDeposito, setOrigemDeposito] = useState<'orcamento' | 'conta'>('orcamento')
  const [contaOrigemId, setContaOrigemId] = useState<string>('')

  const createTransacao = useCaixinhasStore((state) => state.createTransacao)
  const contas = useContasBancariasStore((state) => state.contas)
  const atualizarSaldo = useContasBancariasStore((state) => state.atualizarSaldo)
  const contasInvestimento = contas.filter((c) => c.ativo && c.tipo === 'investimento')

  const isDeposito = tipo === 'deposito'
  const contaSelecionada = contasInvestimento.find((c) => c.id === contaOrigemId)
  const excedeSaldoDisponivel = isDeposito && origemDeposito === 'orcamento' && valor > saldoDisponivelParaDeposito
  const excedeSaldoConta = isDeposito && origemDeposito === 'conta' && !!contaSelecionada && valor > contaSelecionada.saldo_atual

  // Gerar opções de meses (mês atual + próximos 2 meses)
  const opcoesDesMeses = useMemo(() => {
    const hoje = new Date()
    const meses = []
    for (let i = 0; i < 3; i++) {
      const mesData = addMonths(startOfMonth(hoje), i)
      meses.push({
        value: format(mesData, 'yyyy-MM'),
        label: format(mesData, "MMMM 'de' yyyy", { locale: ptBR }),
      })
    }
    return meses
  }, [])

  const handleSubmit = async () => {
    if (valor <= 0) {
      toast.error('Informe um valor válido')
      return
    }

    if (!isDeposito && valor > caixinha.saldo_atual) {
      toast.error('Valor maior que o saldo disponível')
      return
    }

    // Validar depósito contra saldo de orçamento
    if (isDeposito && origemDeposito === 'orcamento' && valor > saldoDisponivelParaDeposito) {
      toast.error(`Saldo disponível insuficiente. Você tem apenas ${formatCurrency(saldoDisponivelParaDeposito)} disponível para alocar em caixinhas.`)
      return
    }

    // Validar depósito contra saldo da conta de investimento
    if (isDeposito && origemDeposito === 'conta') {
      if (!contaOrigemId) {
        toast.error('Selecione uma conta de investimento como origem')
        return
      }
      if (!contaSelecionada) {
        toast.error('Conta não encontrada')
        return
      }
      if (valor > contaSelecionada.saldo_atual) {
        toast.error(`Saldo insuficiente. A conta "${contaSelecionada.nome}" tem apenas ${formatCurrency(contaSelecionada.saldo_atual)}.`)
        return
      }
    }

    setIsLoading(true)

    try {
      // Para retiradas, incluir o mês destino na descrição
      let descricaoFinal = descricao || null
      if (!isDeposito) {
        const mesDestinoLabel = opcoesDesMeses.find(m => m.value === mesDestino)?.label || mesDestino
        descricaoFinal = descricao
          ? `${descricao} (para ${mesDestinoLabel})`
          : `Para compor orçamento de ${mesDestinoLabel}`
      }

      // Para depósitos via conta, registrar origem na descrição
      if (isDeposito && origemDeposito === 'conta' && contaSelecionada) {
        descricaoFinal = descricao
          ? `${descricao} (da conta ${contaSelecionada.nome})`
          : `Alocado da conta ${contaSelecionada.nome}`
      }

      // Criar transação na caixinha
      const result = await createTransacao({
        caixinha_id: caixinha.id,
        valor,
        tipo: tipo as TransacaoCaixinhaTipo,
        descricao: descricaoFinal,
        // origem_mes_referencia só se vier do orçamento
        origem_mes_referencia: isDeposito && origemDeposito === 'orcamento' ? `${mesOrigem}-01` : undefined,
        destino_mes_referencia: !isDeposito ? `${mesDestino}-01` : undefined,
      })

      if (!result) {
        const errorMsg = useCaixinhasStore.getState().error
        toast.error(errorMsg || 'Erro ao realizar operação')
        console.error('Erro na transação:', errorMsg)
        return
      }

      // Descontar da conta de investimento de origem
      if (isDeposito && origemDeposito === 'conta' && contaSelecionada) {
        await atualizarSaldo(contaSelecionada.id, contaSelecionada.saldo_atual - valor)
      }

      if (isDeposito) {
        const origemLabel = origemDeposito === 'conta' && contaSelecionada
          ? ` da conta ${contaSelecionada.nome}`
          : ''
        toast.success(`${formatCurrency(valor)} depositado com sucesso${origemLabel}!`)
      } else {
        const mesDestinoLabel = opcoesDesMeses.find(m => m.value === mesDestino)?.label || mesDestino
        toast.success(
          `${formatCurrency(valor)} retirado para compor orçamento de ${mesDestinoLabel}!`
        )
      }

      handleClose()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao realizar operação')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setValor(0)
    setDescricao('')
    setOrigemDeposito('orcamento')
    setContaOrigemId('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className={cn(
          'bg-dark-900 border border-dark-700 rounded-xl shadow-xl',
          'w-full max-w-md',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isDeposito ? 'bg-green-500/20' : 'bg-amber-500/20'
              )}
            >
              {isDeposito ? (
                <ArrowUpCircle className="w-5 h-5 text-green-400" />
              ) : (
                <ArrowDownCircle className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">
                {isDeposito ? 'Depositar' : 'Retirar'}
              </h2>
              <p className="text-xs text-gray-500">{caixinha.nome}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-dark-800 transition-colors text-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Info da Caixinha */}
          <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg">
            <span className="text-2xl">{caixinha.icone}</span>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Saldo Atual</p>
              <p className="text-lg font-bold text-primary-400">
                {formatCurrency(caixinha.saldo_atual)}
              </p>
            </div>
            {caixinha.meta_valor && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Meta</p>
                <p className="text-sm text-gray-300">{formatCurrency(caixinha.meta_valor)}</p>
              </div>
            )}
          </div>

          {/* Origem do Depósito */}
          {isDeposito && (
            <div>
              <p className="text-sm font-medium text-gray-300 mb-2">Origem do valor</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setOrigemDeposito('orcamento'); setContaOrigemId('') }}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors',
                    origemDeposito === 'orcamento'
                      ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                      : 'border-dark-600 bg-dark-800 text-gray-400 hover:border-dark-500'
                  )}
                >
                  <Wallet className="w-5 h-5" />
                  <span className="font-medium">Saldo de Orçamento</span>
                  <span className="text-xs opacity-75">{formatCurrency(saldoDisponivelParaDeposito)} disponível</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrigemDeposito('conta')}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors',
                    origemDeposito === 'conta'
                      ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                      : 'border-dark-600 bg-dark-800 text-gray-400 hover:border-dark-500',
                    contasInvestimento.length === 0 && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={contasInvestimento.length === 0}
                  title={contasInvestimento.length === 0 ? 'Nenhuma conta de investimento cadastrada' : ''}
                >
                  <Building2 className="w-5 h-5" />
                  <span className="font-medium">Conta de Investimento</span>
                  <span className="text-xs opacity-75">
                    {contasInvestimento.length === 0 ? 'Nenhuma conta' : `${contasInvestimento.length} conta(s)`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Saldo Disponível para Depósito — apenas quando origem = orçamento */}
          {isDeposito && origemDeposito === 'orcamento' && (
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex-1">
                <p className="text-sm text-gray-400">Saldo Disponível para Alocar</p>
                <p className="text-lg font-bold text-green-400">
                  {formatCurrency(saldoDisponivelParaDeposito)}
                </p>
              </div>
              <p className="text-xs text-gray-500 max-w-[150px] text-right">
                Sobra de meses anteriores
              </p>
            </div>
          )}

          {/* Seleção de conta de investimento como origem */}
          {isDeposito && origemDeposito === 'conta' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Building2 size={14} className="inline mr-1" />
                Selecione a conta de origem
              </label>
              <select
                value={contaOrigemId}
                onChange={(e) => setContaOrigemId(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
              >
                <option value="">Selecione uma conta...</option>
                {contasInvestimento.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.icone || '💼'} {conta.nome}{conta.instituicao ? ` — ${conta.instituicao}` : ''} ({formatCurrency(conta.saldo_atual)})
                  </option>
                ))}
              </select>
              {contaSelecionada && (
                <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-gray-400">Saldo disponível na conta</p>
                  <p className="text-lg font-bold text-blue-400">{formatCurrency(contaSelecionada.saldo_atual)}</p>
                  {excedeSaldoConta && (
                    <div className="flex items-center gap-2 mt-1">
                      <AlertTriangle size={13} className="text-red-400 shrink-0" />
                      <p className="text-xs text-red-400">Valor excede o saldo da conta</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mês de origem (apenas para depósito de orçamento quando há múltiplos meses) */}
          {isDeposito && origemDeposito === 'orcamento' && mesesComSaldo.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar size={14} className="inline mr-2" />
                De qual mês está alocando?
              </label>
              <select
                value={mesOrigem}
                onChange={(e) => setMesOrigem(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              >
                {mesesComSaldo.map((mes) => (
                  <option key={mes.mesRef} value={mes.mesRef}>
                    {format(new Date(`${mes.mesRef}-01`), "MMMM 'de' yyyy", { locale: ptBR })} - {formatCurrency(mes.saldoDisponivel)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Valor
            </label>
            <CurrencyInput
              value={valor}
              onChange={setValor}
              placeholder="R$ 0,00"
              className="w-full"
            />
            {!isDeposito && valor > caixinha.saldo_atual && (
              <p className="text-xs text-red-400 mt-1">
                Valor maior que o saldo disponível
              </p>
            )}
            {excedeSaldoDisponivel && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-400">
                  Valor excede o saldo disponível de {formatCurrency(saldoDisponivelParaDeposito)}
                </p>
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descrição (opcional)
            </label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={isDeposito ? 'Ex: Salário de janeiro' : 'Ex: Compra de viagem'}
            />
          </div>

          {/* Mês destino (apenas para retirada) */}
          {!isDeposito && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar size={14} className="inline mr-2" />
                Compor orçamento de qual mês?
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Registra para qual mês este valor será utilizado (apenas para controle)
              </p>
              <select
                value={mesDestino}
                onChange={(e) => setMesDestino(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              >
                {opcoesDesMeses.map((mes) => (
                  <option key={mes.value} value={mes.value} className="capitalize">
                    {mes.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview do novo saldo */}
          {valor > 0 && (
            <div
              className={cn(
                'p-3 rounded-lg border',
                isDeposito
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              )}
            >
              <p className="text-sm text-gray-400 mb-1">Novo saldo após {isDeposito ? 'depósito' : 'retirada'}:</p>
              <p
                className={cn(
                  'text-xl font-bold',
                  isDeposito ? 'text-green-400' : 'text-amber-400'
                )}
              >
                {formatCurrency(
                  isDeposito
                    ? caixinha.saldo_atual + valor
                    : Math.max(0, caixinha.saldo_atual - valor)
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-dark-700">
          <Button variant="ghost" onClick={handleClose} disabled={isLoading} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              valor <= 0 ||
              isLoading ||
              (!isDeposito && valor > caixinha.saldo_atual) ||
              excedeSaldoDisponivel ||
              excedeSaldoConta ||
              (isDeposito && origemDeposito === 'conta' && !contaOrigemId)
            }
            isLoading={isLoading}
            className={cn(
              'flex-1',
              isDeposito ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'
            )}
          >
            {isDeposito ? (
              <>
                <ArrowUpCircle size={18} className="mr-2" />
                Depositar
              </>
            ) : (
              <>
                <ArrowDownCircle size={18} className="mr-2" />
                Retirar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
