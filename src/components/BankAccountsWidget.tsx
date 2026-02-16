import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from './ui'
import { useContasBancariasStore, useTransacoesStore } from '../store'
import { formatCurrency } from '../utils/currency'
import { Landmark, Plus, ArrowRight } from 'lucide-react'

export function BankAccountsWidget() {
  const contas = useContasBancariasStore((state) => state.contas)
  const fetchContas = useContasBancariasStore((state) => state.fetchContas)
  const getSaldoTotal = useContasBancariasStore((state) => state.getSaldoTotal)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const navigate = useNavigate()

  // Buscar contas ao montar e quando transações mudam (saldo pode ter sido atualizado)
  useEffect(() => {
    fetchContas()
  }, [fetchContas, lancamentos])

  const contasAtivas = useMemo(
    () => contas.filter((c) => c.ativo).slice(0, 4), // Mostrar apenas as 4 primeiras
    [contas]
  )

  const saldoTotal = useMemo(() => getSaldoTotal(), [contas, getSaldoTotal])

  const temContas = contasAtivas.length > 0

  if (!temContas) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Landmark size={20} />
              Contas Bancárias
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <Landmark className="text-gray-500" size={24} />
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Cadastre suas contas para controlar seus saldos
            </p>
            <button
              onClick={() => navigate('/app/contas')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm transition-colors"
            >
              <Plus size={16} />
              Adicionar Conta
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Landmark size={20} />
            Saldo nas Contas
          </span>
          <button
            onClick={() => navigate('/app/contas')}
            className="text-xs text-gray-400 hover:text-primary-400 transition-colors flex items-center gap-1"
          >
            Ver todas
            <ArrowRight size={14} />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Saldo Total */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border border-primary-500/20">
          <p className="text-xs text-gray-400 mb-1">Saldo Total</p>
          <p className="text-2xl font-bold text-gray-100">
            {formatCurrency(saldoTotal)}
          </p>
        </div>

        {/* Lista de Contas */}
        <div className="space-y-2">
          {contasAtivas.map((conta) => {
            const saldoPositivo = conta.saldo_atual >= 0

            return (
              <div
                key={conta.id}
                className="flex items-center justify-between p-3 rounded-lg bg-dark-700/30 hover:bg-dark-700/50 transition-colors cursor-pointer"
                onClick={() => navigate('/app/contas')}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${conta.cor}20` }}
                  >
                    {conta.icone || '💳'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {conta.nome}
                    </p>
                    {conta.instituicao && (
                      <p className="text-xs text-gray-500 truncate">
                        {conta.instituicao}
                      </p>
                    )}
                  </div>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    saldoPositivo ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {formatCurrency(conta.saldo_atual)}
                </p>
              </div>
            )
          })}
        </div>

        {/* Link para ver todas */}
        {contas.filter((c) => c.ativo).length > 4 && (
          <button
            onClick={() => navigate('/app/contas')}
            className="w-full text-xs text-center text-gray-400 hover:text-primary-400 transition-colors py-2"
          >
            + {contas.filter((c) => c.ativo).length - 4} contas
          </button>
        )}
      </CardContent>
    </Card>
  )
}
