import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  subMonths,
  subDays,
  startOfDay,
  endOfDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { cn } from '../lib/cn'

export interface PeriodFilterValue {
  tipo: 'mes-atual' | 'mes-custom' | 'ano' | 'range-custom'
  dataInicio: Date
  dataFim: Date
}

interface PeriodFilterProps {
  value: PeriodFilterValue
  onChange: (value: PeriodFilterValue) => void
  className?: string
}

// Definir os filtros rápidos disponíveis
type QuickFilter =
  | 'hoje'
  | 'esta-semana'
  | 'este-mes'
  | 'mes-passado'
  | 'ultimos-30'
  | 'ultimos-90'
  | 'este-ano'
  | 'personalizado'

interface QuickFilterOption {
  id: QuickFilter
  label: string
  getDateRange: () => { dataInicio: Date; dataFim: Date }
}

const quickFilters: QuickFilterOption[] = [
  {
    id: 'hoje',
    label: 'Hoje',
    getDateRange: () => ({
      dataInicio: startOfDay(new Date()),
      dataFim: endOfDay(new Date()),
    }),
  },
  {
    id: 'esta-semana',
    label: 'Esta semana',
    getDateRange: () => ({
      dataInicio: startOfWeek(new Date(), { locale: ptBR }),
      dataFim: endOfWeek(new Date(), { locale: ptBR }),
    }),
  },
  {
    id: 'este-mes',
    label: 'Este mês',
    getDateRange: () => ({
      dataInicio: startOfMonth(new Date()),
      dataFim: endOfMonth(new Date()),
    }),
  },
  {
    id: 'mes-passado',
    label: 'Mês passado',
    getDateRange: () => ({
      dataInicio: startOfMonth(subMonths(new Date(), 1)),
      dataFim: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    id: 'ultimos-30',
    label: 'Últimos 30 dias',
    getDateRange: () => ({
      dataInicio: subDays(new Date(), 30),
      dataFim: new Date(),
    }),
  },
  {
    id: 'ultimos-90',
    label: 'Últimos 90 dias',
    getDateRange: () => ({
      dataInicio: subDays(new Date(), 90),
      dataFim: new Date(),
    }),
  },
  {
    id: 'este-ano',
    label: 'Este ano',
    getDateRange: () => ({
      dataInicio: startOfYear(new Date()),
      dataFim: endOfYear(new Date()),
    }),
  },
  {
    id: 'personalizado',
    label: 'Personalizado',
    getDateRange: () => ({
      dataInicio: startOfMonth(new Date()),
      dataFim: endOfMonth(new Date()),
    }),
  },
]

export function PeriodFilter({ value, onChange, className }: PeriodFilterProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [tempDataInicio, setTempDataInicio] = useState(format(value.dataInicio, 'yyyy-MM-dd'))
  const [tempDataFim, setTempDataFim] = useState(format(value.dataFim, 'yyyy-MM-dd'))

  // Determinar qual filtro rápido está ativo baseado nas datas
  const getActiveFilter = (): QuickFilter => {
    // Verificar se é personalizado (não corresponde a nenhum filtro rápido)
    if (value.tipo === 'range-custom') {
      return 'personalizado'
    }

    // Verificar cada filtro rápido
    for (const filter of quickFilters) {
      if (filter.id === 'personalizado') continue

      const range = filter.getDateRange()
      const inicioMatch =
        format(value.dataInicio, 'yyyy-MM-dd') === format(range.dataInicio, 'yyyy-MM-dd')
      const fimMatch = format(value.dataFim, 'yyyy-MM-dd') === format(range.dataFim, 'yyyy-MM-dd')

      if (inicioMatch && fimMatch) {
        return filter.id
      }
    }

    // Se não encontrou, é este-mes por padrão
    return 'este-mes'
  }

  const activeFilter = getActiveFilter()

  const handleQuickFilterClick = (filterId: QuickFilter) => {
    if (filterId === 'personalizado') {
      setShowCustom(!showCustom)
      return
    }

    const filter = quickFilters.find((f) => f.id === filterId)
    if (!filter) return

    const range = filter.getDateRange()

    onChange({
      tipo: 'mes-atual', // Não importa muito, mas mantenho compatibilidade
      dataInicio: range.dataInicio,
      dataFim: range.dataFim,
    })

    setShowCustom(false)
  }

  const handleCustomRangeApply = () => {
    // Validar se as datas são válidas
    const dataInicio = new Date(tempDataInicio)
    const dataFim = new Date(tempDataFim)

    // Verificar se as datas são válidas (não NaN)
    if (isNaN(dataInicio.getTime())) {
      alert('Data de início inválida. Por favor, selecione uma data válida.')
      return
    }
    if (isNaN(dataFim.getTime())) {
      alert('Data de fim inválida. Por favor, selecione uma data válida.')
      return
    }

    // Verificar se a data de início não é maior que a de fim
    if (dataInicio > dataFim) {
      alert('A data de início não pode ser maior que a data de fim.')
      return
    }

    onChange({
      tipo: 'range-custom',
      dataInicio,
      dataFim,
    })
    setShowCustom(false)
  }

  const getDisplayPeriod = () => {
    try {
      // Verificar se as datas são válidas
      if (!value.dataInicio || !value.dataFim ||
          isNaN(value.dataInicio.getTime()) || isNaN(value.dataFim.getTime())) {
        return 'Período inválido'
      }
      const inicio = format(value.dataInicio, 'dd MMM', { locale: ptBR })
      const fim = format(value.dataFim, 'dd MMM yyyy', { locale: ptBR })
      return `${inicio} - ${fim}`
    } catch {
      return 'Período inválido'
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header com período atual */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-400" />
          <span className="text-sm font-medium text-gray-300">Período</span>
        </div>
        <div className="px-3 py-1.5 bg-dark-700 rounded-lg border border-dark-600 text-sm text-gray-300">
          {getDisplayPeriod()}
        </div>
      </div>

      {/* Filtros rápidos em chips */}
      <div className="flex flex-wrap gap-2">
        {quickFilters.map((filter) => {
          const isActive = activeFilter === filter.id
          const isPersonalizado = filter.id === 'personalizado'

          return (
            <button
              key={filter.id}
              onClick={() => handleQuickFilterClick(filter.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                'border border-dark-600 hover:border-primary-500/50',
                'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                isActive
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-dark-700 text-gray-300 hover:bg-dark-600',
                isPersonalizado && showCustom && 'bg-primary-500/20 border-primary-500'
              )}
            >
              <span className="flex items-center gap-1.5">
                {filter.label}
                {isPersonalizado && (
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 transition-transform',
                      showCustom && 'rotate-180'
                    )}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Período customizado */}
      {showCustom && (
        <div className="p-4 bg-dark-700/50 rounded-lg border border-primary-500/30 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Data de Início
              </label>
              <Input
                type="date"
                value={tempDataInicio}
                onChange={(e) => setTempDataInicio(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Data de Fim</label>
              <Input
                type="date"
                value={tempDataFim}
                onChange={(e) => setTempDataFim(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCustomRangeApply} size="sm" className="flex-1">
              Aplicar Período
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustom(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Info do filtro ativo */}
      {activeFilter !== 'personalizado' && (
        <div className="text-xs text-gray-400">
          Mostrando:{' '}
          <span className="text-primary-400 font-medium">
            {quickFilters.find((f) => f.id === activeFilter)?.label}
          </span>
        </div>
      )}
    </div>
  )
}
