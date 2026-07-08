import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type ResultadoCapturaAudio = {
  audioPaths: string[]
  transcricao: string
  observacoes: string
} | null

export async function processarCapturaAudio(
  supabase: SupabaseClient<Database>,
  arquivos: File[],
  propriedadeId: string,
  unidadeNegocioId: string,
  data: string
): Promise<ResultadoCapturaAudio> {
  const groqApiKey = process.env.GROQ_API_KEY
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!groqApiKey || !anthropicApiKey || arquivos.length === 0) {
    return null
  }

  try {
    const audioPaths: string[] = []
    const groq = new Groq({ apiKey: groqApiKey })
    const transcricoes: string[] = []

    for (let indice = 0; indice < arquivos.length; indice++) {
      const arquivo = arquivos[indice]
      const extensao = arquivo.type.includes('mp4') ? 'mp4' : 'webm'
      const path = `${propriedadeId}/${unidadeNegocioId}/${data}-${Date.now()}-${indice}.${extensao}`

      const { error: erroUpload } = await supabase.storage
        .from('capturas-audio')
        .upload(path, arquivo, { contentType: arquivo.type })

      if (erroUpload) {
        throw new Error(`falha no upload do audio ${indice}: ${erroUpload.message}`)
      }

      audioPaths.push(path)

      const transcricao = await groq.audio.transcriptions.create({
        file: arquivo,
        model: 'whisper-large-v3',
        language: 'pt',
      })

      transcricoes.push(transcricao.text)
    }

    const transcricaoCompleta = transcricoes.join('\n')

    const anthropic = new Anthropic({ apiKey: anthropicApiKey })
    const mensagem = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Limpe e sintetize em português estas observações faladas por um produtor rural durante uma visita à propriedade, mantendo os fatos e removendo repetições/hesitações. Responda só com o texto sintetizado, sem introdução. Texto bruto: """${transcricaoCompleta}"""`,
        },
      ],
    })

    const primeiroBloco = mensagem.content[0]
    const observacoes = primeiroBloco.type === 'text' ? primeiroBloco.text : transcricaoCompleta

    return { audioPaths, transcricao: transcricaoCompleta, observacoes }
  } catch {
    return null
  }
}
