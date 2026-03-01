import { useState, useMemo } from 'react'
import { Modal } from './ui/Modal'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '../utils/currency'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { Lancamento, Categoria } from '../types'

const COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16',
]

interface GastoItem {
  categoria_id: string
  nome: string
  total: number
  cor: string
  percentual: number
}

interface SubcatItem {
  subcategoria_id: string
  nome: string
  total: number
  cor: string
  percentual: number
}

interface GastosCategoriaModalProps {
  isOpen: boolean
  onClose: () => void
  gastosPorCategoria: GastoItem[]
  totalDespesas: number
  despesasMes: Lancamento[]
  categorias: Categoria[]
  titulo: string
}

// Donut reutilizável — prefix garante IDs de gradiente únicos por instância
function DonutChart({
  data,
  total,
  size,
  gradientPrefix,
}: {
  data: Array<{ nome: string; total: number; cor: string; percentual: number }>
  total: number
  size: number
  gradientPrefix: string
}) {
  const innerR = Math.round(size * 0.27)
  const outerR = Math.round(size * 0.45)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {data.map((entry, i) => {
              const color = entry.cor || COLORS[i % COLORS.length]
              return (
                <linearGradient key={i} id={`${gradientPrefix}-${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                </linearGradient>
              )
            })}
          </defs>
          <Pie
            data={data}
            dataKey="total"
            nameKey="nome"
            cx="50%"
            cy="50%"
            innerRadius={innerR}
            outerRadius={outerR}
            paddingAngle={3}
            cornerRadius={5}
            stroke="none"
          >
            {data.map((_e, i) => (
              <Cell key={i} fill={`url(#${gradientPrefix}-${i})`} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | undefined, _name: any, props: any) => {
              const pct = props?.payload?.percentual
              return value ? `${formatCurrency(value)} (${pct?.toFixed(1)}%)` : 'R$ 0,00'
            }}
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F3F4F6',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-xs text-gray-500">Total</p>
        <p className="text-sm font-bold text-gray-100">{formatCurrency(total)}</p>
      </div>
    </div>
  )
}

export function GastosCategoriaModal({
  isOpen,
  onClose,
  gastosPorCategoria,
  totalDespesas,
  despesasMes,
  categorias,
  titulo,
}: GastosCategoriaModalProps) {
  const [selectedCategoria, setSelectedCategoria] = useState<GastoItem | null>(null)

  // Agrupamento por subcategoria da categoria selecionada
  const subcatData = useMemo((): SubcatItem[] => {
    if (!selectedCategoria) return []

    const filtered = despesasMes.filter(l => l.categoria_id === selectedCategoria.categoria_id)
    const grouped: Record<string, SubcatItem> = {}

    filtered.forEach(l => {
      const subcatId = l.subcategoria_id ?? 'sem-subcategoria'
      const subcat = categorias.find(c => c.id === subcatId)
      const nome = subcat?.nome ?? 'Sem subcategoria'
      const cor = subcat?.cor ?? '#6B7280'
      if (!grouped[subcatId]) grouped[subcatId] = { subcategoria_id: subcatId, nome, total: 0, cor, percentual: 0 }
      grouped[subcatId].total += l.valor
    })

    const items = Object.values(grouped).sort((a, b) => b.total - a.total)
    const total = items.reduce((s, i) => s + i.total, 0)
    return items.map(i => ({ ...i, percentual: total > 0 ? (i.total / total) * 100 : 0 }))
  }, [selectedCategoria, despesasMes, categorias])

  const hasRealSubcats = subcatData.some(s => s.subcategoria_id !== 'sem-subcategoria')

  const handleClose = () => {
    setSelectedCategoria(null)
    onClose()
  }

  // ── Vista principal: todas as categorias ──────────────────────────────────
  const MainView = () => (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
      {/* Donut grande */}
      <DonutChart
        data={gastosPorCategoria}
        total={totalDespesas}
        size={280}
        gradientPrefix="cat"
      />

      {/* Legenda clicável */}
      <div className="flex-1 w-full space-y-1">
        <p className="text-xs text-gray-500 mb-3">
          Clique em uma categoria para ver o detalhamento por subcategoria
        </p>
        {gastosPorCategoria.map((entry, index) => (
          <button
            key={entry.categoria_id}
            onClick={() => setSelectedCategoria(entry)}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-dark-700/50 transition-colors text-left group"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: entry.cor || COLORS[index % COLORS.length] }}
            />
            <span className="flex-1 text-sm text-gray-300 group-hover:text-gray-100 truncate transition-colors">
              {entry.nome}
            </span>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-gray-200">{formatCurrency(entry.total)}</p>
              <p className="text-xs text-gray-500">{entry.percentual.toFixed(1)}%</p>
            </div>
            <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )

  // ── Vista de drill-down: categoria selecionada + subcategorias ─────────────
  const DrillDownView = ({ cat }: { cat: GastoItem }) => (
    <div className="space-y-4">
      <button
        onClick={() => setSelectedCategoria(null)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <ArrowLeft size={15} />
        Voltar para todas as categorias
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Esquerda: lista de categorias com selecionada destacada */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Por Categoria</h3>
          <div className="flex justify-center">
            <DonutChart
              data={gastosPorCategoria}
              total={totalDespesas}
              size={220}
              gradientPrefix="catDrill"
            />
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {gastosPorCategoria.map((entry, index) => (
              <button
                key={entry.categoria_id}
                onClick={() => setSelectedCategoria(entry)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                  entry.categoria_id === cat.categoria_id
                    ? 'bg-dark-700 ring-1 ring-dark-500'
                    : 'hover:bg-dark-700/30 opacity-50 hover:opacity-80'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.cor || COLORS[index % COLORS.length] }}
                />
                <span className="flex-1 text-sm text-gray-300 truncate">{entry.nome}</span>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-200">{formatCurrency(entry.total)}</p>
                  <p className="text-xs text-gray-500">{entry.percentual.toFixed(1)}%</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Direita: subcategorias */}
        <div className="space-y-4 md:border-l md:border-dark-700/50 md:pl-8">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Subcategorias de {cat.nome}
          </h3>

          {hasRealSubcats ? (
            <>
              <div className="flex justify-center">
                <DonutChart
                  data={subcatData}
                  total={cat.total}
                  size={220}
                  gradientPrefix="sub"
                />
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {subcatData.map((sub, index) => (
                  <div
                    key={sub.subcategoria_id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-700/30 transition-colors"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: sub.cor || COLORS[index % COLORS.length] }}
                    />
                    <span className="flex-1 text-sm text-gray-300 truncate">{sub.nome}</span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-200">{formatCurrency(sub.total)}</p>
                      <p className="text-xs text-gray-500">{sub.percentual.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <p className="text-sm">Nenhuma subcategoria encontrada</p>
              <p className="text-xs text-gray-600 mt-1">
                As transações desta categoria não foram classificadas em subcategorias
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={titulo}
      description={
        selectedCategoria
          ? `${selectedCategoria.nome} · ${formatCurrency(selectedCategoria.total)}`
          : `${gastosPorCategoria.length} categorias · ${formatCurrency(totalDespesas)} total`
      }
      maxWidth="5xl"
    >
      {selectedCategoria ? <DrillDownView cat={selectedCategoria} /> : <MainView />}
    </Modal>
  )
}
