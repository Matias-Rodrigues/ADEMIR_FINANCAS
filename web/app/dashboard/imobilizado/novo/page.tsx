import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { redirect } from 'next/navigation'

export default async function NovoImobilizadoPage({
  searchParams,
}: {
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

  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: unidades } = await supabase
    .from('unidades_negocio')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Novo bem</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/imobilizado" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select id="categoria" name="categoria" required defaultValue="">
                <option value="" disabled>
                  Selecione a categoria
                </option>
                <option value="benfeitoria">Benfeitoria</option>
                <option value="maquina">Máquina/Implemento</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor_aquisicao">Valor de aquisição (R$)</Label>
              <Input id="valor_aquisicao" name="valor_aquisicao" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor_residual">Valor residual (R$)</Label>
              <Input id="valor_residual" name="valor_residual" type="number" step="0.01" min="0" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_aquisicao">Data de aquisição</Label>
              <Input id="data_aquisicao" name="data_aquisicao" type="date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vida_util_anos">Vida útil (anos)</Label>
              <Input id="vida_util_anos" name="vida_util_anos" type="number" min="1" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unidade_negocio_id">Unidade de negócio</Label>
              <Select id="unidade_negocio_id" name="unidade_negocio_id" defaultValue="">
                <option value="">Não vinculado</option>
                {(unidades ?? []).map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Criar bem</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
