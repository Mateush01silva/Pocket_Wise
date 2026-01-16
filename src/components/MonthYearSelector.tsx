import { format, setMonth, setYear, startOfMonth } from 'date-fns'

interface MonthYearSelectorProps {
  value: string // formato: 'yyyy-MM-dd'
  onChange: (newDate: string) => void
  hasData?: boolean // se tem orçamento para este mês
}

const MONTHS = [
  { value: 0, label: 'Janeiro' },
  { value: 1, label: 'Fevereiro' },
  { value: 2, label: 'Março' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Maio' },
  { value: 5, label: 'Junho' },
  { value: 6, label: 'Julho' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Setembro' },
  { value: 9, label: 'Outubro' },
  { value: 10, label: 'Novembro' },
  { value: 11, label: 'Dezembro' },
]

// Gerar últimos 3 anos e próximos 2 anos
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i)

export function MonthYearSelector({ value, onChange, hasData }: MonthYearSelectorProps) {
  const currentDate = new Date(value)
  const currentMonth = currentDate.getMonth()
  const currentYearValue = currentDate.getFullYear()

  const handleMonthChange = (newMonth: number) => {
    // Construir data explicitamente para evitar problemas de timezone
    const newDate = new Date(currentYearValue, newMonth, 1)
    const newValue = format(startOfMonth(newDate), 'yyyy-MM-dd')
    console.log('📅 MonthYearSelector - Mudança de MÊS:', {
      valorAntigo: value,
      mesNovo: newMonth,
      anoAtual: currentYearValue,
      valorNovo: newValue
    })
    onChange(newValue)
  }

  const handleYearChange = (newYear: number) => {
    // Construir data explicitamente para evitar problemas de timezone
    const newDate = new Date(newYear, currentMonth, 1)
    const newValue = format(startOfMonth(newDate), 'yyyy-MM-dd')
    console.log('📅 MonthYearSelector - Mudança de ANO:', {
      valorAntigo: value,
      anoNovo: newYear,
      mesAtual: currentMonth,
      valorNovo: newValue
    })
    onChange(newValue)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Month Dropdown */}
      <select
        value={currentMonth}
        onChange={(e) => handleMonthChange(Number(e.target.value))}
        className="px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      >
        {MONTHS.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </select>

      {/* Year Dropdown */}
      <select
        value={currentYearValue}
        onChange={(e) => handleYearChange(Number(e.target.value))}
        className="px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      >
        {YEARS.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      {/* Indicator if has data */}
      {hasData && (
        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium border border-green-500/30">
          ✓
        </span>
      )}
    </div>
  )
}
