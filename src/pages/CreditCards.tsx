import { useState, useMemo } from 'react'
import {
  Plus,
  CreditCard,
  Pencil,
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Eye,
  Target,
  FileSearch,
} from 'lucide-react'
import { format, parseISO, addMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCartoesStore, useTransacoesStore, useCategoriasStore } from '../store'
import { usePermissions } from '../hooks/usePermissions'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui'
import { CreditCardModal } from '../components/CreditCardModal'
import { FaturaDetailsModal } from '../components/FaturaDetailsModal'
import { PagarFaturaModal } from '../components/PagarFaturaModal'
import { formatCurrency } from '../utils/currency'
import { LearningTooltip } from '../components/ui/LearningTooltip'
import { learningContent } from '../lib/learningContent'
import type { Cartao, Lancamento } from '../types'

/**
 * Calcula o mês da fatura baseado na data da compra e dia de fechamento
 *
 * Exemplo com fechamento dia 13:
 * - Compra em 10/jan (dia 10 <= 13) → Fatura de janeiro
 * - Compra em 15/jan (dia 15 > 13) → Fatura de fevereiro
 */
function calcularMesFatura(dataCompra: string, diaFechamento: number): Date {
  const data = parseISO(dataCompra)
  const diaCompra = data.getDate()

  // Se comprou depois do fechamento, vai para o próximo mês
  if (diaCompra > diaFechamento) {
    return addMonths(startOfMonth(data), 1)
  }

  return startOfMonth(data)
}

/**
 * Calcula qual é a fatura atual do cartão (ciclo de faturamento em aberto)
 *
 * Se hoje é 20/jan e fechamento é dia 13:
 * - A fatura de janeiro já fechou (13/jan)
 * - A fatura atual é de fevereiro (compras de 14/jan a 13/fev)
 *
 * Se hoje é 10/jan e fechamento é dia 13:
 * - A fatura de janeiro ainda não fechou
 * - A fatura atual é de janeiro (compras de 14/dez a 13/jan)
 */
function calcularFaturaAtual(diaFechamento: number): Date {
  const hoje = new Date()
  const diaHoje = hoje.getDate()

  // Se já passou do fechamento, a fatura atual é do próximo mês
  if (diaHoje > diaFechamento) {
    return addMonths(startOfMonth(hoje), 1)
  }

  return startOfMonth(hoje)
}

/**
 * Filtra transações que pertencem à fatura atual
 */
function getTransacoesFaturaAtual(
  lancamentos: Lancamento[],
  cartaoId: string,
  diaFechamento: number
): Lancamento[] {
  const faturaAtual = calcularFaturaAtual(diaFechamento)
  const faturaAtualTime = faturaAtual.getTime()

  return lancamentos.filter((l) => {
    if (l.cartao_id !== cartaoId) return false
    if (l.forma_pagamento !== 'credito') return false
    if (l.status === 'pago') return false

    // Para parcelas com data_vencimento_fatura, usar esse campo
    const mesFatura = l.data_vencimento_fatura
      ? startOfMonth(parseISO(l.data_vencimento_fatura))
      : calcularMesFatura(l.data, diaFechamento)
    return mesFatura.getTime() === faturaAtualTime
  })
}

/**
 * Encontra a fatura mais antiga não paga (fatura fechada pendente de pagamento)
 * Retorna null se não houver fatura fechada pendente
 */
function getFaturaFechadaPendente(
  lancamentos: Lancamento[],
  cartaoId: string,
  diaFechamento: number,
  diaVencimento: number
): {
  mesFatura: Date
  transacoes: Lancamento[]
  total: number
  vencida: boolean
  dataVencimento: Date
} | null {
  const hoje = new Date()

  // Buscar todas as transações não pagas do cartão
  const transacoesNaoPagas = lancamentos.filter(
    (l) =>
      l.cartao_id === cartaoId &&
      l.forma_pagamento === 'credito' &&
      l.status !== 'pago'
  )

  if (transacoesNaoPagas.length === 0) return null

  // Agrupar por mês de fatura
  const faturasPorMes = new Map<number, Lancamento[]>()

  transacoesNaoPagas.forEach((t) => {
    // Para parcelas com data_vencimento_fatura, usar esse campo
    const mesFatura = t.data_vencimento_fatura
      ? startOfMonth(parseISO(t.data_vencimento_fatura))
      : calcularMesFatura(t.data, diaFechamento)
    const key = mesFatura.getTime()
    if (!faturasPorMes.has(key)) {
      faturasPorMes.set(key, [])
    }
    faturasPorMes.get(key)!.push(t)
  })

  // Encontrar faturas que já fecharam (mês da fatura <= mês atual E dia > fechamento)
  // Ou faturas de meses anteriores (que com certeza já fecharam)
  const faturasFechadasPendentes: Array<{
    mesFatura: Date
    transacoes: Lancamento[]
    total: number
    dataVencimento: Date
  }> = []

  faturasPorMes.forEach((transacoes, timestamp) => {
    const mesFatura = new Date(timestamp)
    const mesFaturaMonth = mesFatura.getMonth()
    const mesFaturaYear = mesFatura.getFullYear()

    // A fatura fechou se a data de fechamento já passou
    // Calcula a data de fechamento desta fatura
    const dataFechamento = new Date(mesFaturaYear, mesFaturaMonth, diaFechamento)
    const faturaFechou = hoje > dataFechamento

    if (faturaFechou) {
      // Calcular data de vencimento desta fatura
      const dataVencimento = new Date(mesFaturaYear, mesFaturaMonth, diaVencimento)

      faturasFechadasPendentes.push({
        mesFatura,
        transacoes,
        total: transacoes.reduce((sum, t) => sum + t.valor, 0),
        dataVencimento,
      })
    }
  })

  if (faturasFechadasPendentes.length === 0) return null

  // Ordenar por data de vencimento (mais antiga primeiro)
  faturasFechadasPendentes.sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime())

  const faturaParaPagar = faturasFechadasPendentes[0]

  // Verificar se está vencida
  const vencida = hoje > faturaParaPagar.dataVencimento

  return {
    ...faturaParaPagar,
    vencida,
  }
}

export function CreditCards() {
  const { canEdit } = usePermissions()
  const cartoes = useCartoesStore((state) => state.cartoes)
  const deleteCartao = useCartoesStore((state) => state.deleteCartao)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const categorias = useCategoriasStore((state) => state.categorias)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [cartaoToEdit, setCartaoToEdit] = useState<Cartao | undefined>()
  const [faturaDetailsCartaoId, setFaturaDetailsCartaoId] = useState<string | null>(null)
  const [verificarFaturaFechadaCartaoId, setVerificarFaturaFechadaCartaoId] = useState<string | null>(null)
  const [pagarFaturaCartao, setPagarFaturaCartao] = useState<typeof cartoesComEstatisticas[0] | null>(null)

  const diaAtual = new Date().getDate()

  // Calcular estatísticas de cada cartão
  const cartoesComEstatisticas = useMemo(() => {
    return cartoes.map((cartao) => {
      // Buscar compras que efetivamente consomem o limite do cartão
      // Apenas 'projetado' conta (compras reais feitas no cartão)
      // 'pendente' (assinaturas) não consome limite pois pode ser cancelado
      const comprasUsandoLimite = lancamentos.filter(
        (l) =>
          l.cartao_id === cartao.id &&
          l.forma_pagamento === 'credito' &&
          l.status === 'projetado'
      )

      const totalUsandoLimite = comprasUsandoLimite.reduce((sum, f) => sum + f.valor, 0)

      // Fatura em aberto (ciclo atual - ainda não fechou)
      const transacoesFaturaEmAberto = getTransacoesFaturaAtual(
        lancamentos,
        cartao.id,
        cartao.dia_fechamento
      )
      const totalFaturaEmAberto = transacoesFaturaEmAberto.reduce((sum, f) => sum + f.valor, 0)

      // Fatura fechada pendente de pagamento (já fechou, precisa pagar)
      const faturaFechadaPendente = getFaturaFechadaPendente(
        lancamentos,
        cartao.id,
        cartao.dia_fechamento,
        cartao.dia_vencimento
      )

      const parcelasPendentes = lancamentos.filter(
        (l) =>
          l.cartao_id === cartao.id &&
          l.forma_pagamento === 'credito' &&
          l.status !== 'pago' &&
          l.parcela_total &&
          l.parcela_total > 1
      )

      const limite = cartao.limite ?? 0
      const limiteDisponivel = limite - totalUsandoLimite
      const percentualUsado = limite > 0 ? (totalUsandoLimite / limite) * 100 : 0

      return {
        ...cartao,
        totalFaturaEmAberto, // Fatura do ciclo atual (ainda não fechou)
        totalUsandoLimite, // Total usando o limite (TODAS as compras não pagas)
        faturaFechadaPendente, // Fatura que já fechou e precisa pagar
        limiteDisponivel,
        percentualUsado,
        quantidadeParcelas: parcelasPendentes.length,
      }
    })
  }, [cartoes, lancamentos, diaAtual])

  const cartoesAtivos = useMemo(
    () => cartoesComEstatisticas.filter((c) => c.ativo),
    [cartoesComEstatisticas]
  )

  const cartoesInativos = useMemo(
    () => cartoesComEstatisticas.filter((c) => !c.ativo),
    [cartoesComEstatisticas]
  )

  // Calcular parcelas pendentes (não pagas, com parcelamento)
  const parcelasPendentes = useMemo(() => {
    return lancamentos
      .filter(
        (l) =>
          l.grupo_parcelas_id &&
          l.parcela_atual &&
          l.parcela_total &&
          l.status !== 'pago' &&
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
        categoria?: string
        subcategoria?: string
      }
    >()

    parcelasPendentes.forEach((parcela) => {
      const grupoId = parcela.grupo_parcelas_id!
      if (!grupos.has(grupoId)) {
        const cartao = cartoes.find((c) => c.id === parcela.cartao_id)
        const categoria = categorias.find((c) => c.id === parcela.categoria_id)
        const subcategoria = categorias.find((c) => c.id === parcela.subcategoria_id)
        grupos.set(grupoId, {
          descricao: parcela.observacao || 'Compra parcelada',
          valor: parcela.valor,
          parcelas: [],
          cartao: cartao?.nome,
          categoria: categoria?.nome,
          subcategoria: subcategoria?.nome,
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
  }, [parcelasPendentes, cartoes, categorias])

  // Calcular parcelas dos próximos 3 meses
  const compromissosProximos3Meses = useMemo(() => {
    const hoje = new Date()
    let total = 0
    for (let i = 0; i < 3; i++) {
      const mesReferencia = startOfMonth(addMonths(hoje, i))
      const mesFormatado = format(mesReferencia, 'yyyy-MM')
      const parcelasMes = lancamentos.filter((l) => {
        if (!l.grupo_parcelas_id || !l.parcela_atual || !l.parcela_total || l.status === 'pago') return false
        const dataLancamento = new Date(l.data_vencimento_fatura || l.data)
        return format(dataLancamento, 'yyyy-MM') === mesFormatado
      })
      total += parcelasMes.reduce((sum, l) => sum + l.valor, 0)
    }
    return total
  }, [lancamentos])

  const totalParcelasPendentes = useMemo(
    () => parcelasPendentes.reduce((sum, p) => sum + p.valor, 0),
    [parcelasPendentes]
  )

  const handleEdit = (cartao: Cartao) => {
    setCartaoToEdit(cartao)
    setIsModalOpen(true)
  }

  const handleDelete = async (cartao: Cartao) => {
    const confirmMessage = `Tem certeza que deseja excluir o cartão "${cartao.nome}"?\n\nEsta ação não pode ser desfeita.`

    if (window.confirm(confirmMessage)) {
      try {
        await deleteCartao(cartao.id)
      } catch (error) {
        console.error('Erro ao deletar cartão:', error)
        alert('Erro ao deletar cartão. Verifique se não há lançamentos associados.')
      }
    }
  }

  const handlePagarFatura = (cartao: typeof cartoesComEstatisticas[0]) => {
    if (!cartao.faturaFechadaPendente) return
    setPagarFaturaCartao(cartao)
  }

  const handlePagarFaturaSuccess = () => {
    setPagarFaturaCartao(null)
    // O saldo da conta será atualizado automaticamente pelo trigger do banco
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setCartaoToEdit(undefined)
  }

  const renderCartao = (cartao: typeof cartoesComEstatisticas[0]) => {
    const corAlerta =
      cartao.percentualUsado >= 90
        ? 'text-red-400'
        : cartao.percentualUsado >= 70
        ? 'text-yellow-400'
        : 'text-green-400'

    return (
      <Card
        key={cartao.id}
        className="hover:shadow-xl transition-shadow relative overflow-hidden"
      >
        {/* Barra de cor no topo */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: cartao.cor || '#6b7280' }}
        />

        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={20} style={{ color: cartao.cor || '#6b7280' }} />
              {cartao.nome}
            </CardTitle>
            {canEdit && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(cartao)}
                  className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-primary-400"
                  title="Editar cartão"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(cartao)}
                  className="p-1.5 hover:bg-dark-700/50 rounded transition-colors text-gray-400 hover:text-red-400"
                  title="Deletar cartão"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Limite e Disponível */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Limite Total</p>
              <p className="text-sm font-semibold text-gray-200">
                {formatCurrency(cartao.limite ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Disponível</p>
              <p className={`text-sm font-semibold ${corAlerta}`}>
                {formatCurrency(cartao.limiteDisponivel)}
              </p>
            </div>
          </div>

          {/* Barra de uso do limite */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Uso do limite</span>
              <span className={corAlerta}>{cartao.percentualUsado.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  cartao.percentualUsado >= 90
                    ? 'bg-red-500'
                    : cartao.percentualUsado >= 70
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(cartao.percentualUsado, 100)}%` }}
              />
            </div>
          </div>

          {/* Fatura Fechada (para pagar) */}
          {cartao.faturaFechadaPendente && (
            <div className={`pt-3 border-t space-y-2 ${cartao.faturaFechadaPendente.vencida ? 'border-red-500/50 bg-red-500/5 -mx-4 px-4 pb-3' : 'border-dark-700'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Fatura Fechada</span>
                    {cartao.faturaFechadaPendente.vencida && (
                      <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-medium">
                        VENCIDA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {format(cartao.faturaFechadaPendente.mesFatura, "MMMM 'de' yyyy", { locale: ptBR })} • Vence {format(cartao.faturaFechadaPendente.dataVencimento, 'dd/MM', { locale: ptBR })}
                  </p>
                </div>
                <span className={`text-lg font-bold ${cartao.faturaFechadaPendente.vencida ? 'text-red-400' : 'text-yellow-400'}`}>
                  {formatCurrency(cartao.faturaFechadaPendente.total)}
                </span>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <Button
                    onClick={() => handlePagarFatura(cartao)}
                    className={`flex-1 ${cartao.faturaFechadaPendente.vencida ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                    size="sm"
                  >
                    <DollarSign size={14} className="mr-2" />
                    {cartao.faturaFechadaPendente.vencida ? 'Pagar Fatura Vencida' : 'Pagar Fatura'}
                  </Button>
                )}
                <button
                  onClick={() => setVerificarFaturaFechadaCartaoId(cartao.id)}
                  className="p-2 hover:bg-dark-700 rounded transition-colors text-gray-400 hover:text-primary-400 border border-dark-600 hover:border-dark-500"
                  title="Verificar fatura (PDF ou Excel)"
                >
                  <FileSearch size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Fatura em Aberto (ciclo atual) */}
          <div className="pt-3 border-t border-dark-700 space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm text-gray-400">Fatura em Aberto</span>
                <p className="text-xs text-gray-500">Ciclo atual</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary-400">
                  {formatCurrency(cartao.totalFaturaEmAberto)}
                </span>
                {cartao.totalUsandoLimite > 0 && (
                  <button
                    onClick={() => setFaturaDetailsCartaoId(cartao.id)}
                    className="p-1.5 hover:bg-dark-700 rounded transition-colors text-gray-400 hover:text-primary-400"
                    title="Ver todas as faturas pendentes"
                  >
                    <Eye size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Info de fechamento/vencimento */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1 text-gray-500">
              <Calendar size={12} />
              <span>Fecha dia {cartao.dia_fechamento}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <DollarSign size={12} />
              <span>Vence dia {cartao.dia_vencimento}</span>
            </div>
          </div>

          {/* Parcelas pendentes */}
          {cartao.quantidadeParcelas > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
              <TrendingUp size={12} />
              <span>{cartao.quantidadeParcelas} parcelas ativas</span>
            </div>
          )}

          {/* Alerta de limite */}
          {cartao.percentualUsado >= 100 ? (
            <div className="flex items-center gap-2 text-xs text-white bg-red-600 px-2 py-1.5 rounded font-medium animate-pulse">
              <AlertCircle size={13} />
              <span>Limite EXCEDIDO! Disponível negativo</span>
            </div>
          ) : cartao.percentualUsado >= 90 && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
              <AlertCircle size={12} />
              <span>Atenção: Limite quase esgotado!</span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-100 mb-1 md:mb-2">Cartões de Crédito</h1>
          <p className="text-gray-400">
            {cartoesAtivos.length} cartões ativos • Gerencie seus limites e faturas
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Novo Cartão
          </Button>
        )}
      </div>

      {/* Resumo Geral */}
      {cartoesAtivos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <LearningTooltip content={learningContent.cartaoLimiteTotal} position="bottom">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Limite Total</p>
                    <p className="text-2xl font-bold text-gray-100">
                      {formatCurrency(
                        cartoesAtivos.reduce((sum, c) => sum + (c.limite ?? 0), 0)
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary-500/10 rounded-full flex items-center justify-center">
                    <CreditCard className="text-primary-500" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </LearningTooltip>

          <LearningTooltip content={learningContent.cartaoTotalPagar} position="bottom">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Total a Pagar</p>
                    <p className="text-2xl font-bold text-red-400">
                      {formatCurrency(
                        cartoesAtivos.reduce((sum, c) => sum + c.totalUsandoLimite, 0)
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                    <DollarSign className="text-red-500" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </LearningTooltip>

          <LearningTooltip content={learningContent.cartaoLimiteDisponivel} position="bottom">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Limite Disponível</p>
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrency(
                        cartoesAtivos.reduce((sum, c) => sum + c.limiteDisponivel, 0)
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                    <TrendingUp className="text-green-500" size={24} />
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
                      {formatCurrency(totalParcelasPendentes)}
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
                      {formatCurrency(compromissosProximos3Meses)}
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
                    <p className="text-2xl font-bold text-gray-100">{gruposParcelas.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                    <Target className="text-blue-500" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </LearningTooltip>
        </div>
      )}

      {/* Cartões Ativos */}
      {cartoesAtivos.length > 0 ? (
        <div>
          <h2 className="text-xl font-bold text-gray-100 mb-4">Cartões Ativos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cartoesAtivos.map(renderCartao)}
          </div>
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center">
            <div className="w-16 h-16 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="text-gray-500" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">
              Nenhum cartão cadastrado
            </h3>
            <p className="text-gray-500 mb-4">
              Adicione seu primeiro cartão para começar a gerenciar suas faturas
            </p>
            {canEdit && (
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus size={16} className="mr-2" />
                Adicionar Cartão
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parcelamentos Ativos */}
      {gruposParcelas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Parcelamentos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
                        {grupo.cartao && (
                          <span className="flex items-center gap-1">
                            <CreditCard size={14} />
                            {grupo.cartao}
                          </span>
                        )}
                        {grupo.categoria && (
                          <span className="text-xs bg-dark-600/50 px-1.5 py-0.5 rounded">
                            {grupo.categoria}
                            {grupo.subcategoria && (
                              <span className="text-gray-500"> › {grupo.subcategoria}</span>
                            )}
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
          </CardContent>
        </Card>
      )}

      {/* Cartões Inativos */}
      {cartoesInativos.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-400 mb-4">Cartões Inativos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {cartoesInativos.map(renderCartao)}
          </div>
        </div>
      )}

      {/* Modal de Cartão */}
      <CreditCardModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        cartao={cartaoToEdit}
      />

      {/* Modal de Detalhes da Fatura */}
      {faturaDetailsCartaoId && (() => {
        const cartao = cartoesComEstatisticas.find((c) => c.id === faturaDetailsCartaoId)
        if (!cartao) return null

        // Mostrar TODAS as transações não pagas, agrupadas por ciclo de faturamento
        const transacoesCartao = lancamentos.filter(
          (l) =>
            l.cartao_id === cartao.id &&
            l.forma_pagamento === 'credito' &&
            l.status !== 'pago'
        )

        return (
          <FaturaDetailsModal
            isOpen={true}
            onClose={() => setFaturaDetailsCartaoId(null)}
            cartaoNome={cartao.nome}
            cartaoCor={cartao.cor || '#6b7280'}
            transacoes={transacoesCartao}
            totalFatura={cartao.totalUsandoLimite}
            diaFechamento={cartao.dia_fechamento}
          />
        )
      })()}

      {/* Modal de Pagamento de Fatura */}
      {pagarFaturaCartao && pagarFaturaCartao.faturaFechadaPendente && (
        <PagarFaturaModal
          isOpen={true}
          onClose={() => setPagarFaturaCartao(null)}
          cartaoNome={pagarFaturaCartao.nome}
          fatura={pagarFaturaCartao.faturaFechadaPendente}
          onSuccess={handlePagarFaturaSuccess}
        />
      )}

      {/* Modal de Verificar Fatura Fechada com PDF */}
      {verificarFaturaFechadaCartaoId && (() => {
        const cartao = cartoesComEstatisticas.find((c) => c.id === verificarFaturaFechadaCartaoId)
        if (!cartao?.faturaFechadaPendente) return null

        const { mesFatura, total } = cartao.faturaFechadaPendente
        const mesFaturaTime = startOfMonth(mesFatura).getTime()

        // Para verificação: inclui TODAS as transações do mês da fatura,
        // independente do status (pagas incluídas — ex: parcelas já quitadas)
        const transacoesParaVerificar = lancamentos.filter((l) => {
          if (l.cartao_id !== cartao.id || l.forma_pagamento !== 'credito') return false
          const mes = l.data_vencimento_fatura
            ? startOfMonth(parseISO(l.data_vencimento_fatura)).getTime()
            : calcularMesFatura(l.data, cartao.dia_fechamento).getTime()
          return mes === mesFaturaTime
        })

        return (
          <FaturaDetailsModal
            isOpen={true}
            onClose={() => setVerificarFaturaFechadaCartaoId(null)}
            cartaoNome={cartao.nome}
            cartaoCor={cartao.cor || '#6b7280'}
            transacoes={transacoesParaVerificar}
            totalFatura={total}
            diaFechamento={cartao.dia_fechamento}
            showVerificarButton={true}
          />
        )
      })()}
    </div>
  )
}
