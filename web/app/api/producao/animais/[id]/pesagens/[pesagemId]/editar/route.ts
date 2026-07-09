import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pesagemId: string }> }
) {
  const { id, pesagemId } = await params
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

  const formData = await request.formData()
  const data = String(formData.get('data') ?? '')
  const pesoKg = Number(formData.get('peso_kg'))
  const observacaoForm = String(formData.get('observacao') ?? '').trim()
  const observacao = observacaoForm === '' ? null : observacaoForm

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/producao/rebanho/animais/${id}/pesagens/${pesagemId}/editar?error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  const hoje = new Date().toISOString().slice(0, 10)
  if (!data || Number.isNaN(Date.parse(data)) || data > hoje) {
    return redirecionarComErro('data_invalida')
  }

  if (Number.isNaN(pesoKg) || pesoKg <= 0) {
    return redirecionarComErro('peso_invalido')
  }

  const supabase = await createClient()
  const { error: erroUpdate } = await supabase
    .from('pesagens_animal')
    .update({ data, peso_kg: pesoKg, observacao })
    .eq('id', pesagemId)
    .eq('animal_id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    return redirecionarComErro('erro_inesperado')
  }

  return NextResponse.redirect(
    new URL(`/dashboard/producao/rebanho/animais/${id}/editar`, request.url),
    { status: 303 }
  )
}
