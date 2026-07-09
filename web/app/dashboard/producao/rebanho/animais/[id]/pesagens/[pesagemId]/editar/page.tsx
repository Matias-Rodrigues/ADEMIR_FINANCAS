import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notFound, redirect } from 'next/navigation'

export default async function EditarPesagemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pesagemId: string }>
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

  const { id, pesagemId } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: pesagem } = await supabase
    .from('pesagens_animal')
    .select('id, data, peso_kg, observacao')
    .eq('id', pesagemId)
    .eq('animal_id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!pesagem) {
    notFound()
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar pesagem</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/producao/animais/${id}/pesagens/${pesagem.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={pesagem.data} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="peso_kg">Peso (kg)</Label>
              <Input
                id="peso_kg"
                name="peso_kg"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={pesagem.peso_kg}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input id="observacao" name="observacao" defaultValue={pesagem.observacao ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
