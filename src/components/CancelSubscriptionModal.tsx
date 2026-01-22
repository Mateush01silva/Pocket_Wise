import { useState } from 'react'
import { AlertTriangle, Calendar, Check, X } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button, Input } from './ui'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AssinaturaComDetalhes } from '../types'

interface CancelSubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  assinatura: AssinaturaComDetalhes | null
  onConfirm: (dataUltimaCobranca: string) => Promise<void>
}

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  assinatura,
  onConfirm,
}: CancelSubscriptionModalProps) {
  const [dataUltimaCobranca, setDataUltimaCobranca] = useState(
    format(new Date(), 'yyyy-MM-dd')
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!assinatura) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validar formato da data
    const regexData = /^\d{4}-\d{2}-\d{2}$/
    if (!regexData.test(dataUltimaCobranca)) {
      setError('Data inválida! Use o formato AAAA-MM-DD (exemplo: 2026-01-20)')
      return
    }

    // Validar se data não está no futuro distante (mais de 1 ano)
    const dataLimite = new Date()
    dataLimite.setFullYear(dataLimite.getFullYear() + 1)
    const dataInput = new Date(dataUltimaCobranca)

    if (dataInput > dataLimite) {
      setError('Data da última cobrança não pode estar mais de 1 ano no futuro')
      return
    }

    setIsLoading(true)
    try {
      await onConfirm(dataUltimaCobranca)
      onClose()
    } catch (err) {
      setError('Erro ao cancelar assinatura. Tente novamente.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancelar Assinatura"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações da Assinatura */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-400 mb-1">
                Atenção: Cancelamento de Assinatura
              </h3>
              <p className="text-sm text-gray-300 mb-2">
                Você está cancelando a assinatura:{' '}
                <span className="font-semibold">{assinatura.nome}</span>
              </p>
              <div className="text-xs text-gray-400 space-y-1">
                <p>• A assinatura será marcada como <strong>INATIVA</strong></p>
                <p>• Lançamentos até a última cobrança serão <strong>MANTIDOS</strong></p>
                <p>• Lançamentos futuros serão <strong>REMOVIDOS</strong></p>
                <p>• Você poderá visualizar o histórico na lista de assinaturas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Data da Última Cobrança */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Calendar size={16} />
            Qual será a data da última cobrança?
          </label>
          <Input
            type="date"
            value={dataUltimaCobranca}
            onChange={(e) => setDataUltimaCobranca(e.target.value)}
            max={format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd')}
            required
          />
          <p className="text-xs text-gray-500 mt-2">
            Informe até quando a assinatura será cobrada. Manteremos o histórico de
            pagamentos até esta data.
          </p>
        </div>

        {/* Preview */}
        {dataUltimaCobranca && (
          <div className="bg-dark-700/30 border border-dark-600 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-gray-300">Resumo do cancelamento:</p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>
                ✓ <strong>Última cobrança:</strong>{' '}
                {format(new Date(dataUltimaCobranca), "dd 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
              </p>
              <p>✓ Lançamentos serão mantidos até esta data</p>
              <p>✓ Assinatura ficará visível como INATIVA</p>
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            <X size={16} className="mr-2" />
            Voltar
          </Button>
          <Button
            type="submit"
            variant="danger"
            isLoading={isLoading}
            className="flex-1"
          >
            <Check size={16} className="mr-2" />
            Confirmar Cancelamento
          </Button>
        </div>
      </form>
    </Modal>
  )
}
