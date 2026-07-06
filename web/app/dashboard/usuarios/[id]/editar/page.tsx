import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { notFound } from 'next/navigation'

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await requireAdmin()
  const { id } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, papel, ativo, perfil_acesso_id, pessoas_fisicas(nome)')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!usuario) {
    notFound()
  }

  const { data: perfis } = await supabase
    .from('perfis_acesso')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{usuario.pessoas_fisicas?.nome ?? 'Usuário'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/admin/usuarios/${usuario.id}/perfil`}
            className="flex flex-col gap-2"
          >
            <Label htmlFor="perfil_acesso_id">Perfil de acesso</Label>
            <Select
              id="perfil_acesso_id"
              name="perfil_acesso_id"
              defaultValue={usuario.perfil_acesso_id ?? ''}
            >
              <option value="">Sem perfil</option>
              {(perfis ?? []).map((perfil) => (
                <option key={perfil.id} value={perfil.id}>
                  {perfil.nome}
                </option>
              ))}
            </Select>
            <Button type="submit">Salvar perfil</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
