import { useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  Target,
  AlertCircle,
} from 'lucide-react'
import { format, addMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useTransacoesStore, useCartoesStore, useOrcamentosStore } from '../store'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui'
import { formatCurrency } from '../utils/currency'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { LearningTooltip } from '../components/ui/LearningTooltip'
import { learningContent } from '../lib/learningContent'
import type { OrcamentoMensal } from '../types'

export function Projections() {
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const cartoes = useCartoesStore((state) => state.cartoes)
  const orcamentos = useOrcamentosStore((state) => state.orcamentos) as OrcamentoMensal[]

  // Calcular projeções para os próximos 6 meses
  const projecoes = useMemo(() => {
    const mesesProjecao = 6
    const hoje = new Date()
    const projecoesMensais = []

    for (let i = 0; i < mesesProjecao; i++) {
      const mesReferencia = startOfMonth(addMonths(hoje, i))
      const mesFormatado = format(mesReferencia, 'yyyy-MM')

      // Calcular parcelas não pagas para este mês (inclui pendente e projetado)
      const parcelasMes = lancamentos.filter((l) => {
        if (
          !l.grupo_parcelas_id ||
          !l.parcela_atual ||
          !l.parcela_total ||
          l.status === 'pago'
        ) {
          return false
        }

        const dataLancamento = new Date(l.data_vencimento_fatura || l.data)
        const mesLancamento = format(dataLancamento, 'yyyy-MM')

        return mesLancamento === mesFormatado
      })

      const totalParcelas = parcelasMes.reduce((sum, l) => sum + l.valor, 0)

      // Calcular receitas recorrentes (simplificado - assumir que receitas se repetem)
      const receitasRecorrentes = lancamentos
        .filter((l) => l.tipo === 'receita' && l.status === 'pago')
        .reduce((sum, l) => sum + l.valor, 0)

      // Buscar orçamento do mês
      const orcamentoMes = orcamentos.find((o) =>
        o.mes_referencia.startsWith(mesFormatado)
      )

      projecoesMensais.push({
        mes: format(mesReferencia, 'MMM/yy', { locale: ptBR }),
        mesCompleto: format(mesReferencia, 'MMMM yyyy', { locale: ptBR }),
        parcelas: totalParcelas,
        receitasProjetadas: i === 0 ? 0 : receitasRecorrentes, // Mês atual não projeta receitas
        despesasOrcadas: orcamentoMes
          ? orcamentoMes.meta_poupanca
            ? receitasRecorrentes - orcamentoMes.meta_poupanca
            : receitasRecorrentes * 0.8
          : receitasRecorrentes * 0.8,
        saldoProjetado:
          (i === 0 ? 0 : receitasRecorrentes) -
          totalParcelas -
          (orcamentoMes
            ? orcamentoMes.meta_poupanca
              ? receitasRecorrentes - orcamentoMes.meta_poupanca
              : receitasRecorrentes * 0.8
            : receitasRecorrentes * 0.8),
      })
    }

    return projecoesMensais
  }, [lancamentos, orcamentos])

  // Listar todas as parcelas não pagas (inclui pendente e projetado)
  const parcelasPendentes = useMemo(() => {
    return lancamentos
      .filter(
        (l) =>
          l.grupo_parcelas_id &&
          l.parcela_atual &&
          l.parcela_total &&
          l.status !== 'pago' && // Inclui pendente e projetado
          l.parcela_total > 1
      )
      .sort((a, b) => new Date(a.data_vencimento_fatura || a.data).getTime() - new Date(b.data_vencimento_fatura || b.data).getTime())
  }, [lancamentos])

  // Agrupar parcelas por grupo
  const gruposParcelas = useMemo(() => {
    const grupos = new Map<
      string,
      {
        descricao: string
        valor: number
        parcelas: typeof parcelasPendentes
        cartao?: string
      }
    >()

    parcelasPendentes.forEach((parcela) => {
      const grupoId = parcela.grupo_parcelas_id!
      if (!grupos.has(grupoId)) {
        const cartao = cartoes.find((c) => c.id === parcela.cartao_id)
        grupos.set(grupoId, {
          descricao: parcela.observacao || 'Compra parcelada',
          valor: parcela.valor,
          parcelas: [],
          cartao: cartao?.nome,
        })
      }
      grupos.get(grupoId)!.parcelas.push(parcela)
    })

    return Array.from(grupos.entries()).map(([id, dados]) => ({
      id,
      ...dados,
      totalParcelas: dados.parcelas.length,
      valorTotal: dados.valor * dados.parcelas.length,
    }))
  }, [parcelasPendentes, cartoes])

  // Calcular totais
  const totais = useMemo(() => {
    const proximoMes = projecoes[1] || projecoes[0]
    const totalParcelas = parcelasPendentes.reduce((sum, p) => sum + p.valor, 0)
    const compromissosProximos3Meses = projecoes
      .slice(0, 3)
      .reduce((sum, p) => sum + p.parcelas, 0)

    return {
      proximoMes: proximoMes?.saldoProjetado || 0,
      totalParcelas,
      compromissosProximos3Meses,
      gruposAtivos: gruposParcelas.length,
    }
  }, [projecoes, parcelasPendentes, gruposParcelas])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Projeções</h1>
        <p className="text-gray-400">Visualize seus compromissos e saldo projetado</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LearningTooltip content={learningContent.projecaoSaldoProximoMes} position="bottom">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Saldo Próximo Mês</p>
                  <p
                    className={`text-2xl font-bold ${
                      totais.proximoMes >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatCurrency(totais.proximoMes)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Projeção do saldo</p>
                </div>
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    totais.proximoMes >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  {totais.proximoMes >= 0 ? (
                    <TrendingUp className="text-green-500" size={24} />
                  ) : (
                    <TrendingDown className="text-red-500" size={24} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </LearningTooltip>

        <LearningTooltip content={learningContent.projecaoParcelasPendentes} position="bottom">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Parcelas Pendentes</p>
                  <p className="text-2xl font-bold text-primary-400">
                    {formatCurrency(totais.totalParcelas)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Total não pago</p>
                </div>
                <div className="w-12 h-12 bg-primary-500/10 rounded-full flex items-center justify-center">
                  <CreditCard className="text-primary-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </LearningTooltip>

        <LearningTooltip content={learningContent.projecaoProximos3Meses} position="bottom">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Próximos 3 Meses</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {formatCurrency(totais.compromissosProximos3Meses)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Parcelas a vencer</p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
                  <Calendar className="text-yellow-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </LearningTooltip>

        <LearningTooltip content={learningContent.projecaoParcelamentosAtivos} position="bottom">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Parcelamentos Ativos</p>
                  <p className="text-2xl font-bold text-gray-100">{totais.gruposAtivos}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Target className="text-blue-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </LearningTooltip>
      </div>

      {/* Gráfico de Projeção */}
      <Card>
        <CardHeader>
          <CardTitle>Projeção de Saldo - Próximos 6 Meses</CardTitle>
        </CardHeader>
        <CardContent>
          {projecoes.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projecoes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                  formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                />
                <Legend />
                <Bar
                  dataKey="receitasProjetadas"
                  fill="#10b981"
                  name="Receitas Projetadas"
                />
                <Bar dataKey="despesasOrcadas" fill="#ef4444" name="Despesas Orçadas" />
                <Bar dataKey="parcelas" fill="#f59e0b" name="Parcelas Pendentes" />
                <Bar dataKey="saldoProjetado" fill="#8b5cf6" name="Saldo Projetado" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Não há dados suficientes para projeção
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Parcelamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Parcelamentos Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {gruposParcelas.length > 0 ? (
            <div className="space-y-3">
              {gruposParcelas.map((grupo) => (
                <div
                  key={grupo.id}
                  className="p-4 bg-dark-700/30 rounded-lg hover:bg-dark-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-200 mb-1">
                        {grupo.descricao}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        {grupo.cartao && (
                          <span className="flex items-center gap-1">
                            <CreditCard size={14} />
                            {grupo.cartao}
                          </span>
                        )}
                        <span>
                          {grupo.parcelas.length} parcelas restantes
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary-400">
                        {formatCurrency(grupo.valor)}
                        <span className="text-sm text-gray-500">/mês</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Total: {formatCurrency(grupo.valorTotal)}
                      </p>
                    </div>
                  </div>

                  {/* Próximas 3 parcelas */}
                  <div className="mt-3 pt-3 border-t border-dark-700">
                    <p className="text-xs text-gray-500 mb-2">Próximas parcelas:</p>
                    <div className="space-y-1">
                      {grupo.parcelas.slice(0, 3).map((parcela) => (
                        <div
                          key={parcela.id}
                          className="flex justify-between text-xs text-gray-400"
                        >
                          <span>
                            Parcela {parcela.parcela_atual}/{parcela.parcela_total}
                          </span>
                          <span>
                            {format(new Date(parcela.data), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      ))}
                      {grupo.parcelas.length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                          + {grupo.parcelas.length - 3} parcelas
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="mx-auto mb-3 text-gray-600" size={32} />
              <p>Nenhum parcelamento ativo no momento</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerta */}
      {totais.proximoMes < 0 && (
        <Card className="border border-red-500/20 bg-red-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-semibold text-red-400 mb-1">
                  Atenção: Saldo Negativo Projetado
                </h4>
                <p className="text-sm text-gray-400">
                  Suas projeções indicam que você pode ficar com saldo negativo no próximo
                  mês. Considere revisar seus gastos ou reduzir despesas não essenciais.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
