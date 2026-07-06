import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

export default async function PerfisPage() {
  const usuarioAtual = await requireAdmin()
  const supabase = await createClient()

  const { data: perfis } = await supabase
    .from('perfis_acesso')
    .select('id, nome, perfil_acesso_permissoes(modulo, pode_ver, pode_lancar)')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Perfis de acesso</h1>
        <Link href="/dashboard/perfis/novo" className={buttonVariants({ variant: 'default' })}>
          Novo perfil
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {(perfis ?? []).map((perfil) => (
          <li key={perfil.id} className="rounded-lg border border-input p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{perfil.nome}</span>
              <Link href={`/dashboard/perfis/${perfil.id}/editar`} className="text-sm underline">
                Editar
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              {perfil.perfil_acesso_permissoes.length} módulo(s) configurado(s)
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}
