import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vaca em lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vaca de descarte' },
  { valor: 'vaca_seca', rotulo: 'Vaca seca' },
  { valor: 'novilha_coberta', rotulo: 'Novilha coberta' },
  { valor: 'novilha_recria', rotulo: 'Novilha em recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneira em aleitamento' },
] as const

type Animal = {
  id: string
  brinco: string
  nome: string | null
  categoria: string
  ativo: boolean
}

export default async function AnimaisPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: animais } = await supabase
    .from('animais')
    .select('id, brinco, nome, categoria, ativo')
    .order('brinco')

  const listaAnimais: Animal[] = animais ?? []

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Animais</h1>
        <Link
          href="/dashboard/producao/rebanho/animais/novo"
          className={buttonVariants({ variant: 'default' })}
        >
          Novo animal
        </Link>
      </div>

      {CATEGORIAS.map((categoria) => {
        const animaisDaCategoria = listaAnimais.filter((animal) => animal.categoria === categoria.valor)
        if (animaisDaCategoria.length === 0) {
          return null
        }
        return (
          <div key={categoria.valor} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{categoria.rotulo}</h2>
            <ul className="flex flex-col gap-2">
              {animaisDaCategoria.map((animal) => (
                <li
                  key={animal.id}
                  className={`flex items-center justify-between rounded-lg border border-input p-3 text-sm ${animal.ativo ? '' : 'opacity-50'}`}
                >
                  <div>
                    <p className="font-medium">
                      {animal.brinco}
                      {animal.nome && ` · ${animal.nome}`}
                    </p>
                    {!animal.ativo && <p className="text-muted-foreground">inativo</p>}
                  </div>
                  <Link
                    href={`/dashboard/producao/rebanho/animais/${animal.id}/editar`}
                    className="text-sm underline"
                  >
                    Editar
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </main>
  )
}
