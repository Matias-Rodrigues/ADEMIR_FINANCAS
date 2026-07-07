import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const supabase = await createClient()
  const { data: bemAtual } = await supabase
    .from('imobilizados')
    .select('ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!bemAtual) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  const { error: erroUpdate } = await supabase
    .from('imobilizados')
    .update({ ativo: !bemAtual.ativo })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    return NextResponse.redirect(
      new URL(`/dashboard/imobilizado/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL(`/dashboard/imobilizado/${id}/editar`, request.url), {
    status: 303,
  })
}
