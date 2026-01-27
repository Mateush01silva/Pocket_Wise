import { useState, useMemo } from 'react'
import { X, CreditCard, Calendar, AlertCircle, Plus } from 'lucide-react'
import { useTransacoesStore, useCategoriasStore } from '../store'
import { Button, Input, Select, CurrencyInput } from './ui'
import { format, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Cartao } from '../types'

interface ConsolidatedInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  cartao: Cartao
}

export function ConsolidatedInvoiceModal({ isOpen, onClose, cartao }: ConsolidatedInvoiceModalProps) {
  const createLancamento = useTransacoesStore((state) => state.createLancamento)
  const categorias = useCategoriasStore((state) => state.categorias)

  const [valor, setValor] = useState(0)
  const [mesVencimento, setMesVencimento] = useState(format(new Date(), 'yyyy-MM'))
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Categorias de despesa
  const categoriasDespesa = useMemo(
    () => categorias.filter((c) => c.tipo === 'despesa' && !c.categoria_pai_id),
    [categorias]
  )

  const categoriaOptions = useMemo(
    () => [
      { value: '', label: 'Selecione uma categoria' },
      ...categoriasDespesa.map((c) => ({ value: c.id, label: c.nome })),
    ],
    [categoriasDespesa]
  )

  // Gerar opções de meses (próximos 6 meses)
  const mesesOptions = useMemo(() => {
    const opcoes = []
    const hoje = new Date()
    for (let i = 0; i < 6; i++) {
      const mes = addMonths(hoje, i)
      const valor = format(mes, 'yyyy-MM')
      const label = format(mes, "MMMM 'de' yyyy", { locale: ptBR })
      opcoes.push({ value: valor, label: label.charAt(0).toUpperCase() + label.slice(1) })
    }
    return opcoes
  }, [])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!valor || valor <= 0) {
      alert('Digite um valor válido para a fatura')
      return
    }

    if (!categoriaId) {
      alert('Selecione uma categoria')
      return
    }

    setIsLoading(true)

    try {
      // Calcular data de vencimento baseado no mês selecionado e dia de vencimento do cartão
      const [ano, mes] = mesVencimento.split('-')
      const diaVencimento = Math.min(cartao.dia_vencimento, 28) // Evitar problemas com meses curtos
      const dataVencimento = `${ano}-${mes}-${String(diaVencimento).padStart(2, '0')}`

      // Criar lançamento consolidado
      const descricaoFatura = descricao || `Fatura ${cartao.nome} - ${format(new Date(mesVencimento + '-01'), "MMM/yyyy", { locale: ptBR })}`
      await createLancamento({
        valor,
        data: dataVencimento,
        tipo: 'despesa',
        categoria_id: categoriaId,
        subcategoria_id: null,
        conta_id: null,
        cartao_id: cartao.id,
        forma_pagamento: 'credito',
        status: 'pendente',
        observacao: `${descricaoFatura} - Fatura consolidada (ponto de partida)`,
      })

      alert('Fatura consolidada lançada com sucesso!')
      onClose()

      // Reset form
      setValor(0)
      setDescricao('')
      setCategoriaId('')
      setMesVencimento(format(new Date(), 'yyyy-MM'))
    } catch (error) {
      console.error('Erro ao lançar fatura:', error)
      alert('Erro ao lançar fatura. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md shadow-xl border border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${cartao.cor}20` }}
            >
              <CreditCard size={20} style={{ color: cartao.cor }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Lançar Fatura Consolidada</h2>
              <p className="text-sm text-gray-400">{cartao.nome}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="mb-1"><strong>Ponto de partida</strong></p>
              <p className="text-xs text-gray-400">
                Use esta opção para registrar faturas anteriores sem precisar lançar cada compra individualmente.
                Ideal para começar a usar o app com o histórico de cartões.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mês da Fatura */}
          <Select
            label="Mês de Vencimento da Fatura"
            value={mesVencimento}
            onChange={(e) => setMesVencimento(e.target.value)}
            options={mesesOptions}
          />

          {/* Valor da Fatura */}
          <CurrencyInput
            label="Valor Total da Fatura"
            required
            value={valor}
            onChange={setValor}
          />

          {/* Categoria */}
          <Select
            label="Categoria"
            required
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            options={categoriaOptions}
            helperText="Escolha a categoria principal dos gastos"
          />

          {/* Descrição (opcional) */}
          <Input
            label="Descrição (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={`Fatura ${cartao.nome}`}
          />

          {/* Info de vencimento */}
          <div className="flex items-center gap-2 p-3 bg-dark-700/50 rounded-lg text-sm">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-gray-300">
              Vencimento: dia {cartao.dia_vencimento} de cada mês
            </span>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={isLoading || !valor || !categoriaId}
            >
              <Plus size={16} />
              {isLoading ? 'Lançando...' : 'Lançar Fatura'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
