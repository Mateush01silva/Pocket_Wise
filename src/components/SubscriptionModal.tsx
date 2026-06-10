import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Modal } from './ui/Modal'
import { Button, Input, Select, CurrencyInput } from './ui'
import { useCategoriasStore, useAssinaturasStore, useCartoesStore } from '../store'
import { SUBSCRIPTION_LOGOS } from '../data/subscription-logos'
import type { SubscriptionLogoOption } from '../data/subscription-logos'
import type { CreateAssinaturaInput, Assinatura } from '../types'
import { format } from 'date-fns'
import { cn } from '../lib/cn'
import { CreditCard, Info } from 'lucide-react'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  editingAssinatura?: Assinatura
}

export function SubscriptionModal({ isOpen, onClose, editingAssinatura }: SubscriptionModalProps) {
  const categorias = useCategoriasStore((state) => state.categorias)
  const createAssinatura = useAssinaturasStore((state) => state.createAssinatura)
  const updateAssinatura = useAssinaturasStore((state) => state.updateAssinatura)
  const cartoes = useCartoesStore((state) => state.cartoes)
  const fetchCartoes = useCartoesStore((state) => state.fetchCartoes)

  const [formData, setFormData] = useState<Partial<CreateAssinaturaInput>>({
    nome: '',
    valor: 0,
    frequencia: 'mensal',
    dia_cobranca: 1,
    primeira_cobranca: format(new Date(), 'yyyy-MM-dd'),
    logo_url: null,
    cartao_id: null,
  })

  // Buscar cartões ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      fetchCartoes()
    }
  }, [isOpen, fetchCartoes])

  // Opções de cartões
  const cartaoOptions = useMemo(
    () => [
      { value: '', label: 'Nenhum (débito/boleto)' },
      ...cartoes.map((c) => ({ value: c.id, label: c.nome })),
    ],
    [cartoes]
  )
  const [logoSelecionado, setLogoSelecionado] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrar categorias de despesa (somente categorias principais)
  const categoriasDespesa = useMemo(() => {
    return categorias.filter((c) => !c.categoria_pai_id && c.tipo === 'despesa')
  }, [categorias])

  const categoriaOptions = useMemo(
    () => categoriasDespesa.map((cat) => ({ value: cat.id, label: cat.nome })),
    [categoriasDespesa]
  )

  // Filtrar subcategorias baseado na categoria selecionada
  const subcategorias = useMemo(() => {
    if (!formData.categoria_id) return []
    return categorias.filter(
      (c) => c.categoria_pai_id === formData.categoria_id && c.tipo === 'despesa'
    )
  }, [categorias, formData.categoria_id])

  const subcategoriaOptions = useMemo(
    () => subcategorias.map((cat) => ({ value: cat.id, label: cat.nome })),
    [subcategorias]
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
        subcategoria_id: editingAssinatura.subcategoria_id,
        cartao_id: editingAssinatura.cartao_id,
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
        cartao_id: null,
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
        toast.error('Por favor, preencha todos os campos obrigatórios')
        setIsLoading(false)
        return
      }

      if (formData.valor <= 0) {
        toast.error('O valor deve ser maior que zero')
        setIsLoading(false)
        return
      }

      if (formData.dia_cobranca! < 1 || formData.dia_cobranca! > 31) {
        toast.error('O dia de cobrança deve estar entre 1 e 31')
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
          subcategoria_id: formData.subcategoria_id,
          cartao_id: formData.cartao_id || null,
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
          subcategoria_id: formData.subcategoria_id,
          cartao_id: formData.cartao_id || null,
          primeira_cobranca: formData.primeira_cobranca!,
          logo_url: logoSelecionado,
        }

        console.log('🔵 SubscriptionModal: Criando assinatura com dados:', assinaturaData)
        const resultado = await createAssinatura(assinaturaData)
        console.log('🔵 SubscriptionModal: Resultado da criação:', resultado)

        if (!resultado) {
          throw new Error('Falha ao criar assinatura - retorno null')
        }
      }

      console.log('✅ Assinatura salva com sucesso')
      onClose()
    } catch (error) {
      console.error('Erro ao salvar assinatura:', error)
      toast.error('Erro ao salvar assinatura. Tente novamente.')
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
        {/* Aviso sobre edição */}
        {editingAssinatura && (
          <div className="flex gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Info size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">As alterações afetam apenas lançamentos futuros</p>
              <p className="text-blue-400">
                Os meses já pagos não serão modificados. Somente os lançamentos pendentes (a partir de hoje) serão atualizados com os novos dados.
              </p>
            </div>
          </div>
        )}

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
            onChange={(e) =>
              setFormData({ ...formData, categoria_id: e.target.value, subcategoria_id: null })
            }
            options={categoriaOptions}
          />
        </div>

        {/* Subcategoria (se houver) */}
        {subcategorias.length > 0 && (
          <Select
            label="Subcategoria"
            value={formData.subcategoria_id || ''}
            onChange={(e) => setFormData({ ...formData, subcategoria_id: e.target.value || null })}
            options={subcategoriaOptions}
            helperText="Opcional"
          />
        )}

        {/* Forma de Pagamento */}
        <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={18} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Forma de Pagamento</span>
          </div>
          <Select
            value={formData.cartao_id || ''}
            onChange={(e) => setFormData({ ...formData, cartao_id: e.target.value || null })}
            options={cartaoOptions}
            helperText="Se pago no cartão de crédito, a cobrança aparecerá na fatura"
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
