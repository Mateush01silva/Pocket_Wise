import { useState, useMemo } from 'react'
import { Modal } from './ui/Modal'
import { Button, Input, Select, CurrencyInput } from './ui'
import { useCategoriasStore, useCartoesStore, useTransacoesStore } from '../store'
import type { CreateLancamentoInput } from '../types'
import { format } from 'date-fns'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TransactionModal({ isOpen, onClose }: TransactionModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  // Select raw cartoes array and derive active cards with memo to keep identity stable
  const cartoes = useCartoesStore((state) => state.cartoes)
  const createLancamento = useTransacoesStore((state) => state.createLancamento)
  const createLancamentoParcelado = useTransacoesStore(
    (state) => state.createLancamentoParcelado
  )

  const [formData, setFormData] = useState<Partial<CreateLancamentoInput>>({
    tipo: 'despesa',
    data: format(new Date(), 'yyyy-MM-dd'),
    forma_pagamento: 'dinheiro',
    valor: 0,
  })
  const [parcelas, setParcelas] = useState<number>(1)
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

      // Use a dummy family_id for LocalStorage mode (until auth is implemented)
      const lancamentoData: CreateLancamentoInput = {
        family_id: 'local-storage-family',
        tipo: formData.tipo as 'receita' | 'despesa',
        categoria_id: formData.categoria_id!,
        subcategoria_id: formData.subcategoria_id,
        valor: formData.valor!,
        data: formData.data!,
        forma_pagamento: formData.forma_pagamento as any,
        cartao_id: formData.cartao_id,
        observacao: formData.observacao,
        status: 'pendente',
      }

      // Se é cartão de crédito com parcelamento
      if (
        formData.forma_pagamento === 'credito' &&
        formData.cartao_id &&
        parcelas > 1
      ) {
        await createLancamentoParcelado(lancamentoData, parcelas)
      } else {
        await createLancamento(lancamentoData)
      }

      // Reset form and close
      setFormData({
        tipo: 'despesa',
        data: format(new Date(), 'yyyy-MM-dd'),
        forma_pagamento: 'dinheiro',
        valor: 0,
      })
      setParcelas(1)
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
      })
      setParcelas(1)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={formData.tipo === 'despesa' ? 'Nova Despesa' : 'Nova Receita'}
      description="Adicione uma nova transação às suas finanças"
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

        {/* Forma de Pagamento */}
        <Select
          label="Forma de Pagamento *"
          value={formData.forma_pagamento || 'dinheiro'}
          onChange={(e) =>
            setFormData({
              ...formData,
              forma_pagamento: e.target.value as any,
              cartao_id: undefined,
            })
          }
          options={[
            { value: 'dinheiro', label: 'Dinheiro' },
            { value: 'debito', label: 'Débito' },
            { value: 'credito', label: 'Crédito' },
            { value: 'pix', label: 'PIX' },
            { value: 'transferencia', label: 'Transferência' },
          ]}
          required
        />

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
