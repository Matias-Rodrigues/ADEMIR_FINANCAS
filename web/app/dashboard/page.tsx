import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <p>Logado como: {user.email}</p>
      <form method="POST" action="/api/auth/logout">
        <Button type="submit" variant="outline">
          Sair
        </Button>
      </form>
    </main>
  )
}
