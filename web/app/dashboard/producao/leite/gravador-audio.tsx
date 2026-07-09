'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type Clipe = {
  id: string
  blob: Blob
  url: string
}

export function GravadorAudio() {
  const [clipes, setClipes] = useState<Clipe[]>([])
  const [gravando, setGravando] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function sincronizarInput(novosClipes: Clipe[]) {
    if (!inputRef.current) return
    const dataTransfer = new DataTransfer()
    novosClipes.forEach((clipe, indice) => {
      const extensao = clipe.blob.type.includes('mp4') ? 'mp4' : 'webm'
      dataTransfer.items.add(
        new File([clipe.blob], `observacao-${indice}.${extensao}`, { type: clipe.blob.type })
      )
    })
    inputRef.current.files = dataTransfer.files
  }

  async function iniciarGravacao() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    const chunks: Blob[] = []

    mediaRecorder.ondataavailable = (evento) => {
      if (evento.data.size > 0) {
        chunks.push(evento.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType })
      const novoClipe: Clipe = { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) }
      setClipes((atuais) => {
        const atualizados = [...atuais, novoClipe]
        sincronizarInput(atualizados)
        return atualizados
      })
      stream.getTracks().forEach((track) => track.stop())
    }

    mediaRecorder.start()
    mediaRecorderRef.current = mediaRecorder
    setGravando(true)
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop()
    setGravando(false)
  }

  function excluirClipe(id: string) {
    setClipes((atuais) => {
      const atualizados = atuais.filter((clipe) => clipe.id !== id)
      sincronizarInput(atualizados)
      return atualizados
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} type="file" name="audio" multiple accept="audio/*" className="hidden" />
      <Button type="button" variant="outline" onClick={gravando ? pararGravacao : iniciarGravacao}>
        {gravando ? 'Parar gravação' : 'Gravar observação'}
      </Button>
      {clipes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {clipes.map((clipe, indice) => (
            <li
              key={clipe.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-input p-2 text-sm"
            >
              <span>Observação {indice + 1}</span>
              <audio controls src={clipe.url} className="h-8" />
              <Button type="button" variant="ghost" onClick={() => excluirClipe(clipe.id)}>
                Excluir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
