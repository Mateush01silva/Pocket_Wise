import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
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

export function PeriodFilter({ value, onChange, className }: PeriodFilterProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [tempDataInicio, setTempDataInicio] = useState(format(value.dataInicio, 'yyyy-MM-dd'))
  const [tempDataFim, setTempDataFim] = useState(format(value.dataFim, 'yyyy-MM-dd'))

  const handleTipoChange = (tipo: PeriodFilterValue['tipo']) => {
    const hoje = new Date()

    switch (tipo) {
      case 'mes-atual':
        onChange({
          tipo,
          dataInicio: startOfMonth(hoje),
          dataFim: endOfMonth(hoje),
        })
        setShowCustom(false)
        break

      case 'mes-custom':
        setShowCustom(true)
        break

      case 'ano':
        onChange({
          tipo,
          dataInicio: startOfYear(hoje),
          dataFim: endOfYear(hoje),
        })
        setShowCustom(false)
        break

      case 'range-custom':
        setShowCustom(true)
        break
    }
  }

  const handleMesCustomChange = (mesAno: string) => {
    // mesAno format: "YYYY-MM"
    const [ano, mes] = mesAno.split('-').map(Number)
    const data = new Date(ano, mes - 1, 1)

    onChange({
      tipo: 'mes-custom',
      dataInicio: startOfMonth(data),
      dataFim: endOfMonth(data),
    })
  }

  const handleAnoChange = (ano: string) => {
    const anoNum = parseInt(ano)
    const data = new Date(anoNum, 0, 1)

    onChange({
      tipo: 'ano',
      dataInicio: startOfYear(data),
      dataFim: endOfYear(data),
    })
  }

  const handleCustomRangeApply = () => {
    onChange({
      tipo: 'range-custom',
      dataInicio: new Date(tempDataInicio),
      dataFim: new Date(tempDataFim),
    })
    setShowCustom(false)
  }

  const getDisplayLabel = () => {
    switch (value.tipo) {
      case 'mes-atual':
        return format(value.dataInicio, 'MMMM yyyy', { locale: ptBR })
      case 'mes-custom':
        return format(value.dataInicio, 'MMMM yyyy', { locale: ptBR })
      case 'ano':
        return format(value.dataInicio, 'yyyy')
      case 'range-custom':
        return `${format(value.dataInicio, 'dd/MM/yy')} - ${format(value.dataFim, 'dd/MM/yy')}`
    }
  }

  // Gerar últimos 12 meses para o select
  const mesesOptions = []
  for (let i = 0; i < 12; i++) {
    const mes = subMonths(new Date(), i)
    mesesOptions.push({
      value: format(mes, 'yyyy-MM'),
      label: format(mes, 'MMMM yyyy', { locale: ptBR }),
    })
  }

  // Gerar últimos 5 anos para o select
  const anosOptions = []
  const anoAtual = new Date().getFullYear()
  for (let i = 0; i < 5; i++) {
    const ano = anoAtual - i
    anosOptions.push({
      value: ano.toString(),
      label: ano.toString(),
    })
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Tipo de filtro */}
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-gray-400" />
        <Select
          value={value.tipo}
          onChange={(e) => handleTipoChange(e.target.value as PeriodFilterValue['tipo'])}
          className="flex-1"
        >
          <option value="mes-atual">Mês Atual</option>
          <option value="mes-custom">Escolher Mês</option>
          <option value="ano">Ano Inteiro</option>
          <option value="range-custom">Período Customizado</option>
        </Select>

        <div className="px-3 py-2 bg-dark-700 rounded-lg border border-dark-600 text-sm text-gray-300">
          {getDisplayLabel()}
        </div>
      </div>

      {/* Inputs customizados */}
      {showCustom && (
        <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-600 space-y-3 animate-in fade-in slide-in-from-top-2">
          {value.tipo === 'mes-custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Selecione o Mês</label>
              <Select
                value={format(value.dataInicio, 'yyyy-MM')}
                onChange={(e) => handleMesCustomChange(e.target.value)}
                className="w-full"
              >
                {mesesOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {value.tipo === 'ano' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Selecione o Ano</label>
              <Select
                value={format(value.dataInicio, 'yyyy')}
                onChange={(e) => handleAnoChange(e.target.value)}
                className="w-full"
              >
                {anosOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {value.tipo === 'range-custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Data Início</label>
                <Input
                  type="date"
                  value={tempDataInicio}
                  onChange={(e) => setTempDataInicio(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Data Fim</label>
                <Input
                  type="date"
                  value={tempDataFim}
                  onChange={(e) => setTempDataFim(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {value.tipo === 'range-custom' && (
            <Button onClick={handleCustomRangeApply} size="sm" className="w-full">
              Aplicar Período
            </Button>
          )}
        </div>
      )}

      {/* Atalhos rápidos */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              tipo: 'mes-custom',
              dataInicio: startOfMonth(subMonths(new Date(), 1)),
              dataFim: endOfMonth(subMonths(new Date(), 1)),
            })
          }
          className="text-xs"
        >
          Mês Passado
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              tipo: 'mes-custom',
              dataInicio: startOfMonth(subMonths(new Date(), 2)),
              dataFim: endOfMonth(subMonths(new Date(), 2)),
            })
          }
          className="text-xs"
        >
          2 Meses Atrás
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              tipo: 'ano',
              dataInicio: startOfYear(new Date()),
              dataFim: endOfYear(new Date()),
            })
          }
          className="text-xs"
        >
          Ano Completo
        </Button>
      </div>
    </div>
  )
}
