import { useState, useEffect, useMemo } from 'react'
import { Modal } from './ui/Modal'
import { Button, Input, Select, CurrencyInput } from './ui'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { useFamilyStore } from '../store/useFamilyStore'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import type { Caixinha, CaixinhaTipo, SubtipoInvestimento } from '../types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { confirmDialog } from './ui/ConfirmDialog'
import { calcularAporteSugerido } from '../lib/caixinhasCalculations'
import { formatCurrency } from '../utils/currency'

interface CaixinhaModalProps {
  isOpen: boolean
  onClose: () => void
  editingCaixinha?: Caixinha
}

const TIPO_OPTIONS = [
  { value: 'objetivo', label: '🎯 Objetivo (Viagem, Carro, etc)' },
  { value: 'emergencia', label: '🏥 Reserva de Emergência' },
  { value: 'investimento', label: '📈 Investimento' },
]

const SUBTIPO_OPTIONS: { value: SubtipoInvestimento; label: string }[] = [
  { value: 'renda_fixa', label: '🏦 Renda Fixa (CDB, LCI, LCA, Tesouro)' },
  { value: 'renda_variavel', label: '📊 Renda Variável (Ações, ETF)' },
  { value: 'fii', label: '🏢 Fundos Imobiliários (FII)' },
  { value: 'cripto', label: '🪙 Criptomoedas' },
  { value: 'internacional', label: '🌎 Internacional (BDR, fundos no exterior)' },
  { value: 'outro', label: '💼 Outro' },
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
  const family = useFamilyStore((state) => state.family)
  const createCaixinha = useCaixinhasStore((state) => state.createCaixinha)
  const updateCaixinha = useCaixinhasStore((state) => state.updateCaixinha)
  const contas = useContasBancariasStore((state) => state.contas)

  // Filtrar somente contas de investimento ativas para o vínculo
  const contasInvestimento = contas.filter((c) => c.ativo && c.tipo === 'investimento')

  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'objetivo' as CaixinhaTipo,
    meta_valor: 0,
    prazo_data: '',
    icone: '🎯',
    cor: '#6366f1',
    descricao: '',
    subtipo_investimento: '' as SubtipoInvestimento | '',
    conta_investimento_id: '' as string,
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
        subtipo_investimento: (editingCaixinha.subtipo_investimento as SubtipoInvestimento) || '',
        conta_investimento_id: editingCaixinha.conta_investimento_id || '',
      })
    } else if (!isOpen) {
      setFormData({
        nome: '',
        tipo: 'objetivo',
        meta_valor: 0,
        prazo_data: '',
        icone: '🎯',
        cor: '#6366f1',
        descricao: '',
        subtipo_investimento: '',
        conta_investimento_id: '',
      })
    }
  }, [editingCaixinha, isOpen])

  const isInvestimento = formData.tipo === 'investimento'

  // Aporte sugerido: calculado em tempo real para Objetivos & Reservas
  const aporteSugerido = useMemo(() => {
    if (isInvestimento) return null
    const saldoConquistado = editingCaixinha
      ? ((editingCaixinha as unknown as { saldo_conquistado?: number }).saldo_conquistado ?? editingCaixinha.saldo_atual)
      : 0
    return calcularAporteSugerido(
      formData.meta_valor > 0 ? formData.meta_valor : null,
      saldoConquistado,
      formData.prazo_data || null,
      editingCaixinha?.meses_pausados ?? 0
    )
  }, [isInvestimento, formData.meta_valor, formData.prazo_data, editingCaixinha])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!formData.nome || !family?.id) {
        toast.error('Por favor, preencha todos os campos obrigatórios')
        setIsLoading(false)
        return
      }

      if (editingCaixinha) {
        // Mudar o tipo para investimento descarta o prazo silenciosamente —
        // avisar antes, pois o aporte sugerido e a projeção dependem dele
        const vaiPerderPrazo =
          editingCaixinha.tipo !== 'investimento' &&
          formData.tipo === 'investimento' &&
          !!editingCaixinha.prazo_data
        if (vaiPerderPrazo) {
          const ok = await confirmDialog({
            title: 'Converter em caixinha de investimento?',
            message:
              'Investimentos não têm prazo — o prazo atual e o aporte mensal sugerido serão removidos. O saldo e o histórico são preservados.',
            confirmLabel: 'Converter',
          })
          if (!ok) {
            setIsLoading(false)
            return
          }
        }

        const result = await updateCaixinha({
          id: editingCaixinha.id,
          nome: formData.nome,
          tipo: formData.tipo,
          meta_valor: formData.meta_valor > 0 ? formData.meta_valor : null,
          prazo_data: formData.prazo_data || null,
          icone: formData.icone,
          cor: formData.cor,
          descricao: formData.descricao || null,
          subtipo_investimento: isInvestimento && formData.subtipo_investimento
            ? formData.subtipo_investimento as SubtipoInvestimento
            : null,
          conta_investimento_id: isInvestimento && formData.conta_investimento_id
            ? formData.conta_investimento_id
            : null,
        })

        if (result) {
          toast.success('Caixinha atualizada com sucesso!')
          onClose()
        } else {
          toast.error('Erro ao atualizar caixinha')
        }
      } else {
        const result = await createCaixinha({
          family_id: family.id,
          nome: formData.nome,
          tipo: formData.tipo,
          meta_valor: formData.meta_valor > 0 ? formData.meta_valor : null,
          prazo_data: formData.prazo_data || null,
          icone: formData.icone,
          cor: formData.cor,
          descricao: formData.descricao || null,
          subtipo_investimento: isInvestimento && formData.subtipo_investimento
            ? formData.subtipo_investimento as SubtipoInvestimento
            : null,
          conta_investimento_id: isInvestimento && formData.conta_investimento_id
            ? formData.conta_investimento_id
            : null,
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
            placeholder={isInvestimento ? 'Ex: CDB Nubank 2027' : 'Ex: Viagem para Disney'}
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
            onChange={(e) => setFormData({
              ...formData,
              tipo: e.target.value as CaixinhaTipo,
              subtipo_investimento: '',
              conta_investimento_id: '',
            })}
            options={TIPO_OPTIONS}
          />
        </div>

        {/* Subtipo — apenas para investimento */}
        {isInvestimento && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Categoria do Investimento
            </label>
            <Select
              value={formData.subtipo_investimento}
              onChange={(e) => setFormData({ ...formData, subtipo_investimento: e.target.value as SubtipoInvestimento })}
              options={[
                { value: '', label: 'Selecione uma categoria...' },
                ...SUBTIPO_OPTIONS,
              ]}
            />
          </div>
        )}

        {/* Conta de Investimento Vinculada — apenas para investimento */}
        {isInvestimento && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Conta de Investimento Vinculada
            </label>
            {contasInvestimento.length === 0 ? (
              <p className="text-xs text-yellow-500 bg-yellow-500/10 rounded p-2">
                ⚠️ Nenhuma conta de investimento cadastrada. Cadastre uma conta do tipo "Investimento" em <strong>Contas</strong> para vinculá-la aqui.
              </p>
            ) : (
              <>
                <Select
                  value={formData.conta_investimento_id}
                  onChange={(e) => setFormData({ ...formData, conta_investimento_id: e.target.value })}
                  options={[
                    { value: '', label: 'Sem vínculo com conta' },
                    ...contasInvestimento.map((c) => ({
                      value: c.id,
                      label: `${c.icone || '💼'} ${c.nome}${c.instituicao ? ` — ${c.instituicao}` : ''}`,
                    })),
                  ]}
                />
                {formData.conta_investimento_id && (
                  <p className="text-xs text-blue-400 mt-1">
                    💡 Ao atualizar o valor de mercado desta caixinha, o saldo da conta vinculada será ajustado automaticamente pela variação.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Meta de Valor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Meta de Valor {isInvestimento ? '(Opcional)' : '*'}
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
          {isInvestimento && (
            <p className="text-xs text-gray-500 mt-1">
              Defina uma meta se quiser acompanhar progresso (ex: R$50.000 para aposentadoria)
            </p>
          )}
        </div>

        {/* Prazo — não exibido para investimento */}
        {isInvestimento && (
          <p className="text-xs text-gray-500">
            Investimentos não têm prazo: são acompanhados continuamente pelo valor de mercado.
          </p>
        )}
        {!isInvestimento && (
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

        {/* Aporte sugerido — exibido em tempo real quando meta + prazo estão preenchidos */}
        {!isInvestimento && aporteSugerido !== null && aporteSugerido > 0 && (
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-md p-3">
            <p className="text-xs text-primary-400 font-medium mb-0.5">Aporte mensal sugerido</p>
            <p className="text-lg font-bold text-primary-300">{formatCurrency(aporteSugerido)}/mês</p>
            <p className="text-xs text-gray-500 mt-1">
              Para atingir sua meta no prazo definido.
              {editingCaixinha?.meses_pausados ? ` (${editingCaixinha.meses_pausados} ${editingCaixinha.meses_pausados === 1 ? 'mês pausado incluído' : 'meses pausados incluídos'})` : ''}
            </p>
          </div>
        )}
        {!isInvestimento && aporteSugerido === 0 && formData.meta_valor > 0 && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-md p-3">
            <p className="text-xs text-green-400 font-medium">✅ Meta já atingida!</p>
          </div>
        )}

        {/* Ícone */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Ícone
          </label>
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
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
            placeholder={
              isInvestimento
                ? 'Ex: CDB com vencimento em 2027, taxa 120% CDI'
                : 'Descreva o objetivo da caixinha...'
            }
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
