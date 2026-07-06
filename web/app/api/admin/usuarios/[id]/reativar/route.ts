import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const supabase = await createClient()
  const { data: usuarioAlvo } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!usuarioAlvo) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios?error=usuario_nao_encontrado', request.url),
      { status: 303 }
    )
  }

  const serviceClient = createServiceRoleClient()
  const { error: erroUnban } = await serviceClient.auth.admin.updateUserById(id, {
    ban_duration: 'none',
  })

  if (erroUnban) {
    return NextResponse.redirect(
      new URL(`/dashboard/usuarios/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  await supabase
    .from('usuarios')
    .update({ ativo: true })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  return NextResponse.redirect(new URL(`/dashboard/usuarios/${id}/editar`, request.url), {
    status: 303,
  })
}
