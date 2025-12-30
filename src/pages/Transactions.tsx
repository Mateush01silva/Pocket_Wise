import { useState, useCallback } from 'react'
import { Card, CardContent, Button, Select, Input, Tabs } from '../components/ui'
import { Plus, Search, Trash2, Check, List, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '../utils/currency'
import { useTransacoesStore, useCategoriasStore } from '../store'
import { TransactionModal } from '../components/TransactionModal'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function Transactions() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filterTipo, setFilterTipo] = useState<'all' | 'receita' | 'despesa'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pago' | 'pendente' | 'projetado'>('all')
  const [filterCategoria, setFilterCategoria] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)
  const deleteLancamento = useTransacoesStore((state) => state.deleteLancamento)
  const marcarComoPago = useTransacoesStore((state) => state.marcarComoPago)

  // Stable callbacks
  const handleOpenModal = useCallback(() => setIsModalOpen(true), [])
  const handleCloseModal = useCallback(() => setIsModalOpen(false), [])

  // Get category name
  const getCategoryName = useCallback((categoriaId: string | null) => {
    if (!categoriaId) return 'Sem categoria'
    const categoria = categorias.find(c => c.id === categoriaId)
    return categoria?.nome || 'Categoria desconhecida'
  }, [categorias])

  // Filter and search transactions - sem useMemo para evitar loops
  const filteredLancamentos = lancamentos.filter(lancamento => {
    // Filter by type
    if (filterTipo !== 'all' && lancamento.tipo !== filterTipo) return false

    // Filter by status
    if (filterStatus !== 'all' && lancamento.status !== filterStatus) return false

    // Filter by category
    if (filterCategoria !== 'all' && lancamento.categoria_id !== filterCategoria) return false

    // Search term (category name or observacao)
    if (searchTerm) {
      const catName = getCategoryName(lancamento.categoria_id).toLowerCase()
      const obs = lancamento.observacao?.toLowerCase() || ''
      const search = searchTerm.toLowerCase()
      if (!catName.includes(search) && !obs.includes(search)) return false
    }

    return true
  }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

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

      {/* Tabs */}
      <Card>
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
          className="px-6 pt-4"
        />

        {/* Filters */}
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

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
          </div>
        </CardContent>
      </Card>

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
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Data</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Categoria</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">Descrição</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">Valor</th>
                  <th className="text-center p-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-center p-4 text-sm font-medium text-gray-400 w-12">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLancamentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      {filteredLancamentos.length === 0 && lancamentos.length === 0
                        ? 'Nenhuma transação encontrada. Adicione sua primeira transação!'
                        : 'Nenhuma transação encontrada com os filtros aplicados.'}
                    </td>
                  </tr>
                ) : (
                  paginatedLancamentos.map((lancamento) => (
                    <tr
                      key={lancamento.id}
                      className="border-b border-dark-700/50 hover:bg-dark-800/30 transition-colors"
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lancamento.id)}
                          onChange={() => handleToggleSelect(lancamento.id)}
                          className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                        />
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-300">
                          {format(new Date(lancamento.data), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </p>
                      </td>
                      <td className="p-4">
                        <div>
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
                        <div>
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
                      <td className="p-4 text-right">
                        <p className={`text-sm font-semibold ${
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
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteSingle(lancamento.id)}
                          className="p-1 hover:bg-dark-700 rounded transition-colors text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
      <TransactionModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </div>
  )
}
