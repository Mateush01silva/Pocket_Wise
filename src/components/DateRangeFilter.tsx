import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Calendar, ChevronDown } from 'lucide-react'
import { Button } from './ui'
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

export type DateRangePreset =
  | 'current_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_12_months'
  | 'current_year'
  | 'custom'

export interface DateRange {
  startDate: Date
  endDate: Date
  preset: DateRangePreset
}

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

const STORAGE_KEY = 'pocketwise_date_range_filter'

const presets: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'current_month', label: 'Mês Atual' },
  { value: 'last_7_days', label: 'Últimos 7 dias' },
  { value: 'last_30_days', label: 'Últimos 30 dias' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
  { value: 'last_6_months', label: 'Últimos 6 meses' },
  { value: 'last_12_months', label: 'Últimos 12 meses' },
  { value: 'current_year', label: 'Ano Atual' },
  { value: 'custom', label: 'Período Customizado' },
]

export function getDateRangeFromPreset(preset: DateRangePreset): { startDate: Date; endDate: Date } {
  const today = new Date()

  switch (preset) {
    case 'current_month':
      return {
        startDate: startOfMonth(today),
        endDate: endOfMonth(today)
      }

    case 'last_7_days':
      return {
        startDate: subDays(today, 7),
        endDate: today
      }

    case 'last_30_days':
      return {
        startDate: subDays(today, 30),
        endDate: today
      }

    case 'last_3_months':
      return {
        startDate: startOfMonth(subMonths(today, 3)),
        endDate: endOfMonth(today)
      }

    case 'last_6_months':
      return {
        startDate: startOfMonth(subMonths(today, 6)),
        endDate: endOfMonth(today)
      }

    case 'last_12_months':
      return {
        startDate: startOfMonth(subMonths(today, 12)),
        endDate: endOfMonth(today)
      }

    case 'current_year':
      return {
        startDate: startOfYear(today),
        endDate: endOfYear(today)
      }

    case 'custom':
    default:
      return {
        startDate: startOfMonth(today),
        endDate: endOfMonth(today)
      }
  }
}

export function getDefaultDateRange(): DateRange {
  // Try to load from localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const startDate = new Date(parsed.startDate)
        const endDate = new Date(parsed.endDate)

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid dates in stored range')
        }

        return {
          startDate,
          endDate,
          preset: parsed.preset as DateRangePreset
        }
      }
    }
  } catch (error) {
    console.error('Error loading date range from localStorage:', error)
  }

  // Default: current month
  const { startDate, endDate } = getDateRangeFromPreset('current_month')
  return { startDate, endDate, preset: 'current_month' }
}

export function saveDateRangeToStorage(range: DateRange) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      preset: range.preset
    }))
  } catch (error) {
    console.error('Error saving date range to localStorage:', error)
  }
}

export function DateRangeFilter({ value, onChange, className = '' }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  useEffect(() => {
    // Initialize custom dates if preset is custom
    if (value.preset === 'custom') {
      setCustomStartDate(format(value.startDate, 'yyyy-MM-dd'))
      setCustomEndDate(format(value.endDate, 'yyyy-MM-dd'))
    }
  }, [value])

  const handlePresetChange = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      // Just set the preset, user will input dates
      setIsOpen(true)
      return
    }

    const { startDate, endDate } = getDateRangeFromPreset(preset)
    const newRange: DateRange = { startDate, endDate, preset }

    onChange(newRange)
    saveDateRangeToStorage(newRange)
    setIsOpen(false)
  }

  const handleCustomDateApply = () => {
    if (!customStartDate || !customEndDate) {
      toast.error('Por favor, preencha ambas as datas')
      return
    }

    const startDate = new Date(customStartDate)
    const endDate = new Date(customEndDate)

    if (startDate > endDate) {
      toast.error('A data inicial não pode ser maior que a data final')
      return
    }

    const newRange: DateRange = { startDate, endDate, preset: 'custom' }
    onChange(newRange)
    saveDateRangeToStorage(newRange)
    setIsOpen(false)
  }

  const getCurrentLabel = () => {
    try {
      const preset = presets.find(p => p.value === value.preset)

      if (value.preset === 'custom' && value.startDate && value.endDate) {
        return `${format(value.startDate, 'dd/MM/yy')} - ${format(value.endDate, 'dd/MM/yy')}`
      }

      return preset?.label || 'Selecione um período'
    } catch (error) {
      console.error('Error getting label:', error)
      return 'Erro ao carregar período'
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <Button
        variant="secondary"
        size="md"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 min-w-[220px] justify-between"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-medium">{getCurrentLabel()}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Presets */}
            <div className="p-2">
              <p className="text-xs font-semibold text-gray-400 px-2 py-2">Períodos Pré-definidos</p>
              {presets.filter(p => p.value !== 'custom').map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetChange(preset.value)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    value.preset === preset.value
                      ? 'bg-primary-500/20 text-primary-400 font-medium'
                      : 'text-gray-300 hover:bg-dark-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Range */}
            <div className="border-t border-dark-700 p-4">
              <p className="text-xs font-semibold text-gray-400 mb-3">Período Customizado</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-md text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Data Final</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-md text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                </div>
                <Button
                  onClick={handleCustomDateApply}
                  size="sm"
                  className="w-full"
                  disabled={!customStartDate || !customEndDate}
                >
                  Aplicar Período
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
