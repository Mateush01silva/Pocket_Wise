import { useState, useMemo, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button, Input, Select, CurrencyInput } from './ui'
import { useCategoriasStore, useCartoesStore, useContasBancariasStore, useTransacoesStore } from '../store'
import type { CreateLancamentoInput, Lancamento } from '../types'
import { format } from 'date-fns'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  editingLancamento?: Lancamento
}

export function TransactionModal({ isOpen, onClose, editingLancamento }: TransactionModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  // Select raw cartoes array and derive active cards with memo to keep identity stable
  const cartoes = useCartoesStore((state) => state.cartoes)
  const contas = useContasBancariasStore((state) => state.contas)
  const fetchContas = useContasBancariasStore((state) => state.fetchContas)
  const createLancamento = useTransacoesStore((state) => state.createLancamento)
  const createLancamentoParcelado = useTransacoesStore(
    (state) => state.createLancamentoParcelado
  )
  const createLancamentoRecorrente = useTransacoesStore(
    (state) => state.createLancamentoRecorrente
  )
  const updateLancamento = useTransacoesStore((state) => state.updateLancamento)

  const [formData, setFormData] = useState<Partial<CreateLancamentoInput>>({
    tipo: 'despesa',
    data: format(new Date(), 'yyyy-MM-dd'),
    forma_pagamento: 'dinheiro',
    valor: 0,
    status: 'pago',
    conta_id: undefined,
  })
  const [parcelas, setParcelas] = useState<number>(1)
  const [isRecorrente, setIsRecorrente] = useState<boolean>(false)
  const [mesesRecorrencia, setMesesRecorrencia] = useState<number>(3)
  const [isLoading, setIsLoading] = useState(false)

  // Filtrar categorias principais por tipo
  const categoriasPrincipais = useMemo(() => {
    return categorias.filter(
      (c) => !c.categoria_pai_id && c.tipo === formData.tipo
    )
  }, [categorias, formData.tipo])

  // Filtrar subcategorias da categoria selecionada
  const subcategorias = useMemo(() => {
    if (!formData.categoria_id) return []
    return categorias.filter((c) => c.categoria_pai_id === formData.categoria_id)
  }, [categorias, formData.categoria_id])

  // Convert categorias to options format (memoized)
  const categoriaOptions = useMemo(() => categoriasPrincipais.map((cat) => ({
    value: cat.id,
    label: cat.nome,
  })), [categoriasPrincipais])

  const subcategoriaOptions = useMemo(() => subcategorias.map((sub) => ({
    value: sub.id,
    label: sub.nome,
  })), [subcategorias])

  const cartaoOptions = useMemo(() => {
    return cartoes.filter(c => c.ativo).map((cartao) => ({
      value: cartao.id,
      label: cartao.nome,
    }))
  }, [cartoes])

  const contaOptions = useMemo(() => {
    return contas.filter(c => c.ativo).map((conta) => ({
      value: conta.id,
      label: `${conta.icone || ''} ${conta.nome}`.trim(),
    }))
  }, [contas])

  // Buscar contas ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      fetchContas()
    }
  }, [isOpen, fetchContas])

  // Effect to populate form when editing
  useEffect(() => {
    if (editingLancamento && isOpen) {
      setFormData({
        tipo: editingLancamento.tipo,
        categoria_id: editingLancamento.categoria_id || undefined,
        subcategoria_id: editingLancamento.subcategoria_id || undefined,
        valor: editingLancamento.valor,
        data: editingLancamento.data,
        forma_pagamento: editingLancamento.forma_pagamento,
        cartao_id: editingLancamento.cartao_id || undefined,
        conta_id: editingLancamento.conta_id || undefined,
        observacao: editingLancamento.observacao || undefined,
        status: editingLancamento.status || 'pago',
      })
      setParcelas(editingLancamento.parcela_total || 1)
    } else if (!isOpen) {
      // Reset form when closing
      setFormData({
        tipo: 'despesa',
        data: format(new Date(), 'yyyy-MM-dd'),
        forma_pagamento: 'dinheiro',
        valor: 0,
        status: 'pago',
        conta_id: undefined,
      })
      setParcelas(1)
      setIsRecorrente(false)
      setMesesRecorrencia(3)
    }
  }, [editingLancamento, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validações básicas
      if (!formData.tipo || !formData.categoria_id || !formData.valor || !formData.data) {
        alert('Por favor, preencha todos os campos obrigatórios')
        setIsLoading(false)
        return
      }

      if (formData.valor <= 0) {
        alert('O valor deve ser maior que zero')
        setIsLoading(false)
        return
      }

      // Validar conta bancária para débito, PIX e transferência
      if (
        (formData.forma_pagamento === 'debito' ||
          formData.forma_pagamento === 'pix' ||
          formData.forma_pagamento === 'transferencia') &&
        !formData.conta_id
      ) {
        alert('Por favor, selecione a conta bancária para esta forma de pagamento')
        setIsLoading(false)
        return
      }

      // Se está editando
      if (editingLancamento) {
        await updateLancamento(editingLancamento.id, {
          tipo: formData.tipo as 'receita' | 'despesa',
          categoria_id: formData.categoria_id!,
          subcategoria_id: formData.subcategoria_id,
          valor: formData.valor!,
          data: formData.data!,
          forma_pagamento: formData.forma_pagamento as any,
          cartao_id: formData.cartao_id,
          conta_id: formData.conta_id,
          observacao: formData.observacao,
          status: formData.status,
        })
      } else {
        // Criando novo
        const lancamentoData: CreateLancamentoInput = {
          family_id: 'local-storage-family',
          tipo: formData.tipo as 'receita' | 'despesa',
          categoria_id: formData.categoria_id!,
          subcategoria_id: formData.subcategoria_id,
          valor: formData.valor!,
          data: formData.data!,
          forma_pagamento: formData.forma_pagamento as any,
          cartao_id: formData.cartao_id,
          conta_id: formData.conta_id,
          observacao: formData.observacao,
          status: formData.status || 'pago',
        }

        // Se é transação recorrente
        if (isRecorrente && mesesRecorrencia > 1) {
          await createLancamentoRecorrente(lancamentoData, mesesRecorrencia)
        }
        // Se é cartão de crédito com parcelamento (e não é recorrente)
        else if (
          formData.forma_pagamento === 'credito' &&
          formData.cartao_id &&
          parcelas > 1
        ) {
          await createLancamentoParcelado(lancamentoData, parcelas)
        }
        // Lançamento simples
        else {
          await createLancamento(lancamentoData)
        }
      }

      // Reset form and close
      setFormData({
        tipo: 'despesa',
        data: format(new Date(), 'yyyy-MM-dd'),
        forma_pagamento: 'dinheiro',
        valor: 0,
        status: 'pago',
        conta_id: undefined,
      })
      setParcelas(1)
      setIsRecorrente(false)
      setMesesRecorrencia(3)
      onClose()
    } catch (error) {
      console.error('Erro ao criar transação:', error)
      alert('Erro ao criar transação. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        tipo: 'despesa',
        data: format(new Date(), 'yyyy-MM-dd'),
        forma_pagamento: 'dinheiro',
        valor: 0,
        status: 'pago',
        conta_id: undefined,
      })
      setParcelas(1)
      setIsRecorrente(false)
      setMesesRecorrencia(3)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingLancamento
        ? `Editar ${formData.tipo === 'despesa' ? 'Despesa' : 'Receita'}`
        : formData.tipo === 'despesa' ? 'Nova Despesa' : 'Nova Receita'
      }
      description={editingLancamento
        ? "Edite os detalhes da transação"
        : "Adicione uma nova transação às suas finanças"
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Tipo de Transação *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipo"
                value="despesa"
                checked={formData.tipo === 'despesa'}
                onChange={(e) =>
                  setFormData({ ...formData, tipo: e.target.value as any, categoria_id: undefined, subcategoria_id: undefined })
                }
                className="w-4 h-4 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-200">Despesa</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipo"
                value="receita"
                checked={formData.tipo === 'receita'}
                onChange={(e) =>
                  setFormData({ ...formData, tipo: e.target.value as any, categoria_id: undefined, subcategoria_id: undefined })
                }
                className="w-4 h-4 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-200">Receita</span>
            </label>
          </div>
        </div>

        {/* Categoria e Subcategoria */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Categoria *"
            value={formData.categoria_id || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                categoria_id: e.target.value || undefined,
                subcategoria_id: undefined,
              })
            }
            options={categoriaOptions}
            required
          />

          {subcategorias.length > 0 && (
            <Select
              label="Subcategoria"
              value={formData.subcategoria_id || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  subcategoria_id: e.target.value || undefined,
                })
              }
              options={subcategoriaOptions}
            />
          )}
        </div>

        {/* Valor e Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label="Valor *"
            value={formData.valor}
            onChange={(value) => setFormData({ ...formData, valor: value })}
            required
          />

          <Input
            type="date"
            label="Data *"
            value={formData.data}
            onChange={(e) => setFormData({ ...formData, data: e.target.value })}
            required
          />
        </div>

        {/* Status */}
        <Select
          label="Status *"
          value={formData.status || 'pago'}
          onChange={(e) =>
            setFormData({ ...formData, status: e.target.value as any })
          }
          options={[
            { value: 'pago', label: 'Pago' },
            { value: 'pendente', label: 'Pendente' },
            { value: 'projetado', label: 'Projetado' },
          ]}
          required
        />

        {/* Forma de Pagamento */}
        <Select
          label="Forma de Pagamento *"
          value={formData.forma_pagamento || 'dinheiro'}
          onChange={(e) =>
            setFormData({
              ...formData,
              forma_pagamento: e.target.value as any,
              cartao_id: undefined,
              conta_id: undefined, // Limpar conta ao mudar forma de pagamento
            })
          }
          options={[
            { value: 'dinheiro', label: 'Dinheiro' },
            { value: 'debito', label: 'Débito' },
            { value: 'credito', label: 'Crédito' },
            { value: 'pix', label: 'PIX' },
            { value: 'transferencia', label: 'Transferência' },
            { value: 'boleto', label: 'Boleto' },
          ]}
          required
        />

        {/* Conta Bancária (para todas exceto crédito) */}
        {formData.forma_pagamento !== 'credito' && (
          <div>
            <Select
              label={
                formData.forma_pagamento === 'debito' ||
                formData.forma_pagamento === 'pix' ||
                formData.forma_pagamento === 'transferencia'
                  ? 'Conta Bancária *'
                  : 'Conta Bancária'
              }
              value={formData.conta_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, conta_id: e.target.value || undefined })
              }
              options={contaOptions}
              required={
                formData.forma_pagamento === 'debito' ||
                formData.forma_pagamento === 'pix' ||
                formData.forma_pagamento === 'transferencia'
              }
              helperText={
                contaOptions.length === 0
                  ? '⚠️ Nenhuma conta cadastrada. Vá em "Contas" no menu lateral para criar uma.'
                  : formData.forma_pagamento === 'debito' ||
                    formData.forma_pagamento === 'pix' ||
                    formData.forma_pagamento === 'transferencia'
                  ? '💳 Selecione a conta de onde sairá/entrará o dinheiro (obrigatório)'
                  : '💰 Opcional: Selecione a conta para controle do saldo'
              }
            />
          </div>
        )}

        {/* Cartão (só se for crédito) */}
        {formData.forma_pagamento === 'credito' && (
          <div className="space-y-4">
            <Select
              label="Cartão de Crédito *"
              value={formData.cartao_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, cartao_id: e.target.value || undefined })
              }
              options={cartaoOptions}
              required
            />

            {/* Parcelas */}
            {formData.cartao_id && (
              <Input
                type="number"
                label="Número de Parcelas"
                value={parcelas}
                onChange={(e) => setParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={24}
                helperText="Deixe 1 para pagamento à vista"
              />
            )}
          </div>
        )}

        {/* Transação Recorrente */}
        {!editingLancamento && (
          <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <input
              type="checkbox"
              id="is_recorrente"
              checked={isRecorrente}
              onChange={(e) => setIsRecorrente(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-dark-800"
            />
            <div className="flex-1">
              <label htmlFor="is_recorrente" className="text-sm font-medium text-green-300 cursor-pointer">
                🔄 Transação Recorrente
              </label>
              <p className="text-xs text-gray-400 mt-1">
                Repete esta transação automaticamente nos próximos meses. Ideal para:
              </p>
              <ul className="text-xs text-gray-400 mt-1 list-disc list-inside space-y-0.5">
                <li>Aluguel, conta de luz, internet</li>
                <li>Assinaturas mensais (Netflix, Spotify)</li>
                <li>Parcelas restantes de compras (ex: parcela 4/10, crie 7 recorrências)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Configuração de Recorrência */}
        {isRecorrente && !editingLancamento && (
          <div className="p-4 bg-dark-700/50 border border-dark-600 rounded-lg space-y-3">
            <Input
              type="number"
              label="Repetir por quantos meses?"
              value={mesesRecorrencia}
              onChange={(e) => setMesesRecorrencia(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={24}
              helperText={`Será criada 1 transação por mês, totalizando ${mesesRecorrencia} transação${mesesRecorrencia > 1 ? 'ões' : ''}`}
            />
            <div className="flex items-start gap-2 text-xs text-gray-400">
              <span>💡</span>
              <span>
                As transações futuras serão criadas com status "Pendente".
                Transações passadas serão criadas como "Pago".
              </span>
            </div>
          </div>
        )}

        {/* Observação */}
        <div>
          <label
            htmlFor="observacao"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Observação
          </label>
          <textarea
            id="observacao"
            value={formData.observacao || ''}
            onChange={(e) =>
              setFormData({ ...formData, observacao: e.target.value })
            }
            rows={3}
            className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            placeholder="Adicione detalhes sobre esta transação..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-dark-700/50">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar Transação'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
