import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFamilyStore } from '../store/useFamilyStore'
import { Users, ArrowRight, Briefcase, ShieldCheck, Eye } from 'lucide-react'

const PROFILE_LABELS: Record<string, string> = {
  configurador: 'Configurador',
  acompanhador: 'Acompanhador',
  custom: 'Personalizado',
}

export function ConsultorClientes() {
  const { userFamilies, switchFamily, personalFamilyId } = useAuth()
  const refresh = useFamilyStore((state) => state.refresh)
  const navigate = useNavigate()

  const clientFamilies = userFamilies.filter((f) => f.member_type === 'consultor')

  const handleAccess = async (familyId: string) => {
    await switchFamily(familyId)
    await refresh()
    navigate('/app')
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientFamilies.map((family) => (
            <div
              key={family.family_id}
              className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-5 flex flex-col gap-4 hover:border-dark-600 transition-colors"
            >
              {/* Family info */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-primary-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-100 truncate">{family.nome}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {family.role === 'admin' || family.role === 'editor' ? (
                      <ShieldCheck className="w-3 h-3 text-primary-400" />
                    ) : (
                      <Eye className="w-3 h-3 text-gray-500" />
                    )}
                    <span className="text-xs text-gray-500 capitalize">{family.role}</span>
                  </div>
                </div>
              </div>

              {/* Acessar button */}
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
      )}

      {/* Link para voltar à própria família se não estiver nela */}
      {personalFamilyId && (
        <p className="text-xs text-gray-600 text-center">
          Você está visualizando sua própria conta.{' '}
          <button
            onClick={() => switchFamily(personalFamilyId).then(() => navigate('/app'))}
            className="text-primary-500 hover:text-primary-400 underline underline-offset-2"
          >
            Ir para o Dashboard
          </button>
        </p>
      )}
    </div>
  )
}
