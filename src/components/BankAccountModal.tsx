import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button, Input, CurrencyInput } from './ui'
import { useContasBancariasStore, useFamilyStore } from '../store'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import type { CreateContaBancariaInput, ContaBancaria, TipoConta } from '../types'
import { Landmark, Wallet, Smartphone, DollarSign, TrendingUp, HelpCircle } from 'lucide-react'

interface BankAccountModalProps {
  isOpen: boolean
  onClose: () => void
  conta?: ContaBancaria // Para edição
}

const CORES_DISPONIVEIS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
]

const TIPOS_CONTA: { value: TipoConta; label: string; icon: React.ReactNode }[] = [
  { value: 'conta_corrente', label: 'Conta Corrente', icon: <Landmark size={18} /> },
  { value: 'poupanca', label: 'Poupança', icon: <Wallet size={18} /> },
  { value: 'carteira_digital', label: 'Carteira Digital', icon: <Smartphone size={18} /> },
  { value: 'dinheiro', label: 'Dinheiro', icon: <DollarSign size={18} /> },
  { value: 'investimento', label: 'Investimento', icon: <TrendingUp size={18} /> },
  { value: 'outra', label: 'Outra', icon: <HelpCircle size={18} /> },
]

const ICONES_DISPONIVEIS = ['💳', '🏦', '💰', '💵', '💸', '🪙', '📱', '💼', '🏠', '🚗']

export function BankAccountModal({ isOpen, onClose, conta }: BankAccountModalProps) {
  const createConta = useContasBancariasStore((state) => state.createConta)
  const updateConta = useContasBancariasStore((state) => state.updateConta)
  const familyId = useFamilyStore((state: any) => state.family?.id)
  const caixinhas = useCaixinhasStore((state) => state.caixinhas)
  const updateCaixinha = useCaixinhasStore((state) => state.updateCaixinha)

  const [formData, setFormData] = useState<Partial<CreateContaBancariaInput>>({
    nome: '',
    tipo: 'conta_corrente',
    saldo_inicial: 0,
    cor: CORES_DISPONIVEIS[10], // Azul por padrão
    icone: '💳',
    ativo: true,
    instituicao: '',
    agencia: '',
    numero_conta: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const isEditMode = !!conta

  // Preencher form com dados da conta ao editar
  useEffect(() => {
    if (conta) {
      setFormData({
        nome: conta.nome,
        tipo: conta.tipo,
        saldo_inicial: conta.saldo_atual, // Carregar saldo atual para edição
        cor: conta.cor || CORES_DISPONIVEIS[10],
        icone: conta.icone || '💳',
        ativo: conta.ativo,
        instituicao: conta.instituicao || '',
        agencia: conta.agencia || '',
        numero_conta: conta.numero_conta || '',
      })
    } else {
      setFormData({
        nome: '',
        tipo: 'conta_corrente',
        saldo_inicial: 0,
        cor: CORES_DISPONIVEIS[10],
        icone: '💳',
        ativo: true,
        instituicao: '',
        agencia: '',
        numero_conta: '',
      })
    }
  }, [conta])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validações
      if (!formData.nome?.trim()) {
        alert('Por favor, informe o nome da conta')
        setIsLoading(false)
        return
      }

      if (!formData.tipo) {
        alert('Por favor, selecione o tipo da conta')
        setIsLoading(false)
        return
      }

      if (formData.saldo_inicial === undefined || formData.saldo_inicial < 0) {
        alert('O saldo inicial não pode ser negativo')
        setIsLoading(false)
        return
      }

      if (!familyId) {
        alert('Erro: Family ID não encontrado')
        setIsLoading(false)
        return
      }

      if (isEditMode && conta) {
        // Atualizar conta existente
        await updateConta(conta.id, {
          nome: formData.nome,
          tipo: formData.tipo,
          saldo_atual: formData.saldo_inicial, // Permite ajustar saldo atual
          cor: formData.cor,
          icone: formData.icone,
          ativo: formData.ativo ?? true,
          instituicao: formData.instituicao || null,
          agencia: formData.agencia || null,
          numero_conta: formData.numero_conta || null,
        })

        // Se é conta de investimento e o saldo mudou, distribuir o delta nas caixinhas vinculadas
        const novoSaldo = formData.saldo_inicial ?? 0
        const delta = novoSaldo - conta.saldo_atual
        if (conta.tipo === 'investimento' && delta !== 0) {
          const caixinhasVinculadas = caixinhas.filter(
            (c) => c.conta_investimento_id === conta.id && c.tipo === 'investimento' && c.ativa
          )
          if (caixinhasVinculadas.length > 0) {
            const totalMercado = caixinhasVinculadas.reduce(
              (sum, c) => sum + (c.valor_mercado ?? c.saldo_atual), 0
            )
            for (const caixinha of caixinhasVinculadas) {
              const mercadoCaixinha = caixinha.valor_mercado ?? caixinha.saldo_atual
              const proporcao = totalMercado > 0 ? mercadoCaixinha / totalMercado : 1 / caixinhasVinculadas.length
              const novoValorMercado = Math.max(0, mercadoCaixinha + delta * proporcao)
              await updateCaixinha({
                id: caixinha.id,
                valor_mercado: novoValorMercado,
                data_valor_mercado: new Date().toISOString(),
              })
            }
          }
        }

        alert('Conta atualizada com sucesso!')
      } else {
        // Criar nova conta
        const newConta = await createConta({
          family_id: familyId,
          nome: formData.nome!,
          tipo: formData.tipo as TipoConta,
          saldo_inicial: formData.saldo_inicial!,
          cor: formData.cor || CORES_DISPONIVEIS[10],
          icone: formData.icone || '💳',
          ativo: formData.ativo ?? true,
          instituicao: formData.instituicao || null,
          agencia: formData.agencia || null,
          numero_conta: formData.numero_conta || null,
        })

        if (newConta) {
          alert('Conta criada com sucesso!')
        } else {
          throw new Error('Erro ao criar conta')
        }
      }

      onClose()
    } catch (error) {
      console.error('Erro ao salvar conta:', error)
      alert('Erro ao salvar conta. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nome da Conta *
          </label>
          <Input
            type="text"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Nubank Conta Corrente, Dinheiro em Espécie"
            required
          />
        </div>

        {/* Tipo de Conta */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tipo de Conta *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_CONTA.map((tipo) => (
              <button
                key={tipo.value}
                type="button"
                onClick={() => setFormData({ ...formData, tipo: tipo.value })}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  formData.tipo === tipo.value
                    ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                    : 'border-dark-600 bg-dark-700 text-gray-400 hover:border-dark-500'
                }`}
              >
                {tipo.icon}
                <span className="text-sm">{tipo.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Saldo Inicial (criação) ou Saldo Atual (edição) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {isEditMode ? 'Saldo Atual' : 'Saldo Inicial'}
          </label>
          <CurrencyInput
            value={formData.saldo_inicial || 0}
            onChange={(value) => setFormData({ ...formData, saldo_inicial: value })}
            placeholder="0,00"
          />
          <p className="text-xs text-gray-500 mt-1">
            {isEditMode
              ? 'Ajuste manual do saldo desta conta (use com cuidado!)'
              : 'Informe o saldo atual desta conta'}
          </p>
        </div>

        {/* Instituição Financeira */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Instituição Financeira
          </label>
          <Input
            type="text"
            value={formData.instituicao || ''}
            onChange={(e) => setFormData({ ...formData, instituicao: e.target.value })}
            placeholder="Ex: Nubank, Banco Inter, C6 Bank"
          />
        </div>

        {/* Agência e Conta (opcional) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Agência</label>
            <Input
              type="text"
              value={formData.agencia || ''}
              onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
              placeholder="0001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Número</label>
            <Input
              type="text"
              value={formData.numero_conta || ''}
              onChange={(e) => setFormData({ ...formData, numero_conta: e.target.value })}
              placeholder="12345-6"
            />
          </div>
        </div>

        {/* Ícone */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ícone/Emoji
          </label>
          <div className="flex gap-2 flex-wrap">
            {ICONES_DISPONIVEIS.map((icone) => (
              <button
                key={icone}
                type="button"
                onClick={() => setFormData({ ...formData, icone })}
                className={`w-12 h-12 rounded-lg border text-2xl transition-all ${
                  formData.icone === icone
                    ? 'border-primary-500 bg-primary-500/10 scale-110'
                    : 'border-dark-600 bg-dark-700 hover:border-dark-500'
                }`}
              >
                {icone}
              </button>
            ))}
          </div>
        </div>

        {/* Cor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Cor</label>
          <div className="flex gap-2 flex-wrap">
            {CORES_DISPONIVEIS.map((cor) => (
              <button
                key={cor}
                type="button"
                onClick={() => setFormData({ ...formData, cor })}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  formData.cor === cor
                    ? 'border-white scale-125'
                    : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: cor }}
              />
            ))}
          </div>
        </div>

        {/* Status (apenas na edição) */}
        {isEditMode && (
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-300">Conta ativa</span>
            </label>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading} className="flex-1">
            {isLoading ? 'Salvando...' : isEditMode ? 'Salvar' : 'Criar Conta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
