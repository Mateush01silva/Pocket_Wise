import { useState, useRef } from 'react'
import {
  User,
  Bell,
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
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { useUserPreferencesStore } from '../store/useUserPreferencesStore'
import { useTransacoesStore } from '../store/useTransacoesStore'
import { useCategoriasStore } from '../store/useCategoriasStore'
import { useContasBancariasStore } from '../store/useContasBancariasStore'
import { useCartoesStore } from '../store/useCartoesStore'
import { cn } from '../lib/cn'

export function Settings() {
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // User preferences
  const nome = useUserPreferencesStore((state) => state.nome)
  const avatarUrl = useUserPreferencesStore((state) => state.avatarUrl)
  const email = useUserPreferencesStore((state) => state.email)
  const moeda = useUserPreferencesStore((state) => state.moeda)
  const diaInicioCiclo = useUserPreferencesStore((state) => state.diaInicioCiclo)
  const notificacoesAtivas = useUserPreferencesStore((state) => state.notificacoesAtivas)
  const lembreteDespesasVencendo = useUserPreferencesStore((state) => state.lembreteDespesasVencendo)
  const lembreteMetasOrcamento = useUserPreferencesStore((state) => state.lembreteMetasOrcamento)
  const ultimoBackup = useUserPreferencesStore((state) => state.ultimoBackup)
  const atualizarPerfil = useUserPreferencesStore((state) => state.atualizarPerfil)
  const atualizarPreferencias = useUserPreferencesStore((state) => state.atualizarPreferencias)
  const registrarBackup = useUserPreferencesStore((state) => state.registrarBackup)

  // Local state for form
  const [formNome, setFormNome] = useState(nome)
  const [formEmail, setFormEmail] = useState(email || '')

  // Stores for export
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)
  const contas = useContasBancariasStore((state) => state.contas)
  const cartoes = useCartoesStore((state) => state.cartoes)

  const handleSavePerfil = async () => {
    setIsSaving(true)
    try {
      atualizarPerfil({
        nome: formNome,
        email: formEmail || null,
      })
      await new Promise(resolve => setTimeout(resolve, 500)) // Simula delay
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Converter para base64
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      atualizarPerfil({ avatarUrl: base64 })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    atualizarPerfil({ avatarUrl: null })
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: {
          lancamentos,
          categorias,
          contas,
          cartoes,
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pocketwise-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
      a.click()
      URL.revokeObjectURL(url)

      registrarBackup()
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
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {nome.charAt(0).toUpperCase()}
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
                {avatarUrl && (
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
                Email (opcional)
              </label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <Button onClick={handleSavePerfil} isLoading={isSaving}>
            <Save size={16} className="mr-2" />
            Salvar Perfil
          </Button>
        </CardContent>
      </Card>

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
            Exporte seus dados para backup.
          </p>

          {ultimoBackup && (
            <p className="text-xs text-gray-500">
              Último backup: {format(new Date(ultimoBackup), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}

          <div className="flex gap-3">
            <Button onClick={handleExportData} isLoading={isExporting}>
              <Download size={16} className="mr-2" />
              Exportar Dados
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
