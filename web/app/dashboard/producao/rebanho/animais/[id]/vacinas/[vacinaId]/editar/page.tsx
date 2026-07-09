import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notFound, redirect } from 'next/navigation'

export default async function EditarVacinaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; vacinaId: string }>
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

  const { id, vacinaId } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: vacina } = await supabase
    .from('vacinas_animal')
    .select('id, data, produto, proxima_dose_prevista, observacao')
    .eq('id', vacinaId)
    .eq('animal_id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!vacina) {
    notFound()
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar vacina</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/producao/animais/${id}/vacinas/${vacina.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={vacina.data} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="produto">Produto</Label>
              <Input id="produto" name="produto" defaultValue={vacina.produto} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="proxima_dose_prevista">Próxima dose prevista (opcional)</Label>
              <Input
                id="proxima_dose_prevista"
                name="proxima_dose_prevista"
                type="date"
                defaultValue={vacina.proxima_dose_prevista ?? ''}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input id="observacao" name="observacao" defaultValue={vacina.observacao ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
