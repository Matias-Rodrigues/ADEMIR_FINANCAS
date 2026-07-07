import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vacas lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vacas descarte' },
  { valor: 'vaca_seca', rotulo: 'Vacas secas' },
  { valor: 'novilha_coberta', rotulo: 'Novilhas cobertas' },
  { valor: 'novilha_recria', rotulo: 'Novilhas recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneiras' },
] as const

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function ultimoDiaDoMes(ano: number, mesIndice: number): string {
  const data = new Date(Date.UTC(ano, mesIndice + 1, 0))
  return data.toISOString().slice(0, 10)
}

export default async function RelatorioProducaoPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const anoAtual = new Date().getUTCFullYear()
  const { ano: anoParam } = await searchParams
  const ano = Number(anoParam) || anoAtual

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const { data: producaoMensal } = unidadeNegocioId
    ? await supabase
        .from('producao_leite_mensal')
        .select('*')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .gte('mes', `${ano}-01-01`)
        .lte('mes', `${ano}-12-31`)
        .order('mes')
    : { data: [] }

  const { data: qualidadeMensal } = unidadeNegocioId
    ? await supabase
        .from('qualidade_leite')
        .select('mes, ccs, cbt, gordura, proteina, esd')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .gte('mes', `${ano}-01-01`)
        .lte('mes', `${ano}-12-31`)
        .order('mes')
    : { data: [] }

  const composicaoPorMes = unidadeNegocioId
    ? await Promise.all(
        MESES.map(async (_, indice) => {
          const { data } = await supabase.rpc('rebanho_composicao', {
            p_unidade_negocio_id: unidadeNegocioId,
            p_data: ultimoDiaDoMes(ano, indice),
          })
          return { mes: MESES[indice], categorias: data ?? [] }
        })
      )
    : []

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-lg font-medium">Relatório de produção — {ano}</h1>

      <form method="GET" className="flex items-end gap-2">
        <Select name="ano" defaultValue={String(ano)} className="w-32">
          {[anoAtual, anoAtual - 1, anoAtual - 2, anoAtual - 3, anoAtual - 4].map((anoOpcao) => (
            <option key={anoOpcao} value={anoOpcao}>
              {anoOpcao}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Ver
        </Button>
      </form>

      <div className="overflow-x-auto">
        <h2 className="mb-2 text-sm font-medium">Produção de leite</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input text-left">
              <th className="p-2">Mês</th>
              <th className="p-2">Comercial</th>
              <th className="p-2">Descarte</th>
              <th className="p-2">Consumo</th>
              <th className="p-2">Total</th>
              <th className="p-2">Média diária</th>
              <th className="p-2">Vacas lactação</th>
              <th className="p-2">Média/vaca</th>
            </tr>
          </thead>
          <tbody>
            {(producaoMensal ?? []).map((linha) => (
              <tr key={linha.mes} className="border-b border-input">
                <td className="p-2">{MESES[new Date(linha.mes as string).getUTCMonth()]}</td>
                <td className="p-2">{linha.litros_comercial}</td>
                <td className="p-2">{linha.litros_descarte}</td>
                <td className="p-2">{linha.litros_consumo}</td>
                <td className="p-2">{linha.producao_total}</td>
                <td className="p-2">{Number(linha.media_diaria).toFixed(1)}</td>
                <td className="p-2">{linha.vacas_lactacao}</td>
                <td className="p-2">
                  {linha.media_por_vaca_lactacao_dia
                    ? Number(linha.media_por_vaca_lactacao_dia).toFixed(1)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <h2 className="mb-2 text-sm font-medium">Composição do rebanho</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input text-left">
              <th className="p-2">Mês</th>
              {CATEGORIAS.map((categoria) => (
                <th key={categoria.valor} className="p-2">
                  {categoria.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {composicaoPorMes.map((linha) => (
              <tr key={linha.mes} className="border-b border-input">
                <td className="p-2">{linha.mes}</td>
                {CATEGORIAS.map((categoria) => (
                  <td key={categoria.valor} className="p-2">
                    {linha.categorias.find((c) => c.categoria === categoria.valor)?.quantidade ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <h2 className="mb-2 text-sm font-medium">Qualidade do leite</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input text-left">
              <th className="p-2">Mês</th>
              <th className="p-2">CCS</th>
              <th className="p-2">CBT</th>
              <th className="p-2">Gordura %</th>
              <th className="p-2">Proteína %</th>
              <th className="p-2">ESD %</th>
            </tr>
          </thead>
          <tbody>
            {(qualidadeMensal ?? []).map((linha) => (
              <tr key={linha.mes} className="border-b border-input">
                <td className="p-2">{MESES[new Date(linha.mes as string).getUTCMonth()]}</td>
                <td className="p-2">{linha.ccs}</td>
                <td className="p-2">{linha.cbt}</td>
                <td className="p-2">{linha.gordura}</td>
                <td className="p-2">{linha.proteina}</td>
                <td className="p-2">{linha.esd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
