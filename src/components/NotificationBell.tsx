import { useState, useEffect, useRef } from 'react'
import { Bell, AlertCircle, Clock, Package, TrendingDown, Check, X, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificacoesStore, type Notificacao } from '../store/useNotificacoesStore'
import { useTransacoesStore } from '../store/useTransacoesStore'
import { useOrcamentosStore } from '../store/useOrcamentosStore'
import { cn } from '../lib/cn'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const notificacoes = useNotificacoesStore((state) => state.getNotificacoes())
  const contadorUrgentes = useNotificacoesStore((state) => state.getContadorUrgentes())
  const contadorTotal = useNotificacoesStore((state) => state.getContadorTotal())
  const atualizarNotificacoes = useNotificacoesStore((state) => state.atualizarNotificacoes)
  const limparNotificacao = useNotificacoesStore((state) => state.limparNotificacao)

  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const orcamentoAtual = useOrcamentosStore((state) => state.orcamentoAtual)
  const getEnvelopesDigitais = useOrcamentosStore((state) => state.getEnvelopesDigitais)

  // Atualizar notificações quando dados mudarem
  useEffect(() => {
    const envelopes = orcamentoAtual ? getEnvelopesDigitais(orcamentoAtual.id) : []
    atualizarNotificacoes(lancamentos, envelopes)
  }, [lancamentos, orcamentoAtual, getEnvelopesDigitais, atualizarNotificacoes])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getIcon = (icone: Notificacao['icone']) => {
    switch (icone) {
      case 'alert':
        return AlertCircle
      case 'clock':
        return Clock
      case 'envelope':
        return Package
      case 'trending-down':
        return TrendingDown
      case 'check':
        return Check
      default:
        return Bell
    }
  }

  const handleNotificacaoClick = (notificacao: Notificacao) => {
    if (notificacao.acao) {
      navigate(notificacao.acao.rota)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-lg transition-all duration-200',
          isOpen
            ? 'bg-primary-500/20 text-primary-400'
            : 'bg-dark-800 text-gray-400 hover:bg-dark-700 hover:text-gray-200'
        )}
      >
        <Bell className="w-5 h-5" />

        {/* Badge */}
        {contadorTotal > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center',
              'text-xs font-bold rounded-full px-1',
              contadorUrgentes > 0
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-amber-500 text-dark-900'
            )}
          >
            {contadorTotal > 9 ? '9+' : contadorTotal}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 z-50',
            'bg-dark-900 border border-dark-700 rounded-xl shadow-xl',
            'animate-in fade-in slide-in-from-top-2 duration-200'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-dark-700">
            <div>
              <h3 className="text-sm font-semibold text-gray-100">Notificações</h3>
              <p className="text-xs text-gray-500">
                {contadorTotal === 0
                  ? 'Nenhuma notificação'
                  : `${contadorTotal} notificação(ões)`}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-dark-800 text-gray-400 hover:text-gray-200"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {notificacoes.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm text-green-400 font-medium">Tudo em dia!</p>
                <p className="text-xs text-gray-500 mt-1">
                  Nenhum alerta ou lembrete
                </p>
              </div>
            ) : (
              <div className="divide-y divide-dark-700">
                {notificacoes.map((notificacao) => {
                  const Icon = getIcon(notificacao.icone)
                  return (
                    <div
                      key={notificacao.id}
                      className={cn(
                        'p-3 hover:bg-dark-800/50 transition-colors cursor-pointer',
                        notificacao.tipo === 'urgente' && 'bg-red-500/5'
                      )}
                      onClick={() => handleNotificacaoClick(notificacao)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                            notificacao.tipo === 'urgente' && 'bg-red-500/20',
                            notificacao.tipo === 'atencao' && 'bg-amber-500/20',
                            notificacao.tipo === 'info' && 'bg-blue-500/20'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-4 h-4',
                              notificacao.tipo === 'urgente' && 'text-red-400',
                              notificacao.tipo === 'atencao' && 'text-amber-400',
                              notificacao.tipo === 'info' && 'text-blue-400'
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm font-medium',
                              notificacao.tipo === 'urgente' && 'text-red-400',
                              notificacao.tipo === 'atencao' && 'text-amber-400',
                              notificacao.tipo === 'info' && 'text-blue-400'
                            )}
                          >
                            {notificacao.titulo}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {notificacao.descricao}
                          </p>
                          {notificacao.acao && (
                            <p className="text-xs text-primary-400 mt-1 flex items-center gap-1">
                              {notificacao.acao.label}
                              <ChevronRight size={12} />
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            limparNotificacao(notificacao.id)
                          }}
                          className="p-1 rounded hover:bg-dark-700 text-gray-500 hover:text-gray-300 shrink-0"
                          title="Dispensar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notificacoes.length > 0 && (
            <div className="p-3 border-t border-dark-700">
              <button
                onClick={() => {
                  navigate('/app/transacoes?status=pendente')
                  setIsOpen(false)
                }}
                className="w-full text-xs text-center text-primary-400 hover:text-primary-300 py-1"
              >
                Ver todas as pendências
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
