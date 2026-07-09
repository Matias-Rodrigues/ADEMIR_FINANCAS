import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { redirect } from 'next/navigation'

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vaca em lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vaca de descarte' },
  { valor: 'vaca_seca', rotulo: 'Vaca seca' },
  { valor: 'novilha_coberta', rotulo: 'Novilha coberta' },
  { valor: 'novilha_recria', rotulo: 'Novilha em recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneira em aleitamento' },
] as const

export default async function ProducaoPorAnimalPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; ordenha?: string; error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    redirect('/dashboard')
  }

  const { data: dataParam, ordenha: ordenhaParam, error } = await searchParams
  const mensagem = mensagemErro(error)

  const hoje = new Date().toISOString().slice(0, 10)
  const data = dataParam || hoje
  const numeroOrdenha = Number(ordenhaParam) || 1

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const { data: animaisBrutos } = unidadeNegocioId
    ? await supabase
        .from('animais')
        .select('id, brinco, nome, categoria')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .eq('categoria', 'vaca_lactacao')
        .eq('ativo', true)
        .order('brinco')
    : { data: [] }

  const { data: lancamentosExistentes } = unidadeNegocioId
    ? await supabase
        .from('producao_animal')
        .select('animal_id, litros')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .eq('data', data)
        .eq('numero_ordenha', numeroOrdenha)
    : { data: [] }

  const litrosPorAnimal = new Map(
    (lancamentosExistentes ?? []).map((lancamento) => [lancamento.animal_id, lancamento.litros])
  )

  const { data: configuracao } = await supabase
    .from('configuracoes_captura_animal')
    .select('estilo_interacao, exibir_categoria')
    .eq('usuario_id', usuarioAtual.id)
    .maybeSingle()

  const { data: ordemConfigurada } = await supabase
    .from('ordem_captura_animal')
    .select('animal_id, posicao')
    .eq('usuario_id', usuarioAtual.id)

  const posicaoPorAnimal = new Map(
    (ordemConfigurada ?? []).map((linha) => [linha.animal_id, linha.posicao])
  )

  const animais = [...(animaisBrutos ?? [])].sort((a, b) => {
    const posicaoA = posicaoPorAnimal.get(a.id)
    const posicaoB = posicaoPorAnimal.get(b.id)

    if (posicaoA !== undefined && posicaoB !== undefined) {
      return posicaoA - posicaoB
    }
    if (posicaoA !== undefined) {
      return -1
    }
    if (posicaoB !== undefined) {
      return 1
    }
    return a.brinco.localeCompare(b.brinco)
  })

  const estiloInteracao = configuracao?.estilo_interacao ?? 'todos_visiveis'
  const exibirCategoria = configuracao?.exibir_categoria ?? false

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">Produção por animal</h1>

      <form method="GET" className="flex items-end gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="data">Data</Label>
          <Input id="data" name="data" type="date" defaultValue={data} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ordenha">Ordenha</Label>
          <Select id="ordenha" name="ordenha" defaultValue={String(numeroOrdenha)} className="w-24">
            <option value="1">1ª</option>
            <option value="2">2ª</option>
            <option value="3">3ª</option>
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Carregar
        </Button>
      </form>

      {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

      {animais.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum animal ativo em lactação cadastrado para esta unidade.
        </p>
      ) : (
        <form method="POST" action="/api/producao/leite/por-animal" className="flex flex-col gap-4">
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="numero_ordenha" value={numeroOrdenha} />
          {animais.map((animal) => {
            const rotuloCategoria = CATEGORIAS.find((c) => c.valor === animal.categoria)?.rotulo
            const rotulo = (
              <>
                {animal.brinco}
                {animal.nome && ` · ${animal.nome}`}
                {exibirCategoria && rotuloCategoria && ` · ${rotuloCategoria}`}
              </>
            )
            const campo = (
              <Input
                id={`litros_${animal.id}`}
                name={`litros_${animal.id}`}
                type="number"
                step="0.01"
                min="0"
                defaultValue={litrosPorAnimal.get(animal.id) ?? ''}
              />
            )

            if (estiloInteracao === 'tocar_para_revelar') {
              return (
                <details key={animal.id} className="rounded-lg border border-input p-3">
                  <summary className="cursor-pointer font-medium">{rotulo}</summary>
                  <div className="mt-2 flex flex-col gap-2">
                    <Label htmlFor={`litros_${animal.id}`}>Litros</Label>
                    {campo}
                  </div>
                </details>
              )
            }

            return (
              <div key={animal.id} className="flex flex-col gap-2">
                <Label htmlFor={`litros_${animal.id}`}>{rotulo}</Label>
                {campo}
              </div>
            )
          })}
          <Button type="submit">Salvar lançamentos</Button>
        </form>
      )}
    </main>
  )
}
