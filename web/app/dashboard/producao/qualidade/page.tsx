import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { redirect } from 'next/navigation'

export default async function QualidadeLeitePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const { mes: mesParam, error } = await searchParams
  const mensagem = mensagemErro(error)
  const hoje = new Date()
  const mesAtual = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`
  const mesSelecionado = mesParam ?? mesAtual

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const { data: resultadoExistente } = unidadeNegocioId
    ? await supabase
        .from('qualidade_leite')
        .select('ccs, cbt, gordura, proteina, esd')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .eq('mes', `${mesSelecionado}-01`)
        .maybeSingle()
    : { data: null }

  const { data: ultimosResultados } = unidadeNegocioId
    ? await supabase
        .from('qualidade_leite')
        .select('mes, ccs, cbt, gordura, proteina, esd')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .order('mes', { ascending: false })
        .limit(6)
    : { data: [] }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Qualidade do leite do mês</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/producao/qualidade" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mes">Mês</Label>
              <Input id="mes" name="mes" type="month" defaultValue={mesSelecionado} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ccs">CCS (x1000)</Label>
              <Input
                id="ccs"
                name="ccs"
                type="number"
                step="0.01"
                min="0"
                defaultValue={resultadoExistente?.ccs ?? ''}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cbt">CBT (x1000)</Label>
              <Input
                id="cbt"
                name="cbt"
                type="number"
                step="0.01"
                min="0"
                defaultValue={resultadoExistente?.cbt ?? ''}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gordura">Gordura (%)</Label>
              <Input
                id="gordura"
                name="gordura"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={resultadoExistente?.gordura ?? ''}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="proteina">Proteína (%)</Label>
              <Input
                id="proteina"
                name="proteina"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={resultadoExistente?.proteina ?? ''}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="esd">ESD (%)</Label>
              <Input
                id="esd"
                name="esd"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={resultadoExistente?.esd ?? ''}
                required
              />
            </div>
            <Button type="submit">{resultadoExistente ? 'Salvar alterações' : 'Lançar'}</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Últimos resultados</h2>
        <ul className="flex flex-col gap-2">
          {(ultimosResultados ?? []).map((resultado) => (
            <li
              key={resultado.mes}
              className="flex items-center justify-between rounded-lg border border-input p-3 text-sm"
            >
              <span>{String(resultado.mes).slice(0, 7)}</span>
              <span className="text-muted-foreground">
                CCS {resultado.ccs} · CBT {resultado.cbt} · Gord {resultado.gordura}%
              </span>
              <a
                href={`/dashboard/producao/qualidade?mes=${String(resultado.mes).slice(0, 7)}`}
                className="underline"
              >
                Editar
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
