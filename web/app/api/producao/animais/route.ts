import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { animalPertenceAPropriedade } from '@/lib/producao/validar-animal'
import { NextResponse } from 'next/server'

const SEXOS_VALIDOS = ['femea', 'macho']
const CATEGORIAS_VALIDAS = [
  'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
  'novilha_coberta', 'novilha_recria', 'terneira_aleitamento',
]

export async function POST(request: Request) {
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
  const brinco = String(formData.get('brinco') ?? '').trim()
  const nomeForm = String(formData.get('nome') ?? '').trim()
  const nome = nomeForm === '' ? null : nomeForm
  const sexo = String(formData.get('sexo') ?? '')
  const categoria = String(formData.get('categoria') ?? '')
  const dataNascimentoForm = String(formData.get('data_nascimento') ?? '').trim()
  const dataNascimento = dataNascimentoForm === '' ? null : dataNascimentoForm
  const maeIdForm = String(formData.get('mae_id') ?? '').trim()
  const maeId = maeIdForm === '' ? null : maeIdForm
  const paiTextoForm = String(formData.get('pai_texto') ?? '').trim()
  const paiTexto = paiTextoForm === '' ? null : paiTextoForm

  if (!brinco || !SEXOS_VALIDOS.includes(sexo) || !CATEGORIAS_VALIDAS.includes(categoria)) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho/animais/novo?error=dados_invalidos', request.url),
      { status: 303 }
    )
  }

  if (dataNascimento !== null) {
    const hoje = new Date().toISOString().slice(0, 10)
    if (Number.isNaN(Date.parse(dataNascimento)) || dataNascimento > hoje) {
      return NextResponse.redirect(
        new URL('/dashboard/producao/rebanho/animais/novo?error=data_nascimento_invalida', request.url),
        { status: 303 }
      )
    }
  }

  const supabase = await createClient()

  if (maeId !== null) {
    const maeValida = await animalPertenceAPropriedade(supabase, maeId, usuarioAtual.propriedade_id)
    if (!maeValida) {
      return NextResponse.redirect(
        new URL('/dashboard/producao/rebanho/animais/novo?error=mae_invalida', request.url),
        { status: 303 }
      )
    }
  }

  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)
  if (!unidadeNegocioId) {
    return NextResponse.redirect(
      new URL(
        '/dashboard/producao/rebanho/animais/novo?error=unidade_negocio_nao_encontrada',
        request.url
      ),
      { status: 303 }
    )
  }

  const { error: erroInsert } = await supabase.from('animais').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    brinco,
    nome,
    sexo,
    categoria,
    data_nascimento: dataNascimento,
    mae_id: maeId,
    pai_texto: paiTexto,
    criado_por: usuarioAtual.id,
  })

  if (erroInsert) {
    const codigo = erroInsert.code === '23505' ? 'brinco_duplicado' : 'erro_inesperado'
    return NextResponse.redirect(
      new URL(`/dashboard/producao/rebanho/animais/novo?error=${codigo}`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/producao/rebanho/animais', request.url), {
    status: 303,
  })
}
