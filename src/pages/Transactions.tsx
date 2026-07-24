import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { usePlan } from '../hooks/usePlan'
import { Card, CardContent, Button, Select, Input, Tabs, confirmDialog } from '../components/ui'
import { Plus, Search, Trash2, Check, List, TrendingUp, TrendingDown, Edit2, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, RefreshCw, Clock, Pause, Eye, User, Settings2 } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useCategoriasStore, useCartoesStore, useContasBancariasStore } from '../store'
import { useFamilyStore } from '../store/useFamilyStore'
import { TransactionModal } from '../components/TransactionModal'
import { usePermissions } from '../hooks/usePermissions'
import { PeriodFilter, type PeriodFilterValue } from '../components/PeriodFilter'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Lancamento, CreateLancamentoInput, PaymentMethod, LancamentoStatus, TransactionType } from '../types'

// Estado da "linha rápida" de lançamento direto na tabela
interface QuickRowState {
  tipo: TransactionType
  data: string
  categoria_id: string
  observacao: string
  forma_pagamento: PaymentMethod
  cartao_id: string
  conta_id: string
  valor: string
  status: LancamentoStatus
}

// Despesa nasce como compra no crédito (status 'projetado') quando o usuário
// tem cartão ativo — mesmo padrão do TransactionModal. Com um único cartão,
// ele já vem selecionado; sem cartão, mantém dinheiro/pago.
const criarLinhaRapidaVazia = (
  tipo: TransactionType,
  cartoesAtivos: { id: string }[] = []
): QuickRowState => {
  const usarCredito = tipo === 'despesa' && cartoesAtivos.length > 0
  return {
    tipo,
    data: format(new Date(), 'yyyy-MM-dd'),
    categoria_id: '',
    observacao: '',
    forma_pagamento: usarCredito ? 'credito' : 'dinheiro',
    cartao_id: usarCredito && cartoesAtivos.length === 1 ? cartoesAtivos[0].id : '',
    conta_id: '',
    valor: '',
    status: usarCredito ? 'projetado' : 'pago',
  }
}

type SortField = 'data' | 'categoria' | 'valor' | 'status' | 'forma_pagamento' | 'cadastro'
type SortOrder = 'asc' | 'desc'

export function Transactions() {
  const { canEdit } = usePermissions()
  const navigate = useNavigate()
  const { getLimit } = usePlan()
  const [searchParams] = useSearchParams()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLancamento, setEditingLancamento] = useState<Lancamento | undefined>(undefined)
  const [modalInitialData, setModalInitialData] = useState<Partial<CreateLancamentoInput> | undefined>(undefined)
  // Linha rápida (lançamento direto na tabela)
  const [isQuickAdding, setIsQuickAdding] = useState(false)
  const [quickRow, setQuickRow] = useState<QuickRowState>(() => criarLinhaRapidaVazia('despesa'))
  const [isSavingQuick, setIsSavingQuick] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filterTipo, setFilterTipo] = useState<'all' | 'receita' | 'despesa'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pago' | 'pendente' | 'projetado'>('all')
  const [filterCategoria, setFilterCategoria] = useState<string>('all')
  const [filterFormaPagamento, setFilterFormaPagamento] = useState<string>('all')
  const [filterCartao, setFilterCartao] = useState<string>('all')
  const [filterCriadoPor, setFilterCriadoPor] = useState<string>('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>({
    tipo: 'mes-atual',
    dataInicio: startOfMonth(new Date()),
    dataFim: endOfMonth(new Date()),
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Novos estados para ordenação e filtro de valor
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [valorMin, setValorMin] = useState<string>('')
  const [valorMax, setValorMax] = useState<string>('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterSubcategoria, setFilterSubcategoria] = useState<string>('all')
  const [filtrarPorDataFatura, setFiltrarPorDataFatura] = useState(true) // Toggle: true = data fatura, false = data compra

  // Estado para atualização de transações antigas
  const [isUpdatingOldTransactions, setIsUpdatingOldTransactions] = useState(false)

  // Aplicar filtros de query params na inicialização
  useEffect(() => {
    const categoriaParam = searchParams.get('categoria')
    const statusParam = searchParams.get('status')
    const tipoParam = searchParams.get('tipo')
    const vencidasParam = searchParams.get('vencidas')
    const periodoParam = searchParams.get('periodo')

    if (categoriaParam) {
      setFilterCategoria(categoriaParam)
    }

    if (statusParam && ['pago', 'pendente', 'projetado'].includes(statusParam)) {
      setFilterStatus(statusParam as 'pago' | 'pendente' | 'projetado')
    }

    if (tipoParam && ['receita', 'despesa'].includes(tipoParam)) {
      setFilterTipo(tipoParam as 'receita' | 'despesa')
    }

    const ordenarParam = searchParams.get('ordenar')
    if (ordenarParam === 'cadastro') {
      setSortField('cadastro')
      setSortOrder('desc')
    }

    // Se periodo=todos, mostrar todas as transações (sem filtro de data)
    if (periodoParam === 'todos') {
      setPeriodFilter({
        tipo: 'range-custom',
        dataInicio: new Date(2000, 0, 1),
        dataFim: new Date(2100, 11, 31),
      })
    }
    // Se vencidas=true, configurar filtro de período para mostrar contas vencidas
    else if (vencidasParam === 'true') {
      // Mostrar todas as transações até ontem (vencidas)
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const ontem = new Date(hoje)
      ontem.setDate(ontem.getDate() - 1)

      setPeriodFilter({
        tipo: 'range-custom',
        dataInicio: new Date(2000, 0, 1), // Data bem antiga para pegar tudo
        dataFim: ontem,
      })
    }
  }, [searchParams])

  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)
  const cartoes = useCartoesStore((state) => state.cartoes)
  const contas = useContasBancariasStore((state) => state.contas)
  const fetchContas = useContasBancariasStore((state) => state.fetchContas)
  const familyMembers = useFamilyStore((state) => state.members)
  const createLancamento = useTransacoesStore((state) => state.createLancamento)
  const deleteLancamento = useTransacoesStore((state) => state.deleteLancamento)
  const marcarComoPago = useTransacoesStore((state) => state.marcarComoPago)
  const updateLancamento = useTransacoesStore((state) => state.updateLancamento)
  const atualizarDataVencimentoFaturaAntigos = useTransacoesStore((state) => state.atualizarDataVencimentoFaturaAntigos)
  const recalcularTodasDatasFatura = useTransacoesStore((state) => state.recalcularTodasDatasFatura)

  // Contar transações de crédito sem data_vencimento_fatura
  const transacoesSemFatura = useMemo(() => {
    return lancamentos.filter(
      l => l.cartao_id && l.forma_pagamento === 'credito' && !l.data_vencimento_fatura
    ).length
  }, [lancamentos])

  // Contar total de transações de crédito
  const totalTransacoesCredito = useMemo(() => {
    return lancamentos.filter(
      l => l.cartao_id && l.forma_pagamento === 'credito'
    ).length
  }, [lancamentos])

  // Stable callbacks
  const handleOpenModal = useCallback(() => {
    const limit = getLimit('transactions')
    if (lancamentos.length >= limit) {
      toast.error(`Você atingiu o limite do Explorador (${limit} transações). Assine o Planejador para criar mais.`, {
        action: { label: 'Assinar Planejador', onClick: () => navigate('/app/assinatura') },
      })
      return
    }
    setEditingLancamento(undefined)
    setModalInitialData(undefined)
    setIsModalOpen(true)
  }, [getLimit, lancamentos.length, navigate])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setEditingLancamento(undefined)
    setModalInitialData(undefined)
  }, [])

  const handleEditLancamento = useCallback((lancamento: Lancamento) => {
    setEditingLancamento(lancamento)
    setModalInitialData(undefined)
    setIsModalOpen(true)
  }, [])

  // Buscar contas (necessárias para débito/PIX/transferência na linha rápida)
  useEffect(() => {
    fetchContas()
  }, [fetchContas])

  // Categorias principais (sem subcategoria) do tipo da linha rápida, em
  // ordem alfabética
  const categoriasQuickOptions = useMemo(() => {
    return categorias
      .filter((c) => !c.categoria_pai_id && c.tipo === quickRow.tipo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((c) => ({ value: c.id, label: c.nome }))
  }, [categorias, quickRow.tipo])

  const cartoesAtivosQuick = useMemo(() => cartoes.filter((c) => c.ativo), [cartoes])

  const cartaoQuickOptions = useMemo(
    () => cartoesAtivosQuick.map((c) => ({ value: c.id, label: c.nome })),
    [cartoesAtivosQuick]
  )

  const contaQuickOptions = useMemo(
    () => contas.filter((c) => c.ativo).map((c) => ({ value: c.id, label: `${c.icone || ''} ${c.nome}`.trim() })),
    [contas]
  )

  const iniciarLinhaRapida = useCallback(() => {
    const limit = getLimit('transactions')
    if (lancamentos.length >= limit) {
      toast.error(`Você atingiu o limite do Explorador (${limit} transações). Assine o Planejador para criar mais.`, {
        action: { label: 'Assinar Planejador', onClick: () => navigate('/app/assinatura') },
      })
      return
    }
    const tipoInicial: TransactionType = filterTipo === 'receita' ? 'receita' : 'despesa'
    setQuickRow(criarLinhaRapidaVazia(tipoInicial, cartoesAtivosQuick))
    setIsQuickAdding(true)
  }, [getLimit, lancamentos.length, navigate, filterTipo, cartoesAtivosQuick])

  const cancelarLinhaRapida = useCallback(() => {
    setIsQuickAdding(false)
    setQuickRow(criarLinhaRapidaVazia('despesa', cartoesAtivosQuick))
  }, [cartoesAtivosQuick])

  // Monta o payload comum (linha rápida → criação ou "+ opções")
  const montarPayloadQuick = useCallback((): Partial<CreateLancamentoInput> => {
    const valorNum = parseFloat((quickRow.valor || '').replace(',', '.'))
    const precisaConta =
      quickRow.forma_pagamento === 'debito' ||
      quickRow.forma_pagamento === 'pix' ||
      quickRow.forma_pagamento === 'transferencia'
    return {
      tipo: quickRow.tipo,
      data: quickRow.data,
      valor: isNaN(valorNum) ? 0 : valorNum,
      categoria_id: quickRow.categoria_id || undefined,
      observacao: quickRow.observacao || undefined,
      forma_pagamento: quickRow.forma_pagamento,
      cartao_id: quickRow.forma_pagamento === 'credito' ? quickRow.cartao_id || undefined : undefined,
      conta_id: quickRow.forma_pagamento !== 'credito' && (quickRow.conta_id || precisaConta)
        ? quickRow.conta_id || undefined
        : undefined,
      status: quickRow.status,
    }
  }, [quickRow])

  const salvarLinhaRapida = useCallback(async () => {
    const valorNum = parseFloat((quickRow.valor || '').replace(',', '.'))

    if (!quickRow.categoria_id) {
      toast.error('Selecione a categoria')
      return
    }
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Informe um valor maior que zero')
      return
    }
    if (quickRow.forma_pagamento === 'credito' && !quickRow.cartao_id) {
      toast.error('Selecione o cartão. Use "+ opções" para parcelas e mais.')
      return
    }
    if (
      (quickRow.forma_pagamento === 'debito' ||
        quickRow.forma_pagamento === 'pix' ||
        quickRow.forma_pagamento === 'transferencia') &&
      !quickRow.conta_id
    ) {
      toast.error('Selecione a conta bancária para esta forma de pagamento')
      return
    }

    setIsSavingQuick(true)
    try {
      const payload = montarPayloadQuick()
      await createLancamento({
        family_id: 'local-storage-family',
        ...payload,
      } as CreateLancamentoInput)
      toast.success('Transação salva!')
      // Mantém a linha aberta para lançamentos em sequência, preservando
      // tipo/data/forma para agilizar
      setQuickRow((prev) => ({
        ...criarLinhaRapidaVazia(prev.tipo, cartoesAtivosQuick),
        data: prev.data,
        forma_pagamento: prev.forma_pagamento,
        cartao_id: prev.cartao_id,
        conta_id: prev.conta_id,
        status: prev.status,
      }))
    } catch (error) {
      console.error('Erro ao salvar na linha rápida:', error)
      toast.error('Erro ao salvar. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSavingQuick(false)
    }
  }, [quickRow, montarPayloadQuick, createLancamento, cartoesAtivosQuick])

  // Abre o formulário completo já preenchido com o que foi digitado na linha
  const abrirOpcoesCompletas = useCallback(() => {
    setModalInitialData(montarPayloadQuick())
    setEditingLancamento(undefined)
    setIsQuickAdding(false)
    setIsModalOpen(true)
  }, [montarPayloadQuick])

  // Get category name
  const getCategoryName = useCallback((categoriaId: string | null) => {
    if (!categoriaId) return 'Sem categoria'
    const categoria = categorias.find(c => c.id === categoriaId)
    return categoria?.nome || 'Categoria desconhecida'
  }, [categorias])

  // Get card name
  const getCardName = useCallback((cartaoId: string | null) => {
    if (!cartaoId) return '-'
    const cartao = cartoes.find(c => c.id === cartaoId)
    return cartao?.nome || 'Cartão desconhecido'
  }, [cartoes])

  // Get portador (quem usou o cartão) name
  const getPortadorName = useCallback((cartaoId: string | null, portadorId: string | null) => {
    if (!cartaoId || !portadorId) return ''
    const cartao = cartoes.find(c => c.id === cartaoId)
    const portador = (cartao?.portadores ?? []).find(p => p.id === portadorId)
    return portador?.nome || ''
  }, [cartoes])

  // Get member name by user_id
  const getMemberName = useCallback((userId: string | null) => {
    if (!userId) return 'Desconhecido'
    const member = familyMembers.find(m => m.user_id === userId)
    if (!member) return 'Desconhecido'
    return member.user_name || 'Desconhecido'
  }, [familyMembers])

  // Translate payment method
  const translatePaymentMethod = useCallback((method: string) => {
    const translations: Record<string, string> = {
      'dinheiro': 'Dinheiro',
      'debito': 'Débito',
      'credito': 'Crédito',
      'pix': 'PIX',
      'transferencia': 'Transferência',
      'boleto': 'Boleto',
    }
    return translations[method] || method
  }, [])

  // Função para ordenar transações
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Inverte a ordem se clicar na mesma coluna
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'data' || field === 'cadastro' ? 'desc' : 'asc') // Data e cadastro começam desc, outros asc
    }
  }, [sortField])

  // Componente de ícone de ordenação
  const SortIcon = useCallback(({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-gray-600" />
    }
    return sortOrder === 'asc'
      ? <ArrowUp size={14} className="text-primary-400" />
      : <ArrowDown size={14} className="text-primary-400" />
  }, [sortField, sortOrder])

  // Handler para atualizar transações antigas (sem data de fatura)
  const handleAtualizarTransacoesAntigas = useCallback(async () => {
    setIsUpdatingOldTransactions(true)
    try {
      const atualizados = await atualizarDataVencimentoFaturaAntigos()
      toast.success(`${atualizados} transação(ões) atualizada(s) com sucesso!`)
    } catch (error) {
      console.error('Erro ao atualizar transações:', error)
      toast.error('Não foi possível atualizar as transações. Verifique sua conexão e tente novamente.')
    } finally {
      setIsUpdatingOldTransactions(false)
    }
  }, [atualizarDataVencimentoFaturaAntigos])

  // Handler para recalcular TODAS as datas de fatura
  const handleRecalcularTodasFaturas = useCallback(async () => {
    const ok = await confirmDialog({
      title: 'Recalcular datas de fatura?',
      message: 'Isso vai recalcular a data de fatura de TODAS as transações de crédito não pagas.',
      confirmLabel: 'Recalcular',
    })
    if (!ok) return
    setIsUpdatingOldTransactions(true)
    try {
      const { atualizados, erros } = await recalcularTodasDatasFatura()
      if (erros.length > 0) {
        toast.warning(`${atualizados} transação(ões) corrigida(s), mas ${erros.length} com erro.`)
      } else {
        toast.success(`${atualizados} transação(ões) corrigida(s) com sucesso!`)
      }
    } catch (error) {
      console.error('Erro ao recalcular:', error)
      toast.error('Não foi possível recalcular. Verifique sua conexão e tente novamente.')
    } finally {
      setIsUpdatingOldTransactions(false)
    }
  }, [recalcularTodasDatasFatura])

  // Filter and search transactions
  const filteredLancamentos = useMemo(() => {
    let result = lancamentos.filter(lancamento => {
      // Filter by type
      if (filterTipo !== 'all' && lancamento.tipo !== filterTipo) return false

      // Filter by status
      if (filterStatus !== 'all' && lancamento.status !== filterStatus) return false

      // Filter by category
      if (filterCategoria !== 'all' && lancamento.categoria_id !== filterCategoria) return false

      // Filter by subcategory
      if (filterSubcategoria !== 'all' && lancamento.subcategoria_id !== filterSubcategoria) return false

      // Filter by payment method
      if (filterFormaPagamento !== 'all' && lancamento.forma_pagamento !== filterFormaPagamento) return false

      // Filter by card
      if (filterCartao !== 'all' && lancamento.cartao_id !== filterCartao) return false

      // Filter by who created (criado_por)
      if (filterCriadoPor !== 'all' && lancamento.criado_por !== filterCriadoPor) return false

      // Filter by date range (usando PeriodFilter)
      // Se toggle ativo: usa data_vencimento_fatura para crédito (mês que será pago)
      // Se toggle desativado: usa data da compra sempre
      try {
        if (periodFilter.dataInicio && periodFilter.dataFim &&
            !isNaN(periodFilter.dataInicio.getTime()) && !isNaN(periodFilter.dataFim.getTime())) {
          const dataInicio = format(periodFilter.dataInicio, 'yyyy-MM-dd')
          const dataFim = format(periodFilter.dataFim, 'yyyy-MM-dd')

          // Determinar qual data usar baseado no toggle
          let dataParaFiltro = lancamento.data
          if (filtrarPorDataFatura && lancamento.data_vencimento_fatura) {
            dataParaFiltro = lancamento.data_vencimento_fatura
          }

          if (dataParaFiltro < dataInicio) return false
          if (dataParaFiltro > dataFim) return false
        }
      } catch {
        // Se houver erro na formatação de data, ignorar o filtro de período
      }

      // Filter by value range
      if (valorMin) {
        const min = parseFloat(valorMin.replace(',', '.'))
        if (!isNaN(min) && lancamento.valor < min) return false
      }
      if (valorMax) {
        const max = parseFloat(valorMax.replace(',', '.'))
        if (!isNaN(max) && lancamento.valor > max) return false
      }

      // Search term (category name, subcategory name, observacao, value, or creator name)
      if (searchTerm) {
        const search = searchTerm.toLowerCase().trim()
        const catName = getCategoryName(lancamento.categoria_id).toLowerCase()
        const subCatName = lancamento.subcategoria_id
          ? getCategoryName(lancamento.subcategoria_id).toLowerCase()
          : ''
        const obs = lancamento.observacao?.toLowerCase() || ''
        const valorStr = lancamento.valor.toString()
        const valorFormatado = formatCurrency(lancamento.valor).toLowerCase()
        const memberName = getMemberName(lancamento.criado_por).toLowerCase()
        const portadorName = getPortadorName(lancamento.cartao_id, lancamento.portador_id).toLowerCase()

        // Busca por texto (categoria, subcategoria, observação, responsável, portador) ou valor
        const matchesText = catName.includes(search) || subCatName.includes(search) || obs.includes(search) || memberName.includes(search) || portadorName.includes(search)
        const matchesValue = valorStr.includes(search.replace(',', '.')) ||
                           valorFormatado.includes(search) ||
                           search.replace(/[^\d,.-]/g, '').replace(',', '.') === valorStr

        if (!matchesText && !matchesValue) return false
      }

      return true
    })

    // Ordenar
    result.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'data':
          comparison = parseISO(a.data).getTime() - parseISO(b.data).getTime()
          break
        case 'cadastro':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'valor':
          comparison = a.valor - b.valor
          break
        case 'categoria':
          comparison = getCategoryName(a.categoria_id).localeCompare(getCategoryName(b.categoria_id))
          break
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '')
          break
        case 'forma_pagamento':
          comparison = a.forma_pagamento.localeCompare(b.forma_pagamento)
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [lancamentos, filterTipo, filterStatus, filterCategoria, filterSubcategoria, filterFormaPagamento, filterCartao, filterCriadoPor, periodFilter, valorMin, valorMax, searchTerm, sortField, sortOrder, getCategoryName, getMemberName, getPortadorName, filtrarPorDataFatura])

  // Limpar filtros avançados
  const clearAdvancedFilters = useCallback(() => {
    setValorMin('')
    setValorMax('')
  }, [])

  // Calculate totals for filtered transactions
  const totals = useMemo(() => {
    const totalReceitas = filteredLancamentos
      .filter(l => l.tipo === 'receita')
      .reduce((sum, l) => sum + l.valor, 0)

    const totalDespesas = filteredLancamentos
      .filter(l => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0)

    const saldo = totalReceitas - totalDespesas

    return { totalReceitas, totalDespesas, saldo }
  }, [filteredLancamentos])

  // Reset para página 1 quando filtros mudam
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterTipo, filterStatus, filterCategoria, filterSubcategoria, filterFormaPagamento, filterCartao, filterCriadoPor, periodFilter, valorMin, valorMax, filtrarPorDataFatura])

  // Pagination
  const totalPages = Math.ceil(filteredLancamentos.length / itemsPerPage)
  const safePage = Math.min(currentPage, Math.max(1, totalPages))
  const paginatedLancamentos = filteredLancamentos.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  )

  // Select all checkbox
  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === paginatedLancamentos.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(paginatedLancamentos.map(l => l.id))
    }
  }, [selectedIds, paginatedLancamentos])

  // Toggle individual checkbox
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }, [])

  // Bulk actions — com estado de processamento para desabilitar os botões
  // durante o await (evita duplo clique e dá feedback visual)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  const runBulk = useCallback(
    async (acao: (id: string) => Promise<unknown>, sucesso: string) => {
      setIsBulkProcessing(true)
      try {
        for (const id of selectedIds) {
          await acao(id)
        }
        toast.success(sucesso)
        setSelectedIds([])
      } catch (error) {
        console.error('Erro na ação em massa:', error)
        toast.error('Não foi possível concluir a ação em todas as transações. Verifique e tente novamente.')
      } finally {
        setIsBulkProcessing(false)
      }
    },
    [selectedIds]
  )

  const handleBulkMarkAsPaid = useCallback(async () => {
    if (selectedIds.length === 0) return

    // Compras no crédito não podem ser marcadas como pagas avulsas: sem conta
    // de débito vinculada, o saldo da conta nunca é descontado e os números
    // divergem do banco real. O caminho certo é "Pagar fatura" (em Cartões),
    // que pergunta a conta e debita tudo atomicamente.
    const selecionados = lancamentos.filter((l) => selectedIds.includes(l.id))
    const idsCredito = selecionados
      .filter((l) => l.forma_pagamento === 'credito' && l.status !== 'pago')
      .map((l) => l.id)
    const idsPagaveis = selectedIds.filter((id) => !idsCredito.includes(id))

    if (idsPagaveis.length === 0) {
      toast.info(
        'Compras no crédito são quitadas pela fatura: use "Pagar fatura" na tela de Cartões para debitar a conta corretamente.'
      )
      return
    }

    if (!(await confirmDialog({ title: `Marcar ${idsPagaveis.length} transação(ões) como paga(s)?` }))) return
    setIsBulkProcessing(true)
    try {
      for (const id of idsPagaveis) {
        await marcarComoPago(id)
      }
      toast.success(`${idsPagaveis.length} transação(ões) marcada(s) como paga(s)`)
      if (idsCredito.length > 0) {
        toast.info(
          `${idsCredito.length} compra(s) no crédito não foi(ram) alterada(s): use "Pagar fatura" em Cartões para quitá-las debitando a conta.`
        )
      }
      setSelectedIds([])
    } catch (error) {
      console.error('Erro na ação em massa:', error)
      toast.error('Não foi possível concluir a ação em todas as transações. Verifique e tente novamente.')
    } finally {
      setIsBulkProcessing(false)
    }
  }, [selectedIds, lancamentos, marcarComoPago])

  const handleBulkMarkAsPendente = useCallback(async () => {
    if (selectedIds.length === 0) return
    if (!(await confirmDialog({ title: `Marcar ${selectedIds.length} transação(ões) como pendente(s)?` }))) return
    await runBulk((id) => updateLancamento(id, { status: 'pendente' }), `${selectedIds.length} transação(ões) marcada(s) como pendente(s)`)
  }, [selectedIds, updateLancamento, runBulk])

  const handleBulkMarkAsProjetado = useCallback(async () => {
    if (selectedIds.length === 0) return
    if (!(await confirmDialog({ title: `Marcar ${selectedIds.length} transação(ões) como projetado(s)?` }))) return
    await runBulk((id) => updateLancamento(id, { status: 'projetado' }), `${selectedIds.length} transação(ões) marcada(s) como projetada(s)`)
  }, [selectedIds, updateLancamento, runBulk])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return
    const ok = await confirmDialog({
      title: `Deletar ${selectedIds.length} transação(ões)?`,
      message: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Deletar',
      danger: true,
    })
    if (!ok) return
    await runBulk((id) => deleteLancamento(id), `${selectedIds.length} transação(ões) deletada(s)`)
  }, [selectedIds, deleteLancamento, runBulk])

  const handleDeleteSingle = useCallback(async (id: string) => {
    const ok = await confirmDialog({
      title: 'Deletar esta transação?',
      message: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Deletar',
      danger: true,
    })
    if (!ok) return
    await deleteLancamento(id)
    toast.success('Transação deletada')
  }, [deleteLancamento])

  return (
    <div className="space-y-6 pb-20">
      {/* Botão flutuante Nova Transação */}
      {canEdit && (
        <button
          onClick={handleOpenModal}
          className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2 px-4 sm:px-5 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-full shadow-lg shadow-primary-500/30 transition-all hover:scale-105 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Nova Transação
        </button>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-100 mb-1 md:mb-2">Transações</h1>
          <p className="text-sm md:text-base text-gray-400">Gerencie suas receitas e despesas</p>
        </div>
        {/* Ferramentas de correção de fatura - compacto (apenas admin/editor) */}
        {canEdit && totalTransacoesCredito > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {transacoesSemFatura > 0 && (
              <button
                onClick={handleAtualizarTransacoesAntigas}
                disabled={isUpdatingOldTransactions}
                title={`Preencher ${transacoesSemFatura} transações sem data de fatura`}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingOldTransactions ? 'animate-spin' : ''}`} />
                Preencher Vazias
              </button>
            )}
            <button
              onClick={handleRecalcularTodasFaturas}
              disabled={isUpdatingOldTransactions}
              title="Recalcular datas de fatura de todas as transações de crédito" aria-label="Recalcular datas de fatura de todas as transações de crédito"
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingOldTransactions ? 'animate-spin' : ''}`} />
              Recalcular Faturas
            </button>
          </div>
        )}
      </div>

      {/* Transaction Summary - Moved to top */}
      {filteredLancamentos.length > 0 && (
        <div className="rounded-xl bg-dark-800/50 backdrop-blur-md border border-dark-700/50 shadow-xl overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-dark-700/50">
            <div className="py-2 px-2 sm:py-3 sm:px-3 md:py-4 md:px-4 min-w-0 overflow-hidden">
              <p className="text-xs text-gray-400 mb-0.5 sm:mb-1 truncate">Receitas</p>
              <p className="text-xs sm:text-sm md:text-xl font-bold text-green-400 truncate">{formatCurrency(totals.totalReceitas)}</p>
            </div>
            <div className="py-2 px-2 sm:py-3 sm:px-3 md:py-4 md:px-4 min-w-0 overflow-hidden">
              <p className="text-xs text-gray-400 mb-0.5 sm:mb-1 truncate">Despesas</p>
              <p className="text-xs sm:text-sm md:text-xl font-bold text-red-400 truncate">{formatCurrency(totals.totalDespesas)}</p>
            </div>
            <div className="py-2 px-2 sm:py-3 sm:px-3 md:py-4 md:px-4 min-w-0 overflow-hidden">
              <p className="text-xs text-gray-400 mb-0.5 sm:mb-1 truncate">Saldo</p>
              <p className={`text-xs sm:text-sm md:text-xl font-bold truncate ${totals.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totals.saldo)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Tabs */}
      <Card className="overflow-hidden">
        <div className="space-y-4">
          {/* Tabs */}
          <Tabs
            items={[
              { value: 'all', label: 'Todas', icon: <List className="w-4 h-4" /> },
              { value: 'receita', label: 'Receitas', icon: <TrendingUp className="w-4 h-4" /> },
              { value: 'despesa', label: 'Despesas', icon: <TrendingDown className="w-4 h-4" /> },
            ]}
            value={filterTipo}
            onChange={(value) => {
              setFilterTipo(value as any)
              setCurrentPage(1) // Reset to first page when changing tabs
            }}
          />

          {/* Filters */}
          <div className="pt-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative col-span-1 md:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Buscar categoria, descrição, valor ou responsável..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Toggle filtros avançados */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  showAdvancedFilters || valorMin || valorMax
                    ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                    : 'border-dark-600 text-gray-400 hover:border-dark-500'
                }`}
              >
                <Filter size={16} />
                <span className="text-sm">Filtros</span>
                {(valorMin || valorMax) && (
                  <span className="w-2 h-2 rounded-full bg-primary-500" />
                )}
              </button>

              {/* Filter by Status */}
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                options={[
                  { value: 'all', label: 'Todos os status' },
                  { value: 'pago', label: 'Pago' },
                  { value: 'pendente', label: 'Pendente' },
                  { value: 'projetado', label: 'Projetado' },
                ]}
              />

              {/* Filter by Category */}
              <Select
                value={filterCategoria}
                onChange={(e) => {
                  setFilterCategoria(e.target.value)
                  setFilterSubcategoria('all') // Reset subcategoria quando mudar categoria
                }}
                options={[
                  { value: 'all', label: 'Todas as categorias' },
                  ...categorias
                    .filter(c => !c.categoria_pai_id)
                    .map(cat => ({ value: cat.id, label: cat.nome })),
                ]}
              />

              {/* Filter by Subcategory */}
              <Select
                value={filterSubcategoria}
                onChange={(e) => setFilterSubcategoria(e.target.value)}
                options={[
                  { value: 'all', label: 'Todas subcategorias' },
                  ...categorias
                    .filter(c => c.categoria_pai_id && (filterCategoria === 'all' || c.categoria_pai_id === filterCategoria))
                    .map(sub => ({ value: sub.id, label: sub.nome })),
                ]}
              />

              {/* Filter by Payment Method */}
              <Select
                value={filterFormaPagamento}
                onChange={(e) => setFilterFormaPagamento(e.target.value)}
                options={[
                  { value: 'all', label: 'Todas as formas' },
                  { value: 'dinheiro', label: 'Dinheiro' },
                  { value: 'debito', label: 'Débito' },
                  { value: 'credito', label: 'Crédito' },
                  { value: 'pix', label: 'PIX' },
                  { value: 'transferencia', label: 'Transferência' },
                  { value: 'boleto', label: 'Boleto' },
                ]}
              />

              {/* Filter by Card */}
              <Select
                value={filterCartao}
                onChange={(e) => setFilterCartao(e.target.value)}
                options={[
                  { value: 'all', label: 'Todos os cartões' },
                  ...cartoes.map(cartao => ({ value: cartao.id, label: cartao.nome })),
                ]}
              />

              {/* Filter by who created (Lançado por) - só aparece quando há múltiplos membros */}
              {familyMembers.length > 1 && (
                <Select
                  value={filterCriadoPor}
                  onChange={(e) => setFilterCriadoPor(e.target.value)}
                  options={[
                    { value: 'all', label: 'Todos os responsáveis' },
                    ...familyMembers.map(member => ({
                      value: member.user_id,
                      label: member.user_name || 'Membro',
                    })),
                  ]}
                />
              )}
            </div>

            {/* Filtros Avançados */}
            {showAdvancedFilters && (
              <div className="pt-4 border-t border-dark-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-300">Filtros Avançados</h4>
                  {(valorMin || valorMax) && (
                    <button
                      onClick={clearAdvancedFilters}
                      className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                    >
                      <X size={12} />
                      Limpar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Valor Mínimo</label>
                    <Input
                      type="text"
                      placeholder="Ex: 100"
                      value={valorMin}
                      onChange={(e) => setValorMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Valor Máximo</label>
                    <Input
                      type="text"
                      placeholder="Ex: 500"
                      value={valorMax}
                      onChange={(e) => setValorMax(e.target.value)}
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Filtrar transações de crédito por</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFiltrarPorDataFatura(true)}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          filtrarPorDataFatura
                            ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                            : 'border-dark-600 text-gray-400 hover:border-dark-500'
                        }`}
                      >
                        Data da Fatura
                      </button>
                      <button
                        onClick={() => setFiltrarPorDataFatura(false)}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          !filtrarPorDataFatura
                            ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                            : 'border-dark-600 text-gray-400 hover:border-dark-500'
                        }`}
                      >
                        Data da Compra
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {filtrarPorDataFatura
                        ? 'Mostra compras pelo mês que serão pagas'
                        : 'Mostra compras pelo mês que foram feitas'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Filtro de Período */}
            <div className="pt-2 border-t border-dark-700">
              <PeriodFilter value={periodFilter} onChange={setPeriodFilter} />
            </div>
          </div>
        </div>
      </Card>

      {/* Contador de resultados */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
        <span className="text-xs sm:text-sm">
          {filteredLancamentos.length} transação(ões) encontrada(s)
          {filteredLancamentos.length !== lancamentos.length && (
            <span className="text-gray-600"> de {lancamentos.length} total</span>
          )}
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          {canEdit && !isQuickAdding && (
            <button
              onClick={iniciarLinhaRapida}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-lg text-xs text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 border border-primary-500/30 transition-colors"
            >
              <Plus size={14} />
              <span>Adicionar linha</span>
            </button>
          )}
          <button
            onClick={() => handleSort('cadastro')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-lg text-xs transition-colors ${
              sortField === 'cadastro'
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
            }`}
          >
            <Clock size={14} />
            <span className="hidden xs:inline">Ordem de Cadastro</span>
            <span className="xs:hidden">Cadastro</span>
            {sortField === 'cadastro' && <SortIcon field="cadastro" />}
          </button>
          <span className="hidden sm:inline text-xs">
            Clique nas colunas para ordenar • Clique na linha para editar
          </span>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && canEdit && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-400">
                {selectedIds.length} transação(ões) selecionada(s)
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkMarkAsPaid}
                  disabled={isBulkProcessing}
                  className="gap-2 text-green-400 hover:text-green-300"
                >
                  <Check className="w-4 h-4" />
                  Pago
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkMarkAsPendente}
                  disabled={isBulkProcessing}
                  className="gap-2 text-yellow-400 hover:text-yellow-300"
                >
                  <Pause className="w-4 h-4" />
                  Pendente
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkMarkAsProjetado}
                  disabled={isBulkProcessing}
                  className="gap-2 text-blue-400 hover:text-blue-300"
                >
                  <Eye className="w-4 h-4" />
                  Projetado
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkProcessing}
                  className="gap-2 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                  Deletar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left p-4 text-sm font-medium text-gray-400 w-12">
                    <input
                      type="checkbox"
                      checked={paginatedLancamentos.length > 0 && selectedIds.length === paginatedLancamentos.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                    />
                  </th>
                  <th
                    className="text-left p-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none"
                    onClick={() => handleSort('data')}
                  >
                    <div className="flex items-center gap-2">
                      Data
                      <SortIcon field="data" />
                    </div>
                  </th>
                  <th
                    className="text-left p-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none"
                    onClick={() => handleSort('categoria')}
                  >
                    <div className="flex items-center gap-2">
                      Categoria
                      <SortIcon field="categoria" />
                    </div>
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Descrição</th>
                  <th
                    className="text-left p-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none"
                    onClick={() => handleSort('forma_pagamento')}
                  >
                    <div className="flex items-center gap-2">
                      Forma Pgto
                      <SortIcon field="forma_pagamento" />
                    </div>
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Cartão</th>
                  <th
                    className="text-right p-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none"
                    onClick={() => handleSort('valor')}
                  >
                    <div className="flex items-center gap-2 justify-end">
                      Valor
                      <SortIcon field="valor" />
                    </div>
                  </th>
                  <th
                    className="text-center p-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-200 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2 justify-center">
                      Status
                      <SortIcon field="status" />
                    </div>
                  </th>
                  {familyMembers.length > 1 && (
                    <th className="text-left p-4 text-sm font-medium text-gray-400">
                      <div className="flex items-center gap-1">
                        <User size={13} />
                        Lançado por
                      </div>
                    </th>
                  )}
                  <th className="text-center p-4 text-sm font-medium text-gray-400 w-20">Ações</th>
                </tr>
              </thead>
              <tbody>
                {/* Linha rápida de lançamento direto na tabela */}
                {isQuickAdding && canEdit && (
                  <tr className="border-b border-dark-700/50 bg-primary-500/5">
                    {/* Indicador */}
                    <td className="p-2 text-center">
                      <Plus className="w-4 h-4 text-primary-400 mx-auto" />
                    </td>
                    {/* Data */}
                    <td className="p-2">
                      <input
                        type="date"
                        value={quickRow.data}
                        onChange={(e) => setQuickRow((p) => ({ ...p, data: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    {/* Tipo + Categoria */}
                    <td className="p-2">
                      <select
                        value={quickRow.tipo}
                        onChange={(e) => setQuickRow((p) => ({ ...p, tipo: e.target.value as TransactionType, categoria_id: '' }))}
                        className="w-full mb-1 px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="despesa">Despesa</option>
                        <option value="receita">Receita</option>
                      </select>
                      <select
                        value={quickRow.categoria_id}
                        onChange={(e) => setQuickRow((p) => ({ ...p, categoria_id: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="">Categoria...</option>
                        {categoriasQuickOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    {/* Descrição */}
                    <td className="p-2">
                      <input
                        type="text"
                        value={quickRow.observacao}
                        onChange={(e) => setQuickRow((p) => ({ ...p, observacao: e.target.value }))}
                        placeholder="Descrição..."
                        className="w-full px-2 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    {/* Forma Pgto */}
                    <td className="p-2">
                      <select
                        value={quickRow.forma_pagamento}
                        onChange={(e) => {
                          const novaForma = e.target.value as PaymentMethod
                          setQuickRow((p) => ({
                            ...p,
                            forma_pagamento: novaForma,
                            cartao_id: '',
                            conta_id: '',
                            // Crédito nasce 'projetado'; ao sair do crédito,
                            // volta para 'pago' (mesmo comportamento do modal)
                            status:
                              novaForma === 'credito'
                                ? 'projetado'
                                : p.status === 'projetado'
                                ? 'pago'
                                : p.status,
                          }))
                        }}
                        className="w-full px-2 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="dinheiro">Dinheiro</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                        <option value="pix">PIX</option>
                        <option value="transferencia">Transferência</option>
                        <option value="boleto">Boleto</option>
                      </select>
                    </td>
                    {/* Cartão (crédito) ou Conta (débito/pix/transf) */}
                    <td className="p-2">
                      {quickRow.forma_pagamento === 'credito' ? (
                        <select
                          value={quickRow.cartao_id}
                          onChange={(e) => setQuickRow((p) => ({ ...p, cartao_id: e.target.value }))}
                          className="w-full px-2 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Cartão...</option>
                          {cartaoQuickOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : quickRow.forma_pagamento === 'debito' || quickRow.forma_pagamento === 'pix' || quickRow.forma_pagamento === 'transferencia' ? (
                        <select
                          value={quickRow.conta_id}
                          onChange={(e) => setQuickRow((p) => ({ ...p, conta_id: e.target.value }))}
                          className="w-full px-2 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Conta...</option>
                          {contaQuickOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-600">-</span>
                      )}
                    </td>
                    {/* Valor */}
                    <td className="p-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={quickRow.valor}
                        onChange={(e) => setQuickRow((p) => ({ ...p, valor: e.target.value.replace(/[^0-9.,]/g, '') }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') salvarLinhaRapida() }}
                        placeholder="0,00"
                        className="w-full px-2 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-gray-100 text-right placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    {/* Status */}
                    <td className="p-2">
                      <select
                        value={quickRow.status}
                        onChange={(e) => setQuickRow((p) => ({ ...p, status: e.target.value as LancamentoStatus }))}
                        className="w-full px-2 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="pago">Pago</option>
                        <option value="pendente">Pendente</option>
                        <option value="projetado">Projetado</option>
                      </select>
                    </td>
                    {/* Lançado por (placeholder de alinhamento) */}
                    {familyMembers.length > 1 && <td className="p-2" />}
                    {/* Ações */}
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={salvarLinhaRapida}
                          disabled={isSavingQuick}
                          className="p-1.5 rounded bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 transition-colors disabled:opacity-50"
                          title="Salvar (Enter)"
                          aria-label="Salvar lançamento"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={abrirOpcoesCompletas}
                          className="p-1.5 rounded text-gray-400 hover:text-primary-400 hover:bg-dark-700 transition-colors"
                          title="Mais opções (parcelas, recorrência, portador...)"
                          aria-label="Abrir formulário completo"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelarLinhaRapida}
                          className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-dark-700 transition-colors"
                          title="Cancelar"
                          aria-label="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {paginatedLancamentos.length === 0 ? (
                  <tr>
                    <td colSpan={familyMembers.length > 1 ? 10 : 9} className="text-center py-12 text-gray-500">
                      {filteredLancamentos.length === 0 && lancamentos.length === 0
                        ? 'Nenhuma transação encontrada. Adicione sua primeira transação!'
                        : 'Nenhuma transação encontrada com os filtros aplicados.'}
                    </td>
                  </tr>
                ) : (
                  paginatedLancamentos.map((lancamento) => (
                    <tr
                      key={lancamento.id}
                      className="border-b border-dark-700/50 hover:bg-dark-800/30 transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Não abre o modal se clicou no checkbox ou nos botões de ação
                        const target = e.target as HTMLElement
                        if (target.closest('input[type="checkbox"]') || target.closest('button')) {
                          return
                        }
                        if (canEdit) handleEditLancamento(lancamento)
                      }}
                    >
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lancamento.id)}
                          onChange={() => handleToggleSelect(lancamento.id)}
                          className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                        />
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-300 hover:text-primary-400 transition-colors">
                          {format(parseISO(lancamento.data), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </p>
                        {lancamento.data_vencimento_fatura && lancamento.forma_pagamento === 'credito' && (
                          <p className="text-xs text-secondary-400 mt-1">
                            Fatura: {format(parseISO(lancamento.data_vencimento_fatura), "MMM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="hover:text-primary-400 transition-colors">
                          <p className="text-sm text-gray-100 font-medium">
                            {getCategoryName(lancamento.categoria_id)}
                          </p>
                          {lancamento.subcategoria_id && (
                            <p className="text-xs text-gray-500">
                              {getCategoryName(lancamento.subcategoria_id)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="hover:text-primary-400 transition-colors">
                          {lancamento.observacao ? (
                            <p className="text-sm text-gray-300">{lancamento.observacao}</p>
                          ) : (
                            <p className="text-sm text-gray-500 italic">Sem descrição</p>
                          )}
                          {lancamento.parcela_atual && lancamento.parcela_total && (
                            <p className="text-xs text-gray-500 mt-1">
                              Parcela {lancamento.parcela_atual}/{lancamento.parcela_total}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-300 hover:text-primary-400 transition-colors">
                          {translatePaymentMethod(lancamento.forma_pagamento)}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-300 hover:text-primary-400 transition-colors">
                          {getCardName(lancamento.cartao_id)}
                        </p>
                        {getPortadorName(lancamento.cartao_id, lancamento.portador_id) && (
                          <p className="text-xs text-secondary-400 mt-1 flex items-center gap-1">
                            <User size={11} />
                            {getPortadorName(lancamento.cartao_id, lancamento.portador_id)}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <p className={`text-sm font-semibold hover:opacity-80 transition-opacity ${
                          lancamento.tipo === 'receita' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {lancamento.tipo === 'receita' ? '+' : '-'} {formatCurrency(lancamento.valor)}
                        </p>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          lancamento.status === 'pago'
                            ? 'bg-green-500/10 text-green-400'
                            : lancamento.status === 'pendente'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          {lancamento.status === 'pago' && 'Pago'}
                          {lancamento.status === 'pendente' && 'Pendente'}
                          {lancamento.status === 'projetado' && 'Projetado'}
                        </span>
                      </td>
                      {familyMembers.length > 1 && (
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0">
                              <User size={11} className="text-primary-400" />
                            </div>
                            <p className="text-xs text-gray-400 truncate max-w-[100px]">
                              {getMemberName(lancamento.criado_por)}
                            </p>
                          </div>
                        </td>
                      )}
                      {canEdit && (
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleEditLancamento(lancamento)}
                              className="p-1 hover:bg-dark-700 rounded transition-colors text-gray-400 hover:text-primary-400"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSingle(lancamento.id)}
                              className="p-1 hover:bg-dark-700 rounded transition-colors text-gray-400 hover:text-red-400"
                              title="Deletar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-dark-700">
              <p className="text-sm text-gray-400">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} até {Math.min(currentPage * itemsPerPage, filteredLancamentos.length)} de {filteredLancamentos.length} transações
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        page === currentPage
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-400 hover:bg-dark-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingLancamento={editingLancamento}
        initialData={modalInitialData}
      />
    </div>
  )
}
