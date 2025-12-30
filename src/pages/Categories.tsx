import { useCategoriasStore } from '../store'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui'

export function Categories() {
  const categorias = useCategoriasStore((state) => state.categorias)
  const categoriasPrincipais = useCategoriasStore((state) => state.getCategoriasPrincipais())
  const getSubcategorias = useCategoriasStore((state) => state.getSubcategorias)

  const despesas = categoriasPrincipais.filter((c) => c.tipo === 'despesa')
  const receitas = categoriasPrincipais.filter((c) => c.tipo === 'receita')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Categorias</h1>
        <p className="text-gray-400">
          Total de {categorias.length} categorias cadastradas ({categoriasPrincipais.length}{' '}
          principais)
        </p>
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
                  <CardTitle className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: categoria.cor || '#6b7280' }}
                    />
                    {categoria.nome}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subcategorias.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-400 mb-2">
                        {subcategorias.length} subcategorias:
                      </p>
                      <ul className="text-sm text-gray-300 space-y-1">
                        {subcategorias.map((sub) => (
                          <li key={sub.id} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                            {sub.nome}
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
          {receitas.map((categoria) => (
            <Card key={categoria.id} className="hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: categoria.cor || '#6b7280' }}
                  />
                  {categoria.nome}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">Categoria de receita</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
