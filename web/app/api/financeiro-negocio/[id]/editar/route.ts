import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { categoriaValida } from '@/lib/financeiro-negocio/categorias'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('financeiro_negocio', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const tipoCategoria = String(formData.get('tipo_categoria') ?? '')
  const [tipo, categoria] = tipoCategoria.split(':')
  const unidadeNegocioId = String(formData.get('unidade_negocio_id') ?? '')
  const valor = Number(formData.get('valor'))
  const data = String(formData.get('data') ?? '')
  const descricaoForm = String(formData.get('descricao') ?? '').trim()
  const descricao = descricaoForm === '' ? null : descricaoForm

  if (!categoriaValida(tipo, categoria) || !unidadeNegocioId) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=dados_invalidos`, request.url),
      { status: 303 }
    )
  }

  if (!data || Number.isNaN(Date.parse(data))) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=data_invalida`, request.url),
      { status: 303 }
    )
  }

  if (Number.isNaN(valor) || valor <= 0) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=valores_invalidos`, request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()

  const { data: unidadeNegocio } = await supabase
    .from('unidades_negocio')
    .select('id')
    .eq('id', unidadeNegocioId)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!unidadeNegocio) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=unidade_negocio_invalida`, request.url),
      { status: 303 }
    )
  }

  const { error: erroUpdate } = await supabase
    .from('lancamentos_financeiros_negocio')
    .update({
      tipo,
      categoria,
      unidade_negocio_id: unidadeNegocioId,
      valor,
      data,
      descricao,
    })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL(`/dashboard/financeiro-negocio/${id}/editar`, request.url), {
    status: 303,
  })
}
