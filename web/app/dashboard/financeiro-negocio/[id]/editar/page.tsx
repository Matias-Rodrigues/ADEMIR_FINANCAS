import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { CATEGORIAS_POR_TIPO } from '@/lib/financeiro-negocio/categorias'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { notFound, redirect } from 'next/navigation'

export default async function EditarLancamentoFinanceiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeLancar = await temPermissao('financeiro_negocio', 'lancar')
  if (!podeLancar) {
    redirect('/dashboard')
  }

  const { id } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: lancamento } = await supabase
    .from('lancamentos_financeiros_negocio')
    .select('id, tipo, categoria, valor, data, descricao, unidade_negocio_id')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!lancamento) {
    notFound()
  }

  const { data: unidades } = await supabase
    .from('unidades_negocio')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar lançamento</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form
            method="POST"
            action={`/api/financeiro-negocio/${lancamento.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo_categoria">Tipo e categoria</Label>
              <Select
                id="tipo_categoria"
                name="tipo_categoria"
                required
                defaultValue={`${lancamento.tipo}:${lancamento.categoria}`}
              >
                <optgroup label="Receita">
                  {CATEGORIAS_POR_TIPO.receita.map((categoria) => (
                    <option key={categoria.valor} value={`receita:${categoria.valor}`}>
                      {categoria.rotulo}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Despesa">
                  {CATEGORIAS_POR_TIPO.despesa.map((categoria) => (
                    <option key={categoria.valor} value={`despesa:${categoria.valor}`}>
                      {categoria.rotulo}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unidade_negocio_id">Unidade de negócio</Label>
              <Select
                id="unidade_negocio_id"
                name="unidade_negocio_id"
                required
                defaultValue={lancamento.unidade_negocio_id}
              >
                {(unidades ?? []).map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                name="valor"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={lancamento.valor}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={lancamento.data} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" name="descricao" defaultValue={lancamento.descricao ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
