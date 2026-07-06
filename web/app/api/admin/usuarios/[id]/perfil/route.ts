import { createClient } from '@/lib/supabase/server'
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

  const formData = await request.formData()
  const perfilAcessoIdForm = String(formData.get('perfil_acesso_id') ?? '')
  const perfilAcessoId = perfilAcessoIdForm === '' ? null : perfilAcessoIdForm

  const supabase = await createClient()

  if (perfilAcessoId) {
    const { data: perfil } = await supabase
      .from('perfis_acesso')
      .select('id')
      .eq('id', perfilAcessoId)
      .eq('propriedade_id', usuarioAtual.propriedade_id)
      .maybeSingle()

    if (!perfil) {
      return NextResponse.redirect(
        new URL(`/dashboard/usuarios/${id}/editar?error=perfil_invalido`, request.url),
        { status: 303 }
      )
    }
  }

  await supabase
    .from('usuarios')
    .update({ perfil_acesso_id: perfilAcessoId })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  return NextResponse.redirect(new URL(`/dashboard/usuarios/${id}/editar`, request.url), {
    status: 303,
  })
}
