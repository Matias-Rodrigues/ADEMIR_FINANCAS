import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

export default async function NovoUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await requireAdmin()
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()

  const { data: pessoas } = await supabase
    .from('pessoas_fisicas')
    .select('id, nome, cpf')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  const { data: usuariosExistentes } = await supabase
    .from('usuarios')
    .select('pessoa_fisica_id')
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  const idsComUsuario = new Set((usuariosExistentes ?? []).map((u) => u.pessoa_fisica_id))
  const pessoasSemUsuario = (pessoas ?? []).filter((p) => !idsComUsuario.has(p.id))

  const { data: perfis } = await supabase
    .from('perfis_acesso')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/admin/usuarios" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Pessoa</span>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="modo" value="existente" defaultChecked />
                Pessoa já cadastrada
              </label>
              <Select name="pessoa_fisica_id" defaultValue="">
                <option value="" disabled>
                  Selecione uma pessoa
                </option>
                {pessoasSemUsuario.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome} ({pessoa.cpf})
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="modo" value="novo" />
                Pessoa nova
              </label>
              <div className="flex flex-col gap-2 pl-6">
                <Label htmlFor="nome_novo">Nome</Label>
                <Input id="nome_novo" name="nome_novo" />
                <Label htmlFor="cpf_novo">CPF</Label>
                <Input id="cpf_novo" name="cpf_novo" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha inicial</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="perfil_acesso_id">Perfil de acesso</Label>
              <Select id="perfil_acesso_id" name="perfil_acesso_id" required defaultValue="">
                <option value="" disabled>
                  Selecione um perfil
                </option>
                {(perfis ?? []).map((perfil) => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.nome}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Criar usuário</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
