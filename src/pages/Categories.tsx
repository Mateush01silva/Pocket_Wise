import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useCategoriasStore } from '../store'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui'
import { CategoryModal } from '../components/CategoryModal'
import type { Categoria } from '../types'

export function Categories() {
  const categorias = useCategoriasStore((state) => state.categorias)
  const getSubcategorias = useCategoriasStore((state) => state.getSubcategorias)
  const deleteCategoria = useCategoriasStore((state) => state.deleteCategoria)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [categoriaToEdit, setCategoriaToEdit] = useState<Categoria | undefined>()

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
    setIsModalOpen(true)
  }

  const handleDelete = async (categoria: Categoria) => {
    const subcategorias = getSubcategorias(categoria.id)

    let confirmMessage = `Tem certeza que deseja excluir a categoria "${categoria.nome}"?`
    if (subcategorias.length > 0) {
      confirmMessage += `\n\nEsta categoria possui ${subcategorias.length} subcategoria(s) que também serão excluídas.`
    }

    if (window.confirm(confirmMessage)) {
      try {
        await deleteCategoria(categoria.id)
      } catch (error) {
        console.error('Erro ao deletar categoria:', error)
        alert('Erro ao deletar categoria. Verifique se não há lançamentos associados.')
      }
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setCategoriaToEdit(undefined)
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Categorias</h1>
          <p className="text-gray-400">
            Total de {categorias.length} categorias cadastradas ({categoriasPrincipais.length}{' '}
            principais)
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} className="mr-2" />
          Nova Categoria
        </Button>
      </div>

      {/* Categorias de Despesa */}
      <div>
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Despesas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {despesas.map((categoria) => {
            const subcategorias = getSubcategorias(categoria.id)
            return (
              <Card key={categoria.id} className="hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <span
                        className="text-xl"
                        role="img"
                        aria-label={categoria.icone || ''}
                      >
                        {categoria.icone || '📦'}
                      </span>
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: categoria.cor || '#6b7280' }}
                      />
                      {categoria.nome}
                    </CardTitle>
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
                  </div>
                </CardHeader>
                <CardContent>
                  {subcategorias.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-400 mb-2">
                        {subcategorias.length} subcategorias:
                      </p>
                      <ul className="text-sm text-gray-300 space-y-2">
                        {subcategorias.map((sub) => (
                          <li key={sub.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                              {sub.nome}
                            </div>
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
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Sem subcategorias</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Categorias de Receita */}
      <div>
        <h2 className="text-2xl font-bold text-gray-100 mb-4">Receitas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {receitas.map((categoria) => {
            const subcategorias = getSubcategorias(categoria.id)
            return (
              <Card key={categoria.id} className="hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <span
                        className="text-xl"
                        role="img"
                        aria-label={categoria.icone || ''}
                      >
                        {categoria.icone || '💰'}
                      </span>
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: categoria.cor || '#6b7280' }}
                      />
                      {categoria.nome}
                    </CardTitle>
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
                  </div>
                </CardHeader>
                <CardContent>
                  {subcategorias.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-400 mb-2">
                        {subcategorias.length} subcategorias:
                      </p>
                      <ul className="text-sm text-gray-300 space-y-2">
                        {subcategorias.map((sub) => (
                          <li key={sub.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                              {sub.nome}
                            </div>
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
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Sem subcategorias</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Modal de Categoria */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        categoria={categoriaToEdit}
      />
    </div>
  )
}
