import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, FolderPlus, ListPlus } from 'lucide-react'
import { useCategoriasStore } from '../store'
import { usePermissions } from '../hooks/usePermissions'
import { Card, CardContent, CardHeader, CardTitle, Button, confirmDialog } from '../components/ui'
import { toast } from 'sonner'
import { CategoryModal } from '../components/CategoryModal'
import type { Categoria } from '../types'
import { cn } from '../lib/cn'

// Helper para verificar se é um emoji válido ou texto em inglês
function isValidEmoji(str: string | null | undefined): boolean {
  if (!str) return false
  // Se tiver apenas letras ASCII, hífens ou underscores = texto em inglês
  const isEnglishText = /^[a-zA-Z\-_]+$/.test(str)
  return !isEnglishText
}

// Helper para obter ícone seguro (só exibe se for emoji válido)
function getSafeIcon(icon: string | null | undefined, fallback: string = ''): string {
  return isValidEmoji(icon) ? (icon || fallback) : fallback
}

export function Categories() {
  const { canEdit } = usePermissions()
  const categorias = useCategoriasStore((state) => state.categorias)
  const getSubcategorias = useCategoriasStore((state) => state.getSubcategorias)
  const deleteCategoria = useCategoriasStore((state) => state.deleteCategoria)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [categoriaToEdit, setCategoriaToEdit] = useState<Categoria | undefined>()
  const [categoriaPaiIdParaNova, setCategoriaPaiIdParaNova] = useState<string | null>(null)

  // Calcular categorias principais a partir das categorias
  const categoriasPrincipais = useMemo(
    () => categorias.filter((c) => !c.categoria_pai_id),
    [categorias]
  )

  const despesas = useMemo(
    () => categoriasPrincipais.filter((c) => c.tipo === 'despesa'),
    [categoriasPrincipais]
  )

  const receitas = useMemo(
    () => categoriasPrincipais.filter((c) => c.tipo === 'receita'),
    [categoriasPrincipais]
  )

  const handleEdit = (categoria: Categoria) => {
    setCategoriaToEdit(categoria)
    setCategoriaPaiIdParaNova(null)
    setIsModalOpen(true)
  }

  const handleDelete = async (categoria: Categoria) => {
    const subcategorias = getSubcategorias(categoria.id)

    const ok = await confirmDialog({
      title: `Excluir a categoria "${categoria.nome}"?`,
      message:
        subcategorias.length > 0
          ? `Esta categoria possui ${subcategorias.length} subcategoria(s) que também serão excluídas.`
          : 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return

    try {
      await deleteCategoria(categoria.id)
      toast.success('Categoria excluída')
    } catch (error) {
      console.error('Erro ao deletar categoria:', error)
      toast.error('Não foi possível excluir a categoria. Verifique se não há lançamentos associados a ela.')
    }
  }

  const handleNovaCategoria = () => {
    setCategoriaToEdit(undefined)
    setCategoriaPaiIdParaNova(null)
    setIsModalOpen(true)
  }

  const handleNovaSubcategoria = (categoriaPai: Categoria) => {
    setCategoriaToEdit(undefined)
    setCategoriaPaiIdParaNova(categoriaPai.id)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setCategoriaToEdit(undefined)
    setCategoriaPaiIdParaNova(null)
  }

  const totalSubcategorias = categorias.filter((c) => c.categoria_pai_id !== null).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Categorias</h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-primary-400" />
              <span>
                <strong className="text-gray-300">{categoriasPrincipais.length}</strong> categorias
                principais
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ListPlus className="w-4 h-4 text-secondary-400" />
              <span>
                <strong className="text-gray-300">{totalSubcategorias}</strong> subcategorias
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Organize suas despesas e receitas em categorias. Adicione subcategorias para maior
            detalhamento.
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleNovaCategoria} size="lg">
            <Plus size={18} className="mr-2" />
            Nova Categoria Principal
          </Button>
        )}
      </div>

      {/* Categorias de Despesa */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <span className="text-lg">💸</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-100">Despesas</h2>
            <span className="text-sm text-gray-500">({despesas.length} categorias)</span>
          </div>
        </div>

        {despesas.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💸</span>
              </div>
              <p className="text-gray-400 mb-4">Nenhuma categoria de despesa cadastrada</p>
              <Button onClick={handleNovaCategoria} variant="ghost">
                <Plus size={16} className="mr-2" />
                Criar primeira categoria de despesa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {despesas.map((categoria) => {
              const subcategorias = getSubcategorias(categoria.id)
              return (
                <Card
                  key={categoria.id}
                  className={cn(
                    'hover:shadow-xl transition-all hover:scale-[1.02]',
                    'border-l-4'
                  )}
                  style={{ borderLeftColor: categoria.cor || '#ef4444' }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {getSafeIcon(categoria.icone) && (
                          <span className="text-2xl" role="img" aria-label={categoria.icone || ''}>
                            {getSafeIcon(categoria.icone)}
                          </span>
                        )}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold">{categoria.nome}</span>
                            {categoria.despesa_fixa && (
                              <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400 font-medium">
                                Fixa
                              </span>
                            )}
                          </div>
                          {subcategorias.length > 0 && (
                            <span className="text-xs text-gray-500 font-normal">
                              {subcategorias.length} subcategoria
                              {subcategorias.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </CardTitle>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(categoria)}
                            className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-primary-400"
                            title="Editar categoria"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(categoria)}
                            className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-red-400"
                            title="Deletar categoria"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {subcategorias.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        <ul className="text-sm text-gray-300 space-y-2 max-h-40 overflow-y-auto">
                          {subcategorias.map((sub) => (
                            <li
                              key={sub.id}
                              className="flex items-center justify-between group p-2 rounded hover:bg-dark-700/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500">└─</span>
                                {getSafeIcon(sub.icone) && (
                                  <span className="text-xs">{getSafeIcon(sub.icone)}</span>
                                )}
                                <span>{sub.nome}</span>
                                {sub.despesa_fixa && (
                                  <span className="px-1 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400 font-medium">
                                    Fixa
                                  </span>
                                )}
                              </div>
                              {canEdit && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleEdit(sub)}
                                    className="p-1 hover:bg-dark-700/50 rounded transition-colors text-gray-500 hover:text-primary-400"
                                    title="Editar subcategoria"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(sub)}
                                    className="p-1 hover:bg-dark-700/50 rounded transition-colors text-gray-500 hover:text-red-400"
                                    title="Deletar subcategoria"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic mb-3">Sem subcategorias</p>
                    )}

                    {/* Botão Adicionar Subcategoria */}
                    {canEdit && (
                      <Button
                        onClick={() => handleNovaSubcategoria(categoria)}
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                      >
                        <Plus size={14} className="mr-1" />
                        Adicionar Subcategoria
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Categorias de Receita */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <span className="text-lg">💰</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-100">Receitas</h2>
            <span className="text-sm text-gray-500">({receitas.length} categorias)</span>
          </div>
        </div>

        {receitas.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <p className="text-gray-400 mb-4">Nenhuma categoria de receita cadastrada</p>
              <Button onClick={handleNovaCategoria} variant="ghost">
                <Plus size={16} className="mr-2" />
                Criar primeira categoria de receita
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {receitas.map((categoria) => {
              const subcategorias = getSubcategorias(categoria.id)
              return (
                <Card
                  key={categoria.id}
                  className={cn(
                    'hover:shadow-xl transition-all hover:scale-[1.02]',
                    'border-l-4'
                  )}
                  style={{ borderLeftColor: categoria.cor || '#10b981' }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {getSafeIcon(categoria.icone) && (
                          <span className="text-2xl" role="img" aria-label={categoria.icone || ''}>
                            {getSafeIcon(categoria.icone)}
                          </span>
                        )}
                        <div className="flex flex-col">
                          <span className="text-base font-semibold">{categoria.nome}</span>
                          {subcategorias.length > 0 && (
                            <span className="text-xs text-gray-500 font-normal">
                              {subcategorias.length} subcategoria
                              {subcategorias.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </CardTitle>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(categoria)}
                            className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-primary-400"
                            title="Editar categoria"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(categoria)}
                            className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-red-400"
                            title="Deletar categoria"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {subcategorias.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        <ul className="text-sm text-gray-300 space-y-2 max-h-40 overflow-y-auto">
                          {subcategorias.map((sub) => (
                            <li
                              key={sub.id}
                              className="flex items-center justify-between group p-2 rounded hover:bg-dark-700/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500">└─</span>
                                {getSafeIcon(sub.icone) && (
                                  <span className="text-xs">{getSafeIcon(sub.icone)}</span>
                                )}
                                <span>{sub.nome}</span>
                                {sub.despesa_fixa && (
                                  <span className="px-1 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400 font-medium">
                                    Fixa
                                  </span>
                                )}
                              </div>
                              {canEdit && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleEdit(sub)}
                                    className="p-1 hover:bg-dark-700/50 rounded transition-colors text-gray-500 hover:text-primary-400"
                                    title="Editar subcategoria"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(sub)}
                                    className="p-1 hover:bg-dark-700/50 rounded transition-colors text-gray-500 hover:text-red-400"
                                    title="Deletar subcategoria"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic mb-3">Sem subcategorias</p>
                    )}

                    {/* Botão Adicionar Subcategoria */}
                    {canEdit && (
                      <Button
                        onClick={() => handleNovaSubcategoria(categoria)}
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                      >
                        <Plus size={14} className="mr-1" />
                        Adicionar Subcategoria
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Categoria */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        categoria={categoriaToEdit}
        categoriaPaiIdInicial={categoriaPaiIdParaNova}
      />
    </div>
  )
}
