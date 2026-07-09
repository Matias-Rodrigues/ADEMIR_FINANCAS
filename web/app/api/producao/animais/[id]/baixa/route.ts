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

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const supabase = await createClient()
  const { data: animalAtual } = await supabase
    .from('animais')
    .select('ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!animalAtual) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho/animais?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  const { error: erroUpdate } = await supabase
    .from('animais')
    .update({ ativo: !animalAtual.ativo })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/rebanho/animais/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(
    new URL(`/dashboard/producao/rebanho/animais/${id}/editar`, request.url),
    { status: 303 }
  )
}
