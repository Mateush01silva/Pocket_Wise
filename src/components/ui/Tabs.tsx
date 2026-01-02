import type { ReactNode } from 'react'

export interface TabItem {
  value: string
  label: string
  icon?: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function Tabs({ items, value, onChange, className = '' }: TabsProps) {
  return (
    <div className={`border-b border-dark-700 ${className}`}>
      <div className="flex gap-1">
        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              value === item.value
                ? 'text-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </div>
            {value === item.value && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
