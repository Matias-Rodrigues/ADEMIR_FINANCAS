import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { MODULOS_NEGOCIO } from '@/lib/modulos'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const nome = String(formData.get('nome') ?? '').trim()

  if (!nome) {
    return NextResponse.redirect(
      new URL('/dashboard/perfis/novo?error=nome_obrigatorio', request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const { data: perfil, error: erroPerfil } = await supabase
    .from('perfis_acesso')
    .insert({ propriedade_id: usuarioAtual.propriedade_id, nome })
    .select('id')
    .single()

  if (erroPerfil || !perfil) {
    return NextResponse.redirect(
      new URL('/dashboard/perfis/novo?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  const permissoes = MODULOS_NEGOCIO.filter(
    (modulo) => formData.get(`ver_${modulo.valor}`) || formData.get(`lancar_${modulo.valor}`)
  ).map((modulo) => ({
    perfil_acesso_id: perfil.id,
    modulo: modulo.valor,
    pode_ver: formData.get(`ver_${modulo.valor}`) !== null,
    pode_lancar: formData.get(`lancar_${modulo.valor}`) !== null,
  }))

  if (permissoes.length > 0) {
    await supabase.from('perfil_acesso_permissoes').insert(permissoes)
  }

  return NextResponse.redirect(new URL('/dashboard/perfis', request.url), { status: 303 })
}
