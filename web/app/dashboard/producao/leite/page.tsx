import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { mensagemErro, mensagemAviso } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { redirect } from 'next/navigation'
import { GravadorAudio } from './gravador-audio'

export default async function LancamentoLeitePage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; error?: string; aviso?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const { data: dataParam, error, aviso } = await searchParams
  const mensagem = mensagemErro(error)
  const mensagemDeAviso = mensagemAviso(aviso)
  const dataSelecionada = dataParam ?? new Date().toISOString().slice(0, 10)

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const { data: lancamentoExistente } = unidadeNegocioId
    ? await supabase
        .from('producao_leite')
        .select('litros_comercial, litros_descarte, litros_consumo')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .eq('data', dataSelecionada)
        .maybeSingle()
    : { data: null }

  const { data: ultimosLancamentos } = unidadeNegocioId
    ? await supabase
        .from('producao_leite')
        .select('data, litros_comercial, litros_descarte, litros_consumo')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .order('data', { ascending: false })
        .limit(7)
    : { data: [] }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Produção de leite do dia</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          {mensagemDeAviso && <p className="mb-4 text-sm text-amber-600">{mensagemDeAviso}</p>}
          <form
            method="POST"
            action="/api/producao/leite"
            encType="multipart/form-data"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={dataSelecionada} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="litros_comercial">Litros comercial</Label>
              <Input
                id="litros_comercial"
                name="litros_comercial"
                type="number"
                step="0.01"
                min="0"
                defaultValue={lancamentoExistente?.litros_comercial ?? 0}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="litros_descarte">Litros descarte</Label>
              <Input
                id="litros_descarte"
                name="litros_descarte"
                type="number"
                step="0.01"
                min="0"
                defaultValue={lancamentoExistente?.litros_descarte ?? 0}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="litros_consumo">Litros consumo</Label>
              <Input
                id="litros_consumo"
                name="litros_consumo"
                type="number"
                step="0.01"
                min="0"
                defaultValue={lancamentoExistente?.litros_consumo ?? 0}
                required
              />
            </div>
            <GravadorAudio />
            <Button type="submit">{lancamentoExistente ? 'Salvar alterações' : 'Lançar'}</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Últimos lançamentos</h2>
        <ul className="flex flex-col gap-2">
          {(ultimosLancamentos ?? []).map((lancamento) => (
            <li
              key={lancamento.data}
              className="flex items-center justify-between rounded-lg border border-input p-3 text-sm"
            >
              <span>{lancamento.data}</span>
              <span className="text-muted-foreground">
                {lancamento.litros_comercial + lancamento.litros_descarte + lancamento.litros_consumo} L
              </span>
              <a href={`/dashboard/producao/leite?data=${lancamento.data}`} className="underline">
                Editar
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
