import { useRef, useState, useCallback, useEffect } from 'react'
import { X, Upload, FileText, AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Loader2, LayoutPanelLeft, TableIcon, Lock, Clock, RotateCcw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '../utils/currency'
import { Button } from './ui/Button'
import { useVerificarFatura, isExcelFile } from '../hooks/useVerificarFatura'
import { DiscrepanciasSplitView } from './DiscrepanciasSplitView'
import type { Lancamento } from '../types'
import type { ResultadoVerificacao } from '../hooks/useVerificarFatura'

interface VerificarFaturaModalProps {
  isOpen: boolean
  onClose: () => void
  cartaoNome: string
  cartaoCor: string
  transacoes: Lancamento[]
  totalFatura: number
  periodo: string
  getCategoryName: (categoriaId: string | null) => string
}

export function VerificarFaturaModal({
  isOpen,
  onClose,
  cartaoNome,
  cartaoCor,
  transacoes,
  totalFatura,
  periodo,
  getCategoryName,
}: VerificarFaturaModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [splitViewOpen, setSplitViewOpen] = useState(false)
  const [senha, setSenha] = useState('')
  const [mostrarNovaAnalise, setMostrarNovaAnalise] = useState(false)
  const [resultadoSalvo, setResultadoSalvo] = useState<{
    resultado: ResultadoVerificacao
    timestamp: string
    totalApp: number
  } | null>(null)
  const { isExtraindo, isAnalisando, resultado, error, verificar, limpar } = useVerificarFatura()

  const isLoading = isExtraindo || isAnalisando
  const isExcel = arquivoSelecionado ? isExcelFile(arquivoSelecionado) : false
  const storageKey = `pw_vf_${cartaoNome}_${periodo}`

  // Displayed result: fresh result takes priority, then saved, then null
  const resultadoExibir = resultado ?? (mostrarNovaAnalise ? null : resultadoSalvo?.resultado ?? null)
  const isResultadoSalvo = !resultado && !mostrarNovaAnalise && resultadoSalvo != null

  // Load saved result when modal opens
  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setResultadoSalvo(JSON.parse(raw))
    } catch {
      setResultadoSalvo(null)
    }
  }, [isOpen, storageKey])

  // Persist new result to localStorage
  useEffect(() => {
    if (!resultado) return
    const entry = { resultado, timestamp: new Date().toISOString(), totalApp: totalFatura }
    try { localStorage.setItem(storageKey, JSON.stringify(entry)) } catch { /* storage full */ }
    setResultadoSalvo(entry)
  }, [resultado, storageKey, totalFatura])

  const handleClose = useCallback(() => {
    if (!isLoading) {
      setArquivoSelecionado(null)
      setSenha('')
      setMostrarNovaAnalise(false)
      limpar()
      onClose()
    }
  }, [isLoading, limpar, onClose])

  const handleNovaAnalise = useCallback(() => {
    setArquivoSelecionado(null)
    setSenha('')
    setMostrarNovaAnalise(true)
    limpar()
  }, [limpar])

  const handleArquivo = useCallback((file: File) => {
    const name = file.name.toLowerCase()
    const valid = file.type === 'application/pdf' || name.endsWith('.xlsx') || name.endsWith('.xls')
    if (!valid) return
    setArquivoSelecionado(file)
    setSenha('')
    limpar()
  }, [limpar])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleArquivo(file)
  }, [handleArquivo])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleArquivo(file)
  }, [handleArquivo])

  const handleAnalisar = useCallback(async () => {
    if (!arquivoSelecionado) return
    await verificar({
      arquivo: arquivoSelecionado,
      senha: senha || undefined,
      transacoes,
      totalFatura,
      cartaoNome,
      periodo,
      getCategoryName,
    })
  }, [arquivoSelecionado, senha, verificar, transacoes, totalFatura, cartaoNome, periodo, getCategoryName])

  if (!isOpen) return null

  const loadingLabel = isExtraindo
    ? (isExcel ? 'Lendo arquivo Excel...' : 'Extraindo texto do PDF...')
    : 'Analisando com IA...'
  const loadingSubLabel = isExtraindo
    ? (isExcel ? 'Processando planilha localmente' : 'Lendo as páginas do PDF')
    : 'Comparando com seus lançamentos'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[60] sm:p-4">
      <div className="bg-dark-800 shadow-xl sm:max-w-2xl w-full max-h-[100dvh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-lg">

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-dark-700 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-100 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cartaoCor }} />
              <span className="truncate">Verificar Fatura — {cartaoNome}</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {periodo} · Total no app: {formatCurrency(totalFatura)}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 hover:bg-dark-700 rounded-full transition-colors text-gray-400 hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 min-h-0 space-y-4">

          {/* Upload area */}
          {!resultadoExibir && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Anexe a fatura do seu banco para verificar se os lançamentos no app conferem com os reais.
              </p>

              {/* Format hint */}
              <div className="flex gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-gray-500 bg-dark-700/50 px-2 py-1 rounded-md">
                  <FileText size={11} /> PDF · 1 crédito de IA
                </span>
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">
                  <TableIcon size={11} /> Excel · 1 crédito · maior precisão
                </span>
              </div>

              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => !isLoading && inputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors select-none ${
                  isLoading
                    ? 'border-dark-600 opacity-50 cursor-not-allowed'
                    : isDragOver
                    ? 'border-primary-400 bg-primary-500/10'
                    : arquivoSelecionado
                    ? isExcel
                      ? 'border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10'
                      : 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10'
                    : 'border-dark-600 hover:border-dark-500 hover:bg-dark-700/30'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.xlsx,.xls"
                  className="hidden"
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
                {arquivoSelecionado ? (
                  <>
                    {isExcel
                      ? <TableIcon size={32} className="mx-auto mb-2 text-emerald-400" />
                      : <FileText size={32} className="mx-auto mb-2 text-green-400" />
                    }
                    <p className={`text-sm font-medium truncate px-4 ${isExcel ? 'text-emerald-400' : 'text-green-400'}`}>
                      {arquivoSelecionado.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(arquivoSelecionado.size / 1024).toFixed(0)} KB · Clique para trocar
                    </p>
                    {isExcel && (
                      <p className="text-xs text-emerald-500 mt-1">
                        Sem OCR — maior precisão na extração
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto mb-2 text-gray-500" />
                    <p className="text-sm font-medium text-gray-300">Arraste o arquivo aqui ou clique para selecionar</p>
                    <p className="text-xs text-gray-500 mt-1">PDF ou Excel (.xlsx / .xls)</p>
                  </>
                )}
              </div>

              {/* Password field + instructions (Excel only) */}
              {isExcel && arquivoSelecionado && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-dark-700/40 rounded-xl border border-dark-600">
                    <Lock size={15} className="text-gray-500 shrink-0" />
                    <input
                      type="password"
                      placeholder="Senha do arquivo (se houver)"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      disabled={isLoading}
                      className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
                    />
                  </div>
                  {/* Proactive instructions for password-protected files */}
                  <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Lock size={12} className="text-amber-400 shrink-0" />
                      <p className="text-xs font-medium text-amber-400">Arquivo com senha? Siga estes passos antes de enviar:</p>
                    </div>
                    <ol className="text-xs text-gray-400 space-y-1 list-none pl-1">
                      <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">1.</span>Abra o Excel normalmente (com a senha)</li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">2.</span>Clique com o botão direito na aba de lançamentos → <strong>Mover ou Copiar</strong></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">3.</span>Selecione <strong>Nova pasta de trabalho</strong> e marque <strong>Criar uma cópia</strong></li>
                      <li className="flex gap-2"><span className="text-amber-500 font-bold shrink-0">4.</span>Salve o novo arquivo como .xlsx <strong>sem senha</strong> e envie aqui</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center gap-3 p-4 bg-dark-700/50 rounded-xl">
                  <Loader2 size={20} className="text-primary-400 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-200">{loadingLabel}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{loadingSubLabel}</p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && error !== 'EXCEL_PASSWORD_PROTECTED' && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Saved result badge */}
          {isResultadoSalvo && resultadoSalvo && (
            <div className="flex items-center gap-2 px-3 py-2 bg-dark-700/40 border border-dark-600 rounded-xl">
              <Clock size={13} className="text-gray-500 shrink-0" />
              <p className="text-xs text-gray-500 flex-1">
                Resultado salvo em{' '}
                {format(parseISO(resultadoSalvo.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <button
                onClick={handleNovaAnalise}
                className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                <RotateCcw size={11} />
                Nova análise
              </button>
            </div>
          )}

          {/* Results */}
          {resultadoExibir && (
            <ResultadoView
              resultado={resultadoExibir}
              totalApp={isResultadoSalvo && resultadoSalvo ? resultadoSalvo.totalApp : totalFatura}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 border-t border-dark-700 bg-dark-800/50 shrink-0">
          {resultadoExibir ? (
            <div className="flex flex-col gap-2">
              {(resultadoExibir.no_pdf_nao_no_app.length > 0 || resultadoExibir.no_app_nao_no_pdf.length > 0 || resultadoExibir.valores_divergentes.length > 0) && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setSplitViewOpen(true)}
                  className="w-full"
                >
                  <LayoutPanelLeft size={16} className="mr-2" />
                  Lançar Discrepâncias
                </Button>
              )}
              <div className="flex gap-3">
                {isResultadoSalvo ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNovaAnalise}
                    className="flex-1"
                  >
                    <RotateCcw size={14} className="mr-1" />
                    Nova análise
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNovaAnalise}
                    className="flex-1"
                  >
                    Analisar outro arquivo
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleClose} className="flex-1">
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={handleAnalisar}
              disabled={!arquivoSelecionado || isLoading}
              isLoading={isLoading}
              className="w-full"
            >
              {isLoading
                ? loadingLabel
                : isExcel
                  ? 'Analisar Fatura (Excel)'
                  : 'Analisar Fatura (PDF)'
              }
            </Button>
          )}
        </div>
      </div>

      {resultadoExibir && (
        <DiscrepanciasSplitView
          isOpen={splitViewOpen}
          onClose={() => setSplitViewOpen(false)}
          cartaoNome={cartaoNome}
          cartaoCor={cartaoCor}
          resultado={resultadoExibir}
        />
      )}
    </div>
  )
}

// ============================================================================
// RESULTADO VIEW
// ============================================================================

function ResultadoView({ resultado, totalApp }: { resultado: ResultadoVerificacao; totalApp: number }) {
  const temDivergencias =
    resultado.no_pdf_nao_no_app.length > 0 ||
    resultado.no_app_nao_no_pdf.length > 0 ||
    resultado.valores_divergentes.length > 0

  const diferencaValor = resultado.diferenca_total
  const diferencaPositiva = diferencaValor !== null && diferencaValor > 0.01
  const diferencaNegativa = diferencaValor !== null && diferencaValor < -0.01

  return (
    <div className="space-y-4">
      {/* Totais */}
      <div className={`p-4 rounded-xl border ${
        !temDivergencias
          ? 'bg-green-500/10 border-green-500/20'
          : 'bg-yellow-500/10 border-yellow-500/20'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          {temDivergencias
            ? <AlertTriangle size={18} className="text-yellow-400 shrink-0" />
            : <CheckCircle size={18} className="text-green-400 shrink-0" />
          }
          <span className={`font-semibold text-sm ${temDivergencias ? 'text-yellow-300' : 'text-green-300'}`}>
            {temDivergencias ? 'Discrepâncias encontradas' : 'Fatura confere com o app'}
          </span>
          {resultado.fonte === 'excel' && (
            <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <TableIcon size={9} /> Excel
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">No app</p>
            <p className="font-bold text-gray-100">{formatCurrency(totalApp)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Na fatura</p>
            <p className="font-bold text-gray-100">
              {resultado.total_pdf !== null ? formatCurrency(resultado.total_pdf) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Diferença</p>
            <p className={`font-bold ${
              diferencaPositiva ? 'text-red-400' : diferencaNegativa ? 'text-green-400' : 'text-gray-300'
            }`}>
              {diferencaValor !== null
                ? (diferencaValor > 0 ? '+' : '') + formatCurrency(diferencaValor)
                : '—'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Resumo */}
      {resultado.resumo && (
        <div className="p-4 bg-dark-700/40 rounded-xl">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            {resultado.fonte === 'excel' ? 'Resumo' : 'Análise da IA'}
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">{resultado.resumo}</p>
        </div>
      )}

      {/* Na fatura, não no app */}
      {resultado.no_pdf_nao_no_app.length > 0 && (
        <Section
          title="Na fatura, mas não no app"
          subtitle="Estes lançamentos aparecem na fatura mas não foram registrados"
          icon={<TrendingDown size={16} className="text-red-400" />}
          cor="red"
          itens={resultado.no_pdf_nao_no_app}
        />
      )}

      {/* No app, não na fatura */}
      {resultado.no_app_nao_no_pdf.length > 0 && (
        <Section
          title="No app, mas não na fatura"
          subtitle="Estes lançamentos estão no app mas não aparecem na fatura"
          icon={<TrendingUp size={16} className="text-blue-400" />}
          cor="blue"
          itens={resultado.no_app_nao_no_pdf}
        />
      )}

      {/* Valores divergentes */}
      {resultado.valores_divergentes.length > 0 && (
        <div className="bg-dark-700/30 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-700">
            <AlertTriangle size={16} className="text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-gray-200">Valores divergentes</p>
              <p className="text-xs text-gray-500">Mesmo lançamento com valor diferente</p>
            </div>
          </div>
          <div className="divide-y divide-dark-700">
            {resultado.valores_divergentes.map((item, i) => (
              <div key={i} className="px-4 py-3">
                <p className="text-sm text-gray-200 mb-2">{item.descricao}</p>
                <div className="flex gap-4 text-xs">
                  <span className="text-gray-500">App: <span className="text-gray-300">{formatCurrency(item.valor_app)}</span></span>
                  <span className="text-gray-500">Fatura: <span className="text-gray-300">{formatCurrency(item.valor_pdf)}</span></span>
                  <span className={`font-medium ${item.diferenca > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {item.diferenca > 0 ? '+' : ''}{formatCurrency(item.diferenca)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!temDivergencias && (
        <div className="text-center py-4">
          <CheckCircle size={40} className="mx-auto mb-2 text-green-400" />
          <p className="text-sm text-gray-400">Todos os lançamentos conferem com a fatura do banco.</p>
        </div>
      )}

      {/* Resumo financeiro dos ajustes */}
      {temDivergencias && (() => {
        const totalFaltante = resultado.no_pdf_nao_no_app.reduce((s, i) => s + i.valor, 0)
        const totalExtra = resultado.no_app_nao_no_pdf.reduce((s, i) => s + i.valor, 0)
        const totalCorrecao = resultado.valores_divergentes.reduce((s, i) => s + i.diferenca, 0)
        const totalAjustado = totalApp + totalFaltante - totalExtra + totalCorrecao
        const diferencaResidual = resultado.total_pdf !== null ? totalAjustado - resultado.total_pdf : null

        return (
          <div className="p-4 bg-dark-700/40 rounded-xl border border-dark-600">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Resumo financeiro dos ajustes</p>
            <div className="space-y-1.5 text-sm">
              {totalFaltante > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Faltam no app (na fatura)</span>
                  <span className="text-red-400 font-medium">+{formatCurrency(totalFaltante)}</span>
                </div>
              )}
              {totalExtra > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Extras no app (não na fatura)</span>
                  <span className="text-blue-400 font-medium">−{formatCurrency(totalExtra)}</span>
                </div>
              )}
              {Math.abs(totalCorrecao) > 0.01 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Correções de valor</span>
                  <span className={`font-medium ${totalCorrecao > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {totalCorrecao > 0 ? '+' : ''}{formatCurrency(totalCorrecao)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-dark-600">
                <span className="text-gray-300 font-medium">Total ajustado no app</span>
                <span className="text-gray-100 font-bold">{formatCurrency(totalAjustado)}</span>
              </div>
              {diferencaResidual !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Diferença residual c/ fatura</span>
                  <span className={`font-medium ${Math.abs(diferencaResidual) < 0.02 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {diferencaResidual > 0 ? '+' : ''}{formatCurrency(diferencaResidual)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

interface SectionProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  cor: 'red' | 'blue'
  itens: { data: string; descricao: string; valor: number }[]
}

function Section({ title, subtitle, icon, cor, itens }: SectionProps) {
  const borderColor = cor === 'red' ? 'border-red-500/20' : 'border-blue-500/20'
  const bgColor = cor === 'red' ? 'bg-red-500/5' : 'bg-blue-500/5'

  return (
    <div className={`rounded-xl overflow-hidden border ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-700">
        {icon}
        <div>
          <p className="text-sm font-medium text-gray-200">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <span className="ml-auto text-xs font-medium text-gray-400 bg-dark-700 px-2 py-0.5 rounded-full">
          {itens.length}
        </span>
      </div>
      <div className="divide-y divide-dark-700/50">
        {itens.map((item, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <p className="text-sm text-gray-200">{item.descricao}</p>
              <p className="text-xs text-gray-500">{item.data}</p>
            </div>
            <span className="text-sm font-semibold text-gray-100 ml-4">{formatCurrency(item.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
