import { useState, useEffect, useMemo } from 'react'
import { Modal } from './ui/Modal'
import { Button, Input, Select, CurrencyInput } from './ui'
import { useCategoriasStore, useAssinaturasStore } from '../store'
import { SUBSCRIPTION_LOGOS, SubscriptionLogoOption } from '../data/subscription-logos'
import type { CreateAssinaturaInput, Assinatura } from '../types'
import { format } from 'date-fns'
import { cn } from '../lib/cn'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  editingAssinatura?: Assinatura
}

export function SubscriptionModal({ isOpen, onClose, editingAssinatura }: SubscriptionModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  const createAssinatura = useAssinaturasStore((state) => state.createAssinatura)
  const updateAssinatura = useAssinaturasStore((state) => state.updateAssinatura)

  const [formData, setFormData] = useState<Partial<CreateAssinaturaInput>>({
    nome: '',
    valor: 0,
    frequencia: 'mensal',
    dia_cobranca: 1,
    primeira_cobranca: format(new Date(), 'yyyy-MM-dd'),
    logo_url: null,
  })
  const [logoSelecionado, setLogoSelecionado] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrar categorias de despesa
  const categoriasDespesa = useMemo(() => {
    return categorias.filter((c) => !c.categoria_pai_id && c.tipo === 'despesa')
  }, [categorias])

  const categoriaOptions = useMemo(
    () => categoriasDespesa.map((cat) => ({ value: cat.id, label: cat.nome })),
    [categoriasDespesa]
  )

  // Filtrar logos por busca
  const logosFiltrados = useMemo(() => {
    if (!searchTerm) return SUBSCRIPTION_LOGOS
    return SUBSCRIPTION_LOGOS.filter((logo) =>
      logo.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [searchTerm])

  // Popular form ao editar
  useEffect(() => {
    if (editingAssinatura && isOpen) {
      setFormData({
        nome: editingAssinatura.nome,
        valor: editingAssinatura.valor,
        frequencia: editingAssinatura.frequencia,
        dia_cobranca: editingAssinatura.dia_cobranca,
        categoria_id: editingAssinatura.categoria_id,
        primeira_cobranca: editingAssinatura.primeira_cobranca,
        logo_url: editingAssinatura.logo_url,
      })
      setLogoSelecionado(editingAssinatura.logo_url)
    } else if (!isOpen) {
      setFormData({
        nome: '',
        valor: 0,
        frequencia: 'mensal',
        dia_cobranca: 1,
        primeira_cobranca: format(new Date(), 'yyyy-MM-dd'),
        logo_url: null,
      })
      setLogoSelecionado(null)
      setSearchTerm('')
    }
  }, [editingAssinatura, isOpen])

  const handleLogoSelect = (logo: SubscriptionLogoOption) => {
    setLogoSelecionado(logo.logoUrl)
    setFormData({ ...formData, logo_url: logo.logoUrl, nome: formData.nome || logo.nome })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validações
      if (!formData.nome || !formData.categoria_id || !formData.valor || !formData.primeira_cobranca) {
        alert('Por favor, preencha todos os campos obrigatórios')
        setIsLoading(false)
        return
      }

      if (formData.valor <= 0) {
        alert('O valor deve ser maior que zero')
        setIsLoading(false)
        return
      }

      if (formData.dia_cobranca! < 1 || formData.dia_cobranca! > 31) {
        alert('O dia de cobrança deve estar entre 1 e 31')
        setIsLoading(false)
        return
      }

      if (editingAssinatura) {
        await updateAssinatura(editingAssinatura.id, {
          nome: formData.nome,
          valor: formData.valor,
          frequencia: formData.frequencia,
          dia_cobranca: formData.dia_cobranca,
          categoria_id: formData.categoria_id,
          logo_url: logoSelecionado,
        })
      } else {
        const assinaturaData: CreateAssinaturaInput = {
          family_id: 'local-storage-family',
          nome: formData.nome!,
          valor: formData.valor!,
          frequencia: formData.frequencia!,
          dia_cobranca: formData.dia_cobranca!,
          categoria_id: formData.categoria_id!,
          primeira_cobranca: formData.primeira_cobranca!,
          logo_url: logoSelecionado,
        }

        await createAssinatura(assinaturaData)
      }

      onClose()
    } catch (error) {
      console.error('Erro ao salvar assinatura:', error)
      alert('Erro ao salvar assinatura. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAssinatura ? 'Editar Assinatura' : 'Nova Assinatura'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seleção de Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Serviço
          </label>

          {/* Busca */}
          <Input
            type="text"
            placeholder="Buscar serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-3"
          />

          {/* Grid de Logos */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-64 overflow-y-auto p-2 bg-dark-800/50 rounded-lg">
            {logosFiltrados.map((logo) => (
              <button
                key={logo.id}
                type="button"
                onClick={() => handleLogoSelect(logo)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg transition-all',
                  'hover:bg-dark-700 hover:scale-105',
                  logoSelecionado === logo.logoUrl
                    ? 'bg-primary-500/20 ring-2 ring-primary-500'
                    : 'bg-dark-800'
                )}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${logo.cor}20` }}
                >
                  {logo.logoUrl}
                </div>
                <span className="text-xs text-gray-400 text-center truncate w-full">
                  {logo.nome}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Nome */}
        <Input
          label="Nome da Assinatura"
          type="text"
          required
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          placeholder="Ex: Netflix Premium"
        />

        {/* Valor e Frequência */}
        <div className="grid grid-cols-2 gap-4">
          <CurrencyInput
            label="Valor"
            required
            value={formData.valor || 0}
            onChange={(value) => setFormData({ ...formData, valor: value })}
          />

          <Select
            label="Frequência"
            required
            value={formData.frequencia}
            onChange={(e) => setFormData({ ...formData, frequencia: e.target.value as any })}
            options={[
              { value: 'mensal', label: 'Mensal' },
              { value: 'anual', label: 'Anual' },
            ]}
          />
        </div>

        {/* Dia de Cobrança e Categoria */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Dia de Cobrança"
            type="number"
            required
            min={1}
            max={31}
            value={formData.dia_cobranca}
            onChange={(e) => setFormData({ ...formData, dia_cobranca: parseInt(e.target.value) })}
            helperText="Dia do mês (1-31)"
          />

          <Select
            label="Categoria"
            required
            value={formData.categoria_id}
            onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
            options={categoriaOptions}
          />
        </div>

        {/* Primeira Cobrança (apenas ao criar) */}
        {!editingAssinatura && (
          <Input
            label="Data da Primeira Cobrança"
            type="date"
            required
            value={formData.primeira_cobranca}
            onChange={(e) => setFormData({ ...formData, primeira_cobranca: e.target.value })}
            helperText="A partir desta data serão gerados os lançamentos futuros"
          />
        )}

        {/* Ações */}
        <div className="flex gap-3 justify-end pt-4 border-t border-dark-700">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Salvando...' : editingAssinatura ? 'Atualizar' : 'Criar Assinatura'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
