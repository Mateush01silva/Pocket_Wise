import { useState, useMemo, useEffect } from 'react'
import { X, PiggyBank, Sparkles, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { format, subMonths, startOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from './ui/Button'
import { CurrencyInput } from './ui/CurrencyInput'
import { useCaixinhasStore } from '../store/useCaixinhasStore'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import { toast } from 'sonner'
import type { SaldoMesInfo } from '../lib/financialCalculations'

interface AlocarSaldoModalProps {
  isOpen: boolean
  onClose: () => void
  saldoDisponivel: number
  mesReferencia?: string // YYYY-MM-DD, default is previous month
  mesesComSaldo?: SaldoMesInfo[] // Breakdown of available balance by month
  onSuccess?: () => void // Callback for when allocation is successful
}

export function AlocarSaldoModal({
  isOpen,
  onClose,
  saldoDisponivel,
  mesReferencia,
  mesesComSaldo,
  onSuccess,
}: AlocarSaldoModalProps) {
  const caixinhas = useCaixinhasStore((state) => state.caixinhas)
  const alocarSaldoMensal = useCaixinhasStore((state) => state.alocarSaldoMensal)

  // Estado local para as alocações
  const [alocacoes, setAlocacoes] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showDetalhes, setShowDetalhes] = useState(false)

  // Filtrar apenas caixinhas ativas
  const caixinhasAtivas = useMemo(
    () => caixinhas.filter((c) => c.ativa),
    [caixinhas]
  )

  // Calcular mês de referência (mês anterior por padrão)
  const mesRef = useMemo(() => {
    if (mesReferencia) return mesReferencia
    return format(subMonths(startOfMonth(new Date()), 1), 'yyyy-MM-dd')
  }, [mesReferencia])

  const mesFormatado = format(parseISO(mesRef.substring(0, 7) + '-01'), "MMMM 'de' yyyy", { locale: ptBR })

  // Calcular total alocado e restante
  const totalAlocado = useMemo(
    () => Object.values(alocacoes).reduce((sum, val) => sum + (val || 0), 0),
    [alocacoes]
  )

  const saldoRestante = Math.round((saldoDisponivel - totalAlocado) * 100) / 100

  // Resetar alocações quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setAlocacoes({})
    }
  }, [isOpen])

  const handleAlocacaoChange = (caixinhaId: string, valor: number) => {
    setAlocacoes((prev) => ({
      ...prev,
      [caixinhaId]: valor,
    }))
  }

  const handleDistribuirIgualmente = () => {
    if (caixinhasAtivas.length === 0) return

    const valorPorCaixinha = Math.floor((saldoDisponivel / caixinhasAtivas.length) * 100) / 100
    const novasAlocacoes: Record<string, number> = {}

    caixinhasAtivas.forEach((c) => {
      novasAlocacoes[c.id] = valorPorCaixinha
    })

    setAlocacoes(novasAlocacoes)
  }

  const handlePreencherMetas = () => {
    // Preencher automaticamente para ajudar a atingir as metas
    const novasAlocacoes: Record<string, number> = {}
    let saldoRestanteTemp = saldoDisponivel

    // Ordenar por % restante para meta (mais perto primeiro)
    const caixinhasComMeta = caixinhasAtivas
      .filter((c) => c.meta_valor && c.meta_valor > c.saldo_atual)
      .sort((a, b) => {
        const faltaA = (a.meta_valor || 0) - a.saldo_atual
        const faltaB = (b.meta_valor || 0) - b.saldo_atual
        return faltaA - faltaB
      })

    for (const caixinha of caixinhasComMeta) {
      if (saldoRestanteTemp <= 0) break

      const valorFaltante = (caixinha.meta_valor || 0) - caixinha.saldo_atual
      const valorAlocar = Math.min(valorFaltante, saldoRestanteTemp)

      if (valorAlocar > 0) {
        novasAlocacoes[caixinha.id] = valorAlocar
        saldoRestanteTemp -= valorAlocar
      }
    }

    setAlocacoes(novasAlocacoes)
  }

  const handleSubmit = async () => {
    const alocacoesArray = Object.entries(alocacoes)
      .filter(([, valor]) => valor > 0)
      .map(([caixinha_id, valor]) => ({
        caixinha_id,
        valor,
        descricao: `Alocação do saldo de ${mesFormatado}`,
      }))

    if (alocacoesArray.length === 0) {
      toast.error('Selecione pelo menos uma caixinha')
      return
    }

    if (Math.round(totalAlocado * 100) > Math.round(saldoDisponivel * 100)) {
      toast.error('Total alocado excede o saldo disponível')
      return
    }

    setIsLoading(true)

    try {
      const success = await alocarSaldoMensal({
        mes_referencia: mesRef.substring(0, 7),
        alocacoes: alocacoesArray,
      })

      if (success) {
        toast.success(`${formatCurrency(totalAlocado)} alocado com sucesso!`)
        onSuccess?.()
        onClose()
      } else {
        // Pegar erro do store para mostrar detalhes
        const errorMsg = useCaixinhasStore.getState().error
        console.error('Erro ao alocar:', errorMsg)
        toast.error(errorMsg || 'Erro ao alocar saldo. Verifique sua conexão.')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao alocar saldo')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-dark-900 border border-dark-700 shadow-xl',
          'w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[85vh] flex flex-col',
          'rounded-t-2xl sm:rounded-xl',
          'animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Alocar Saldo</h2>
              <p className="text-xs text-gray-500 capitalize">{mesFormatado}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-dark-800 transition-colors text-gray-400 hover:text-gray-200 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 min-h-0">
          {/* Saldo disponível */}
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
            <p className="text-sm text-gray-400">Saldo disponível para alocar</p>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(saldoDisponivel)}
            </p>

            {mesesComSaldo && mesesComSaldo.length > 0 && (
              <>
                <button
                  onClick={() => setShowDetalhes(v => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showDetalhes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showDetalhes ? 'Ocultar detalhes' : `Ver detalhes (${mesesComSaldo.length} ${mesesComSaldo.length === 1 ? 'mês' : 'meses'})`}
                </button>

                {showDetalhes && (
                  <div className="space-y-2 pt-1">
                    {mesesComSaldo.map(m => {
                      const nomeMes = format(parseISO(m.mesRef + '-01'), "MMMM 'de' yyyy", { locale: ptBR })
                      const temCaixinha = m.totalRetiradasCaixinhas > 0
                      const organico = m.saldoBruto
                      return (
                        <div key={m.mesRef} className="flex items-start justify-between gap-2 text-xs border-t border-green-500/20 pt-2">
                          <div className="flex-1">
                            <p className="text-gray-300 capitalize font-medium">{nomeMes}</p>
                            {temCaixinha ? (
                              <p className="text-gray-500 mt-0.5">
                                {organico >= 0
                                  ? `R$ ${formatCurrency(organico)} orgânico + ${formatCurrency(m.totalRetiradasCaixinhas)} de caixinha`
                                  : `${formatCurrency(m.totalRetiradasCaixinhas)} de caixinha (fluxo ${formatCurrency(Math.abs(organico))} negativo)`}
                              </p>
                            ) : (
                              <p className="text-gray-500 mt-0.5">Saldo orgânico do mês</p>
                            )}
                          </div>
                          <span className="text-green-400 font-semibold shrink-0">{formatCurrency(m.saldoDisponivel)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ações rápidas */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDistribuirIgualmente}
              disabled={caixinhasAtivas.length === 0}
            >
              Distribuir igualmente
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreencherMetas}
              disabled={caixinhasAtivas.length === 0}
            >
              Priorizar metas
            </Button>
          </div>

          {/* Lista de Caixinhas */}
          {caixinhasAtivas.length === 0 ? (
            <div className="p-6 text-center">
              <PiggyBank className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Nenhuma caixinha ativa</p>
              <p className="text-xs text-gray-500">Crie uma caixinha primeiro</p>
            </div>
          ) : (
            <div className="space-y-3">
              {caixinhasAtivas.map((caixinha) => {
                const valorAlocado = alocacoes[caixinha.id] || 0
                const novoSaldo = caixinha.saldo_atual + valorAlocado
                const atingiuMeta = caixinha.meta_valor && novoSaldo >= caixinha.meta_valor

                return (
                  <div
                    key={caixinha.id}
                    className={cn(
                      'p-3 rounded-lg border transition-all',
                      valorAlocado > 0
                        ? 'bg-primary-500/10 border-primary-500/30'
                        : 'bg-dark-800 border-dark-700'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{caixinha.icone}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-200 truncate">
                            {caixinha.nome}
                          </p>
                          {atingiuMeta && (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                              Meta!
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <span>Atual: {formatCurrency(caixinha.saldo_atual)}</span>
                          {caixinha.meta_valor && (
                            <>
                              <span>•</span>
                              <span>Meta: {formatCurrency(caixinha.meta_valor)}</span>
                            </>
                          )}
                        </div>
                        {valorAlocado > 0 && (
                          <p className="text-xs text-green-400 mt-1">
                            Novo saldo: {formatCurrency(novoSaldo)}
                          </p>
                        )}
                      </div>
                      <div className="w-28">
                        <CurrencyInput
                          value={valorAlocado}
                          onChange={(val) => handleAlocacaoChange(caixinha.id, val)}
                          placeholder="R$ 0"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 space-y-3 shrink-0">
          {/* Resumo */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Total alocado:</span>
            <span
              className={cn(
                'font-semibold',
                Math.round(totalAlocado * 100) > Math.round(saldoDisponivel * 100) ? 'text-red-400' : 'text-green-400'
              )}
            >
              {formatCurrency(totalAlocado)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Restante:</span>
            <span
              className={cn(
                'font-semibold',
                saldoRestante < 0 ? 'text-red-400' : 'text-gray-300'
              )}
            >
              {formatCurrency(saldoRestante)}
            </span>
          </div>

          {Math.round(totalAlocado * 100) > Math.round(saldoDisponivel * 100) && (
            <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
              <AlertCircle size={14} />
              Total excede o saldo disponível
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={isLoading} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={totalAlocado <= 0 || Math.round(totalAlocado * 100) > Math.round(saldoDisponivel * 100) || isLoading}
              isLoading={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check size={18} className="mr-2" />
              Confirmar Alocação
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
