import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button, Input, Select, CurrencyInput } from './ui'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { useAuth } from '../contexts/AuthContext'
import type { Caixinha, CaixinhaTipo } from '../types'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface CaixinhaModalProps {
  isOpen: boolean
  onClose: () => void
  editingCaixinha?: Caixinha
}

const TIPO_OPTIONS = [
  { value: 'objetivo', label: '🎯 Objetivo (Viagem, Carro, etc)' },
  { value: 'emergencia', label: '🏥 Reserva de Emergência' },
  { value: 'investimento', label: '💰 Investimento' },
]

const ICONE_OPTIONS = [
  '🎯', '✈️', '🏠', '🚗', '💍', '🎓', '💻', '📱',
  '🏥', '💰', '📈', '🎁', '🎉', '🌴', '🏖️', '⛰️'
]

const COR_OPTIONS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // green
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
]

export function CaixinhaModal({ isOpen, onClose, editingCaixinha }: CaixinhaModalProps) {
  const { user } = useAuth()
  const createCaixinha = useCaixinhasStore((state) => state.createCaixinha)
  const updateCaixinha = useCaixinhasStore((state) => state.updateCaixinha)

  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'objetivo' as CaixinhaTipo,
    meta_valor: 0,
    prazo_data: '',
    icone: '🎯',
    cor: '#6366f1',
    descricao: '',
  })

  // Effect to populate form when editing
  useEffect(() => {
    if (editingCaixinha && isOpen) {
      setFormData({
        nome: editingCaixinha.nome,
        tipo: editingCaixinha.tipo,
        meta_valor: editingCaixinha.meta_valor || 0,
        prazo_data: editingCaixinha.prazo_data || '',
        icone: editingCaixinha.icone || '🎯',
        cor: editingCaixinha.cor || '#6366f1',
        descricao: editingCaixinha.descricao || '',
      })
    } else if (!isOpen) {
      // Reset form when closing
      setFormData({
        nome: '',
        tipo: 'objetivo',
        meta_valor: 0,
        prazo_data: '',
        icone: '🎯',
        cor: '#6366f1',
        descricao: '',
      })
    }
  }, [editingCaixinha, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validações básicas
      if (!formData.nome || !user?.family_id) {
        toast.error('Por favor, preencha todos os campos obrigatórios')
        setIsLoading(false)
        return
      }

      if (editingCaixinha) {
        // Atualizar caixinha existente
        const result = await updateCaixinha({
          id: editingCaixinha.id,
          ...formData,
          meta_valor: formData.meta_valor > 0 ? formData.meta_valor : null,
          prazo_data: formData.prazo_data || null,
        })

        if (result) {
          toast.success('Caixinha atualizada com sucesso!')
          onClose()
        } else {
          toast.error('Erro ao atualizar caixinha')
        }
      } else {
        // Criar nova caixinha
        const result = await createCaixinha({
          family_id: user.family_id,
          nome: formData.nome,
          tipo: formData.tipo,
          meta_valor: formData.meta_valor > 0 ? formData.meta_valor : null,
          prazo_data: formData.prazo_data || null,
          icone: formData.icone,
          cor: formData.cor,
          descricao: formData.descricao || null,
        })

        if (result) {
          toast.success('Caixinha criada com sucesso!')
          onClose()
        } else {
          toast.error('Erro ao criar caixinha')
        }
      }
    } catch (error) {
      console.error('Error submitting caixinha:', error)
      toast.error('Erro ao salvar caixinha')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCaixinha ? 'Editar Caixinha' : 'Nova Caixinha'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Nome da Caixinha *
          </label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Viagem para Disney"
            required
          />
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Tipo *
          </label>
          <Select
            value={formData.tipo}
            onChange={(e) => setFormData({ ...formData, tipo: e.target.value as CaixinhaTipo })}
            options={TIPO_OPTIONS}
          />
        </div>

        {/* Meta de Valor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Meta de Valor {formData.tipo === 'investimento' ? '(Opcional)' : '*'}
          </label>
          <CurrencyInput
            value={formData.meta_valor}
            onChange={(value) => setFormData({ ...formData, meta_valor: value })}
            placeholder="R$ 0,00"
          />
          {formData.tipo === 'emergencia' && (
            <p className="text-xs text-gray-500 mt-1">
              Recomendado: 6 meses de despesas fixas
            </p>
          )}
        </div>

        {/* Prazo */}
        {formData.tipo !== 'investimento' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Prazo (Opcional)
            </label>
            <Input
              type="date"
              value={formData.prazo_data}
              onChange={(e) => setFormData({ ...formData, prazo_data: e.target.value })}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
        )}

        {/* Ícone */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Ícone
          </label>
          <div className="grid grid-cols-8 gap-2">
            {ICONE_OPTIONS.map((icone) => (
              <button
                key={icone}
                type="button"
                onClick={() => setFormData({ ...formData, icone })}
                className={`text-2xl p-2 rounded border ${
                  formData.icone === icone
                    ? 'border-primary-500 bg-primary-500/20'
                    : 'border-dark-600 hover:border-dark-500'
                }`}
              >
                {icone}
              </button>
            ))}
          </div>
        </div>

        {/* Cor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Cor
          </label>
          <div className="flex gap-2">
            {COR_OPTIONS.map((cor) => (
              <button
                key={cor}
                type="button"
                onClick={() => setFormData({ ...formData, cor })}
                className={`w-8 h-8 rounded-full border-2 ${
                  formData.cor === cor ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: cor }}
              />
            ))}
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Descrição (Opcional)
          </label>
          <textarea
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            placeholder="Descreva o objetivo da caixinha..."
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Salvando...' : editingCaixinha ? 'Atualizar' : 'Criar Caixinha'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
