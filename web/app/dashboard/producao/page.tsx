import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { buttonVariants } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ProducaoPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">Produção</h1>
      <nav className="flex flex-col gap-2">
        <Link href="/dashboard/producao/leite" className={buttonVariants({ variant: 'default' })}>
          Lançar produção do dia
        </Link>
        <Link href="/dashboard/producao/relatorio" className={buttonVariants({ variant: 'outline' })}>
          Relatório mensal
        </Link>
        <Link href="/dashboard/producao/rebanho" className={buttonVariants({ variant: 'outline' })}>
          Movimentar rebanho
        </Link>
      </nav>
    </main>
  )
}
