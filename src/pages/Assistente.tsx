import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Send,
  Loader2,
  AlertCircle,
  Sparkles,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useAssistenteIA, ALERT_TRIGGER_KEYS } from '../hooks/useAssistenteIA'
import { useAICredits } from '../hooks/useAICredits'
import type { PersonalityTone } from '../hooks/usePossoComprarIA'

// ============================================================================
// PERSONALITY OPTIONS (reuse do PossoComprarIAModal)
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
// ASSISTENTE PAGE
// ============================================================================

export function Assistente() {
  const {
    hasAccess,
    isCheckingAccess,
    mensagens,
    isFetchingHistory,
    isLoading,
    error,
    tone,
    loadHistorico,
    enviar,
    setTone,
  } = useAssistenteIA()

  const { creditosRestantes, limiteManual, isLoading: isLoadingCredits, refresh: refreshCredits } = useAICredits()

  const [input, setInput] = useState('')
  const [showToneSelector, setShowToneSelector] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasLoadedHistory = useRef(false)

  // Carrega histórico uma vez ao montar (apenas se tiver acesso)
  useEffect(() => {
    if (hasAccess && !hasLoadedHistory.current) {
      hasLoadedHistory.current = true
      loadHistorico()
    }
  }, [hasAccess, loadHistorico])

  // Auto-scroll ao chegar nova mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, isLoading])

  const handleEnviar = async () => {
    if (!input.trim() || isLoading) return
    const texto = input
    setInput('')
    await enviar(texto)
    refreshCredits()   // atualiza contador sem bloquear
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  const currentTone = TONES.find((t) => t.id === tone)

  // --------------------------------------------------------------------------
  // Loading de verificação de acesso
  // --------------------------------------------------------------------------
  if (isCheckingAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-secondary-400 animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Verificando acesso...</p>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Sem acesso
  // --------------------------------------------------------------------------
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-secondary-500/10 flex items-center justify-center mx-auto">
            <Bot className="w-8 h-8 text-secondary-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-200">Assistente em breve</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            O Assistente Financeiro está disponível em acesso antecipado.
            Entre em contato para solicitar acesso.
          </p>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Chat principal
  // --------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">

      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary-500 to-primary-500 flex items-center justify-center shadow-lg shadow-secondary-500/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100">Assistente Financeiro</h1>
            <p className="text-xs text-gray-500">Pergunte qualquer coisa sobre suas finanças</p>
          </div>
        </div>

        {/* Indicador discreto de créditos */}
        {!isLoadingCredits && (
          <span className={cn(
            'hidden sm:inline-flex items-center text-xs font-medium px-2 py-1 rounded-lg',
            creditosRestantes <= 5
              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
              : 'text-gray-500 bg-dark-800/50'
          )}>
            {creditosRestantes}/{limiteManual} créditos
          </span>
        )}

        {/* Botão de configuração do tom */}
        <button
          onClick={() => setShowToneSelector((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-150',
            showToneSelector
              ? 'bg-secondary-500/20 border-secondary-500/40 text-secondary-300'
              : 'bg-dark-800 border-dark-600 text-gray-400 hover:border-dark-500 hover:text-gray-300'
          )}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>{currentTone?.emoji} {currentTone?.label}</span>
          {showToneSelector ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SELETOR DE TOM (colapsável)                                         */}
      {/* ------------------------------------------------------------------ */}
      {showToneSelector && (
        <div className="mb-4 p-3 bg-dark-800/50 border border-dark-700 rounded-xl shrink-0">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">
            Personalidade do Assistente
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTone(t.id); setShowToneSelector(false) }}
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
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ÁREA DE MENSAGENS                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto rounded-xl bg-dark-800/30 border border-dark-700/50 p-4 space-y-4 mb-4">

        {/* Loading do histórico */}
        {isFetchingHistory && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-secondary-400 animate-spin" />
          </div>
        )}

        {/* Mensagem de boas-vindas (apenas quando histórico vazio) */}
        {!isFetchingHistory && mensagens.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary-500/20 to-primary-500/20 border border-secondary-500/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-secondary-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-gray-200">Olá! Sou o seu Assistente Financeiro 👋</h3>
              <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                Posso responder perguntas sobre seus envelopes, fluxo de caixa, metas e muito mais.
                Pergunte em linguagem natural!
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md mt-2">
              {[
                'Por que meu dinheiro sempre acaba antes do fim do mês?',
                'Consigo juntar R$5.000 em 6 meses?',
                'Como está meu fluxo de caixa esse mês?',
                'Quais envelopes estão no vermelho?',
              ].map((sugestao) => (
                <button
                  key={sugestao}
                  onClick={() => setInput(sugestao)}
                  className="text-left text-xs text-gray-400 bg-dark-800 hover:bg-dark-700 border border-dark-600 hover:border-dark-500 rounded-lg px-3 py-2 transition-all duration-150 leading-relaxed"
                >
                  "{sugestao}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensagens do chat */}
        {mensagens.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} currentTone={currentTone} />
        ))}

        {/* Loading de resposta da IA */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary-500 to-primary-500 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-dark-800 border border-dark-600 rounded-xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-secondary-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-secondary-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-secondary-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Sentinel para auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* INPUT                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="shrink-0">
        <div className="relative flex items-end gap-3 bg-dark-800/50 border border-dark-700/50 rounded-xl p-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre suas finanças... (Enter para enviar)"
            rows={1}
            disabled={isLoading}
            className={cn(
              'flex-1 resize-none bg-transparent text-sm text-gray-100 placeholder-gray-600',
              'focus:outline-none leading-relaxed max-h-32 overflow-y-auto',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={handleEnviar}
            disabled={!input.trim() || isLoading}
            className={cn(
              'shrink-0 p-2 rounded-lg transition-all duration-150',
              input.trim() && !isLoading
                ? 'bg-secondary-500 text-white hover:bg-secondary-400 shadow-lg shadow-secondary-500/30'
                : 'bg-dark-700 text-gray-600 cursor-not-allowed'
            )}
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 text-center">
          Enter para enviar · Shift+Enter para nova linha · Histórico compartilhado com a família
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// CHAT BUBBLE
// ============================================================================

function ChatBubble({
  msg,
  currentTone,
}: {
  msg: import('../hooks/useAssistenteIA').AssistenteMensagem
  currentTone: typeof TONES[number] | undefined
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-secondary-500/20 border border-secondary-500/30 rounded-xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
        </div>
      </div>
    )
  }

  const isProactive = msg.message_type === 'proactive'
  const isAlert     = isProactive && ALERT_TRIGGER_KEYS.has(msg.trigger_key ?? '')
  const msgTone     = TONES.find((t) => t.id === msg.tone) ?? currentTone

  return (
    <div className="flex items-start gap-3">
      {/* Ícone: âmbar para proativas, gradiente para manuais */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isProactive
          ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm shadow-amber-500/30'
          : 'bg-gradient-to-br from-secondary-500 to-primary-500'
      )}>
        <Bot className="w-4 h-4 text-white" />
      </div>

      {/* Bolha */}
      <div className={cn(
        'max-w-[80%] rounded-xl rounded-tl-sm px-4 py-3',
        isProactive
          ? 'bg-amber-500/5 border border-amber-500/20'
          : 'bg-dark-800 border border-dark-600'
      )}>
        <div className="flex items-center gap-2 mb-2">
          {isProactive ? (
            // Chip de tipo: "Alerta" (vermelho) ou "Análise" (âmbar)
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
              isAlert
                ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
            )}>
              {isAlert ? 'Alerta' : 'Análise'}
            </span>
          ) : (
            <span className="text-xs font-medium text-secondary-400">
              PocketWise IA {msgTone?.emoji}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
      </div>
    </div>
  )
}
