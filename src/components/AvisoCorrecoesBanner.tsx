import { useState } from 'react'
import { Info, X, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Banner TEMPORÁRIO sobre as correções de consistência aplicadas em jun/2026
 * (faturas de cartões que vencem antes do fechamento, lançamentos duplicados
 * de assinaturas, categorias duplicadas e estornos no cartão).
 *
 * - Some sozinho após DATA_FIM (não precisa de novo deploy para sumir).
 * - O usuário pode dispensá-lo antes (persistido em localStorage).
 *
 * Este componente pode ser REMOVIDO do código após DATA_FIM.
 */

// ~30 dias após o deploy das correções
const DATA_FIM = new Date('2026-07-12T23:59:59')
const STORAGE_KEY = 'pw-aviso-correcoes-jun2026-dismissed'

export function AvisoCorrecoesBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1'
  )
  const [expanded, setExpanded] = useState(false)

  if (dismissed || new Date() > DATA_FIM) return null

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="mb-6 rounded-lg bg-blue-500/10 border border-blue-500/20 overflow-hidden">
      <div className="p-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-blue-200">
              <span className="font-medium">Melhoramos a precisão dos seus dados.</span>{' '}
              Após uma análise completa, corrigimos inconsistências em faturas de cartão,
              assinaturas e categorias. Nenhuma transação sua foi perdida — mas alguns números
              podem aparecer em lugares diferentes.
            </p>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors min-h-[32px]"
            >
              {expanded ? 'Ocultar detalhes' : 'Ver o que mudou'}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-2 rounded-lg text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10 transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
          title="Dispensar aviso"
          aria-label="Dispensar aviso"
        >
          <X size={16} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 sm:px-11">
          <ul className="space-y-2 text-xs text-blue-200/90 leading-relaxed">
            <li>
              <span className="font-medium text-blue-200">Faturas de cartão:</span> em cartões
              cujo vencimento acontece antes do fechamento (ex.: fecha dia 25, vence dia 5), as
              compras ainda não pagas foram movidas para a fatura do mês correto. Você pode notar
              compras que "mudaram" da fatura de um mês para o seguinte — agora elas refletem o
              ciclo real do banco.
            </li>
            <li>
              <span className="font-medium text-blue-200">Assinaturas:</span> lançamentos
              duplicados de uma mesma assinatura no mesmo mês foram removidos. Se algum duplicado
              já tinha sido pago, o saldo da conta foi ajustado automaticamente.
            </li>
            <li>
              <span className="font-medium text-blue-200">Categorias:</span> categorias que
              existiam em duplicidade foram unificadas. Todas as transações e orçamentos foram
              preservados e apontam para a categoria correta.
            </li>
            <li>
              <span className="font-medium text-blue-200">Estornos no cartão:</span> receitas
              lançadas no cartão de crédito (estorno/cashback) agora <em>abatem</em> o total da
              fatura, em vez de somar.
            </li>
          </ul>
          <p className="mt-3 text-xs text-blue-300/70">
            Notou algo que não bate? Fale com a gente pelo Suporte — temos o histórico completo
            das correções.
          </p>
        </div>
      )}
    </div>
  )
}
