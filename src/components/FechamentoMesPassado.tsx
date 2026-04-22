import { useState } from 'react'
import { AlertTriangle, RefreshCw, ArrowRight, Lock, CheckCircle, X } from 'lucide-react'
import { Button } from './ui'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import type { CategoriaBudgetComRelacoes } from '../types'
import { formatCurrency } from '../utils/currency'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

interface FechamentoMesPassadoProps {
  categoriasBudget: CategoriaBudgetComRelacoes[]
  mesReferencia: string
  orcamentoId: string
  orcamentoStatus?: string
  onRebalanceado?: () => void | Promise<void>
  onFechado?: () => void | Promise<void>
}

export function FechamentoMesPassado({
  categoriasBudget,
  mesReferencia,
  orcamentoId,
  orcamentoStatus,
  onRebalanceado,
  onFechado,
}: FechamentoMesPassadoProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isFechando, setIsFechando] = useState(false)
  const [showModalFechamento, setShowModalFechamento] = useState(false)
  const updateCategoriaBudget = useOrcamentosStore((state) => state.updateCategoriaBudget)
  const fecharOrcamento = useOrcamentosStore((state) => state.fecharOrcamento)

  const jaFechado = orcamentoStatus === 'fechado'

  // Apenas despesas
  const despesas = categoriasBudget.filter(
    (cat) => cat.categoria?.tipo === 'despesa'
  )

  // Categorias estouradas (gastaram mais que o orçado)
  const categoriasEstouradas = despesas.filter(
    (cat) => cat.valor_disponivel !== undefined && cat.valor_disponivel < 0
  )

  // Categorias com sobra (gastaram menos que o orçado)
  const categoriasComSobra = despesas.filter(
    (cat) => cat.valor_disponivel !== undefined && cat.valor_disponivel > 0
  )

  const totalEstouro = categoriasEstouradas.reduce(
    (sum, cat) => sum + Math.abs(cat.valor_disponivel || 0), 0
  )

  const totalSobra = categoriasComSobra.reduce(
    (sum, cat) => sum + (cat.valor_disponivel || 0), 0
  )

  // Calcula inflação de orçamento (edições que aumentaram o total)
  const totalOrcadoAtual = despesas.reduce((sum, cat) => sum + (cat.valor_orcado || 0), 0)
  const totalOrcadoOriginal = despesas.reduce(
    (sum, cat) => sum + (cat.valor_orcado_original ?? cat.valor_orcado ?? 0), 0
  )
  const inflacao = totalOrcadoAtual - totalOrcadoOriginal
  const foiInflado = inflacao > totalOrcadoOriginal * 0.001

  const mesFormatado = format(parseISO(mesReferencia), 'MMMM yyyy', { locale: ptBR })
  const sobraCobreEstouro = totalSobra >= totalEstouro
  const valorFaltante = Math.max(0, totalEstouro - totalSobra)

  const handleAutoRebalancear = async () => {
    setIsLoading(true)
    try {
      let sobraRestante = totalSobra

      // 1. Para cada categoria estourada, ajustar orçamento para o valor gasto real
      for (const cat of categoriasEstouradas) {
        const valorGasto = cat.valor_gasto || 0
        await updateCategoriaBudget(cat.id, valorGasto)
      }

      // 2. Para cada categoria com sobra, reduzir proporcionalmente
      if (categoriasComSobra.length > 0 && totalEstouro > 0) {
        const totalParaRedistribuir = Math.min(totalEstouro, totalSobra)

        for (const cat of categoriasComSobra) {
          if (sobraRestante <= 0) break

          const sobraCat = cat.valor_disponivel || 0
          const proporcao = sobraCat / totalSobra
          const reducao = Math.min(
            sobraCat,
            Math.round(totalParaRedistribuir * proporcao * 100) / 100
          )

          const novoOrcado = cat.valor_orcado - reducao
          await updateCategoriaBudget(cat.id, Math.max(0, novoOrcado))
          sobraRestante -= reducao
        }
      }

      await onRebalanceado?.()

      if (sobraCobreEstouro) {
        toast.success(`Mês de ${mesFormatado} rebalanceado! Todos os envelopes ajustados.`)
      } else {
        toast.success(
          `Rebalanceamento parcial realizado. Ainda faltam ${formatCurrency(valorFaltante)} para cobrir todos os estouros.`
        )
      }
    } catch (error) {
      console.error('Erro ao auto-rebalancear:', error)
      toast.error('Erro ao rebalancear mês passado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmarFechamento = async () => {
    setIsFechando(true)
    try {
      await fecharOrcamento(orcamentoId)
      setShowModalFechamento(false)
      toast.success(`Orçamento de ${mesFormatado} fechado com sucesso!`)
      await onFechado?.()
    } catch (error) {
      console.error('Erro ao fechar orçamento:', error)
      toast.error('Erro ao fechar orçamento')
    } finally {
      setIsFechando(false)
    }
  }

  // Se mês fechado, exibe badge e nada mais
  if (jaFechado) {
    return (
      <div className="flex items-center gap-2 bg-gray-500/10 border border-gray-500/20 rounded-lg px-4 py-3">
        <CheckCircle className="text-gray-400" size={18} />
        <span className="text-gray-400 text-sm">
          Orçamento de {mesFormatado} <span className="font-medium">fechado</span> — score Pocks calculado com os valores originais.
        </span>
      </div>
    )
  }

  // Se não há estouros, só mostra o botão de fechar
  if (categoriasEstouradas.length === 0) {
    return (
      <div className="flex items-center justify-between bg-dark-800/50 border border-gray-700/30 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="text-green-400" size={18} />
          <span className="text-gray-400 text-sm">
            Nenhum envelope estourado em {mesFormatado}.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowModalFechamento(true)}
          className="text-gray-400 hover:text-gray-200 flex-shrink-0"
        >
          <Lock size={14} className="mr-1.5" />
          Fechar mês
        </Button>

        {showModalFechamento && (
          <ModalFechamento
            mesFormatado={mesFormatado}
            foiInflado={foiInflado}
            totalOrcadoOriginal={totalOrcadoOriginal}
            totalOrcadoAtual={totalOrcadoAtual}
            inflacao={inflacao}
            isFechando={isFechando}
            onConfirmar={handleConfirmarFechamento}
            onCancelar={() => setShowModalFechamento(false)}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="text-amber-400 mt-0.5 flex-shrink-0" size={22} />
          <div className="flex-1">
            <h3 className="text-amber-400 font-semibold text-base mb-1">
              {mesFormatado} - Envelopes com estouro
            </h3>
            <p className="text-gray-400 text-sm">
              {categoriasEstouradas.length} envelope(s) estouraram neste mês que já passou.
              Rebalanceie automaticamente para ajustar os orçamentos ao gasto real.
            </p>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-red-500/10 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Total Estourado</p>
            <p className="text-lg font-bold text-red-400">{formatCurrency(totalEstouro)}</p>
            <p className="text-xs text-gray-500">{categoriasEstouradas.length} envelope(s)</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Sobra Disponível</p>
            <p className="text-lg font-bold text-green-400">{formatCurrency(totalSobra)}</p>
            <p className="text-xs text-gray-500">{categoriasComSobra.length} envelope(s)</p>
          </div>
          <div className={`${sobraCobreEstouro ? 'bg-green-500/10' : 'bg-red-500/10'} rounded-lg p-3 text-center`}>
            <p className="text-xs text-gray-400 mb-1">
              {sobraCobreEstouro ? 'Saldo após ajuste' : 'Ainda faltará'}
            </p>
            <p className={`text-lg font-bold ${sobraCobreEstouro ? 'text-green-400' : 'text-red-400'}`}>
              {sobraCobreEstouro
                ? formatCurrency(totalSobra - totalEstouro)
                : formatCurrency(valorFaltante)
              }
            </p>
            <p className="text-xs text-gray-500">
              {sobraCobreEstouro ? 'Cobre tudo' : 'Edite o orçamento'}
            </p>
          </div>
        </div>

        {/* Lista de estouros com transferências */}
        <div className="space-y-2 mb-4">
          {categoriasEstouradas.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 bg-dark-800/50 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-300 flex-1 truncate">{cat.categoria?.nome}</span>
              <span className="text-gray-500">
                {formatCurrency(cat.valor_orcado)} <ArrowRight size={12} className="inline mx-1" /> {formatCurrency(cat.valor_gasto || 0)}
              </span>
              <span className="text-red-400 font-medium whitespace-nowrap">
                +{formatCurrency(Math.abs(cat.valor_disponivel || 0))}
              </span>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAutoRebalancear}
              isLoading={isLoading}
              className="flex-shrink-0"
            >
              <RefreshCw size={16} className="mr-2" />
              Auto-Rebalancear
            </Button>

            {!sobraCobreEstouro && (
              <p className="text-xs text-amber-400">
                A sobra dos outros envelopes não cobre todo o estouro.
                Após o rebalanceamento, edite o orçamento deste mês para ajustar os valores.
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowModalFechamento(true)}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-200 flex-shrink-0"
          >
            <Lock size={14} className="mr-1.5" />
            Fechar mês
          </Button>
        </div>
      </div>

      {showModalFechamento && (
        <ModalFechamento
          mesFormatado={mesFormatado}
          foiInflado={foiInflado}
          totalOrcadoOriginal={totalOrcadoOriginal}
          totalOrcadoAtual={totalOrcadoAtual}
          inflacao={inflacao}
          isFechando={isFechando}
          onConfirmar={handleConfirmarFechamento}
          onCancelar={() => setShowModalFechamento(false)}
        />
      )}
    </>
  )
}

// -----------------------------------------------------------------------
// Modal de confirmação de fechamento
// -----------------------------------------------------------------------

interface ModalFechamentoProps {
  mesFormatado: string
  foiInflado: boolean
  totalOrcadoOriginal: number
  totalOrcadoAtual: number
  inflacao: number
  isFechando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

function ModalFechamento({
  mesFormatado,
  foiInflado,
  totalOrcadoOriginal,
  totalOrcadoAtual,
  inflacao,
  isFechando,
  onConfirmar,
  onCancelar,
}: ModalFechamentoProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancelar} />
      <div className="relative bg-dark-800 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <button
          onClick={onCancelar}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-500/10 rounded-lg p-2.5">
            <Lock className="text-blue-400" size={20} />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">Fechar orçamento</h3>
            <p className="text-gray-400 text-sm">{mesFormatado}</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          {foiInflado && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
              <p className="text-amber-400 font-medium mb-1">Orçamento foi editado este mês</p>
              <p className="text-gray-400">
                O total planejado foi aumentado de{' '}
                <span className="text-white font-medium">{formatCurrency(totalOrcadoOriginal)}</span>{' '}
                para{' '}
                <span className="text-white font-medium">{formatCurrency(totalOrcadoAtual)}</span>{' '}
                (+{formatCurrency(inflacao)}).
              </p>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
            <p className="text-blue-300 font-medium mb-1">Score Pocks calculado corretamente</p>
            <p className="text-gray-400">
              O score de aderência ao orçamento usa os{' '}
              <span className="text-white font-medium">valores planejados originalmente</span>,
              não os valores editados. Edições que aumentam o total não melhoram a pontuação.
            </p>
          </div>

          <p className="text-gray-400 text-sm">
            Após fechar, este orçamento ficará bloqueado para novas edições e
            a pontuação do mês estará definitivamente calculada.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={onCancelar}
            disabled={isFechando}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirmar}
            isLoading={isFechando}
            className="flex-1"
          >
            <Lock size={15} className="mr-1.5" />
            Confirmar fechamento
          </Button>
        </div>
      </div>
    </div>
  )
}
