import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, Button, Select, Input, Tabs } from '../components/ui'
import { Plus, Search, Trash2, Check, List, TrendingUp, TrendingDown, Edit2, DollarSign, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useCategoriasStore, useCartoesStore } from '../store'
import { TransactionModal } from '../components/TransactionModal'
import { PeriodFilter, type PeriodFilterValue } from '../components/PeriodFilter'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Lancamento } from '../types'

type SortField = 'data' | 'categoria' | 'valor' | 'status' | 'forma_pagamento'
type SortOrder = 'asc' | 'desc'

export function Transactions() {
  const [searchParams] = useSearchParams()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLancamento, setEditingLancamento] = useState<Lancamento | undefined>(undefined)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filterTipo, setFilterTipo] = useState<'all' | 'receita' | 'despesa'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pago' | 'pendente' | 'projetado'>('all')
  const [filterCategoria, setFilterCategoria] = useState<string>('all')
  const [filterFormaPagamento, setFilterFormaPagamento] = useState<string>('all')
  const [filterCartao, setFilterCartao] = useState<string>('all')
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

  // Aplicar filtros de query params na inicialização
  useEffect(() => {
    const categoriaParam = searchParams.get('categoria')
    if (categoriaParam) {
      setFilterCategoria(categoriaParam)
    }
  }, [searchParams])

  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)
  const cartoes = useCartoesStore((state) => state.cartoes)
  const deleteLancamento = useTransacoesStore((state) => state.deleteLancamento)
  const marcarComoPago = useTransacoesStore((state) => state.marcarComoPago)

  // Stable callbacks
  const handleOpenModal = useCallback(() => {
    setEditingLancamento(undefined)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setEditingLancamento(undefined)
  }, [])

  const handleEditLancamento = useCallback((lancamento: Lancamento) => {
    setEditingLancamento(lancamento)
    setIsModalOpen(true)
  }, [])

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
      setSortOrder(field === 'data' ? 'desc' : 'asc') // Data começa desc, outros asc
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

  // Filter and search transactions
  const filteredLancamentos = useMemo(() => {
    let result = lancamentos.filter(lancamento => {
      // Filter by type
      if (filterTipo !== 'all' && lancamento.tipo !== filterTipo) return false

      // Filter by status
      if (filterStatus !== 'all' && lancamento.status !== filterStatus) return false

      // Filter by category
      if (filterCategoria !== 'all' && lancamento.categoria_id !== filterCategoria) return false

      // Filter by payment method
      if (filterFormaPagamento !== 'all' && lancamento.forma_pagamento !== filterFormaPagamento) return false

      // Filter by card
      if (filterCartao !== 'all' && lancamento.cartao_id !== filterCartao) return false

      // Filter by date range (usando PeriodFilter)
      try {
        if (periodFilter.dataInicio && periodFilter.dataFim &&
            !isNaN(periodFilter.dataInicio.getTime()) && !isNaN(periodFilter.dataFim.getTime())) {
          const dataInicio = format(periodFilter.dataInicio, 'yyyy-MM-dd')
          const dataFim = format(periodFilter.dataFim, 'yyyy-MM-dd')
          if (lancamento.data < dataInicio) return false
          if (lancamento.data > dataFim) return false
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

      // Search term (category name, observacao, or value)
      if (searchTerm) {
        const search = searchTerm.toLowerCase().trim()
        const catName = getCategoryName(lancamento.categoria_id).toLowerCase()
        const obs = lancamento.observacao?.toLowerCase() || ''
        const valorStr = lancamento.valor.toString()
        const valorFormatado = formatCurrency(lancamento.valor).toLowerCase()

        // Busca por texto ou valor
        const matchesText = catName.includes(search) || obs.includes(search)
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
  }, [lancamentos, filterTipo, filterStatus, filterCategoria, filterFormaPagamento, filterCartao, periodFilter, valorMin, valorMax, searchTerm, sortField, sortOrder, getCategoryName])

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

  // Pagination
  const totalPages = Math.ceil(filteredLancamentos.length / itemsPerPage)
  const paginatedLancamentos = filteredLancamentos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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

  // Bulk actions
  const handleBulkMarkAsPaid = useCallback(async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Marcar ${selectedIds.length} transação(ões) como paga(s)?`)) return

    for (const id of selectedIds) {
      await marcarComoPago(id)
    }
    setSelectedIds([])
  }, [selectedIds, marcarComoPago])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Deletar ${selectedIds.length} transação(ões)? Esta ação não pode ser desfeita.`)) return

    for (const id of selectedIds) {
      await deleteLancamento(id)
    }
    setSelectedIds([])
  }, [selectedIds, deleteLancamento])

  const handleDeleteSingle = useCallback(async (id: string) => {
    if (!confirm('Deletar esta transação? Esta ação não pode ser desfeita.')) return
    await deleteLancamento(id)
  }, [deleteLancamento])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Transações</h1>
          <p className="text-gray-400">Gerencie todas as suas receitas e despesas</p>
        </div>
        <Button onClick={handleOpenModal} className="gap-2">
          <Plus className="w-5 h-5" />
          Nova Transação
        </Button>
      </div>

      {/* Filters and Tabs */}
      <Card>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Buscar por nome, descrição ou valor..."
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
                onChange={(e) => setFilterCategoria(e.target.value)}
                options={[
                  { value: 'all', label: 'Todas as categorias' },
                  ...categorias
                    .filter(c => !c.categoria_pai_id)
                    .map(cat => ({ value: cat.id, label: cat.nome })),
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
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {filteredLancamentos.length} transação(ões) encontrada(s)
          {filteredLancamentos.length !== lancamentos.length && (
            <span className="text-gray-600"> de {lancamentos.length} total</span>
          )}
        </span>
        <span className="text-xs">
          Clique nas colunas para ordenar • Clique na linha para editar
        </span>
      </div>

      {/* Transaction Summary */}
      {filteredLancamentos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Total Receitas</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(totals.totalReceitas)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="text-green-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Total Despesas</p>
                  <p className="text-2xl font-bold text-red-400">
                    {formatCurrency(totals.totalDespesas)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                  <TrendingDown className="text-red-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Saldo</p>
                  <p className={`text-2xl font-bold ${
                    totals.saldo >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(totals.saldo)}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  totals.saldo >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  <DollarSign className={totals.saldo >= 0 ? 'text-green-500' : 'text-red-500'} size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                {selectedIds.length} transação(ões) selecionada(s)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkMarkAsPaid}
                  className="gap-2"
                >
                  <Check className="w-4 h-4" />
                  Marcar como Pago
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="gap-2 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                  Deletar Selecionados
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
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
                  <th className="text-center p-4 text-sm font-medium text-gray-400 w-20">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLancamentos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-500">
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
                        handleEditLancamento(lancamento)
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
      />
    </div>
  )
}
