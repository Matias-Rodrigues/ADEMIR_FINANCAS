import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UsuarioAtual = {
  id: string
  propriedade_id: string
  papel: string
}

export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data } = await supabase
    .from('usuarios')
    .select('id, propriedade_id, papel')
    .eq('id', user.id)
    .single()

  return data
}

export function ehAdminOuDev(usuario: UsuarioAtual | null): usuario is UsuarioAtual {
  return usuario !== null && (usuario.papel === 'admin' || usuario.papel === 'dev')
}

export async function requireAdmin(): Promise<UsuarioAtual> {
  const usuario = await getUsuarioAtual()
  if (!ehAdminOuDev(usuario)) {
    redirect('/dashboard')
  }
  return usuario
}
