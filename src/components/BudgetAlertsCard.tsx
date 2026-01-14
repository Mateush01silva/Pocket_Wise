import { AlertTriangle, CheckCircle, TrendingUp, Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { useOrcamentosStore } from '../store'
import { formatCurrency } from '../utils/currency'
import { cn } from '../lib/cn'
import type { CategoriaEmRisco } from '../types'

interface BudgetAlertsCardProps {
  orcamentoId: string
  className?: string
}

export function BudgetAlertsCard({ orcamentoId, className }: BudgetAlertsCardProps) {
  const getCategoriasEmRisco = useOrcamentosStore((state) => state.getCategoriasEmRisco)
  const getProjecaoMensal = useOrcamentosStore((state) => state.getProjecaoMensal)
  const orcamentoAtual = useOrcamentosStore((state) => state.orcamentoAtual)

  const categoriasEmRisco = getCategoriasEmRisco(orcamentoId) || []
  const projecao = getProjecaoMensal(orcamentoId)

  // Gerar alertas baseado em diferentes condições
  const alerts: Array<{
    id: string
    tipo: 'sucesso' | 'atencao' | 'critico'
    titulo: string
    mensagem: string
    icon: React.ReactNode
  }> = []

  // Alertas de categorias em risco (80%, 90%, 100%)
  categoriasEmRisco.forEach((catRisco: CategoriaEmRisco) => {
    const { percentual_usado } = catRisco

    let tipo: 'sucesso' | 'atencao' | 'critico' = 'atencao'
    let titulo = ''
    let icon: React.ReactNode = <AlertTriangle size={18} />

    if (percentual_usado >= 100) {
      tipo = 'critico'
      titulo = `${catRisco.categoria.nome} estourou o orçamento!`
      icon = <AlertTriangle size={18} />
    } else if (percentual_usado >= 90) {
      tipo = 'critico'
      titulo = `${catRisco.categoria.nome} em 90%`
      icon = <AlertTriangle size={18} />
    } else if (percentual_usado >= 80) {
      tipo = 'atencao'
      titulo = `${catRisco.categoria.nome} em 80%`
      icon = <Bell size={18} />
    }

    alerts.push({
      id: `categoria-${catRisco.categoria.id}`,
      tipo,
      titulo,
      mensagem:
        percentual_usado >= 100
          ? `Você excedeu o orçamento em ${formatCurrency(Math.abs(catRisco.margem_restante))}`
          : `Restam apenas ${formatCurrency(catRisco.margem_restante)} do orçado`,
      icon,
    })
  })

  // Alerta: Meta de poupança atingida ou em risco
  if (projecao && orcamentoAtual) {
    const metaPoupanca = orcamentoAtual.meta_poupanca
    const projecaoFimMes = projecao.saldo_projetado_fim_mes

    if (projecaoFimMes >= metaPoupanca && metaPoupanca > 0) {
      alerts.push({
        id: 'meta-atingida',
        tipo: 'sucesso',
        titulo: 'Meta de poupança on track! 🎉',
        mensagem: `Você está projetado para poupar ${formatCurrency(projecaoFimMes)} este mês`,
        icon: <CheckCircle size={18} />,
      })
    } else if (projecaoFimMes < metaPoupanca * 0.5 && metaPoupanca > 0) {
      alerts.push({
        id: 'meta-risco',
        tipo: 'critico',
        titulo: 'Meta de poupança em risco',
        mensagem: `Projeção de apenas ${formatCurrency(projecaoFimMes)} (meta: ${formatCurrency(metaPoupanca)})`,
        icon: <TrendingUp size={18} />,
      })
    }
  }

  // Alerta: Gastando acima do ritmo
  if (projecao && projecao.percentual_orcamento_usado > projecao.percentual_mes_decorrido + 10) {
    alerts.push({
      id: 'ritmo-alto',
      tipo: 'atencao',
      titulo: 'Gastando acima do ritmo',
      mensagem: `Você está ${(projecao.percentual_orcamento_usado - projecao.percentual_mes_decorrido).toFixed(1)}% acima do esperado para este período`,
      icon: <AlertTriangle size={18} />,
    })
  }

  // Se não há alertas, mostrar mensagem positiva
  if (alerts.length === 0) {
    alerts.push({
      id: 'tudo-certo',
      tipo: 'sucesso',
      titulo: 'Tudo sob controle!',
      mensagem: 'Nenhum alerta no momento. Continue assim!',
      icon: <CheckCircle size={18} />,
    })
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell size={20} className="text-yellow-500" />
          Alertas e Notificações
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              'p-3 rounded-lg border',
              alert.tipo === 'sucesso' && 'bg-green-500/10 border-green-500/30',
              alert.tipo === 'atencao' && 'bg-yellow-500/10 border-yellow-500/30',
              alert.tipo === 'critico' && 'bg-red-500/10 border-red-500/30'
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5',
                  alert.tipo === 'sucesso' && 'text-green-400',
                  alert.tipo === 'atencao' && 'text-yellow-400',
                  alert.tipo === 'critico' && 'text-red-400'
                )}
              >
                {alert.icon}
              </div>
              <div className="flex-1">
                <p
                  className={cn(
                    'text-sm font-medium mb-1',
                    alert.tipo === 'sucesso' && 'text-green-400',
                    alert.tipo === 'atencao' && 'text-yellow-400',
                    alert.tipo === 'critico' && 'text-red-400'
                  )}
                >
                  {alert.titulo}
                </p>
                <p className="text-xs text-gray-400">{alert.mensagem}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
