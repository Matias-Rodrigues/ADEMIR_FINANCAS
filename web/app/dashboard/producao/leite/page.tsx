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

const CAMPOS = [
  { valor: 'litros_comercial', rotulo: 'Litros comercial' },
  { valor: 'litros_descarte', rotulo: 'Litros descarte' },
  { valor: 'litros_consumo', rotulo: 'Litros consumo' },
] as const

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

  const { data: configuracao } = await supabase
    .from('configuracoes_captura_leite')
    .select('estilo_interacao')
    .eq('usuario_id', usuarioAtual.id)
    .maybeSingle()

  const { data: ordemConfigurada } = await supabase
    .from('ordem_captura_leite')
    .select('campo, posicao')
    .eq('usuario_id', usuarioAtual.id)

  const posicaoPorCampo = new Map(
    (ordemConfigurada ?? []).map((linha) => [linha.campo, linha.posicao])
  )

  const campos = [...CAMPOS].sort((a, b) => {
    const posicaoA = posicaoPorCampo.get(a.valor)
    const posicaoB = posicaoPorCampo.get(b.valor)

    if (posicaoA !== undefined && posicaoB !== undefined) {
      return posicaoA - posicaoB
    }
    if (posicaoA !== undefined) {
      return -1
    }
    if (posicaoB !== undefined) {
      return 1
    }
    return 0
  })

  const estiloInteracao = configuracao?.estilo_interacao ?? 'todos_visiveis'

  const valorPorCampo: Record<string, number> = {
    litros_comercial: lancamentoExistente?.litros_comercial ?? 0,
    litros_descarte: lancamentoExistente?.litros_descarte ?? 0,
    litros_consumo: lancamentoExistente?.litros_consumo ?? 0,
  }

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
            {campos.map((campo) => {
              const inputCampo = (
                <Input
                  id={campo.valor}
                  name={campo.valor}
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={valorPorCampo[campo.valor]}
                  required
                />
              )

              if (estiloInteracao === 'tocar_para_revelar') {
                return (
                  <details key={campo.valor} className="rounded-lg border border-input p-3">
                    <summary className="cursor-pointer font-medium">{campo.rotulo}</summary>
                    <div className="mt-2 flex flex-col gap-2">{inputCampo}</div>
                  </details>
                )
              }

              return (
                <div key={campo.valor} className="flex flex-col gap-2">
                  <Label htmlFor={campo.valor}>{campo.rotulo}</Label>
                  {inputCampo}
                </div>
              )
            })}
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
