import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
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
  const mesForm = String(formData.get('mes') ?? '')
  const ccs = Number(formData.get('ccs'))
  const cbt = Number(formData.get('cbt'))
  const gordura = Number(formData.get('gordura'))
  const proteina = Number(formData.get('proteina'))
  const esd = Number(formData.get('esd'))

  if (!/^\d{4}-\d{2}$/.test(mesForm)) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/qualidade?error=data_invalida', request.url),
      { status: 303 }
    )
  }

  const mes = `${mesForm}-01`

  const valoresValidos =
    !Number.isNaN(ccs) &&
    !Number.isNaN(cbt) &&
    !Number.isNaN(gordura) &&
    !Number.isNaN(proteina) &&
    !Number.isNaN(esd) &&
    ccs >= 0 &&
    cbt >= 0 &&
    gordura >= 0 &&
    gordura <= 100 &&
    proteina >= 0 &&
    proteina <= 100 &&
    esd >= 0 &&
    esd <= 100

  if (!valoresValidos) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/qualidade?mes=${mesForm}&error=valores_invalidos`, request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  if (!unidadeNegocioId) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/qualidade?error=unidade_negocio_nao_encontrada', request.url),
      { status: 303 }
    )
  }

  const { error: erroInsert } = await supabase.from('qualidade_leite').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    mes,
    ccs,
    cbt,
    gordura,
    proteina,
    esd,
    criado_por: usuarioAtual.id,
    origem: 'manual',
  })

  if (erroInsert) {
    if (erroInsert.code !== '23505') {
      return NextResponse.redirect(
        new URL(`/dashboard/producao/qualidade?mes=${mesForm}&error=erro_inesperado`, request.url),
        { status: 303 }
      )
    }

    const { error: erroUpdate } = await supabase
      .from('qualidade_leite')
      .update({ ccs, cbt, gordura, proteina, esd })
      .eq('unidade_negocio_id', unidadeNegocioId)
      .eq('mes', mes)

    if (erroUpdate) {
      return NextResponse.redirect(
        new URL(`/dashboard/producao/qualidade?mes=${mesForm}&error=erro_inesperado`, request.url),
        { status: 303 }
      )
    }
  }

  return NextResponse.redirect(new URL('/dashboard/producao/qualidade', request.url), {
    status: 303,
  })
}
