import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui'
import { TagInput } from './TagInput'

interface BulkTagModalProps {
  isOpen: boolean
  onClose: () => void
  quantidade: number
  tagsExistentes: string[]
  // Tags em comum entre as transações selecionadas (candidatas à remoção)
  tagsNaSelecao: string[]
  onConfirm: (modo: 'adicionar' | 'remover', tags: string[]) => Promise<void>
}

export function BulkTagModal({
  isOpen,
  onClose,
  quantidade,
  tagsExistentes,
  tagsNaSelecao,
  onConfirm,
}: BulkTagModalProps) {
  const [modo, setModo] = useState<'adicionar' | 'remover'>('adicionar')
  const [tags, setTags] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  const fechar = () => {
    if (salvando) return
    setTags([])
    setModo('adicionar')
    onClose()
  }

  const confirmar = async () => {
    if (tags.length === 0) return
    setSalvando(true)
    try {
      await onConfirm(modo, tags)
      setTags([])
      setModo('adicionar')
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={fechar}
      title="Tags nas transações selecionadas"
      description={`${quantidade} transação(ões) selecionada(s). As tags que elas já têm são mantidas.`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {(['adicionar', 'remover'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setModo(m)
                setTags([])
              }}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                modo === m
                  ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                  : 'border-dark-600 text-gray-400 hover:border-dark-500'
              }`}
            >
              {m === 'adicionar' ? 'Adicionar tag' : 'Remover tag'}
            </button>
          ))}
        </div>

        <TagInput
          label={modo === 'adicionar' ? 'Tags a adicionar' : 'Tags a remover'}
          value={tags}
          onChange={setTags}
          suggestions={modo === 'adicionar' ? tagsExistentes : tagsNaSelecao}
          helperText={
            modo === 'adicionar'
              ? 'Escolha uma tag existente ou digite uma nova e aperte Enter.'
              : tagsNaSelecao.length === 0
                ? 'Nenhuma das transações selecionadas tem tags.'
                : 'Escolha as tags que quer tirar das transações selecionadas.'
          }
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-dark-700/50">
          <Button type="button" variant="ghost" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={salvando || tags.length === 0}>
            {salvando
              ? 'Aplicando...'
              : modo === 'adicionar'
                ? `Adicionar a ${quantidade}`
                : `Remover de ${quantidade}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
