import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; medicamentoId: string }> }
) {
  const { id, medicamentoId } = await params
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
  const produto = String(formData.get('produto') ?? '').trim()
  const diasCarencia = Number(formData.get('dias_carencia'))
  const observacaoForm = String(formData.get('observacao') ?? '').trim()
  const observacao = observacaoForm === '' ? null : observacaoForm

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/producao/rebanho/animais/${id}/medicamentos/${medicamentoId}/editar?error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  const hoje = new Date().toISOString().slice(0, 10)
  if (!data || Number.isNaN(Date.parse(data)) || data > hoje) {
    return redirecionarComErro('data_invalida')
  }

  if (!produto) {
    return redirecionarComErro('produto_invalido')
  }

  if (Number.isNaN(diasCarencia) || diasCarencia < 0 || !Number.isInteger(diasCarencia)) {
    return redirecionarComErro('dias_carencia_invalido')
  }

  const supabase = await createClient()
  const { error: erroUpdate } = await supabase
    .from('medicamentos_animal')
    .update({ data, produto, dias_carencia: diasCarencia, observacao })
    .eq('id', medicamentoId)
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
