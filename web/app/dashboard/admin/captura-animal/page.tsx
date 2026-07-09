import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehDev } from '@/lib/auth/current-usuario'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { redirect } from 'next/navigation'

export default async function CapturaAnimalAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ propriedade_id?: string; usuario_id?: string; error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  if (!ehDev(usuarioAtual)) {
    redirect('/dashboard')
  }

  const { propriedade_id: propriedadeId, usuario_id: usuarioId, error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()

  const { data: propriedades } = await supabase.from('propriedades').select('id, nome').order('nome')

  const { data: usuariosDaPropriedade } = propriedadeId
    ? await supabase
        .from('usuarios')
        .select('id, papel, pessoas_fisicas(nome)')
        .eq('propriedade_id', propriedadeId)
        .order('created_at')
    : { data: [] }

  const { data: animais } = propriedadeId
    ? await supabase
        .from('animais')
        .select('id, brinco, nome')
        .eq('propriedade_id', propriedadeId)
        .eq('categoria', 'vaca_lactacao')
        .eq('ativo', true)
        .order('brinco')
    : { data: [] }

  const { data: configuracaoAtual } = usuarioId
    ? await supabase
        .from('configuracoes_captura_animal')
        .select('estilo_interacao, exibir_categoria')
        .eq('usuario_id', usuarioId)
        .maybeSingle()
    : { data: null }

  const { data: ordemAtual } = usuarioId
    ? await supabase.from('ordem_captura_animal').select('animal_id, posicao').eq('usuario_id', usuarioId)
    : { data: [] }

  const posicaoPorAnimal = new Map((ordemAtual ?? []).map((linha) => [linha.animal_id, linha.posicao]))

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">Motor de captura configurável</h1>

      {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

      <Card>
        <CardHeader>
          <CardTitle>1. Propriedade</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET" className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="propriedade_id">Propriedade</Label>
              <Select id="propriedade_id" name="propriedade_id" defaultValue={propriedadeId ?? ''}>
                <option value="" disabled>
                  Selecione a propriedade
                </option>
                {(propriedades ?? []).map((propriedade) => (
                  <option key={propriedade.id} value={propriedade.id}>
                    {propriedade.nome}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline">
              Escolher
            </Button>
          </form>
        </CardContent>
      </Card>

      {propriedadeId && (
        <Card>
          <CardHeader>
            <CardTitle>2. Usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="GET" className="flex items-end gap-2">
              <input type="hidden" name="propriedade_id" value={propriedadeId} />
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="usuario_id">Usuário</Label>
                <Select id="usuario_id" name="usuario_id" defaultValue={usuarioId ?? ''}>
                  <option value="" disabled>
                    Selecione o usuário
                  </option>
                  {(usuariosDaPropriedade ?? []).map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.pessoas_fisicas?.nome ?? usuario.papel} ({usuario.papel})
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="outline">
                Escolher
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {propriedadeId && usuarioId && (
        <Card>
          <CardHeader>
            <CardTitle>3. Configuração de captura</CardTitle>
          </CardHeader>
          <CardContent>
            {(animais ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum animal ativo em lactação cadastrado para esta propriedade.
              </p>
            ) : (
              <form method="POST" action="/api/admin/captura-animal" className="flex flex-col gap-4">
                <input type="hidden" name="propriedade_id" value={propriedadeId} />
                <input type="hidden" name="usuario_id" value={usuarioId} />

                <div className="flex flex-col gap-2">
                  <Label htmlFor="estilo_interacao">Estilo de interação</Label>
                  <Select
                    id="estilo_interacao"
                    name="estilo_interacao"
                    defaultValue={configuracaoAtual?.estilo_interacao ?? 'todos_visiveis'}
                  >
                    <option value="todos_visiveis">Todos os campos visíveis</option>
                    <option value="tocar_para_revelar">Tocar para revelar</option>
                  </Select>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="exibir_categoria"
                    defaultChecked={configuracaoAtual?.exibir_categoria ?? false}
                  />
                  Exibir categoria do animal
                </label>

                <div className="flex flex-col gap-2">
                  <Label>Ordem dos animais (posição)</Label>
                  {(animais ?? []).map((animal) => (
                    <div key={animal.id} className="flex items-center gap-2">
                      <Label htmlFor={`posicao_${animal.id}`} className="flex-1">
                        {animal.brinco}
                        {animal.nome && ` · ${animal.nome}`}
                      </Label>
                      <Input
                        id={`posicao_${animal.id}`}
                        name={`posicao_${animal.id}`}
                        type="number"
                        min="1"
                        step="1"
                        className="w-20"
                        defaultValue={posicaoPorAnimal.get(animal.id) ?? ''}
                      />
                    </div>
                  ))}
                </div>

                <Button type="submit">Salvar configuração</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
