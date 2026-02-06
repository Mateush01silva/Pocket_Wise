import { useState } from 'react'
import { X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Button } from './ui/Button'
import { CurrencyInput } from './ui/CurrencyInput'
import { Input } from './ui/Input'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import { toast } from 'sonner'
import type { CaixinhaComDetalhes, TransacaoCaixinhaTipo } from '../types'

interface MovimentarCaixinhaModalProps {
  isOpen: boolean
  onClose: () => void
  caixinha: CaixinhaComDetalhes
  tipo: 'deposito' | 'retirada'
}

export function MovimentarCaixinhaModal({
  isOpen,
  onClose,
  caixinha,
  tipo,
}: MovimentarCaixinhaModalProps) {
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const createTransacao = useCaixinhasStore((state) => state.createTransacao)

  const isDeposito = tipo === 'deposito'

  const handleSubmit = async () => {
    if (valor <= 0) {
      toast.error('Informe um valor válido')
      return
    }

    if (!isDeposito && valor > caixinha.saldo_atual) {
      toast.error('Valor maior que o saldo disponível')
      return
    }

    setIsLoading(true)

    try {
      const result = await createTransacao({
        caixinha_id: caixinha.id,
        valor,
        tipo: tipo as TransacaoCaixinhaTipo,
        descricao: descricao || null,
      })

      if (result) {
        toast.success(
          isDeposito
            ? `${formatCurrency(valor)} depositado com sucesso!`
            : `${formatCurrency(valor)} retirado com sucesso!`
        )
        handleClose()
      } else {
        toast.error('Erro ao realizar operação')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao realizar operação')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setValor(0)
    setDescricao('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className={cn(
          'bg-dark-900 border border-dark-700 rounded-xl shadow-xl',
          'w-full max-w-md',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isDeposito ? 'bg-green-500/20' : 'bg-amber-500/20'
              )}
            >
              {isDeposito ? (
                <ArrowUpCircle className="w-5 h-5 text-green-400" />
              ) : (
                <ArrowDownCircle className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">
                {isDeposito ? 'Depositar' : 'Retirar'}
              </h2>
              <p className="text-xs text-gray-500">{caixinha.nome}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-dark-800 transition-colors text-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Info da Caixinha */}
          <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg">
            <span className="text-2xl">{caixinha.icone}</span>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Saldo Atual</p>
              <p className="text-lg font-bold text-primary-400">
                {formatCurrency(caixinha.saldo_atual)}
              </p>
            </div>
            {caixinha.meta_valor && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Meta</p>
                <p className="text-sm text-gray-300">{formatCurrency(caixinha.meta_valor)}</p>
              </div>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Valor
            </label>
            <CurrencyInput
              value={valor}
              onChange={setValor}
              placeholder="R$ 0,00"
              className="w-full"
            />
            {!isDeposito && valor > caixinha.saldo_atual && (
              <p className="text-xs text-red-400 mt-1">
                Valor maior que o saldo disponível
              </p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descrição (opcional)
            </label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={isDeposito ? 'Ex: Salário de janeiro' : 'Ex: Compra de viagem'}
            />
          </div>

          {/* Preview do novo saldo */}
          {valor > 0 && (
            <div
              className={cn(
                'p-3 rounded-lg border',
                isDeposito
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              )}
            >
              <p className="text-sm text-gray-400 mb-1">Novo saldo após {isDeposito ? 'depósito' : 'retirada'}:</p>
              <p
                className={cn(
                  'text-xl font-bold',
                  isDeposito ? 'text-green-400' : 'text-amber-400'
                )}
              >
                {formatCurrency(
                  isDeposito
                    ? caixinha.saldo_atual + valor
                    : Math.max(0, caixinha.saldo_atual - valor)
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-dark-700">
          <Button variant="ghost" onClick={handleClose} disabled={isLoading} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={valor <= 0 || isLoading || (!isDeposito && valor > caixinha.saldo_atual)}
            isLoading={isLoading}
            className={cn(
              'flex-1',
              isDeposito ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'
            )}
          >
            {isDeposito ? (
              <>
                <ArrowUpCircle size={18} className="mr-2" />
                Depositar
              </>
            ) : (
              <>
                <ArrowDownCircle size={18} className="mr-2" />
                Retirar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
