import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Bem = {
  id: string
  categoria: string
  nome: string
  valor_aquisicao: number
  depreciacao_anual: number
  depreciacao_mensal: number
  ativo: boolean
}

function TabelaCategoria({ titulo, bens }: { titulo: string; bens: Bem[] }) {
  const totalAnual = bens
    .filter((bem) => bem.ativo)
    .reduce((soma, bem) => soma + bem.depreciacao_anual, 0)

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{titulo}</h2>
      <ul className="flex flex-col gap-2">
        {bens.map((bem) => (
          <li
            key={bem.id}
            className={`flex items-center justify-between rounded-lg border border-input p-3 text-sm ${bem.ativo ? '' : 'opacity-50'}`}
          >
            <div>
              <p className="font-medium">{bem.nome}</p>
              <p className="text-muted-foreground">
                Aquisição R$ {bem.valor_aquisicao} · Depreciação R$ {bem.depreciacao_anual.toFixed(2)}/ano
                ({bem.depreciacao_mensal.toFixed(2)}/mês)
                {!bem.ativo && ' · inativo'}
              </p>
            </div>
            <Link href={`/dashboard/imobilizado/${bem.id}/editar`} className="text-sm underline">
              Editar
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium">
        Total {titulo.toLowerCase()}: R$ {totalAnual.toFixed(2)}/ano
      </p>
    </div>
  )
}

export default async function ImobilizadoPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('imobilizado', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: bens } = await supabase
    .from('imobilizados_depreciacao')
    .select('id, categoria, nome, valor_aquisicao, depreciacao_anual, depreciacao_mensal, ativo')
    .order('nome')

  const bensNormalizados: Bem[] = (bens ?? []).map((bem) => ({
    id: bem.id ?? '',
    categoria: bem.categoria ?? '',
    nome: bem.nome ?? '',
    valor_aquisicao: bem.valor_aquisicao ?? 0,
    depreciacao_anual: bem.depreciacao_anual ?? 0,
    depreciacao_mensal: bem.depreciacao_mensal ?? 0,
    ativo: bem.ativo ?? false,
  }))

  const benfeitorias = bensNormalizados.filter((bem) => bem.categoria === 'benfeitoria')
  const maquinas = bensNormalizados.filter((bem) => bem.categoria === 'maquina')
  const totalGeral = bensNormalizados
    .filter((bem) => bem.ativo)
    .reduce((soma, bem) => soma + bem.depreciacao_anual, 0)

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Imobilizado</h1>
        <Link href="/dashboard/imobilizado/novo" className={buttonVariants({ variant: 'default' })}>
          Novo bem
        </Link>
      </div>

      <TabelaCategoria titulo="Benfeitorias" bens={benfeitorias} />
      <TabelaCategoria titulo="Máquinas e Implementos" bens={maquinas} />

      <p className="text-base font-semibold">Total geral: R$ {totalGeral.toFixed(2)}/ano</p>
    </main>
  )
}
