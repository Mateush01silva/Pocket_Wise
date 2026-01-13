import { useMemo } from 'react'
import {
  Users,
  UserPlus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  AlertCircle,
  Shield,
  Share2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui'
import { useTransacoesStore, useCartoesStore, useOrcamentosStore, useCategoriasStore } from '../store'
import { formatCurrency } from '../utils/currency'
import { format, startOfMonth } from 'date-fns'

export function Family() {
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const cartoes = useCartoesStore((state) => state.cartoes)
  const orcamentos = useOrcamentosStore((state) => state.orcamentos)
  const categorias = useCategoriasStore((state) => state.categorias)

  // Estatísticas da família
  const estatisticas = useMemo(() => {
    const mesAtual = format(startOfMonth(new Date()), 'yyyy-MM')

    // Lançamentos do mês
    const lancamentosMes = lancamentos.filter((l) =>
      l.data.startsWith(mesAtual)
    )

    const receitas = lancamentosMes
      .filter((l) => l.tipo === 'receita' && l.status === 'pago')
      .reduce((sum, l) => sum + l.valor, 0)

    const despesas = lancamentosMes
      .filter((l) => l.tipo === 'despesa' && l.status === 'pago')
      .reduce((sum, l) => sum + l.valor, 0)

    const saldo = receitas - despesas

    // Contadores
    const totalCartoes = cartoes.length
    const totalCategorias = categorias.length
    const totalOrcamentos = orcamentos.length
    const totalLancamentos = lancamentos.length

    return {
      receitas,
      despesas,
      saldo,
      totalCartoes,
      totalCategorias,
      totalOrcamentos,
      totalLancamentos,
    }
  }, [lancamentos, cartoes, orcamentos, categorias])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Família</h1>
        <p className="text-gray-400">
          Gerencie membros e compartilhamento financeiro
        </p>
      </div>

      {/* Informação sobre Autenticação */}
      <Card className="border border-blue-500/20 bg-blue-500/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-blue-400 mb-1">
                Funcionalidade em Desenvolvimento
              </h4>
              <p className="text-sm text-gray-400 mb-3">
                O gerenciamento completo de membros da família estará disponível após a
                implementação do sistema de autenticação. Por enquanto, todos os dados são
                compartilhados localmente neste dispositivo.
              </p>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded">
                  <Shield size={12} />
                  Autenticação pendente
                </span>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded">
                  <Share2 size={12} />
                  Compartilhamento pendente
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas da Família */}
      <div>
        <h2 className="text-xl font-bold text-gray-100 mb-4">
          Estatísticas da Família
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Receitas do Mês</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(estatisticas.receitas)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="text-green-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Despesas do Mês</p>
                  <p className="text-2xl font-bold text-red-400">
                    {formatCurrency(estatisticas.despesas)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                  <TrendingDown className="text-red-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Saldo do Mês</p>
                  <p
                    className={`text-2xl font-bold ${
                      estatisticas.saldo >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatCurrency(estatisticas.saldo)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary-500/10 rounded-full flex items-center justify-center">
                  <DollarSign className="text-primary-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Cartões Cadastrados</p>
                  <p className="text-2xl font-bold text-gray-100">
                    {estatisticas.totalCartoes}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
                  <CreditCard className="text-yellow-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recursos do Sistema */}
      <div>
        <h2 className="text-xl font-bold text-gray-100 mb-4">
          Recursos Cadastrados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Categorias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-4xl font-bold text-primary-400 mb-2">
                  {estatisticas.totalCategorias}
                </p>
                <p className="text-sm text-gray-500">categorias cadastradas</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Orçamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-4xl font-bold text-green-400 mb-2">
                  {estatisticas.totalOrcamentos}
                </p>
                <p className="text-sm text-gray-500">orçamentos criados</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lançamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-400 mb-2">
                  {estatisticas.totalLancamentos}
                </p>
                <p className="text-sm text-gray-500">transações registradas</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Membros da Família (Preview) */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Membros da Família</CardTitle>
            <Button disabled>
              <UserPlus size={16} className="mr-2" />
              Adicionar Membro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Usuário atual (simulado) */}
            <div className="flex items-center justify-between p-4 bg-dark-700/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                  <Users className="text-primary-500" size={24} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-200">Você</h4>
                  <p className="text-sm text-gray-500">Administrador</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded">
                  Ativo
                </span>
                <span className="text-xs px-2 py-1 bg-primary-500/10 text-primary-400 rounded">
                  Admin
                </span>
              </div>
            </div>

            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-dark-700 rounded-lg">
              <Users className="mx-auto mb-3 text-gray-600" size={32} />
              <p className="mb-2">Nenhum membro adicional</p>
              <p className="text-sm text-gray-600">
                Adicione membros da família para compartilhar o controle financeiro
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Funcionalidades Futuras */}
      <Card className="border border-dark-700">
        <CardHeader>
          <CardTitle>Funcionalidades Planejadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-dark-700/20 rounded">
              <div className="w-8 h-8 bg-blue-500/10 rounded flex items-center justify-center flex-shrink-0">
                <Shield size={16} className="text-blue-400" />
              </div>
              <div>
                <h5 className="font-medium text-gray-200 mb-1">Autenticação</h5>
                <p className="text-sm text-gray-500">
                  Sistema de login e registro de usuários com segurança
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-dark-700/20 rounded">
              <div className="w-8 h-8 bg-green-500/10 rounded flex items-center justify-center flex-shrink-0">
                <UserPlus size={16} className="text-green-400" />
              </div>
              <div>
                <h5 className="font-medium text-gray-200 mb-1">Convites</h5>
                <p className="text-sm text-gray-500">
                  Convide membros da família por email ou link
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-dark-700/20 rounded">
              <div className="w-8 h-8 bg-yellow-500/10 rounded flex items-center justify-center flex-shrink-0">
                <Share2 size={16} className="text-yellow-400" />
              </div>
              <div>
                <h5 className="font-medium text-gray-200 mb-1">Compartilhamento</h5>
                <p className="text-sm text-gray-500">
                  Compartilhe categorias, cartões e orçamentos entre membros
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-dark-700/20 rounded">
              <div className="w-8 h-8 bg-purple-500/10 rounded flex items-center justify-center flex-shrink-0">
                <Users size={16} className="text-purple-400" />
              </div>
              <div>
                <h5 className="font-medium text-gray-200 mb-1">Permissões</h5>
                <p className="text-sm text-gray-500">
                  Defina permissões diferentes para cada membro (admin, editor,
                  visualizador)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
