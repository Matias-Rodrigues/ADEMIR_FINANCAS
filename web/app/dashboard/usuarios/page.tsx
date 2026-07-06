import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

export default async function UsuariosPage() {
  const usuarioAtual = await requireAdmin()
  const supabase = await createClient()

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, papel, ativo, pessoas_fisicas(nome), perfis_acesso(nome)')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('created_at')

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Usuários</h1>
        <Link href="/dashboard/usuarios/novo" className={buttonVariants({ variant: 'default' })}>
          Novo usuário
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {(usuarios ?? []).map((usuario) => (
          <li
            key={usuario.id}
            className="flex items-center justify-between rounded-lg border border-input p-3"
          >
            <div>
              <p className="font-medium">{usuario.pessoas_fisicas?.nome ?? '(sem pessoa vinculada)'}</p>
              <p className="text-sm text-muted-foreground">
                {usuario.papel} · {usuario.perfis_acesso?.nome ?? 'sem perfil'} ·{' '}
                {usuario.ativo ? 'ativo' : 'inativo'}
              </p>
            </div>
            <Link href={`/dashboard/usuarios/${usuario.id}/editar`} className="text-sm underline">
              Gerenciar
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
