import { useState } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  // Tags já usadas em outros lançamentos, sugeridas ao digitar
  suggestions?: string[]
  label?: string
  helperText?: string
}

const normalizar = (t: string) => t.trim().replace(/\s+/g, ' ').slice(0, 40)

export function TagInput({ value, onChange, suggestions = [], label, helperText }: TagInputProps) {
  const [texto, setTexto] = useState('')

  const adicionar = (raw: string) => {
    const tag = normalizar(raw)
    if (!tag) return
    // Evita duplicar ignorando maiúsculas/minúsculas
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setTexto('')
      return
    }
    onChange([...value, tag])
    setTexto('')
  }

  const disponiveis = suggestions.filter(
    (s) =>
      !value.some((t) => t.toLowerCase() === s.toLowerCase()) &&
      (!texto || s.toLowerCase().includes(texto.toLowerCase()))
  )

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg focus-within:ring-2 focus-within:ring-primary-500">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-300 text-xs"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remover tag ${tag}`}
              className="hover:text-white"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault() // Enter não deve enviar o formulário
              adicionar(texto)
            } else if (e.key === 'Backspace' && !texto && value.length > 0) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => adicionar(texto)}
          placeholder={value.length === 0 ? 'Ex.: Viagem Europa 2026' : 'Nova tag...'}
          className="flex-1 min-w-[8rem] bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none text-sm"
        />
      </div>
      {disponiveis.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">Tags já cadastradas (clique para usar):</p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {disponiveis.map((s) => (
            <button
              key={s}
              type="button"
              // mouseDown evita o onBlur do input criar uma tag com o texto parcial
              onMouseDown={(e) => {
                e.preventDefault()
                adicionar(s)
              }}
              className="px-2 py-0.5 rounded-full border border-dark-600 text-xs text-gray-400 hover:border-primary-500 hover:text-primary-300"
            >
              #{s}
            </button>
          ))}
          </div>
        </div>
      )}
      {helperText && <p className="mt-1 text-sm text-gray-400">{helperText}</p>}
    </div>
  )
}
