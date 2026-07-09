import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { GraficoPeso } from './grafico-peso'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vaca em lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vaca de descarte' },
  { valor: 'vaca_seca', rotulo: 'Vaca seca' },
  { valor: 'novilha_coberta', rotulo: 'Novilha coberta' },
  { valor: 'novilha_recria', rotulo: 'Novilha em recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneira em aleitamento' },
] as const

export default async function EditarAnimalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    redirect('/dashboard')
  }

  const { id } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: animal } = await supabase
    .from('animais')
    .select('id, brinco, nome, sexo, categoria, data_nascimento, mae_id, pai_texto, ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!animal) {
    notFound()
  }

  const { data: maes } = await supabase
    .from('animais')
    .select('id, brinco, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .eq('sexo', 'femea')
    .neq('id', animal.id)
    .order('brinco')

  const { data: pesagensAscendente } = await supabase
    .from('pesagens_animal')
    .select('id, data, peso_kg, observacao')
    .eq('animal_id', animal.id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('data', { ascending: true })

  const pesagens = pesagensAscendente ?? []
  const pesagensRecentesPrimeiro = [...pesagens].reverse()

  const { data: vacinasDb } = await supabase
    .from('vacinas_animal')
    .select('id, data, produto, proxima_dose_prevista, observacao')
    .eq('animal_id', animal.id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('data', { ascending: false })

  const vacinas = vacinasDb ?? []

  const { data: medicamentosDb } = await supabase
    .from('medicamentos_animal')
    .select('id, data, produto, dias_carencia, data_liberacao, observacao')
    .eq('animal_id', animal.id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('data', { ascending: false })

  const medicamentos = medicamentosDb ?? []

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {animal.brinco}
            {animal.nome && ` · ${animal.nome}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/producao/animais/${animal.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="brinco">Brinco</Label>
              <Input id="brinco" name="brinco" defaultValue={animal.brinco} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome (opcional)</Label>
              <Input id="nome" name="nome" defaultValue={animal.nome ?? ''} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sexo">Sexo</Label>
              <Select id="sexo" name="sexo" required defaultValue={animal.sexo}>
                <option value="femea">Fêmea</option>
                <option value="macho">Macho</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select id="categoria" name="categoria" required defaultValue={animal.categoria}>
                {CATEGORIAS.map((categoria) => (
                  <option key={categoria.valor} value={categoria.valor}>
                    {categoria.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_nascimento">Data de nascimento (opcional)</Label>
              <Input
                id="data_nascimento"
                name="data_nascimento"
                type="date"
                defaultValue={animal.data_nascimento ?? ''}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mae_id">Mãe (opcional)</Label>
              <Select id="mae_id" name="mae_id" defaultValue={animal.mae_id ?? ''}>
                <option value="">Não informada</option>
                {(maes ?? []).map((mae) => (
                  <option key={mae.id} value={mae.id}>
                    {mae.brinco}
                    {mae.nome && ` · ${mae.nome}`}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pai_texto">Pai (opcional)</Label>
              <Input id="pai_texto" name="pai_texto" defaultValue={animal.pai_texto ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>

          <form method="POST" action={`/api/producao/animais/${animal.id}/baixa`}>
            <Button type="submit" variant={animal.ativo ? 'destructive' : 'default'}>
              {animal.ativo ? 'Dar baixa' : 'Reativar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pesagens</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <GraficoPeso pesagens={pesagens} />

          {pesagensRecentesPrimeiro.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pesagem registrada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pesagensRecentesPrimeiro.map((pesagem) => (
                <li
                  key={pesagem.id}
                  className="flex items-center justify-between rounded-lg border border-input p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {pesagem.data} · {pesagem.peso_kg} kg
                    </p>
                    {pesagem.observacao && (
                      <p className="text-muted-foreground">{pesagem.observacao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/producao/rebanho/animais/${animal.id}/pesagens/${pesagem.id}/editar`}
                      className="text-sm underline"
                    >
                      Editar
                    </Link>
                    <form
                      method="POST"
                      action={`/api/producao/animais/${animal.id}/pesagens/${pesagem.id}/excluir`}
                    >
                      <Button type="submit" variant="destructive" size="sm">
                        Excluir
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {animal.ativo && (
            <form
              method="POST"
              action={`/api/producao/animais/${animal.id}/pesagens`}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="data">Data</Label>
                <Input id="data" name="data" type="date" defaultValue={hoje} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="peso_kg">Peso (kg)</Label>
                <Input id="peso_kg" name="peso_kg" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <Input id="observacao" name="observacao" />
              </div>
              <Button type="submit">Registrar pesagem</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vacinas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {vacinas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma vacina registrada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {vacinas.map((vacina) => (
                <li
                  key={vacina.id}
                  className="flex items-center justify-between rounded-lg border border-input p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {vacina.data} · {vacina.produto}
                    </p>
                    {vacina.proxima_dose_prevista && (
                      <p className="text-muted-foreground">
                        Próxima dose prevista: {vacina.proxima_dose_prevista}
                      </p>
                    )}
                    {vacina.observacao && (
                      <p className="text-muted-foreground">{vacina.observacao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/producao/rebanho/animais/${animal.id}/vacinas/${vacina.id}/editar`}
                      className="text-sm underline"
                    >
                      Editar
                    </Link>
                    <form
                      method="POST"
                      action={`/api/producao/animais/${animal.id}/vacinas/${vacina.id}/excluir`}
                    >
                      <Button type="submit" variant="destructive" size="sm">
                        Excluir
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {animal.ativo && (
            <form
              method="POST"
              action={`/api/producao/animais/${animal.id}/vacinas`}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="vacina_data">Data</Label>
                <Input id="vacina_data" name="data" type="date" defaultValue={hoje} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="vacina_produto">Produto</Label>
                <Input id="vacina_produto" name="produto" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="vacina_proxima_dose_prevista">
                  Próxima dose prevista (opcional)
                </Label>
                <Input id="vacina_proxima_dose_prevista" name="proxima_dose_prevista" type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="vacina_observacao">Observação (opcional)</Label>
                <Input id="vacina_observacao" name="observacao" />
              </div>
              <Button type="submit">Registrar vacina</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medicamentos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {medicamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum medicamento registrado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {medicamentos.map((medicamento) => {
                const emCarencia =
                  medicamento.data_liberacao !== null && medicamento.data_liberacao > hoje

                return (
                  <li
                    key={medicamento.id}
                    className="flex items-center justify-between rounded-lg border border-input p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {medicamento.data} · {medicamento.produto} · {medicamento.dias_carencia} dias
                        de carência
                      </p>
                      {emCarencia && (
                        <p className="text-destructive">
                          Em carência até {medicamento.data_liberacao}
                        </p>
                      )}
                      {medicamento.observacao && (
                        <p className="text-muted-foreground">{medicamento.observacao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/producao/rebanho/animais/${animal.id}/medicamentos/${medicamento.id}/editar`}
                        className="text-sm underline"
                      >
                        Editar
                      </Link>
                      <form
                        method="POST"
                        action={`/api/producao/animais/${animal.id}/medicamentos/${medicamento.id}/excluir`}
                      >
                        <Button type="submit" variant="destructive" size="sm">
                          Excluir
                        </Button>
                      </form>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {animal.ativo && (
            <form
              method="POST"
              action={`/api/producao/animais/${animal.id}/medicamentos`}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="medicamento_data">Data</Label>
                <Input id="medicamento_data" name="data" type="date" defaultValue={hoje} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="medicamento_produto">Produto</Label>
                <Input id="medicamento_produto" name="produto" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="medicamento_dias_carencia">Dias de carência</Label>
                <Input
                  id="medicamento_dias_carencia"
                  name="dias_carencia"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={0}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="medicamento_observacao">Observação (opcional)</Label>
                <Input id="medicamento_observacao" name="observacao" />
              </div>
              <Button type="submit">Registrar medicamento</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
