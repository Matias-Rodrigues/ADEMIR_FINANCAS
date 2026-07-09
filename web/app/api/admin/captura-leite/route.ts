import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

const ESTILOS_VALIDOS = ['todos_visiveis', 'tocar_para_revelar']
const CAMPOS_VALIDOS = ['litros_comercial', 'litros_descarte', 'litros_consumo']

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  if (!ehDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const propriedadeId = String(formData.get('propriedade_id') ?? '')
  const usuarioId = String(formData.get('usuario_id') ?? '')
  const estiloInteracao = String(formData.get('estilo_interacao') ?? '')

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/admin/captura-leite?propriedade_id=${propriedadeId}&usuario_id=${usuarioId}&error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  if (!ESTILOS_VALIDOS.includes(estiloInteracao)) {
    return redirecionarComErro('dados_invalidos')
  }

  const posicoesForm = CAMPOS_VALIDOS.map((campo) => ({
    campo,
    posicaoTexto: String(formData.get(`posicao_${campo}`) ?? '').trim(),
  }))

  for (const { posicaoTexto } of posicoesForm) {
    if (posicaoTexto === '') {
      continue
    }
    const posicao = Number(posicaoTexto)
    if (Number.isNaN(posicao) || posicao <= 0 || !Number.isInteger(posicao)) {
      return redirecionarComErro('posicao_invalida')
    }
  }

  const supabase = await createClient()

  const { data: usuarioAlvo } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', usuarioId)
    .eq('propriedade_id', propriedadeId)
    .maybeSingle()

  if (!usuarioAlvo) {
    return redirecionarComErro('usuario_invalido')
  }

  const { error: erroInsertConfig } = await supabase.from('configuracoes_captura_leite').insert({
    propriedade_id: propriedadeId,
    usuario_id: usuarioId,
    estilo_interacao: estiloInteracao,
    criado_por: usuarioAtual.id,
  })

  if (erroInsertConfig) {
    if (erroInsertConfig.code !== '23505') {
      return redirecionarComErro('erro_inesperado')
    }

    const { error: erroUpdateConfig } = await supabase
      .from('configuracoes_captura_leite')
      .update({ estilo_interacao: estiloInteracao })
      .eq('usuario_id', usuarioId)

    if (erroUpdateConfig) {
      return redirecionarComErro('erro_inesperado')
    }
  }

  let algumaPosicaoFalhou = false

  for (const { campo, posicaoTexto } of posicoesForm) {
    if (posicaoTexto === '') {
      continue
    }

    const posicao = Number(posicaoTexto)

    const { error: erroInsertPosicao } = await supabase.from('ordem_captura_leite').insert({
      propriedade_id: propriedadeId,
      usuario_id: usuarioId,
      campo,
      posicao,
    })

    if (erroInsertPosicao) {
      if (erroInsertPosicao.code !== '23505') {
        algumaPosicaoFalhou = true
        continue
      }

      const { error: erroUpdatePosicao } = await supabase
        .from('ordem_captura_leite')
        .update({ posicao })
        .eq('usuario_id', usuarioId)
        .eq('campo', campo)

      if (erroUpdatePosicao) {
        algumaPosicaoFalhou = true
      }
    }
  }

  if (algumaPosicaoFalhou) {
    return redirecionarComErro('erro_inesperado')
  }

  return NextResponse.redirect(
    new URL(
      `/dashboard/admin/captura-leite?propriedade_id=${propriedadeId}&usuario_id=${usuarioId}`,
      request.url
    ),
    { status: 303 }
  )
}
