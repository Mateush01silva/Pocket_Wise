import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from './ui/Button'
import { cn } from '../lib/cn'
import type { UsePossoComprarIAReturn, PersonalityTone } from '../hooks/usePossoComprarIA'

// ============================================================================
// PERSONALITY OPTIONS
// ============================================================================

const TONES: Array<{
  id: PersonalityTone
  label: string
  emoji: string
  description: string
}> = [
  { id: 'conservador', emoji: '🧓', label: 'Conservador', description: 'Cauteloso, foca nos riscos' },
  { id: 'parceiro',    emoji: '🤙', label: 'Parceiro',    description: 'Honesto e direto, sem drama' },
  { id: 'provocador',  emoji: '😈', label: 'Provocador',  description: 'Irônico, te desafia a poupar' },
  { id: 'hype',        emoji: '🎉', label: 'Hype',        description: 'Torce por você, mas é honesto' },
]

// ============================================================================
// PROPS — recebe estado do hook via PossoComprarFloating (evita duplicação)
// ============================================================================

type Props = Pick<
  UsePossoComprarIAReturn,
  | 'isLoading'
  | 'resposta'
  | 'usosUsados'
  | 'usosRestantes'
  | 'limite'
  | 'tone'
  | 'error'
  | 'limiteAtingido'
  | 'perguntar'
  | 'resetResposta'
  | 'setTone'
>

// ============================================================================
// COMPONENT
// ============================================================================

export function PossoComprarIAModal({
  isLoading,
  resposta,
  usosUsados,
  usosRestantes,
  limite,
  tone,
  error,
  limiteAtingido,
  perguntar,
  resetResposta,
  setTone,
}: Props) {
  const [pergunta, setPergunta] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus no textarea ao montar
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handlePerguntar = async () => {
    if (!pergunta.trim() || isLoading || limiteAtingido) return
    await perguntar(pergunta.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePerguntar()
    }
  }

  const handleNovaPergunta = () => {
    resetResposta()
    setPergunta('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const currentTone = TONES.find((t) => t.id === tone)

  // -------------------------------------------------------------------------
  // Limite atingido
  // -------------------------------------------------------------------------
  if (limiteAtingido && !resposta) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-300 mb-1">Limite mensal atingido</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Você utilizou todas as {limite} consultas deste mês.
                O limite renova automaticamente em 1° do próximo mês. 🎯
              </p>
            </div>
          </div>
        </div>
        <UsageBar used={usosUsados} limit={limite} />
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Com resposta
  // -------------------------------------------------------------------------
  if (resposta) {
    return (
      <div className="space-y-4">
        {/* Pergunta feita */}
        <div className="flex justify-end">
          <div className="max-w-[85%] bg-secondary-500/20 border border-secondary-500/30 rounded-xl rounded-tr-sm px-4 py-3">
            <p className="text-sm text-gray-200">{pergunta}</p>
          </div>
        </div>

        {/* Resposta da IA */}
        <div className="flex justify-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary-500 to-primary-500 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="max-w-[85%] bg-dark-800 border border-dark-600 rounded-xl rounded-tl-sm px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-secondary-400">
                PocketWise IA {currentTone?.emoji}
              </span>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{resposta}</p>
          </div>
        </div>

        {/* Contador + Nova pergunta */}
        <div className="flex items-center justify-between pt-1">
          <UsageBar used={usosUsados} limit={limite} compact />
          <Button
            onClick={handleNovaPergunta}
            variant="secondary"
            size="sm"
            className="gap-1.5 text-xs"
          >
            <RotateCcw size={13} />
            Nova pergunta
          </Button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Estado inicial (formulário)
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Seletor de Tom */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
          Personalidade da IA
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all duration-150',
                tone === t.id
                  ? 'bg-secondary-500/20 border-secondary-500/50 text-gray-100'
                  : 'bg-dark-800 border-dark-600 text-gray-400 hover:border-dark-500 hover:text-gray-300'
              )}
            >
              <span className="text-base leading-none">{t.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium leading-tight">{t.label}</p>
                <p className="text-[10px] text-gray-500 leading-tight truncate">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Input da pergunta */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
          O que você quer saber?
        </p>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ex: "posso comprar um tênis de R$ 300?" ou "tenho margem pra jantar fora essa semana?"`}
            rows={3}
            disabled={isLoading}
            className={cn(
              'w-full resize-none rounded-xl border bg-dark-800 px-4 py-3 pr-12',
              'text-sm text-gray-100 placeholder-gray-600',
              'border-dark-600 focus:border-secondary-500 focus:outline-none focus:ring-1 focus:ring-secondary-500/30',
              'transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <button
            onClick={handlePerguntar}
            disabled={!pergunta.trim() || isLoading}
            className={cn(
              'absolute bottom-3 right-3 p-1.5 rounded-lg transition-all duration-150',
              pergunta.trim() && !isLoading
                ? 'bg-secondary-500 text-white hover:bg-secondary-400'
                : 'bg-dark-700 text-gray-600 cursor-not-allowed'
            )}
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-3 p-3 bg-dark-800/50 border border-dark-700 rounded-xl">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-secondary-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-secondary-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-secondary-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-xs text-gray-400">Analisando seu orçamento...</p>
        </div>
      )}

      {/* Contador de usos */}
      <UsageBar used={usosUsados} limit={limite} />
    </div>
  )
}

// ============================================================================
// USAGE BAR — subcomponente interno
// ============================================================================

function UsageBar({ used, limit, compact = false }: { used: number; limit: number; compact?: boolean }) {
  const remaining = limit - used
  const pct = Math.min((used / limit) * 100, 100)
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-secondary-500'

  if (compact) {
    return (
      <span className="text-[10px] text-gray-500">
        {remaining > 0 ? `${remaining} consultas restantes` : 'Limite atingido'}
      </span>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">Consultas este mês</span>
        <span className="text-[10px] text-gray-400 font-medium">{used}/{limit}</span>
      </div>
      <div className="h-1 w-full bg-dark-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {remaining <= 5 && remaining > 0 && (
        <p className="text-[10px] text-yellow-400">
          Restam apenas {remaining} consulta{remaining !== 1 ? 's' : ''} este mês.
        </p>
      )}
    </div>
  )
}
