import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { rotuloCategoria } from '@/lib/financeiro-negocio/categorias'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Lancamento = {
  id: string
  tipo: string
  categoria: string | null
  valor: number
  data: string
  descricao: string | null
}

function GrupoUnidade({ nome, lancamentos }: { nome: string; lancamentos: Lancamento[] }) {
  const totalReceita = lancamentos
    .filter((lancamento) => lancamento.tipo === 'receita')
    .reduce((soma, lancamento) => soma + lancamento.valor, 0)
  const totalDespesa = lancamentos
    .filter((lancamento) => lancamento.tipo === 'despesa')
    .reduce((soma, lancamento) => soma + lancamento.valor, 0)

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{nome}</h2>
      <ul className="flex flex-col gap-2">
        {lancamentos.map((lancamento) => (
          <li
            key={lancamento.id}
            className="flex items-center justify-between rounded-lg border border-input p-3 text-sm"
          >
            <div>
              <p className="font-medium">{lancamento.categoria ? rotuloCategoria(lancamento.categoria) : 'Sem categoria'}</p>
              <p className="text-muted-foreground">
                {lancamento.data}
                {lancamento.descricao && ` · ${lancamento.descricao}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={lancamento.tipo === 'receita' ? 'text-green-600' : 'text-destructive'}>
                {lancamento.tipo === 'receita' ? '+' : '−'} R$ {lancamento.valor.toFixed(2)}
              </span>
              <Link href={`/dashboard/financeiro-negocio/${lancamento.id}/editar`} className="text-sm underline">
                Editar
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium">
        Receita: R$ {totalReceita.toFixed(2)} · Despesa: R$ {totalDespesa.toFixed(2)} · Saldo: R${' '}
        {(totalReceita - totalDespesa).toFixed(2)}
      </p>
    </div>
  )
}

export default async function FinanceiroNegocioPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('financeiro_negocio', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const agora = new Date()
  const primeiroDia = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
  const ultimoDia = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)

  const supabase = await createClient()
  const { data: unidades } = await supabase
    .from('unidades_negocio')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  const { data: lancamentos } = await supabase
    .from('lancamentos_financeiros_negocio')
    .select('id, tipo, categoria, valor, data, descricao, unidade_negocio_id')
    .gte('data', primeiroDia)
    .lte('data', ultimoDia)
    .order('data', { ascending: false })

  const lancamentosPorUnidade = new Map<string, Lancamento[]>()
  for (const lancamento of lancamentos ?? []) {
    const grupo = lancamentosPorUnidade.get(lancamento.unidade_negocio_id) ?? []
    grupo.push(lancamento)
    lancamentosPorUnidade.set(lancamento.unidade_negocio_id, grupo)
  }

  const totalReceitaGeral = (lancamentos ?? [])
    .filter((lancamento) => lancamento.tipo === 'receita')
    .reduce((soma, lancamento) => soma + lancamento.valor, 0)
  const totalDespesaGeral = (lancamentos ?? [])
    .filter((lancamento) => lancamento.tipo === 'despesa')
    .reduce((soma, lancamento) => soma + lancamento.valor, 0)

  const gruposComLancamentos = (unidades ?? []).filter(
    (unidade) => (lancamentosPorUnidade.get(unidade.id)?.length ?? 0) > 0
  )

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Financeiro do negócio</h1>
        <Link href="/dashboard/financeiro-negocio/novo" className={buttonVariants({ variant: 'default' })}>
          Novo lançamento
        </Link>
      </div>

      <p className="text-base font-semibold">
        Saldo do mês: R$ {(totalReceitaGeral - totalDespesaGeral).toFixed(2)}
      </p>

      {gruposComLancamentos.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês ainda.</p>
      )}

      {gruposComLancamentos.map((unidade) => (
        <GrupoUnidade
          key={unidade.id}
          nome={unidade.nome}
          lancamentos={lancamentosPorUnidade.get(unidade.id) ?? []}
        />
      ))}
    </main>
  )
}
