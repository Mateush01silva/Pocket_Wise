import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options?: { value: string; label: string }[]
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full px-4 py-2 bg-dark-800 border rounded-lg text-gray-100',
            'focus:outline-none focus:ring-2 focus:border-transparent transition-all',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-dark-600 focus:ring-primary-500',
            className
          )}
          {...props}
        >
          {!props.children && <option value="">Selecione...</option>}
          {options && options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {props.children}
        </select>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-gray-400">{helperText}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export { Select }
