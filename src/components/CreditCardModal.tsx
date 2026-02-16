import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button, Input, CurrencyInput } from './ui'
import { useCartoesStore } from '../store'
import type { CreateCartaoInput, Cartao } from '../types'

interface CreditCardModalProps {
  isOpen: boolean
  onClose: () => void
  cartao?: Cartao // Para edição
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

export function CreditCardModal({ isOpen, onClose, cartao }: CreditCardModalProps) {
  const createCartao = useCartoesStore((state) => state.createCartao)
  const updateCartao = useCartoesStore((state) => state.updateCartao)

  const [formData, setFormData] = useState<Partial<CreateCartaoInput>>({
    nome: '',
    dia_fechamento: 1,
    dia_vencimento: 10,
    limite: 0,
    cor: CORES_DISPONIVEIS[4], // Verde por padrão
    ativo: true,
  })
  const [isLoading, setIsLoading] = useState(false)

  const isEditMode = !!cartao

  // Preencher form com dados do cartão ao editar
  useEffect(() => {
    if (cartao) {
      setFormData({
        nome: cartao.nome,
        dia_fechamento: cartao.dia_fechamento,
        dia_vencimento: cartao.dia_vencimento,
        limite: cartao.limite,
        cor: cartao.cor || CORES_DISPONIVEIS[4],
        ativo: cartao.ativo,
      })
    } else {
      setFormData({
        nome: '',
        dia_fechamento: 1,
        dia_vencimento: 10,
        limite: 0,
        cor: CORES_DISPONIVEIS[4],
        ativo: true,
      })
    }
  }, [cartao])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validações
      if (!formData.nome?.trim()) {
        alert('Por favor, informe o nome do cartão')
        setIsLoading(false)
        return
      }

      if (
        !formData.dia_fechamento ||
        formData.dia_fechamento < 1 ||
        formData.dia_fechamento > 31
      ) {
        alert('O dia de fechamento deve estar entre 1 e 31')
        setIsLoading(false)
        return
      }

      if (
        !formData.dia_vencimento ||
        formData.dia_vencimento < 1 ||
        formData.dia_vencimento > 31
      ) {
        alert('O dia de vencimento deve estar entre 1 e 31')
        setIsLoading(false)
        return
      }

      if (formData.limite === undefined || formData.limite === null || formData.limite < 0) {
        alert('O limite deve ser um valor positivo')
        setIsLoading(false)
        return
      }

      if (isEditMode && cartao) {
        // Atualizar cartão existente
        await updateCartao(cartao.id, {
          nome: formData.nome.trim(),
          dia_fechamento: formData.dia_fechamento,
          dia_vencimento: formData.dia_vencimento,
          limite: formData.limite,
          cor: formData.cor || CORES_DISPONIVEIS[4],
          ativo: formData.ativo ?? true,
        })
      } else {
        // Criar novo cartão
        const cartaoData: CreateCartaoInput = {
          nome: formData.nome.trim(),
          dia_fechamento: formData.dia_fechamento!,
          dia_vencimento: formData.dia_vencimento!,
          limite: formData.limite ?? 0,
          cor: formData.cor || CORES_DISPONIVEIS[4],
          ativo: formData.ativo ?? true,
        }

        await createCartao(cartaoData)
      }

      // Resetar form e fechar
      setFormData({
        nome: '',
        dia_fechamento: 1,
        dia_vencimento: 10,
        limite: 0,
        cor: CORES_DISPONIVEIS[4],
        ativo: true,
      })
      onClose()
    } catch (error) {
      console.error('Erro ao salvar cartão:', error)
      alert('Erro ao salvar cartão. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        nome: '',
        dia_fechamento: 1,
        dia_vencimento: 10,
        limite: 0,
        cor: CORES_DISPONIVEIS[4],
        ativo: true,
      })
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? 'Editar Cartão' : 'Novo Cartão'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nome do Cartão <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Nubank, Itaú..."
            required
          />
        </div>

        {/* Dia de Fechamento */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Dia de Fechamento da Fatura <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            min="1"
            max="31"
            value={formData.dia_fechamento}
            onChange={(e) =>
              setFormData({ ...formData, dia_fechamento: parseInt(e.target.value) })
            }
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Dia em que a fatura fecha (1 a 31)
          </p>
        </div>

        {/* Dia de Vencimento */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Dia de Vencimento da Fatura <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            min="1"
            max="31"
            value={formData.dia_vencimento}
            onChange={(e) =>
              setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) })
            }
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Dia em que a fatura vence (1 a 31)
          </p>
        </div>

        {/* Limite */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Limite do Cartão <span className="text-red-500">*</span>
          </label>
          <CurrencyInput
            value={formData.limite || 0}
            onChange={(value) => setFormData({ ...formData, limite: value })}
            placeholder="R$ 0,00"
          />
        </div>

        {/* Cor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Cor</label>
          <div className="grid grid-cols-6 sm:grid-cols-7 md:grid-cols-9 gap-2">
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

        {/* Ativo */}
        {isEditMode && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-dark-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-dark-800"
            />
            <label htmlFor="ativo" className="text-sm text-gray-300">
              Cartão ativo
            </label>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading} className="flex-1">
            {isEditMode ? 'Salvar Alterações' : 'Criar Cartão'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
