import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const modo = String(formData.get('modo') ?? '')
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const perfilAcessoId = String(formData.get('perfil_acesso_id') ?? '')

  if (!email || !password || password.length < 6 || !perfilAcessoId) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios/novo?error=dados_invalidos', request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()

  const { data: perfil } = await supabase
    .from('perfis_acesso')
    .select('id')
    .eq('id', perfilAcessoId)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!perfil) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios/novo?error=perfil_invalido', request.url),
      { status: 303 }
    )
  }

  let pessoaFisicaId: string

  if (modo === 'existente') {
    const pessoaFisicaIdForm = String(formData.get('pessoa_fisica_id') ?? '')
    const { data: pessoa } = await supabase
      .from('pessoas_fisicas')
      .select('id')
      .eq('id', pessoaFisicaIdForm)
      .eq('propriedade_id', usuarioAtual.propriedade_id)
      .maybeSingle()

    if (!pessoa) {
      return NextResponse.redirect(
        new URL('/dashboard/usuarios/novo?error=pessoa_invalida', request.url),
        { status: 303 }
      )
    }
    pessoaFisicaId = pessoa.id
  } else {
    const nomeNovo = String(formData.get('nome_novo') ?? '').trim()
    const cpfNovo = String(formData.get('cpf_novo') ?? '').trim()

    if (!nomeNovo || !cpfNovo) {
      return NextResponse.redirect(
        new URL('/dashboard/usuarios/novo?error=nome_obrigatorio', request.url),
        { status: 303 }
      )
    }

    const { data: pessoaNova, error: erroPessoa } = await supabase
      .from('pessoas_fisicas')
      .insert({ propriedade_id: usuarioAtual.propriedade_id, nome: nomeNovo, cpf: cpfNovo })
      .select('id')
      .single()

    if (erroPessoa || !pessoaNova) {
      return NextResponse.redirect(
        new URL('/dashboard/usuarios/novo?error=cpf_duplicado', request.url),
        { status: 303 }
      )
    }
    pessoaFisicaId = pessoaNova.id
  }

  const serviceClient = createServiceRoleClient()
  const { data: authData, error: erroAuth } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (erroAuth || !authData.user) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios/novo?error=email_duplicado', request.url),
      { status: 303 }
    )
  }

  const { error: erroUsuario } = await serviceClient.from('usuarios').insert({
    id: authData.user.id,
    propriedade_id: usuarioAtual.propriedade_id,
    pessoa_fisica_id: pessoaFisicaId,
    perfil_acesso_id: perfilAcessoId,
    papel: 'membro_familia',
    ativo: true,
  })

  if (erroUsuario) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios/novo?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/usuarios', request.url), { status: 303 })
}
