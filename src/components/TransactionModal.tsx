import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button, Input, Select, CurrencyInput, confirmDialog } from './ui'
import { TagInput } from './TagInput'
import { MOEDAS, buscarCotacaoAtual, lerUltimaCotacao, salvarUltimaCotacao } from '../lib/moedas'
import { useCategoriasStore, useCartoesStore, useContasBancariasStore, useTransacoesStore } from '../store'
import {
  encontrarLancamentosParecidos,
  descreverLancamento,
  montarMensagemDuplicados,
} from '../lib/duplicadosUtils'
import type { CreateLancamentoInput, Lancamento } from '../types'
import { format } from 'date-fns'

// Nova despesa nasce como compra no crédito (status 'projetado') quando o
// usuário tem cartão ativo — a maioria dos gastos é no cartão, então só
// falta escolher qual. Com um único cartão, ele já vem selecionado.
// Sem cartão cadastrado, mantém o padrão dinheiro/pago.
// (Lê a store de forma não-reativa: os defaults são aplicados só na abertura.)
function criarFormPadrao(): Partial<CreateLancamentoInput> {
  const cartoesAtivos = useCartoesStore.getState().cartoes.filter((c) => c.ativo)
  const base = {
    tipo: 'despesa' as const,
    data: format(new Date(), 'yyyy-MM-dd'),
    valor: 0,
    conta_id: undefined,
  }

  if (cartoesAtivos.length === 0) {
    return { ...base, forma_pagamento: 'dinheiro', status: 'pago' }
  }

  return {
    ...base,
    forma_pagamento: 'credito',
    status: 'projetado',
    cartao_id: cartoesAtivos.length === 1 ? cartoesAtivos[0].id : undefined,
  }
}

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  editingLancamento?: Lancamento
  // Dados iniciais ao criar (ex.: vindos da "linha rápida" da tabela, ao
  // clicar em "+ opções" para abrir o formulário completo já preenchido)
  initialData?: Partial<CreateLancamentoInput>
}

export function TransactionModal({ isOpen, onClose, editingLancamento, initialData }: TransactionModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  // Select raw cartoes array and derive active cards with memo to keep identity stable
  const cartoes = useCartoesStore((state) => state.cartoes)
  const contas = useContasBancariasStore((state) => state.contas)
  const fetchContas = useContasBancariasStore((state) => state.fetchContas)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const createLancamento = useTransacoesStore((state) => state.createLancamento)
  const createLancamentoParcelado = useTransacoesStore(
    (state) => state.createLancamentoParcelado
  )
  const createLancamentoRecorrente = useTransacoesStore(
    (state) => state.createLancamentoRecorrente
  )
  const updateLancamento = useTransacoesStore((state) => state.updateLancamento)
  const deleteLancamento = useTransacoesStore((state) => state.deleteLancamento)
  const deleteGrupoParcelas = useTransacoesStore((state) => state.deleteGrupoParcelas)

  const [formData, setFormData] = useState<Partial<CreateLancamentoInput>>(() => criarFormPadrao())
  const [parcelasInput, setParcelasInput] = useState<string>('1')
  const [isRecorrente, setIsRecorrente] = useState<boolean>(false)
  const [mesesRecorrencia, setMesesRecorrencia] = useState<number>(3)
  const [isLoading, setIsLoading] = useState(false)

  // Lançamento em moeda estrangeira: o usuário informa o valor na moeda e a
  // cotação; o valor em R$ (campo `valor`) é calculado a partir deles
  const [usarMoeda, setUsarMoeda] = useState(false)
  const [moeda, setMoeda] = useState('EUR')
  const [valorOriginal, setValorOriginal] = useState<number>(0)
  const [cotacaoInput, setCotacaoInput] = useState('')
  const [buscandoCotacao, setBuscandoCotacao] = useState(false)
  const cotacaoNum = parseFloat(cotacaoInput.replace(',', '.')) || 0

  // Tags já usadas em outros lançamentos (sugestões ao digitar)
  const tagsExistentes = useMemo(() => {
    const todas = new Set<string>()
    for (const l of lancamentos) for (const t of l.tags || []) todas.add(t)
    return Array.from(todas).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [lancamentos])

  const resetarMoeda = () => {
    setUsarMoeda(false)
    setMoeda('EUR')
    setValorOriginal(0)
    setCotacaoInput('')
  }

  const alternarMoeda = (ativo: boolean) => {
    setUsarMoeda(ativo)
    if (ativo && !cotacaoInput) {
      const ultima = lerUltimaCotacao(moeda)
      if (ultima) setCotacaoInput(String(ultima).replace('.', ','))
    }
  }

  const trocarMoeda = (codigo: string) => {
    setMoeda(codigo)
    const ultima = lerUltimaCotacao(codigo)
    setCotacaoInput(ultima ? String(ultima).replace('.', ',') : '')
  }

  const atualizarCotacao = async () => {
    setBuscandoCotacao(true)
    const cotacao = await buscarCotacaoAtual(moeda)
    setBuscandoCotacao(false)
    if (cotacao) {
      setCotacaoInput(cotacao.toFixed(4).replace('.', ','))
    } else {
      toast.error('Não foi possível buscar a cotação. Digite manualmente.')
    }
  }

  // Valor em R$ = valor na moeda × cotação (arredondado em centavos)
  useEffect(() => {
    if (!usarMoeda) return
    const emReais = Math.round(valorOriginal * cotacaoNum * 100) / 100
    setFormData((f) => (f.valor === emReais ? f : { ...f, valor: emReais }))
  }, [usarMoeda, valorOriginal, cotacaoNum])

  // Filtrar categorias principais por tipo (ordenadas alfabeticamente para
  // facilitar encontrar a categoria no momento do lançamento)
  const categoriasPrincipais = useMemo(() => {
    return categorias
      .filter((c) => !c.categoria_pai_id && c.tipo === formData.tipo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [categorias, formData.tipo])

  // Filtrar subcategorias da categoria selecionada (também em ordem alfabética)
  const subcategorias = useMemo(() => {
    if (!formData.categoria_id) return []
    return categorias
      .filter((c) => c.categoria_pai_id === formData.categoria_id)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
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

  // Portadores (titular + adicionais) do cartão selecionado, para registrar
  // quem realizou a compra. Só aparece quando o cartão tem portadores.
  const portadorOptions = useMemo(() => {
    if (!formData.cartao_id) return []
    const cartao = cartoes.find((c) => c.id === formData.cartao_id)
    return (cartao?.portadores ?? []).map((p) => ({
      value: p.id,
      label: p.nome,
    }))
  }, [cartoes, formData.cartao_id])

  // Possíveis duplicados: lançamentos já existentes com o mesmo tipo, data,
  // valor e categoria do que está sendo preenchido. Só na criação — na
  // edição o lançamento casaria consigo mesmo.
  const possiveisDuplicados = useMemo(() => {
    if (editingLancamento || !isOpen) return []
    if (!formData.tipo || !formData.data || !formData.categoria_id || !formData.valor || formData.valor <= 0) {
      return []
    }
    return encontrarLancamentosParecidos(lancamentos, {
      tipo: formData.tipo,
      data: formData.data,
      valor: formData.valor,
      categoria_id: formData.categoria_id,
    })
  }, [editingLancamento, isOpen, lancamentos, formData.tipo, formData.data, formData.valor, formData.categoria_id])

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

  // Mantém os dados iniciais sem fazer o efeito de populate reexecutar a cada
  // render (initialData costuma ser um objeto recriado pelo componente pai)
  const initialDataRef = useRef(initialData)
  useEffect(() => {
    initialDataRef.current = initialData
  }, [initialData])

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
        portador_id: editingLancamento.portador_id || undefined,
        conta_id: editingLancamento.conta_id || undefined,
        observacao: editingLancamento.observacao || undefined,
        status: editingLancamento.status || 'pago',
        tags: editingLancamento.tags || [],
      })
      setParcelasInput(String(editingLancamento.parcela_total || 1))
      if (editingLancamento.moeda_original && editingLancamento.valor_original != null) {
        setUsarMoeda(true)
        setMoeda(editingLancamento.moeda_original)
        setValorOriginal(editingLancamento.valor_original)
        setCotacaoInput(String(editingLancamento.cotacao ?? '').replace('.', ','))
      } else {
        resetarMoeda()
      }
    } else if (isOpen && !editingLancamento) {
      // Abrindo para criar: aplica os defaults (crédito/projetado quando há
      // cartão) e mescla dados pré-preenchidos (ex.: "+ opções" da linha
      // rápida), que têm prioridade sobre os defaults
      setFormData({ ...criarFormPadrao(), ...(initialDataRef.current || {}) })
      resetarMoeda()
    } else if (!isOpen) {
      // Reset form when closing
      setFormData(criarFormPadrao())
      resetarMoeda()
      setParcelasInput('1')
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
        toast.error('Preencha todos os campos obrigatórios')
        setIsLoading(false)
        return
      }

      if (formData.valor <= 0) {
        toast.error('O valor deve ser maior que zero')
        setIsLoading(false)
        return
      }

      if (usarMoeda && (valorOriginal <= 0 || cotacaoNum <= 0)) {
        toast.error('Informe o valor na moeda estrangeira e a cotação')
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
        toast.error('Selecione a conta bancária para esta forma de pagamento')
        setIsLoading(false)
        return
      }

      // Guarda contra duplicados na criação: além do aviso inline no
      // formulário, pede confirmação explícita (o aviso pode passar batido
      // em lançamentos rápidos em sequência)
      if (!editingLancamento && possiveisDuplicados.length > 0) {
        const confirmar = await confirmDialog({
          title: 'Possível lançamento duplicado',
          message: montarMensagemDuplicados(possiveisDuplicados),
          confirmLabel: 'Lançar mesmo assim',
          cancelLabel: 'Revisar',
        })
        if (!confirmar) {
          setIsLoading(false)
          return
        }
      }

      // Campos extras comuns a todos os fluxos de gravação. Ao desligar a
      // moeda estrangeira, grava null explicitamente (limpa na edição).
      const extras = {
        tags: formData.tags || [],
        moeda_original: usarMoeda ? moeda : null,
        valor_original: usarMoeda ? valorOriginal : null,
        cotacao: usarMoeda ? cotacaoNum : null,
      }
      if (usarMoeda) salvarUltimaCotacao(moeda, cotacaoNum)

      // Se está editando
      if (editingLancamento) {
        const wasParcelado = editingLancamento.grupo_parcelas_id != null
        const wantsParcelado =
          formData.forma_pagamento === 'credito' &&
          formData.cartao_id &&
          parcelasNum > 1

        if (wantsParcelado && !wasParcelado) {
          // Conversão: à vista → parcelado
          // Deleta a transação original e recria como parcelas
          await deleteLancamento(editingLancamento.id)

          const lancamentoData: CreateLancamentoInput = {
            family_id: 'local-storage-family',
            tipo: formData.tipo as 'receita' | 'despesa',
            categoria_id: formData.categoria_id!,
            subcategoria_id: formData.subcategoria_id,
            valor: formData.valor!,
            data: formData.data!,
            forma_pagamento: formData.forma_pagamento as any,
            cartao_id: formData.cartao_id,
            portador_id: formData.portador_id,
            conta_id: formData.conta_id,
            observacao: formData.observacao,
            ...extras,
            status: formData.status || 'projetado',
          }
          await createLancamentoParcelado(lancamentoData, parcelasNum)
        } else if (wantsParcelado && wasParcelado && parcelasNum !== (editingLancamento.parcela_total || 1)) {
          // Parcelas existentes com quantidade alterada: recria o grupo inteiro
          await deleteGrupoParcelas(editingLancamento.grupo_parcelas_id!)

          const lancamentoData: CreateLancamentoInput = {
            family_id: 'local-storage-family',
            tipo: formData.tipo as 'receita' | 'despesa',
            categoria_id: formData.categoria_id!,
            subcategoria_id: formData.subcategoria_id,
            valor: formData.valor!,
            data: formData.data!,
            forma_pagamento: formData.forma_pagamento as any,
            cartao_id: formData.cartao_id,
            portador_id: formData.portador_id,
            conta_id: formData.conta_id,
            observacao: formData.observacao,
            ...extras,
            status: formData.status || 'projetado',
          }
          await createLancamentoParcelado(lancamentoData, parcelasNum)
        } else {
          // Edição simples (sem mudança de parcelamento)
          await updateLancamento(editingLancamento.id, {
            tipo: formData.tipo as 'receita' | 'despesa',
            categoria_id: formData.categoria_id!,
            subcategoria_id: formData.subcategoria_id,
            valor: formData.valor!,
            data: formData.data!,
            forma_pagamento: formData.forma_pagamento as any,
            cartao_id: formData.cartao_id,
            portador_id: formData.portador_id,
            conta_id: formData.conta_id,
            observacao: formData.observacao,
            ...extras,
            status: formData.status,
          })
        }
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
          portador_id: formData.portador_id,
          conta_id: formData.conta_id,
          observacao: formData.observacao,
          ...extras,
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
          parcelasNum > 1
        ) {
          await createLancamentoParcelado(lancamentoData, parcelasNum)
        }
        // Lançamento simples
        else {
          await createLancamento(lancamentoData)
        }
      }

      // Reset form and close
      toast.success(editingLancamento ? 'Transação atualizada!' : 'Transação salva!')
      setFormData(criarFormPadrao())
      setParcelasInput('1')
      setIsRecorrente(false)
      setMesesRecorrencia(3)
      resetarMoeda()
      onClose()
    } catch (error) {
      console.error('Erro ao criar transação:', error)
      toast.error('Erro ao salvar. Verifique sua conexão e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const parcelasNum = Math.max(1, Math.min(24, parseInt(parcelasInput) || 1))

  const handleClose = () => {
    if (!isLoading) {
      setFormData(criarFormPadrao())
      setParcelasInput('1')
      setIsRecorrente(false)
      setMesesRecorrencia(3)
      resetarMoeda()
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
            label={usarMoeda ? 'Valor em R$ (calculado)' : 'Valor *'}
            value={formData.valor}
            onChange={(value) => setFormData({ ...formData, valor: value })}
            disabled={usarMoeda}
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

        {/* Moeda estrangeira */}
        <div className="p-3 bg-dark-700/40 border border-dark-600 rounded-lg space-y-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-200">
            <input
              type="checkbox"
              checked={usarMoeda}
              onChange={(e) => alternarMoeda(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 text-primary-500 focus:ring-primary-500"
            />
            💱 Gasto em outra moeda
          </label>
          {usarMoeda && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  label="Moeda"
                  value={moeda}
                  onChange={(e) => trocarMoeda(e.target.value)}
                  options={MOEDAS.map((m) => ({ value: m.codigo, label: `${m.codigo} — ${m.nome}` }))}
                />
                <CurrencyInput
                  label={`Valor em ${moeda}`}
                  prefix={MOEDAS.find((m) => m.codigo === moeda)?.simbolo}
                  value={valorOriginal}
                  onChange={setValorOriginal}
                />
                <div>
                  <Input
                    label="Cotação (R$)"
                    type="text"
                    inputMode="decimal"
                    value={cotacaoInput}
                    onChange={(e) => setCotacaoInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="Ex.: 6,15"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
                <span>
                  {valorOriginal > 0 && cotacaoNum > 0
                    ? `${valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${moeda} × ${cotacaoNum.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} = R$ ${(formData.valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : `Informe o valor em ${moeda} e quanto custa 1 ${moeda} em reais`}
                </span>
                <button
                  type="button"
                  onClick={atualizarCotacao}
                  disabled={buscandoCotacao}
                  className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 shrink-0 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={buscandoCotacao ? 'animate-spin' : ''} />
                  Cotação de hoje
                </button>
              </div>
            </>
          )}
        </div>

        {/* Aviso de possível duplicidade (mesmo tipo, data, valor e categoria) */}
        {possiveisDuplicados.length > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {possiveisDuplicados.length === 1
                ? 'Já existe um lançamento parecido'
                : `Já existem ${possiveisDuplicados.length} lançamentos parecidos`}
            </div>
            <ul className="text-xs text-gray-300 mt-2 space-y-1">
              {possiveisDuplicados.slice(0, 3).map((l) => (
                <li key={l.id}>• {descreverLancamento(l)}</li>
              ))}
              {possiveisDuplicados.length > 3 && (
                <li className="text-gray-500">…e mais {possiveisDuplicados.length - 3}</li>
              )}
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              Mesma data, valor e categoria. Se não for duplicado, pode salvar normalmente.
            </p>
          </div>
        )}

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
          onChange={(e) => {
            const novaForma = e.target.value as any
            setFormData({
              ...formData,
              forma_pagamento: novaForma,
              cartao_id: undefined,
              portador_id: undefined,
              conta_id: undefined,
              // Auto-setar status para 'projetado' quando for crédito; ao
              // sair do crédito, volta para 'pago' (não faz sentido manter
              // 'projetado' em dinheiro/PIX/débito)
              status:
                novaForma === 'credito'
                  ? 'projetado'
                  : formData.status === 'projetado'
                  ? 'pago'
                  : formData.status,
            })
          }}
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
                setFormData({
                  ...formData,
                  cartao_id: e.target.value || undefined,
                  portador_id: undefined, // troca de cartão zera o portador
                })
              }
              options={cartaoOptions}
              required
            />

            {/* Quem usou o cartão (portadores: titular + adicionais) */}
            {formData.cartao_id && portadorOptions.length > 0 && (
              <Select
                label="Quem usou o cartão"
                value={formData.portador_id || ''}
                onChange={(e) =>
                  setFormData({ ...formData, portador_id: e.target.value || undefined })
                }
                options={portadorOptions}
                helperText="Selecione o portador (titular ou adicional) que fez a compra"
              />
            )}

            {/* Parcelas */}
            {formData.cartao_id && (
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                label="Número de Parcelas"
                value={parcelasInput}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '')
                  setParcelasInput(v)
                }}
                onBlur={() => {
                  const n = parseInt(parcelasInput) || 1
                  setParcelasInput(String(Math.max(1, Math.min(24, n))))
                }}
                helperText="Apague e digite a quantidade (1 = à vista, máx. 24)"
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

        {/* Tags */}
        <TagInput
          label="Tags"
          value={formData.tags || []}
          onChange={(tags) => setFormData({ ...formData, tags })}
          suggestions={tagsExistentes}
          helperText="Agrupe gastos de qualquer categoria, ex.: Viagem Europa 2026. Enter para adicionar."
        />

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
