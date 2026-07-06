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

  const supabase = await createClient()
  await supabase
    .from('perfis_acesso')
    .delete()
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  return NextResponse.redirect(new URL('/dashboard/perfis', request.url), { status: 303 })
}
