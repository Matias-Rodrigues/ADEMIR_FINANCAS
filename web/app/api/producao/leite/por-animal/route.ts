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
  const data = String(formData.get('data') ?? '')
  const numeroOrdenha = Number(formData.get('numero_ordenha'))

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/producao/leite/por-animal?data=${data}&ordenha=${numeroOrdenha}&error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  if (!data || Number.isNaN(Date.parse(data))) {
    return redirecionarComErro('data_invalida')
  }

  if (Number.isNaN(numeroOrdenha) || numeroOrdenha < 1) {
    return redirecionarComErro('ordenha_invalida')
  }

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  if (!unidadeNegocioId) {
    return redirecionarComErro('unidade_negocio_nao_encontrada')
  }

  const { data: animaisValidos } = await supabase
    .from('animais')
    .select('id')
    .eq('unidade_negocio_id', unidadeNegocioId)
    .eq('categoria', 'vaca_lactacao')
    .eq('ativo', true)

  const idsValidos = new Set((animaisValidos ?? []).map((animal) => animal.id))

  let algumLancamentoFalhou = false

  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith('litros_')) {
      continue
    }

    const animalId = chave.slice('litros_'.length)
    const litrosTexto = String(valor).trim()

    if (!idsValidos.has(animalId) || litrosTexto === '') {
      continue
    }

    const litros = Number(litrosTexto)
    if (Number.isNaN(litros) || litros < 0) {
      continue
    }

    const { error: erroInsert } = await supabase.from('producao_animal').insert({
      propriedade_id: usuarioAtual.propriedade_id,
      animal_id: animalId,
      unidade_negocio_id: unidadeNegocioId,
      data,
      numero_ordenha: numeroOrdenha,
      litros,
      criado_por: usuarioAtual.id,
    })

    if (erroInsert) {
      if (erroInsert.code !== '23505') {
        algumLancamentoFalhou = true
        continue
      }

      const { error: erroUpdate } = await supabase
        .from('producao_animal')
        .update({ litros })
        .eq('animal_id', animalId)
        .eq('data', data)
        .eq('numero_ordenha', numeroOrdenha)

      if (erroUpdate) {
        algumLancamentoFalhou = true
      }
    }
  }

  if (algumLancamentoFalhou) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/producao/leite/por-animal?data=${data}&ordenha=${numeroOrdenha}&error=erro_inesperado`,
        request.url
      ),
      { status: 303 }
    )
  }

  return NextResponse.redirect(
    new URL(`/dashboard/producao/leite/por-animal?data=${data}&ordenha=${numeroOrdenha}`, request.url),
    { status: 303 }
  )
}
