import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vaca em lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vaca de descarte' },
  { valor: 'vaca_seca', rotulo: 'Vaca seca' },
  { valor: 'novilha_coberta', rotulo: 'Novilha coberta' },
  { valor: 'novilha_recria', rotulo: 'Novilha em recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneira em aleitamento' },
] as const

const TIPOS = [
  { valor: 'nascimento', rotulo: 'Nascimento' },
  { valor: 'mortalidade', rotulo: 'Morte' },
  { valor: 'mudanca_categoria', rotulo: 'Mudança de categoria' },
  { valor: 'compra_animal', rotulo: 'Compra' },
  { valor: 'venda_animal', rotulo: 'Venda' },
  { valor: 'ajuste_inventario', rotulo: 'Ajuste de inventário' },
] as const

export default async function RebanhoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const hoje = new Date().toISOString().slice(0, 10)
  const { data: composicao } = unidadeNegocioId
    ? await supabase.rpc('rebanho_composicao', {
        p_unidade_negocio_id: unidadeNegocioId,
        p_data: hoje,
      })
    : { data: [] }

  const { data: historico } = unidadeNegocioId
    ? await supabase
        .from('eventos_operacionais')
        .select('data, tipo_evento, categoria_animal, categoria_origem, quantidade')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .in('tipo_evento', [
          'nascimento',
          'mortalidade',
          'mudanca_categoria',
          'compra_animal',
          'venda_animal',
          'ajuste_inventario',
        ])
        .order('data', { ascending: false })
        .limit(10)
    : { data: [] }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Link
        href="/dashboard/producao/rebanho/animais"
        className={buttonVariants({ variant: 'outline' })}
      >
        Ver/gerenciar animais
      </Link>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Composição atual do rebanho</h2>
        <ul className="flex flex-col gap-1">
          {(composicao ?? []).map((linha) => (
            <li key={linha.categoria} className="flex justify-between text-sm">
              <span>{CATEGORIAS.find((c) => c.valor === linha.categoria)?.rotulo}</span>
              <span className="font-medium">{linha.quantidade}</span>
            </li>
          ))}
        </ul>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar movimentação</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form
            method="POST"
            action="/api/producao/rebanho/movimentacao"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo">Tipo de movimentação</Label>
              <Select id="tipo" name="tipo" required defaultValue="">
                <option value="" disabled>
                  Selecione o tipo
                </option>
                {TIPOS.map((tipo) => (
                  <option key={tipo.valor} value={tipo.valor}>
                    {tipo.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria (ou categoria de destino, se mudança)</Label>
              <Select id="categoria" name="categoria" required defaultValue="">
                <option value="" disabled>
                  Selecione a categoria
                </option>
                {CATEGORIAS.map((categoria) => (
                  <option key={categoria.valor} value={categoria.valor}>
                    {categoria.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria_origem">
                Categoria de origem (só usada em &quot;mudança de categoria&quot;)
              </Label>
              <Select id="categoria_origem" name="categoria_origem" defaultValue="">
                <option value="">Não se aplica</option>
                {CATEGORIAS.map((categoria) => (
                  <option key={categoria.valor} value={categoria.valor}>
                    {categoria.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input id="quantidade" name="quantidade" type="number" min="1" defaultValue={1} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={hoje} required />
            </div>
            <Button type="submit">Registrar</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Últimas movimentações</h2>
        <ul className="flex flex-col gap-2">
          {(historico ?? []).map((evento, indice) => (
            <li key={indice} className="rounded-lg border border-input p-3 text-sm">
              {evento.data} · {TIPOS.find((t) => t.valor === evento.tipo_evento)?.rotulo} ·{' '}
              {evento.quantidade}x{' '}
              {CATEGORIAS.find((c) => c.valor === evento.categoria_animal)?.rotulo}
              {evento.categoria_origem &&
                ` (de ${CATEGORIAS.find((c) => c.valor === evento.categoria_origem)?.rotulo})`}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
