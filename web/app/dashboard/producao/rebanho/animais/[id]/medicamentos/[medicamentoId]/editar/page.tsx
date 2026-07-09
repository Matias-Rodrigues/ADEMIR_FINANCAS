import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notFound, redirect } from 'next/navigation'

export default async function EditarMedicamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; medicamentoId: string }>
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

  const { id, medicamentoId } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: medicamento } = await supabase
    .from('medicamentos_animal')
    .select('id, data, produto, dias_carencia, observacao')
    .eq('id', medicamentoId)
    .eq('animal_id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!medicamento) {
    notFound()
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar medicamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/producao/animais/${id}/medicamentos/${medicamento.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={medicamento.data} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="produto">Produto</Label>
              <Input id="produto" name="produto" defaultValue={medicamento.produto} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dias_carencia">Dias de carência</Label>
              <Input
                id="dias_carencia"
                name="dias_carencia"
                type="number"
                min="0"
                step="1"
                defaultValue={medicamento.dias_carencia}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input id="observacao" name="observacao" defaultValue={medicamento.observacao ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
