import { useState, useRef, useEffect } from 'react'
import {
  User,
  Bell,
  BellOff,
  Smartphone,
  Palette,
  Database,
  Info,
  Camera,
  Save,
  Download,
  Trash2,
  Mail,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  BookOpen,
  Sparkles,
  Wallet,
  ArrowUpRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePlan } from '../hooks/usePlan'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { useUserPreferencesStore } from '../store/useUserPreferencesStore'
import { useTransacoesStore } from '../store/useTransacoesStore'
import { useCategoriasStore } from '../store/useCategoriasStore'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import { useCartoesStore } from '../store/useCartoesStore'
import { useAuth } from '../contexts/AuthContext'
import { cancelSubscription } from '../services/paymentService'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import { toast } from 'sonner'
import { usePossoComprarIA, type PersonalityTone } from '../hooks/usePossoComprarIA'
import { useAICredits, AI_TOTAL_LIMIT } from '../hooks/useAICredits'
import { usePushNotifications } from '../hooks/usePushNotifications'

export function Settings() {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Auth context - dados reais do banco
  const { user, userProfile, refreshProfile, subscription, refreshSubscription } = useAuth()
  const { tier, trialDaysLeft, isTrialExpired } = usePlan()

  // User preferences (local store)
  const moeda = useUserPreferencesStore((state) => state.moeda)
  const diaInicioCiclo = useUserPreferencesStore((state) => state.diaInicioCiclo)
  const notificacoesAtivas = useUserPreferencesStore((state) => state.notificacoesAtivas)
  const lembreteDespesasVencendo = useUserPreferencesStore((state) => state.lembreteDespesasVencendo)
  const lembreteMetasOrcamento = useUserPreferencesStore((state) => state.lembreteMetasOrcamento)
  const ultimoBackup = useUserPreferencesStore((state) => state.ultimoBackup)
  const atualizarPerfil = useUserPreferencesStore((state) => state.atualizarPerfil)
  const atualizarPreferencias = useUserPreferencesStore((state) => state.atualizarPreferencias)
  const registrarBackup = useUserPreferencesStore((state) => state.registrarBackup)

  // Local state for form - inicializar com dados do banco
  const [formNome, setFormNome] = useState('')
  const [formEmail, setFormEmail] = useState('')

  // Carregar dados do perfil do banco
  useEffect(() => {
    const nome = userProfile?.full_name || user?.user_metadata?.full_name || ''
    const email = userProfile?.email || user?.email || ''

    if (nome) setFormNome(nome)
    if (email) setFormEmail(email)
  }, [userProfile, user])

  // Hook de IA (verifica acesso e gerencia tom de personalidade)
  const { hasAccess: hasIAAccess, isCheckingAccess: isCheckingIA, tone: iaTone, setTone: setIATone } = usePossoComprarIA()

  // Hook de créditos de IA (uso do mês + configuração)
  const {
    creditosProativas,
    limiteManual,
    usadoPossoComprar,
    usadoAssistente,
    usadoVerificarFatura,
    usadoProativas,
    usadoManual,
    creditosRestantes,
    dataRenovacao,
    isLoading: isLoadingCredits,
    isSaving: isSavingCredits,
    saveCreditsConfig,
  } = useAICredits()

  // Push notifications
  const {
    isSupported: isPushSupported,
    isSubscribed,
    isLoading: isPushLoading,
    permission: pushPermission,
    preferences: pushPrefs,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    updatePreference: updatePushPref,
  } = usePushNotifications()

  // Estado local do slider de proativas (sincroniza com o valor carregado)
  const [sliderProativas, setSliderProativas] = useState(10)
  useEffect(() => {
    setSliderProativas(creditosProativas)
  }, [creditosProativas])

  // Stores for export
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)
  const contas = useContasBancariasStore((state) => state.contas)
  const cartoes = useCartoesStore((state) => state.cartoes)

  const handleSavePerfil = async () => {
    setIsSaving(true)
    try {
      // Salvar no store local
      atualizarPerfil({ nome: formNome, email: formEmail || null })

      // Salvar no Supabase
      if (supabase && user) {
        const { error } = await (supabase as any)
          .from('users')
          .update({ full_name: formNome, nome: formNome })
          .eq('id', user.id)
        if (error) throw error
      }
      toast.success('Perfil salvo com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar perfil:', error)
      toast.error('Erro ao salvar perfil')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = reader.result as string

      // Salvar no Supabase e atualizar perfil no contexto
      if (supabase && user) {
        await (supabase as any)
          .from('users')
          .update({ avatar_url: base64 })
          .eq('id', user.id)
        await refreshProfile()
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = async () => {
    if (supabase && user) {
      await (supabase as any)
        .from('users')
        .update({ avatar_url: null })
        .eq('id', user.id)
      await refreshProfile()
    }
  }

  const handleCancelSubscription = async () => {
    setIsCanceling(true)
    try {
      await cancelSubscription()
      await refreshSubscription()
      setShowCancelConfirm(false)
      toast.success('Assinatura cancelada. Seu acesso continua até o fim do período pago.')
    } catch (error) {
      console.error('Erro ao cancelar:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao cancelar assinatura. Tente novamente.'
      )
    } finally {
      setIsCanceling(false)
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const categoriasMap = new Map(categorias.map((c) => [c.id, c.nome]))
      const cartoesMap = new Map(cartoes.map((c) => [c.id, c.nome]))
      const contasMap = new Map(contas.map((c) => [c.id, c.nome]))

      const formatarFormaPagamento = (forma: string) => {
        const labels: Record<string, string> = {
          dinheiro: 'Dinheiro',
          debito: 'Débito',
          credito: 'Crédito',
          pix: 'Pix',
          transferencia: 'Transferência',
          boleto: 'Boleto',
        }
        return labels[forma] ?? forma
      }

      const formatarStatus = (status: string) => {
        const labels: Record<string, string> = {
          pago: 'Pago',
          pendente: 'Pendente',
          projetado: 'Projetado',
        }
        return labels[status] ?? status
      }

      const linhas = lancamentos.map((l) => ({
        'Data': format(new Date(l.data + 'T00:00:00'), 'dd/MM/yyyy'),
        'Tipo': l.tipo === 'receita' ? 'Receita' : 'Despesa',
        'Valor (R$)': l.valor,
        'Categoria': l.categoria_id ? (categoriasMap.get(l.categoria_id) ?? '—') : '—',
        'Subcategoria': l.subcategoria_id ? (categoriasMap.get(l.subcategoria_id) ?? '—') : '—',
        'Forma de Pagamento': formatarFormaPagamento(l.forma_pagamento),
        'Cartão': l.cartao_id ? (cartoesMap.get(l.cartao_id) ?? '—') : '—',
        'Conta': l.conta_id ? (contasMap.get(l.conta_id) ?? '—') : '—',
        'Status': formatarStatus(l.status),
        'Parcela': l.parcela_atual && l.parcela_total ? `${l.parcela_atual}/${l.parcela_total}` : '—',
        'Observação': l.observacao ?? '—',
        'Responsável': l.criado_por === user?.id ? (userProfile?.full_name ?? l.criado_por ?? '—') : (l.criado_por ?? '—'),
      }))

      const ws = XLSX.utils.json_to_sheet(linhas)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transações')
      XLSX.writeFile(wb, `pocketwise-transacoes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)

      registrarBackup()
      toast.success('Transações exportadas com sucesso!')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Configurações</h1>
        <p className="text-gray-400">Gerencie suas preferências e conta</p>
      </div>

      {/* Perfil do Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User size={20} className="text-primary-400" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center overflow-hidden">
                {userProfile?.avatar_url ? (
                  <img
                    src={userProfile?.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {(formNome || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 bg-primary-500 rounded-full hover:bg-primary-400 transition-colors"
              >
                <Camera size={14} className="text-white" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2">Foto de perfil</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Camera size={14} className="mr-2" />
                  Alterar foto
                </Button>
                {userProfile?.avatar_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} className="mr-2" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Nome e Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome
              </label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Mail size={14} className="inline mr-1" />
                Email
              </label>
              <Input
                type="email"
                value={formEmail}
                disabled
                className="opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Email da conta (não editável)</p>
            </div>
          </div>

          <Button onClick={handleSavePerfil} isLoading={isSaving}>
            <Save size={16} className="mr-2" />
            Salvar Perfil
          </Button>
        </CardContent>
      </Card>

      {/* Plano e Assinatura */}
      {subscription && userProfile?.role !== 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet size={20} className="text-emerald-400" />
              Plano e Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status da assinatura */}
            <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
              <div className="flex items-center gap-3">
                {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                  <CheckCircle size={20} className="text-green-400" />
                )}
                {subscription.status === 'active' && subscription.cancel_at_period_end && (
                  <Clock size={20} className="text-yellow-400" />
                )}
                {subscription.status === 'trial' && (
                  <Clock size={20} className="text-blue-400" />
                )}
                {(subscription.status === 'expired' || subscription.status === 'canceled') && (
                  <XCircle size={20} className="text-red-400" />
                )}
                <div>
                  <p className="font-medium text-gray-200">
                    {subscription.status === 'trial' && `Explorador${isTrialExpired ? ' (expirado)' : ' (Trial)'}`}
                    {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                      tier === 'mestre' ? 'Mestre' : `Planejador ${subscription.plan === 'annual' ? 'Anual' : 'Mensal'}`
                    )}
                    {subscription.status === 'active' && subscription.cancel_at_period_end && (
                      `${tier === 'mestre' ? 'Mestre' : 'Planejador'} (cancelado)`
                    )}
                    {subscription.status === 'expired' && 'Explorador (expirado)'}
                    {subscription.status === 'canceled' && 'Plano cancelado'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {subscription.status === 'trial' && !isTrialExpired && (
                      `${trialDaysLeft} ${trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'} de Explorador`
                    )}
                    {subscription.status === 'trial' && subscription.trial_ends_at && (
                      ` — termina em ${format(new Date(subscription.trial_ends_at), "dd 'de' MMMM", { locale: ptBR })}`
                    )}
                    {subscription.status === 'active' && subscription.cancel_at_period_end && subscription.current_period_end && (
                      `Acesso até ${format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                    )}
                    {subscription.status === 'active' && !subscription.cancel_at_period_end && subscription.current_period_end && (
                      `Próxima cobrança: ${format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                    )}
                    {subscription.status === 'active' && !subscription.cancel_at_period_end && subscription.plan && (
                      tier === 'mestre'
                        ? ` — ${subscription.plan === 'annual' ? 'R$ 175,90/ano' : 'R$ 18,90/mês'}`
                        : ` — ${subscription.plan === 'annual' ? 'R$ 119,90/ano' : 'R$ 12,90/mês'}`
                    )}
                  </p>
                </div>
              </div>
              <div>
                {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded-full">
                    Ativa
                  </span>
                )}
                {subscription.status === 'active' && subscription.cancel_at_period_end && (
                  <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 text-xs font-medium rounded-full">
                    Cancela no fim do ciclo
                  </span>
                )}
                {subscription.status === 'trial' && !isTrialExpired && (
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full">
                    Explorador
                  </span>
                )}
              </div>
            </div>

            {/* Botão gerenciar assinatura */}
            <Link
              to="/app/assinatura"
              className="flex items-center justify-between w-full p-3 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium text-primary-400">Gerenciar assinatura</span>
              <ArrowUpRight size={16} className="text-primary-400" />
            </Link>

            {/* Aviso de cancelamento pendente */}
            {subscription.status === 'active' && subscription.cancel_at_period_end && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-yellow-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-yellow-200 font-medium">Cancelamento agendado</p>
                    <p className="text-xs text-yellow-300/70 mt-1">
                      Sua assinatura foi cancelada, mas você mantém acesso a todas as funcionalidades
                      até o fim do período já pago. Após essa data, será necessário assinar novamente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Botão de cancelar */}
            {subscription.status === 'active' && !subscription.cancel_at_period_end && (
              <>
                {!showCancelConfirm ? (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-sm text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Cancelar assinatura
                  </button>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-red-200 font-medium">Tem certeza que deseja cancelar?</p>
                        <p className="text-xs text-red-300/70 mt-1">
                          Seu acesso continua até o fim do período atual
                          {subscription.current_period_end && (
                            <> ({format(new Date(subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })})</>
                          )}.
                          Após essa data, não será cobrado novamente.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowCancelConfirm(false)}
                        disabled={isCanceling}
                      >
                        Voltar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCancelSubscription}
                        disabled={isCanceling}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400"
                      >
                        {isCanceling ? (
                          <span className="flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Cancelando...
                          </span>
                        ) : (
                          'Confirmar cancelamento'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preferências do App */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette size={20} className="text-secondary-400" />
            Preferências
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Moeda */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <DollarSign size={14} className="inline mr-1" />
                Moeda
              </label>
              <Select
                value={moeda}
                onChange={(e) => atualizarPreferencias({ moeda: e.target.value as 'BRL' | 'USD' | 'EUR' })}
              >
                <option value="BRL">Real Brasileiro (R$)</option>
                <option value="USD">Dólar Americano ($)</option>
                <option value="EUR">Euro (€)</option>
              </Select>
            </div>

            {/* Dia início ciclo */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar size={14} className="inline mr-1" />
                Dia início do ciclo orçamentário
              </label>
              <Select
                value={diaInicioCiclo}
                onChange={(e) => atualizarPreferencias({ diaInicioCiclo: parseInt(e.target.value) })}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                  <option key={dia} value={dia}>
                    Dia {dia}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={20} className="text-amber-400" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle geral */}
          <div className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
            <div>
              <p className="font-medium text-gray-200">Notificações ativas</p>
              <p className="text-sm text-gray-500">Receber alertas e lembretes</p>
            </div>
            <button
              onClick={() => atualizarPreferencias({ notificacoesAtivas: !notificacoesAtivas })}
              className={cn(
                'w-12 h-6 rounded-full transition-all duration-200 relative',
                notificacoesAtivas ? 'bg-primary-500' : 'bg-dark-600'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
                  notificacoesAtivas ? 'left-7' : 'left-1'
                )}
              />
            </button>
          </div>

          {/* Opções específicas */}
          <div className={cn('space-y-3', !notificacoesAtivas && 'opacity-50 pointer-events-none')}>
            <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-300">Despesas vencendo</p>
                <p className="text-xs text-gray-500">Alertar sobre contas próximas do vencimento</p>
              </div>
              <button
                onClick={() => atualizarPreferencias({ lembreteDespesasVencendo: !lembreteDespesasVencendo })}
                className={cn(
                  'w-10 h-5 rounded-full transition-all duration-200 relative',
                  lembreteDespesasVencendo ? 'bg-primary-500' : 'bg-dark-600'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
                    lembreteDespesasVencendo ? 'left-5' : 'left-0.5'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-300">Metas de orçamento</p>
                <p className="text-xs text-gray-500">Alertar quando categorias ultrapassarem 80%</p>
              </div>
              <button
                onClick={() => atualizarPreferencias({ lembreteMetasOrcamento: !lembreteMetasOrcamento })}
                className={cn(
                  'w-10 h-5 rounded-full transition-all duration-200 relative',
                  lembreteMetasOrcamento ? 'bg-primary-500' : 'bg-dark-600'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
                    lembreteMetasOrcamento ? 'left-5' : 'left-0.5'
                  )}
                />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notificações Push (celular) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone size={20} className="text-indigo-400" />
            Notificações no Celular
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isPushSupported ? (
            <div className="flex items-start gap-3 p-3 bg-dark-800 rounded-lg">
              <BellOff size={18} className="text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-400">Não suportado neste dispositivo</p>
                <p className="text-xs text-gray-500 mt-1">
                  Notificações push requerem um browser moderno com suporte a Service Workers.
                  No iOS, instale o app via "Adicionar à Tela de Início" (iOS 16.4+).
                </p>
              </div>
            </div>
          ) : pushPermission === 'denied' ? (
            <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <BellOff size={18} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-300">Permissão bloqueada pelo browser</p>
                <p className="text-xs text-red-400/70 mt-1">
                  Para reativar, vá nas configurações do browser e permita notificações para este site.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Toggle principal — ativar/desativar notificações push */}
              <div className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-200">Receber no celular</p>
                  <p className="text-sm text-gray-500">
                    {isSubscribed
                      ? 'Notificações ativas — você receberá alertas mesmo com o app fechado'
                      : 'Ative para receber alertas no celular mesmo com o app fechado'}
                  </p>
                </div>
                <button
                  onClick={() => void (isSubscribed ? unsubscribePush() : subscribePush())}
                  disabled={isPushLoading}
                  className={cn(
                    'w-12 h-6 rounded-full transition-all duration-200 relative disabled:opacity-50',
                    isSubscribed ? 'bg-indigo-600' : 'bg-dark-600'
                  )}
                >
                  {isPushLoading ? (
                    <Loader2 size={12} className="absolute top-1.5 left-3 animate-spin text-white" />
                  ) : (
                    <div
                      className={cn(
                        'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
                        isSubscribed ? 'left-7' : 'left-1'
                      )}
                    />
                  )}
                </button>
              </div>

              {/* Preferências individuais — só visíveis se subscrito */}
              {isSubscribed && (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
                    O que você quer receber
                  </p>

                  {(
                    [
                      { key: 'envelope_burst',    label: 'Envelope estourado',        desc: 'Quando uma categoria ultrapassar 100% do orçamento' },
                      { key: 'expense_overdue',   label: 'Despesas vencidas',          desc: 'Contas pendentes com data no passado' },
                      { key: 'credit_card_limit', label: 'Cartão no limite',           desc: 'Fatura do cartão atingir 90% ou mais do limite' },
                      { key: 'trial_expiring',    label: 'Trial expirando',            desc: 'Avisos 3 dias e 1 dia antes do fim do período gratuito' },
                      { key: 'month_end_reminder',label: 'Planejar o próximo mês',     desc: '3 dias antes do fim do mês: hora de criar o orçamento' },
                      { key: 'savings_goals',            label: 'Metas de caixinha',          desc: 'Quando atingir 50%, 75% ou 100% de uma meta de reserva' },
                      { key: 'ai_proactive',             label: 'Mensagens do Assistente IA', desc: 'Notificação quando o PocketWise detectar algo importante' },
                      { key: 'credit_card_due_date',     label: 'Fatura vencendo em 3 dias',  desc: 'Alerta com o total da fatura 3 dias antes do vencimento' },
                      { key: 'unusual_spending',         label: 'Gasto fora do padrão',        desc: 'Transação maior que o dobro da média mensal da categoria' },
                      { key: 'no_transactions_reminder', label: '7 dias sem lançamentos',      desc: 'Lembrete quando não houver registros nos últimos 7 dias' },
                      { key: 'month_start_checkin',      label: 'Check-in do novo mês',        desc: 'Motivação para montar o orçamento no dia 1 (não-IA)' },
                      { key: 'perfect_month',            label: 'Mês perfeito',                desc: 'Celebração quando todos os envelopes fecharem no verde' },
                      { key: 'pocks_score_update',       label: 'Score Pocks do mês',          desc: 'Aviso quando a pontuação mensal estiver disponível para consulta' },
                      { key: 'pocks_streak_at_risk',     label: 'Streak em risco',             desc: 'Alerta no final do mês se você estiver prestes a perder sua sequência' },
                      { key: 'pocks_level_up',           label: 'Subiu de nível nos Pocks',    desc: 'Celebração quando sua pontuação cruzar uma nova faixa (ex.: Bom → Excelente)' },
                    ] as Array<{ key: keyof typeof pushPrefs; label: string; desc: string }>
                  ).map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-300">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                      <button
                        onClick={() => void updatePushPref(key, !pushPrefs[key])}
                        className={cn(
                          'w-10 h-5 rounded-full transition-all duration-200 relative shrink-0',
                          pushPrefs[key] ? 'bg-indigo-600' : 'bg-dark-600'
                        )}
                      >
                        <div
                          className={cn(
                            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
                            pushPrefs[key] ? 'left-5' : 'left-0.5'
                          )}
                        />
                      </button>
                    </div>
                  ))}

                  <p className="text-xs text-gray-600 px-1">
                    <Bell size={10} className="inline mr-1" />
                    Notificações funcionam mesmo com o app fechado, via PWA instalado.
                    No iOS é necessário ter o app adicionado à tela de início.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Assistente IA — exibido apenas para usuários com acesso */}
      {!isCheckingIA && hasIAAccess && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles size={20} className="text-secondary-400" />
              Assistente IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* ---------------------------------------------------------------- */}
            {/* PERSONALIDADE                                                    */}
            {/* ---------------------------------------------------------------- */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">Personalidade do Assistente</p>
                <p className="text-xs text-gray-500">
                  Aplicada ao "Posso Comprar? com IA" e ao chat do Assistente Financeiro.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { id: 'conservador', emoji: '🧓', label: 'Conservador', description: 'Cauteloso, foca nos riscos' },
                    { id: 'parceiro',    emoji: '🤙', label: 'Parceiro',    description: 'Honesto e direto, sem drama' },
                    { id: 'provocador',  emoji: '😈', label: 'Provocador',  description: 'Irônico, te desafia a poupar' },
                    { id: 'hype',        emoji: '🎉', label: 'Hype',        description: 'Torce por você, mas é honesto' },
                  ] as Array<{ id: PersonalityTone; emoji: string; label: string; description: string }>
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setIATone(t.id)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150',
                      iaTone === t.id
                        ? 'bg-secondary-500/20 border-secondary-500/50 text-gray-100'
                        : 'bg-dark-800 border-dark-600 text-gray-400 hover:border-dark-500 hover:text-gray-300'
                    )}
                  >
                    <span className="text-xl leading-none">{t.emoji}</span>
                    <div>
                      <p className="text-sm font-medium leading-tight">{t.label}</p>
                      <p className="text-xs text-gray-500 leading-tight">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-dark-700/50" />

            {/* ---------------------------------------------------------------- */}
            {/* USO DE CRÉDITOS DO MÊS                                           */}
            {/* ---------------------------------------------------------------- */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-300">Créditos de IA este mês</p>
                {!isLoadingCredits && (
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full',
                    creditosRestantes <= 5
                      ? 'text-amber-400 bg-amber-500/15'
                      : 'text-secondary-400 bg-secondary-500/15'
                  )}>
                    {creditosRestantes} restantes
                  </span>
                )}
              </div>

              {isLoadingCredits ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 size={14} className="animate-spin text-gray-500" />
                  <span className="text-xs text-gray-500">Carregando uso...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Barra de progresso total */}
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                      <span>Consultas manuais usadas</span>
                      <span>{usadoManual} / {limiteManual}</span>
                    </div>
                    <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          usadoManual >= limiteManual
                            ? 'bg-red-500'
                            : usadoManual >= limiteManual * 0.8
                              ? 'bg-amber-500'
                              : 'bg-gradient-to-r from-secondary-500 to-primary-500'
                        )}
                        style={{ width: `${Math.min((usadoManual / Math.max(limiteManual, 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Breakdown por tipo */}
                  <div className="space-y-2 pl-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-500 shrink-0" />
                        Posso Comprar? com IA
                      </span>
                      <span className="text-gray-400 font-medium">{usadoPossoComprar} uso{usadoPossoComprar !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                        Chat do Assistente
                      </span>
                      <span className="text-gray-400 font-medium">{usadoAssistente} uso{usadoAssistente !== 1 ? 's' : ''}</span>
                    </div>
                    {usadoVerificarFatura > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          Verificar Fatura
                        </span>
                        <span className="text-gray-400 font-medium">{usadoVerificarFatura} uso{usadoVerificarFatura !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {usadoProativas > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          Mensagens Proativas
                        </span>
                        <span className="text-gray-400 font-medium">{usadoProativas} uso{usadoProativas !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Data de renovação */}
                  <p className="text-[10px] text-gray-600">
                    Renova automaticamente em{' '}
                    <span className="text-gray-500 font-medium">
                      {format(dataRenovacao, "dd 'de' MMMM", { locale: ptBR })}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-dark-700/50" />

            {/* ---------------------------------------------------------------- */}
            {/* RESERVA PARA MENSAGENS PROATIVAS                                 */}
            {/* ---------------------------------------------------------------- */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">Reservar para mensagens proativas</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Defina quantos dos {AI_TOTAL_LIMIT} créditos mensais ficarão reservados para análises
                  automáticas do PocketWise (em breve). O restante fica disponível para consultas manuais.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Proativas</span>
                  <span className="font-bold text-secondary-400">{sliderProativas} crédito{sliderProativas !== 1 ? 's' : ''}</span>
                  <span>Manuais</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={sliderProativas}
                  onChange={(e) => setSliderProativas(Number(e.target.value))}
                  className="w-full h-2 appearance-none rounded-full bg-dark-700 accent-secondary-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>{sliderProativas} reservados para proativas</span>
                  <span>{AI_TOTAL_LIMIT - sliderProativas} para consultas manuais</span>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => saveCreditsConfig(sliderProativas)}
                isLoading={isSavingCredits}
                disabled={sliderProativas === creditosProativas || isSavingCredits}
              >
                Salvar configuração
              </Button>
            </div>

            <div className="border-t border-dark-700/50" />

            {/* ---------------------------------------------------------------- */}
            {/* EXPLICAÇÃO                                                       */}
            {/* ---------------------------------------------------------------- */}
            <div className="p-3 bg-dark-800/50 rounded-xl border border-dark-700/50 space-y-2">
              <p className="text-xs font-semibold text-gray-400">Como funcionam os créditos?</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Cada consulta ao "Posso Comprar? com IA", mensagem no chat do Assistente ou
                verificação de fatura PDF consome 1 crédito do seu pool mensal de {AI_TOTAL_LIMIT}.
                O pool renova automaticamente todo 1° do mês.
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Você pode reservar parte dos créditos para mensagens proativas — análises automáticas
                que o PocketWise envia sobre sua situação financeira (funcionalidade em breve).
                Por padrão, 10 créditos ficam reservados.
              </p>
            </div>

          </CardContent>
        </Card>
      )}

      {/* Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={20} className="text-green-400" />
            Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-400">
            Exporte suas transações para Excel para análise e backup.
          </p>

          {ultimoBackup && (
            <p className="text-xs text-gray-500">
              Último backup: {format(new Date(ultimoBackup), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}

          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleExportData} isLoading={isExporting}>
              <Download size={16} className="mr-2" />
              Exportar Dados
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (user) localStorage.removeItem(`pw-onboarding-done-${user.id}`)
                atualizarPreferencias({ onboardingCompleted: false, onboardingStep: 0 })
              }}
            >
              <BookOpen size={16} className="mr-2" />
              Retomar Tour de Configuração
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sobre */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info size={20} className="text-blue-400" />
            Sobre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">PocketWise</h3>
              <p className="text-sm text-gray-400">Versão 1.0.0</p>
            </div>
          </div>

          <p className="text-sm text-gray-400">
            Gestão financeira pessoal inteligente. Controle suas finanças,
            acompanhe gastos e alcance seus objetivos financeiros.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
