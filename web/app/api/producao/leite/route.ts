import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { processarCapturaAudio } from '@/lib/producao/captura-audio'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const data = String(formData.get('data') ?? '')
  const litrosComercial = Number(formData.get('litros_comercial'))
  const litrosDescarte = Number(formData.get('litros_descarte'))
  const litrosConsumo = Number(formData.get('litros_consumo'))

  const arquivosAudio = formData
    .getAll('audio')
    .filter((valor): valor is File => valor instanceof File && valor.size > 0)

  if (!data || Number.isNaN(Date.parse(data))) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/leite?error=data_invalida`, request.url),
      { status: 303 }
    )
  }

  if (
    Number.isNaN(litrosComercial) ||
    Number.isNaN(litrosDescarte) ||
    Number.isNaN(litrosConsumo) ||
    litrosComercial < 0 ||
    litrosDescarte < 0 ||
    litrosConsumo < 0
  ) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/leite?data=${data}&error=valores_invalidos`, request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  if (!unidadeNegocioId) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/leite?error=unidade_negocio_nao_encontrada`, request.url),
      { status: 303 }
    )
  }

  const resultadoAudio = await processarCapturaAudio(
    supabase,
    arquivosAudio,
    usuarioAtual.propriedade_id,
    unidadeNegocioId,
    data
  )

  const audioFalhou = arquivosAudio.length > 0 && resultadoAudio === null

  const { error: erroInsert } = await supabase.from('producao_leite').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    data,
    litros_comercial: litrosComercial,
    litros_descarte: litrosDescarte,
    litros_consumo: litrosConsumo,
    criado_por: usuarioAtual.id,
    origem: resultadoAudio ? 'app_audio' : 'manual',
    observacoes: resultadoAudio?.observacoes ?? null,
    transcricao: resultadoAudio?.transcricao ?? null,
    audio_paths: resultadoAudio?.audioPaths ?? null,
  })

  if (erroInsert) {
    if (erroInsert.code !== '23505') {
      return NextResponse.redirect(
        new URL(`/dashboard/producao/leite?data=${data}&error=erro_inesperado`, request.url),
        { status: 303 }
      )
    }

    const { error: erroUpdate } = await supabase
      .from('producao_leite')
      .update({
        litros_comercial: litrosComercial,
        litros_descarte: litrosDescarte,
        litros_consumo: litrosConsumo,
        ...(resultadoAudio
          ? {
              origem: 'app_audio',
              observacoes: resultadoAudio.observacoes,
              transcricao: resultadoAudio.transcricao,
              audio_paths: resultadoAudio.audioPaths,
            }
          : {}),
      })
      .eq('unidade_negocio_id', unidadeNegocioId)
      .eq('data', data)

    if (erroUpdate) {
      return NextResponse.redirect(
        new URL(`/dashboard/producao/leite?data=${data}&error=erro_inesperado`, request.url),
        { status: 303 }
      )
    }
  }

  const urlSucesso = audioFalhou
    ? `/dashboard/producao/leite?aviso=audio_falhou`
    : '/dashboard/producao/leite'

  return NextResponse.redirect(new URL(urlSucesso, request.url), { status: 303 })
}
