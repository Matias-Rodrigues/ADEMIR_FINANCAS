import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('imobilizado', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const categoria = String(formData.get('categoria') ?? '')
  const nome = String(formData.get('nome') ?? '').trim()
  const valorAquisicao = Number(formData.get('valor_aquisicao'))
  const valorResidual = Number(formData.get('valor_residual'))
  const dataAquisicao = String(formData.get('data_aquisicao') ?? '')
  const vidaUtilAnos = Number(formData.get('vida_util_anos'))
  const unidadeNegocioIdForm = String(formData.get('unidade_negocio_id') ?? '')
  const unidadeNegocioId = unidadeNegocioIdForm === '' ? null : unidadeNegocioIdForm

  if (!['benfeitoria', 'maquina'].includes(categoria) || !nome) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado/novo?error=dados_invalidos', request.url),
      { status: 303 }
    )
  }

  if (!dataAquisicao || Number.isNaN(Date.parse(dataAquisicao))) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado/novo?error=data_aquisicao_invalida', request.url),
      { status: 303 }
    )
  }

  const valoresValidos =
    !Number.isNaN(valorAquisicao) &&
    !Number.isNaN(valorResidual) &&
    !Number.isNaN(vidaUtilAnos) &&
    valorAquisicao > 0 &&
    valorResidual >= 0 &&
    valorResidual < valorAquisicao &&
    vidaUtilAnos > 0

  if (!valoresValidos) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado/novo?error=valores_invalidos', request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const { error: erroInsert } = await supabase.from('imobilizados').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    categoria,
    nome,
    valor_aquisicao: valorAquisicao,
    valor_residual: valorResidual,
    data_aquisicao: dataAquisicao,
    vida_util_anos: vidaUtilAnos,
  })

  if (erroInsert) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado/novo?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/imobilizado', request.url), { status: 303 })
}
