import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; vacinaId: string }> }
) {
  const { id, vacinaId } = await params
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
  const proximaDoseForm = String(formData.get('proxima_dose_prevista') ?? '').trim()
  const proximaDosePrevista = proximaDoseForm === '' ? null : proximaDoseForm
  const observacaoForm = String(formData.get('observacao') ?? '').trim()
  const observacao = observacaoForm === '' ? null : observacaoForm

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/producao/rebanho/animais/${id}/vacinas/${vacinaId}/editar?error=${codigo}`,
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

  const supabase = await createClient()
  const { error: erroUpdate } = await supabase
    .from('vacinas_animal')
    .update({ data, produto, proxima_dose_prevista: proximaDosePrevista, observacao })
    .eq('id', vacinaId)
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
