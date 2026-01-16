import { forwardRef, useState, useEffect } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string
  error?: string
  helperText?: string
  value?: number
  onChange?: (value: number) => void
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, label, error, helperText, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(() => {
      if (value === undefined || value === 0) return ''
      return formatCurrencyDisplay(value)
    })

    // Sincronizar displayValue quando o prop value mudar (necessário para edição)
    useEffect(() => {
      if (value === undefined || value === 0) {
        setDisplayValue('')
      } else {
        setDisplayValue(formatCurrencyDisplay(value))
      }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/\D/g, '')

      if (rawValue === '') {
        setDisplayValue('')
        onChange?.(0)
        return
      }

      const numericValue = parseInt(rawValue, 10) / 100
      setDisplayValue(formatCurrencyDisplay(numericValue))
      onChange?.(numericValue)
    }

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            R$
          </span>
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={handleChange}
            className={cn(
              'w-full pl-12 pr-4 py-2 bg-dark-800 border rounded-lg text-gray-100 placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:border-transparent transition-all',
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-dark-600 focus:ring-primary-500',
              className
            )}
            placeholder="0,00"
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-gray-400">{helperText}</p>}
      </div>
    )
  }
)

CurrencyInput.displayName = 'CurrencyInput'

function formatCurrencyDisplay(value: number): string {
  return value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export { CurrencyInput }
