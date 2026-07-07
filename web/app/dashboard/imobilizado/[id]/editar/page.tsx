import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { notFound, redirect } from 'next/navigation'

export default async function EditarImobilizadoPage({
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

  const podeLancar = await temPermissao('imobilizado', 'lancar')
  if (!podeLancar) {
    redirect('/dashboard')
  }

  const { id } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: bem } = await supabase
    .from('imobilizados')
    .select('id, categoria, nome, valor_aquisicao, valor_residual, data_aquisicao, vida_util_anos, unidade_negocio_id, ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!bem) {
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
          <CardTitle>{bem.nome}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form method="POST" action={`/api/imobilizado/${bem.id}/editar`} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select id="categoria" name="categoria" required defaultValue={bem.categoria}>
                <option value="benfeitoria">Benfeitoria</option>
                <option value="maquina">Máquina/Implemento</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" defaultValue={bem.nome} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor_aquisicao">Valor de aquisição (R$)</Label>
              <Input
                id="valor_aquisicao"
                name="valor_aquisicao"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={bem.valor_aquisicao}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor_residual">Valor residual (R$)</Label>
              <Input
                id="valor_residual"
                name="valor_residual"
                type="number"
                step="0.01"
                min="0"
                defaultValue={bem.valor_residual}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_aquisicao">Data de aquisição</Label>
              <Input id="data_aquisicao" name="data_aquisicao" type="date" defaultValue={bem.data_aquisicao} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vida_util_anos">Vida útil (anos)</Label>
              <Input
                id="vida_util_anos"
                name="vida_util_anos"
                type="number"
                min="1"
                defaultValue={bem.vida_util_anos}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unidade_negocio_id">Unidade de negócio</Label>
              <Select id="unidade_negocio_id" name="unidade_negocio_id" defaultValue={bem.unidade_negocio_id ?? ''}>
                <option value="">Não vinculado</option>
                {(unidades ?? []).map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>

          <form method="POST" action={`/api/imobilizado/${bem.id}/baixa`}>
            <Button type="submit" variant={bem.ativo ? 'destructive' : 'default'}>
              {bem.ativo ? 'Dar baixa' : 'Reativar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
