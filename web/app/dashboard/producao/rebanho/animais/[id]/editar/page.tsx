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

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vaca em lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vaca de descarte' },
  { valor: 'vaca_seca', rotulo: 'Vaca seca' },
  { valor: 'novilha_coberta', rotulo: 'Novilha coberta' },
  { valor: 'novilha_recria', rotulo: 'Novilha em recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneira em aleitamento' },
] as const

export default async function EditarAnimalPage({
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

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    redirect('/dashboard')
  }

  const { id } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: animal } = await supabase
    .from('animais')
    .select('id, brinco, nome, sexo, categoria, data_nascimento, mae_id, pai_texto, ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!animal) {
    notFound()
  }

  const { data: maes } = await supabase
    .from('animais')
    .select('id, brinco, nome')
    .eq('sexo', 'femea')
    .neq('id', animal.id)
    .order('brinco')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {animal.brinco}
            {animal.nome && ` · ${animal.nome}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/producao/animais/${animal.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="brinco">Brinco</Label>
              <Input id="brinco" name="brinco" defaultValue={animal.brinco} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome (opcional)</Label>
              <Input id="nome" name="nome" defaultValue={animal.nome ?? ''} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sexo">Sexo</Label>
              <Select id="sexo" name="sexo" required defaultValue={animal.sexo}>
                <option value="femea">Fêmea</option>
                <option value="macho">Macho</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select id="categoria" name="categoria" required defaultValue={animal.categoria}>
                {CATEGORIAS.map((categoria) => (
                  <option key={categoria.valor} value={categoria.valor}>
                    {categoria.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_nascimento">Data de nascimento (opcional)</Label>
              <Input
                id="data_nascimento"
                name="data_nascimento"
                type="date"
                defaultValue={animal.data_nascimento ?? ''}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mae_id">Mãe (opcional)</Label>
              <Select id="mae_id" name="mae_id" defaultValue={animal.mae_id ?? ''}>
                <option value="">Não informada</option>
                {(maes ?? []).map((mae) => (
                  <option key={mae.id} value={mae.id}>
                    {mae.brinco}
                    {mae.nome && ` · ${mae.nome}`}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pai_texto">Pai (opcional)</Label>
              <Input id="pai_texto" name="pai_texto" defaultValue={animal.pai_texto ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>

          <form method="POST" action={`/api/producao/animais/${animal.id}/baixa`}>
            <Button type="submit" variant={animal.ativo ? 'destructive' : 'default'}>
              {animal.ativo ? 'Dar baixa' : 'Reativar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
