import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const usuarioAtual = await getUsuarioAtual()
  const ehAdminOuDev = usuarioAtual?.papel === 'admin' || usuarioAtual?.papel === 'dev'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <p>Logado como: {user.email}</p>
      <nav className="flex flex-col gap-2">
        {ehAdminOuDev && (
          <>
            <Link href="/dashboard/perfis" className="underline">
              Perfis de acesso
            </Link>
            <Link href="/dashboard/usuarios" className="underline">
              Usuários
            </Link>
          </>
        )}
        <Link href="/dashboard/meu-plano" className="underline">
          Meu plano
        </Link>
      </nav>
      <form method="POST" action="/api/auth/logout">
        <Button type="submit" variant="outline">
          Sair
        </Button>
      </form>
    </main>
  )
}
