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
} from 'lucide-react'
import { format } from 'date-fns'
import { useCartoesStore, useTransacoesStore } from '../store'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui'
import { CreditCardModal } from '../components/CreditCardModal'
import { FaturaDetailsModal } from '../components/FaturaDetailsModal'
import { formatCurrency } from '../utils/currency'
import type { Cartao } from '../types'

export function CreditCards() {
  const cartoes = useCartoesStore((state) => state.cartoes)
  const deleteCartao = useCartoesStore((state) => state.deleteCartao)
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const getFaturasCartao = useTransacoesStore((state) => state.getFaturasCartao)
  const marcarFaturaComoPaga = useTransacoesStore((state) => state.marcarFaturaComoPaga)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [cartaoToEdit, setCartaoToEdit] = useState<Cartao | undefined>()
  const [faturaDetailsCartaoId, setFaturaDetailsCartaoId] = useState<string | null>(null)

  // Obter mês atual no formato YYYY-MM
  const mesAtual = format(new Date(), 'yyyy-MM')
  const diaAtual = new Date().getDate()

  // Calcular estatísticas de cada cartão
  const cartoesComEstatisticas = useMemo(() => {
    return cartoes.map((cartao) => {
      // Buscar TODAS as compras não pagas do cartão (independente do mês de vencimento)
      // O que importa é: se não foi pago, está usando o limite!
      const comprasNaoPagas = lancamentos.filter(
        (l) =>
          l.cartao_id === cartao.id &&
          l.forma_pagamento === 'credito' &&
          l.status !== 'pago' // Considera pendente, projetado, etc
      )

      const totalUsandoLimite = comprasNaoPagas.reduce((sum, f) => sum + f.valor, 0)

      // Buscar faturas do mês atual para o botão "Pagar Fatura"
      const faturasMesAtual = getFaturasCartao(cartao.id, mesAtual)
      const faturasNaoPagasMesAtual = faturasMesAtual.filter((l) => l.status !== 'pago')
      const totalFaturaMesAtual = faturasNaoPagasMesAtual.reduce((sum, f) => sum + f.valor, 0)

      const parcelasPendentes = lancamentos.filter(
        (l) =>
          l.cartao_id === cartao.id &&
          l.forma_pagamento === 'credito' &&
          l.status === 'pendente' &&
          l.parcela_total &&
          l.parcela_total > 1
      )

      const limite = cartao.limite ?? 0
      const limiteDisponivel = limite - totalUsandoLimite
      const percentualUsado = limite > 0 ? (totalUsandoLimite / limite) * 100 : 0

      // Verificar se a fatura do mês atual está fechada (dia atual > dia de fechamento)
      const faturaFechada = diaAtual > cartao.dia_fechamento
      const temFaturaParaPagar = totalFaturaMesAtual > 0 && faturaFechada

      return {
        ...cartao,
        totalFatura: totalUsandoLimite, // Total usando o limite (TODAS as compras não pagas)
        totalFaturaMesAtual, // Fatura do mês para pagar
        limiteDisponivel,
        percentualUsado,
        quantidadeParcelas: parcelasPendentes.length,
        faturaFechada,
        temFaturaParaPagar,
      }
    })
  }, [cartoes, lancamentos, mesAtual, diaAtual, getFaturasCartao])

  const cartoesAtivos = useMemo(
    () => cartoesComEstatisticas.filter((c) => c.ativo),
    [cartoesComEstatisticas]
  )

  const cartoesInativos = useMemo(
    () => cartoesComEstatisticas.filter((c) => !c.ativo),
    [cartoesComEstatisticas]
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

  const handlePagarFatura = async (cartao: typeof cartoesComEstatisticas[0]) => {
    const confirmMessage = `Confirmar pagamento da fatura do cartão "${cartao.nome}"?\n\nValor: ${formatCurrency(cartao.totalFaturaMesAtual)}\n\nTodos os lançamentos desta fatura serão marcados como pagos e o limite será liberado.`

    if (window.confirm(confirmMessage)) {
      try {
        await marcarFaturaComoPaga(cartao.id, mesAtual)
        alert('Fatura paga com sucesso! Limite liberado.')
      } catch (error) {
        console.error('Erro ao pagar fatura:', error)
        alert('Erro ao pagar fatura. Tente novamente.')
      }
    }
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

          {/* Fatura do mês */}
          <div className="pt-3 border-t border-dark-700">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Fatura Atual</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary-400">
                  {formatCurrency(cartao.totalFatura)}
                </span>
                {cartao.totalFatura > 0 && (
                  <button
                    onClick={() => setFaturaDetailsCartaoId(cartao.id)}
                    className="p-1.5 hover:bg-dark-700 rounded transition-colors text-gray-400 hover:text-primary-400"
                    title="Ver detalhes da fatura"
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

          {/* Botão Pagar Fatura */}
          {cartao.temFaturaParaPagar && (
            <Button
              onClick={() => handlePagarFatura(cartao)}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <DollarSign size={14} className="mr-2" />
              Pagar Fatura ({formatCurrency(cartao.totalFaturaMesAtual)})
            </Button>
          )}

          {/* Parcelas pendentes */}
          {cartao.quantidadeParcelas > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
              <TrendingUp size={12} />
              <span>{cartao.quantidadeParcelas} parcelas ativas</span>
            </div>
          )}

          {/* Alerta de limite */}
          {cartao.percentualUsado >= 90 && (
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
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Cartões de Crédito</h1>
          <p className="text-gray-400">
            {cartoesAtivos.length} cartões ativos • Gerencie seus limites e faturas
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={16} className="mr-2" />
          Novo Cartão
        </Button>
      </div>

      {/* Resumo Geral */}
      {cartoesAtivos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Total em Faturas</p>
                  <p className="text-2xl font-bold text-red-400">
                    {formatCurrency(
                      cartoesAtivos.reduce((sum, c) => sum + c.totalFatura, 0)
                    )}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                  <DollarSign className="text-red-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

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
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus size={16} className="mr-2" />
              Adicionar Cartão
            </Button>
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
            totalFatura={cartao.totalFatura}
          />
        )
      })()}
    </div>
  )
}
