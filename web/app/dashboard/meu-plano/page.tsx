import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { MODULOS_NEGOCIO } from '@/lib/modulos'
import { redirect } from 'next/navigation'

export default async function MeuPlanoPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const supabase = await createClient()
  const { data: modulosContratados } = await supabase
    .from('propriedade_modulos_contratados')
    .select('modulo, ativo')
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  const contratados = new Map((modulosContratados ?? []).map((m) => [m.modulo, m.ativo]))

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">Meu plano</h1>
      <ul className="flex flex-col gap-2">
        {MODULOS_NEGOCIO.map((modulo) => {
          const ativo = contratados.get(modulo.valor) ?? false
          return (
            <li
              key={modulo.valor}
              className="flex items-center justify-between rounded-lg border border-input px-3 py-2"
            >
              <span>{modulo.rotulo}</span>
              <span className={ativo ? 'text-primary' : 'text-muted-foreground'}>
                {ativo ? 'Contratado' : 'Não contratado'}
              </span>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
