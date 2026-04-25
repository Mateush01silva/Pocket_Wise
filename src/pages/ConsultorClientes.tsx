import { useAuth } from '../contexts/AuthContext'
import { Users, ArrowRight, Briefcase, Eye, Home, ChevronRight } from 'lucide-react'
import { useFamilyStore } from '../store/useFamilyStore'
import { useConsultorPermissions } from '../hooks/useConsultorPermissions'

export function ConsultorClientes() {
  const { userFamilies, switchFamily, personalFamilyId } = useAuth()
  const { isConsultor } = useConsultorPermissions()
  const family = useFamilyStore((state) => state.family)

  const clientFamilies = userFamilies.filter((f) => f.member_type === 'consultor')

  const handleAccess = async (familyId: string) => {
    await switchFamily(familyId)
    window.location.href = '/app'
  }

  const handleBackToPersonal = async () => {
    if (personalFamilyId) {
      await switchFamily(personalFamilyId)
    }
    window.location.href = '/app'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-100">Meus Clientes</h1>
          <p className="text-sm text-gray-500">Famílias que você acompanha como consultor</p>
        </div>
      </div>

      {/* Conta pessoal — mostrada quando o consultor está visualizando um cliente */}
      {isConsultor && (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Contexto atual</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-100 truncate">{family?.nome || 'Cliente'}</p>
                <p className="text-xs text-gray-500">Você está visualizando como consultor</p>
              </div>
            </div>
            <button
              onClick={handleBackToPersonal}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-600 text-gray-300 hover:bg-dark-700 hover:text-white transition-all text-sm font-medium shrink-0"
            >
              <Home className="w-4 h-4" />
              Minha Conta
            </button>
          </div>
        </div>
      )}

      {clientFamilies.length === 0 ? (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-dark-700/50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-gray-500" />
          </div>
          <h3 className="text-base font-medium text-gray-300 mb-1">Nenhum cliente ainda</h3>
          <p className="text-sm text-gray-500">
            Quando um cliente te convidar como consultor, ele aparecerá aqui.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 uppercase tracking-wider -mb-3">Clientes</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientFamilies.map((family) => (
              <div
                key={family.family_id}
                className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-5 flex flex-col gap-4 hover:border-dark-600 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-100 truncate">{family.nome}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Eye className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500 capitalize">Consultor</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleAccess(family.family_id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 transition-all text-sm font-medium"
                >
                  Acessar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Atalho para conta pessoal — sempre visível no final */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Minha conta</p>
        <button
          onClick={handleBackToPersonal}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-dark-700/50 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-dark-700/50 border border-dark-600 flex items-center justify-center shrink-0">
            <Home className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200">Voltar para minha conta</p>
            <p className="text-xs text-gray-500">Acessar suas finanças pessoais</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
        </button>
      </div>
    </div>
  )
}
