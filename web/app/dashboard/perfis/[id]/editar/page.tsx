import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { MODULOS_NEGOCIO } from '@/lib/modulos'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notFound } from 'next/navigation'

export default async function EditarPerfilPage({
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
  const { data: perfil } = await supabase
    .from('perfis_acesso')
    .select('id, nome, perfil_acesso_permissoes(modulo, pode_ver, pode_lancar)')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!perfil) {
    notFound()
  }

  const { data: contratados } = await supabase
    .from('propriedade_modulos_contratados')
    .select('modulo')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .eq('ativo', true)

  const modulosDisponiveis = MODULOS_NEGOCIO.filter((modulo) =>
    (contratados ?? []).some((c) => c.modulo === modulo.valor)
  )

  const permissoesPorModulo = new Map(perfil.perfil_acesso_permissoes.map((p) => [p.modulo, p]))

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar perfil de acesso</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form
            method="POST"
            action={`/api/perfis/${perfil.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome do perfil</Label>
              <Input id="nome" name="nome" defaultValue={perfil.nome} required />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Módulos</span>
              {modulosDisponiveis.map((modulo) => {
                const atual = permissoesPorModulo.get(modulo.valor)
                return (
                  <div
                    key={modulo.valor}
                    className="flex items-center gap-4 rounded-lg border border-input p-2"
                  >
                    <span className="flex-1">{modulo.rotulo}</span>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        name={`ver_${modulo.valor}`}
                        defaultChecked={atual?.pode_ver ?? false}
                      />
                      Ver
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        name={`lancar_${modulo.valor}`}
                        defaultChecked={atual?.pode_lancar ?? false}
                      />
                      Lançar
                    </label>
                  </div>
                )
              })}
            </div>
            <Button type="submit">Salvar</Button>
          </form>
          <form method="POST" action={`/api/perfis/${perfil.id}/excluir`} className="mt-4">
            <Button type="submit" variant="destructive">
              Excluir perfil
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
