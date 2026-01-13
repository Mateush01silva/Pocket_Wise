import { useState, useEffect, useMemo } from 'react'
import { Modal } from './ui/Modal'
import { Button, Input, Select } from './ui'
import { useCategoriasStore } from '../store'
import type { CreateCategoriaInput, Categoria, TransactionType } from '../types'

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  categoria?: Categoria // Para edição
}

const CORES_DISPONIVEIS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
]

export function CategoryModal({ isOpen, onClose, categoria }: CategoryModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  const createCategoria = useCategoriasStore((state) => state.createCategoria)
  const updateCategoria = useCategoriasStore((state) => state.updateCategoria)

  const [formData, setFormData] = useState<Partial<CreateCategoriaInput>>({
    nome: '',
    tipo: 'despesa',
    cor: CORES_DISPONIVEIS[0],
    icone: '📦',
  })
  const [isLoading, setIsLoading] = useState(false)

  const isEditMode = !!categoria

  // Preencher form com dados da categoria ao editar
  useEffect(() => {
    if (categoria) {
      setFormData({
        nome: categoria.nome,
        tipo: categoria.tipo,
        cor: categoria.cor || CORES_DISPONIVEIS[0],
        icone: categoria.icone || '📦',
        categoria_pai_id: categoria.categoria_pai_id || undefined,
      })
    } else {
      setFormData({
        nome: '',
        tipo: 'despesa',
        cor: CORES_DISPONIVEIS[0],
        icone: '📦',
      })
    }
  }, [categoria])

  // Filtrar categorias principais por tipo para seleção de categoria pai
  const categoriasPrincipais = useMemo(() => {
    return categorias.filter(
      (c) => !c.categoria_pai_id && c.tipo === formData.tipo && c.id !== categoria?.id
    )
  }, [categorias, formData.tipo, categoria?.id])

  const categoriaPaiOptions = useMemo(
    () => [
      { value: '', label: 'Nenhuma (Categoria Principal)' },
      ...categoriasPrincipais.map((cat) => ({
        value: cat.id,
        label: cat.nome,
      })),
    ],
    [categoriasPrincipais]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validações
      if (!formData.nome?.trim()) {
        alert('Por favor, informe o nome da categoria')
        setIsLoading(false)
        return
      }

      if (!formData.tipo) {
        alert('Por favor, selecione o tipo da categoria')
        setIsLoading(false)
        return
      }

      if (isEditMode && categoria) {
        // Atualizar categoria existente
        await updateCategoria(categoria.id, {
          nome: formData.nome.trim(),
          tipo: formData.tipo,
          cor: formData.cor || CORES_DISPONIVEIS[0],
          icone: formData.icone || '📦',
          categoria_pai_id: formData.categoria_pai_id || null,
        })
      } else {
        // Criar nova categoria
        const categoriaData: CreateCategoriaInput = {
          nome: formData.nome.trim(),
          tipo: formData.tipo as TransactionType,
          cor: formData.cor || CORES_DISPONIVEIS[0],
          icone: formData.icone || '📦',
          categoria_pai_id: formData.categoria_pai_id || null,
        }

        await createCategoria(categoriaData)
      }

      // Resetar form e fechar
      setFormData({
        nome: '',
        tipo: 'despesa',
        cor: CORES_DISPONIVEIS[0],
        icone: '📦',
      })
      onClose()
    } catch (error) {
      console.error('Erro ao salvar categoria:', error)
      alert('Erro ao salvar categoria. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        nome: '',
        tipo: 'despesa',
        cor: CORES_DISPONIVEIS[0],
        icone: '📦',
      })
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEditMode ? 'Editar Categoria' : 'Nova Categoria'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nome <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Alimentação, Transporte..."
            required
          />
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tipo <span className="text-red-500">*</span>
          </label>
          <Select
            value={formData.tipo}
            onChange={(e) =>
              setFormData({ ...formData, tipo: e.target.value as TransactionType })
            }
            options={[
              { value: 'despesa', label: 'Despesa' },
              { value: 'receita', label: 'Receita' },
            ]}
          />
        </div>

        {/* Categoria Pai (para criar subcategorias) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Categoria Pai (opcional)
          </label>
          <Select
            value={formData.categoria_pai_id || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                categoria_pai_id: e.target.value || null,
              })
            }
            options={categoriaPaiOptions}
          />
          <p className="text-xs text-gray-500 mt-1">
            Deixe vazio para criar uma categoria principal
          </p>
        </div>

        {/* Ícone */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
          <Input
            type="text"
            value={formData.icone}
            onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
            placeholder="📦"
            maxLength={2}
          />
          <p className="text-xs text-gray-500 mt-1">
            Use um emoji para representar a categoria
          </p>
        </div>

        {/* Cor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Cor</label>
          <div className="grid grid-cols-9 gap-2">
            {CORES_DISPONIVEIS.map((cor) => (
              <button
                key={cor}
                type="button"
                onClick={() => setFormData({ ...formData, cor })}
                className={`w-8 h-8 rounded-full transition-all ${
                  formData.cor === cor
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-800 scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: cor }}
                title={cor}
              />
            ))}
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading} className="flex-1">
            {isEditMode ? 'Salvar Alterações' : 'Criar Categoria'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
