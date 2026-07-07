import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { NextResponse } from 'next/server'

const TIPOS_VALIDOS = [
  'nascimento',
  'mortalidade',
  'mudanca_categoria',
  'compra_animal',
  'venda_animal',
  'ajuste_inventario',
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
  const tipo = String(formData.get('tipo') ?? '')
  const categoria = String(formData.get('categoria') ?? '')
  const categoriaOrigemForm = String(formData.get('categoria_origem') ?? '')
  const quantidade = Number(formData.get('quantidade'))
  const data = String(formData.get('data') ?? '')

  if (!TIPOS_VALIDOS.includes(tipo) || !categoria || !data || Number.isNaN(Date.parse(data))) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=dados_invalidos', request.url),
      { status: 303 }
    )
  }

  if (Number.isNaN(quantidade) || quantidade < 1) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=quantidade_invalida', request.url),
      { status: 303 }
    )
  }

  const categoriaOrigem = tipo === 'mudanca_categoria' ? categoriaOrigemForm : null

  if (tipo === 'mudanca_categoria' && (!categoriaOrigem || categoriaOrigem === categoria)) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=categoria_origem_invalida', request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  if (!unidadeNegocioId) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=unidade_negocio_nao_encontrada', request.url),
      { status: 303 }
    )
  }

  const { error: erroInsert } = await supabase.from('eventos_operacionais').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    tipo_evento: tipo,
    data,
    quantidade,
    categoria_animal: categoria,
    categoria_origem: categoriaOrigem,
    origem: 'manual',
    criado_por: usuarioAtual.id,
  })

  if (erroInsert) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/producao/rebanho', request.url), {
    status: 303,
  })
}
