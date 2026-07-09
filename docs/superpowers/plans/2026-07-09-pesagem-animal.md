# Pesagem de Animal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar registro de peso ao longo do tempo para qualquer animal ativo, com listagem, edição, exclusão e um gráfico de evolução (SVG server-side), conforme `docs/superpowers/specs/2026-07-09-pesagem-animal-design.md`.

**Architecture:** Tabela nova `pesagens_animal` com RLS multi-tenant (4 policies: select/insert/update/delete) no mesmo padrão já usado em `animais`/`producao_animal`. Frontend estende a página de edição de animal já existente (`web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`) com uma seção nova (gráfico + lista + formulário de criação), mais uma tela própria de edição de pesagem. O gráfico é um componente de função pura que retorna markup `<svg>`, sem `'use client'` e sem biblioteca de gráfico — mantém a convenção de zero JavaScript no cliente do projeto.

**Tech Stack:** Postgres/Supabase local + pgTAP (backend); Next.js (App Router) + TypeScript + shadcn/ui (frontend, fundação já pronta).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente — toda mudança usa `create table`/`create policy` numa migration nova.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Toda mutação de frontend é Route Handler HTML puro (`method="POST"`), sem JavaScript no cliente.
- Qualquer animal ativo pode ser pesado — sem restrição de categoria.
- Sem periodicidade fixa e sem unicidade em (`animal_id`, `data`) — múltiplos lançamentos no mesmo dia são válidos.
- Edição e exclusão de pesagem são reais (update/delete diretos) — diferente do padrão de "nunca deletar, só toggle de `ativo`" usado em `animais`/`imobilizados`. Uma pesagem é um registro de log pontual, não uma entidade permanente.
- IDs recebidos de formulário que referenciam outra tabela (`animal_id`) são sempre validados como pertencentes à propriedade do chamador antes de usar — reaproveita `animalPertenceAPropriedade` (`web/lib/producao/validar-animal.ts`).
- `data` de pesagem não pode ser no futuro.
- Toda query/mutação filtra `propriedade_id` explicitamente (defesa em profundidade), sem confiar só em RLS.
- Sem suíte de testes automatizados de frontend — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- O Supabase local precisa estar rodando; comandos do Supabase CLI rodam na raiz do repositório, comandos `npm`/`npx` do frontend rodam dentro de `web/`.

### Fixtures de teste

Reutiliza a propriedade seedada (`00000000-0000-0000-0000-000000000001`) e a unidade de negócio "Gado leiteiro" (`00000000-0000-0000-0000-000000000002`, `tipo = 'leite'`). Admin de teste: `admin.producao@ademir.local` / `senha-admin-123` (se a fixture não existir no ambiente local, recrie via Admin API: `POST /auth/v1/admin/users` + insert em `public.usuarios` com `propriedade_id=00000000-0000-0000-0000-000000000001`, `papel=admin`). Para testar via curl é necessário pelo menos um animal cadastrado — se não houver, crie um via `POST /api/producao/animais` (rota já existente).

---

### Task 1: Schema — tabela `pesagens_animal`

**Files:**
- Create: `supabase/migrations/20260709172000_pesagens_animal.sql`
- Create: `supabase/tests/database/36_pesagens_animal.sql`

**Interfaces:**
- Consumes: `public.animais` (já existente), `public.propriedades`, `public.usuarios`, `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`, `public.tem_permissao(modulo text, acao text)`.
- Produces: tabela `public.pesagens_animal` (colunas `id`, `propriedade_id`, `animal_id`, `data`, `peso_kg`, `observacao`, `criado_por`, `created_at`) — consumida pelas Tasks 2, 3, 4.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/36_pesagens_animal.sql`:

```sql
begin;
select plan(8);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('22222222-2222-2222-2222-222222222222', 'Propriedade Outro Cliente');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo) values
  ('11111111-1111-1111-1111-111111111111', 'producao', true),
  ('22222222-2222-2222-2222-222222222222', 'producao', true);
insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com'),
  ('44444444-4444-4444-4444-444444444444', 'outrocliente@teste.com');
insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'pesagens_animal', 'tabela pesagens_animal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.animais (id, propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por) values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'femea', 'terneira_aleitamento', '33333333-3333-3333-3333-333333333333');

insert into public.pesagens_animal (id, propriedade_id, animal_id, data, peso_kg, criado_por) values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 45.5, '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.pesagens_animal),
  1,
  'admin deve conseguir lancar uma pesagem'
);

select throws_ok(
  $$insert into public.pesagens_animal (propriedade_id, animal_id, data, peso_kg, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 0, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "pesagens_animal" violates check constraint "pesagens_animal_peso_kg_check"',
  'peso zero ou negativo deve ser rejeitado'
);

insert into public.pesagens_animal (propriedade_id, animal_id, data, peso_kg, criado_por) values
  ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 46.0, '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.pesagens_animal where animal_id = '77777777-7777-7777-7777-777777777777' and data = '2026-07-09'),
  2,
  'multiplas pesagens no mesmo dia devem ser aceitas'
);

update public.pesagens_animal set peso_kg = 47.0 where id = '88888888-8888-8888-8888-888888888888';

select is(
  (select peso_kg from public.pesagens_animal where id = '88888888-8888-8888-8888-888888888888'),
  47.0,
  'admin deve conseguir editar uma pesagem ja lancada'
);

-- usuario de OUTRA propriedade nao deve ver, editar nem excluir a pesagem acima
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.pesagens_animal),
  0,
  'usuario de outra propriedade nao deve ver pesagens alheias (isolamento RLS)'
);

update public.pesagens_animal set peso_kg = 999 where id = '88888888-8888-8888-8888-888888888888';
delete from public.pesagens_animal where id = '88888888-8888-8888-8888-888888888888';

-- volta ao contexto do admin dono para conferir que nada mudou
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select peso_kg from public.pesagens_animal where id = '88888888-8888-8888-8888-888888888888'),
  47.0,
  'usuario de outra propriedade nao deve conseguir editar pesagem alheia (isolamento RLS)'
);

select is(
  (select count(*)::int from public.pesagens_animal where id = '88888888-8888-8888-8888-888888888888'),
  1,
  'usuario de outra propriedade nao deve conseguir excluir pesagem alheia (isolamento RLS)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Da raiz do repositório:

```bash
npx supabase test db
```

Expected: falha em `has_table` (a tabela `pesagens_animal` ainda não existe).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260709172000_pesagens_animal.sql`:

```sql
create table public.pesagens_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  data date not null,
  peso_kg numeric(6,2) not null check (peso_kg > 0),
  observacao text,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.pesagens_animal enable row level security;

create index pesagens_animal_propriedade_id_idx on public.pesagens_animal(propriedade_id);
create index pesagens_animal_animal_id_idx on public.pesagens_animal(animal_id);

create policy "ver pesagens de animal da propria propriedade"
  on public.pesagens_animal for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar pesagens de animal da propria propriedade"
  on public.pesagens_animal for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar pesagens de animal da propria propriedade"
  on public.pesagens_animal for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "excluir pesagens de animal da propria propriedade"
  on public.pesagens_animal for delete
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 8 testes de `36_pesagens_animal.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts 2>/dev/null
cd ..
```

**Atenção:** use `2>/dev/null` para evitar que texto de status do CLI vaze para dentro do arquivo. Confirme que a primeira linha é `export type Json = ...` e rode `npx tsc --noEmit` dentro de `web/` para confirmar que o arquivo é TypeScript válido.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260709172000_pesagens_animal.sql supabase/tests/database/36_pesagens_animal.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona tabela de pesagens de animal"
```

---

### Task 2: Gráfico, listagem e criação de pesagem

**Files:**
- Create: `web/app/api/producao/animais/[id]/pesagens/route.ts`
- Create: `web/app/dashboard/producao/rebanho/animais/[id]/editar/grafico-peso.tsx`
- Modify: `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`
- Modify: `web/lib/erros-formulario.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro`, `animalPertenceAPropriedade` (`@/lib/producao/validar-animal`, já existente); tabela `pesagens_animal` (Task 1).
- Produces: componente `GraficoPeso({ pesagens }: { pesagens: { data: string; peso_kg: number }[] })` — consumido pela Task 3 (a tela de edição de pesagem não precisa dele, mas ele fica disponível caso uma fatia futura queira reutilizá-lo).

- [ ] **Step 1: Editar `web/lib/erros-formulario.ts`** — adicionar o código de erro que falta ao objeto `MENSAGENS` (junto aos já existentes):

```ts
  peso_invalido: 'Informe um peso maior que zero.',
```

- [ ] **Step 2: Criar `web/app/dashboard/producao/rebanho/animais/[id]/editar/grafico-peso.tsx`**

```tsx
type Pesagem = {
  data: string
  peso_kg: number
}

export function GraficoPeso({ pesagens }: { pesagens: Pesagem[] }) {
  if (pesagens.length < 2) {
    return null
  }

  const largura = 320
  const altura = 160
  const preenchimento = 24

  const pesos = pesagens.map((pesagem) => pesagem.peso_kg)
  const pesoMinimo = Math.min(...pesos)
  const pesoMaximo = Math.max(...pesos)
  const variacao = pesoMaximo - pesoMinimo || 1

  const pontos = pesagens.map((pesagem, indice) => {
    const x =
      preenchimento + (indice / (pesagens.length - 1)) * (largura - 2 * preenchimento)
    const y =
      altura -
      preenchimento -
      ((pesagem.peso_kg - pesoMinimo) / variacao) * (altura - 2 * preenchimento)
    return { x, y }
  })

  const pontosSvg = pontos.map((ponto) => `${ponto.x},${ponto.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      className="w-full max-w-sm text-foreground"
      role="img"
      aria-label="Gráfico de evolução de peso"
    >
      <line
        x1={preenchimento}
        y1={altura - preenchimento}
        x2={largura - preenchimento}
        y2={altura - preenchimento}
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      <line
        x1={preenchimento}
        y1={preenchimento}
        x2={preenchimento}
        y2={altura - preenchimento}
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      <polyline points={pontosSvg} fill="none" stroke="currentColor" strokeWidth={2} />
      {pontos.map((ponto, indice) => (
        <circle key={indice} cx={ponto.x} cy={ponto.y} r={3} fill="currentColor" />
      ))}
    </svg>
  )
}
```

- [ ] **Step 3: Criar `web/app/api/producao/animais/[id]/pesagens/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { animalPertenceAPropriedade } from '@/lib/producao/validar-animal'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const data = String(formData.get('data') ?? '')
  const pesoKg = Number(formData.get('peso_kg'))
  const observacaoForm = String(formData.get('observacao') ?? '').trim()
  const observacao = observacaoForm === '' ? null : observacaoForm

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(`/dashboard/producao/rebanho/animais/${id}/editar?error=${codigo}`, request.url),
      { status: 303 }
    )

  const hoje = new Date().toISOString().slice(0, 10)
  if (!data || Number.isNaN(Date.parse(data)) || data > hoje) {
    return redirecionarComErro('data_invalida')
  }

  if (Number.isNaN(pesoKg) || pesoKg <= 0) {
    return redirecionarComErro('peso_invalido')
  }

  const supabase = await createClient()
  const animalValido = await animalPertenceAPropriedade(supabase, id, usuarioAtual.propriedade_id)
  if (!animalValido) {
    return redirecionarComErro('erro_inesperado')
  }

  const { error: erroInsert } = await supabase.from('pesagens_animal').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    animal_id: id,
    data,
    peso_kg: pesoKg,
    observacao,
    criado_por: usuarioAtual.id,
  })

  if (erroInsert) {
    return redirecionarComErro('erro_inesperado')
  }

  return NextResponse.redirect(
    new URL(`/dashboard/producao/rebanho/animais/${id}/editar`, request.url),
    { status: 303 }
  )
}
```

- [ ] **Step 4: Editar `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`** para o conteúdo completo abaixo (adiciona import de `GraficoPeso` e `Link`, busca de `pesagens`, e uma segunda `Card` com gráfico + lista + formulário de criação):

```tsx
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
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 5: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 6: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

ANIMAL_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/rebanho/animais | grep -oE "/dashboard/producao/rebanho/animais/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*animais/([a-f0-9-]+)/editar#\1#')

echo "--- ANIMAL_ID capturado: $ANIMAL_ID ---"

echo "--- lancar 3 pesagens (para o grafico aparecer com 2+ pontos) ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/pesagens" \
  --data-urlencode "data=2026-06-01" \
  --data-urlencode "peso_kg=40" | grep -i location

curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/pesagens" \
  --data-urlencode "data=2026-07-01" \
  --data-urlencode "peso_kg=48.5" \
  --data-urlencode "observacao=apos vermifugacao" | grep -i location

echo "--- peso invalido deve ser rejeitado ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/pesagens" \
  --data-urlencode "data=2026-07-09" \
  --data-urlencode "peso_kg=0" | grep -i location

echo "--- pagina deve mostrar o grafico (svg) e as observacoes lancadas ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "<svg" | head -1
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "apos vermifugacao"

kill $DEV_PID
```

Expected: os dois primeiros blocos redirecionam para `/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar` (sem `error=`); o terceiro bloco redireciona com `error=peso_invalido`; o quarto bloco imprime `<svg`; o quinto imprime `apos vermifugacao`.

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: adiciona grafico, listagem e criacao de pesagem de animal"
```

---

### Task 3: Edição de pesagem

**Files:**
- Create: `web/app/dashboard/producao/rebanho/animais/[id]/pesagens/[pesagemId]/editar/page.tsx`
- Create: `web/app/api/producao/animais/[id]/pesagens/[pesagemId]/editar/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro` (Task 2), `animalPertenceAPropriedade` (já existente).

- [ ] **Step 1: Criar `web/app/dashboard/producao/rebanho/animais/[id]/pesagens/[pesagemId]/editar/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notFound, redirect } from 'next/navigation'

export default async function EditarPesagemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pesagemId: string }>
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

  const { id, pesagemId } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: pesagem } = await supabase
    .from('pesagens_animal')
    .select('id, data, peso_kg, observacao')
    .eq('id', pesagemId)
    .eq('animal_id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!pesagem) {
    notFound()
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar pesagem</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/producao/animais/${id}/pesagens/${pesagem.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={pesagem.data} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="peso_kg">Peso (kg)</Label>
              <Input
                id="peso_kg"
                name="peso_kg"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={pesagem.peso_kg}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input id="observacao" name="observacao" defaultValue={pesagem.observacao ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/producao/animais/[id]/pesagens/[pesagemId]/editar/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pesagemId: string }> }
) {
  const { id, pesagemId } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const data = String(formData.get('data') ?? '')
  const pesoKg = Number(formData.get('peso_kg'))
  const observacaoForm = String(formData.get('observacao') ?? '').trim()
  const observacao = observacaoForm === '' ? null : observacaoForm

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/producao/rebanho/animais/${id}/pesagens/${pesagemId}/editar?error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  const hoje = new Date().toISOString().slice(0, 10)
  if (!data || Number.isNaN(Date.parse(data)) || data > hoje) {
    return redirecionarComErro('data_invalida')
  }

  if (Number.isNaN(pesoKg) || pesoKg <= 0) {
    return redirecionarComErro('peso_invalido')
  }

  const supabase = await createClient()
  const { error: erroUpdate } = await supabase
    .from('pesagens_animal')
    .update({ data, peso_kg: pesoKg, observacao })
    .eq('id', pesagemId)
    .eq('animal_id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    return redirecionarComErro('erro_inesperado')
  }

  return NextResponse.redirect(
    new URL(`/dashboard/producao/rebanho/animais/${id}/editar`, request.url),
    { status: 303 }
  )
}
```

- [ ] **Step 3: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 4: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

ANIMAL_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/rebanho/animais | grep -oE "/dashboard/producao/rebanho/animais/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*animais/([a-f0-9-]+)/editar#\1#')

curl -s -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/pesagens" \
  --data-urlencode "data=2026-07-05" \
  --data-urlencode "peso_kg=41" -o /dev/null

PESAGEM_ID=$(curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -oE "/pesagens/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*pesagens/([a-f0-9-]+)/editar#\1#')

echo "--- PESAGEM_ID capturado: $PESAGEM_ID ---"

echo "--- editar pesagem ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/pesagens/$PESAGEM_ID/editar" \
  --data-urlencode "data=2026-07-05" \
  --data-urlencode "peso_kg=42.3" \
  --data-urlencode "observacao=peso corrigido" | grep -i location

echo "--- pagina de edicao do animal deve mostrar o valor corrigido ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "42.3 kg"

kill $DEV_PID
```

Expected: o bloco de edição redireciona para `/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar` (sem `error=`); o último bloco imprime `42.3 kg`.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: adiciona edicao de pesagem de animal"
```

---

### Task 4: Exclusão de pesagem

**Files:**
- Create: `web/app/api/producao/animais/[id]/pesagens/[pesagemId]/excluir/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient` (já existentes). O form de exclusão na listagem já foi adicionado na Task 2 (`page.tsx` já tem o `<form action=".../excluir">`), então esta task só precisa da rota.

- [ ] **Step 1: Criar `web/app/api/producao/animais/[id]/pesagens/[pesagemId]/excluir/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pesagemId: string }> }
) {
  const { id, pesagemId } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const supabase = await createClient()
  const { error: erroDelete } = await supabase
    .from('pesagens_animal')
    .delete()
    .eq('id', pesagemId)
    .eq('animal_id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroDelete) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/rebanho/animais/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(
    new URL(`/dashboard/producao/rebanho/animais/${id}/editar`, request.url),
    { status: 303 }
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 3: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

ANIMAL_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/rebanho/animais | grep -oE "/dashboard/producao/rebanho/animais/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*animais/([a-f0-9-]+)/editar#\1#')

curl -s -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/pesagens" \
  --data-urlencode "data=2026-07-08" \
  --data-urlencode "peso_kg=39.9" \
  --data-urlencode "observacao=para excluir no teste" -o /dev/null

# 2026-07-08 e mais recente que qualquer pesagem de tasks anteriores (2026-06-01, 2026-07-01, 2026-07-05),
# entao a lista "mais recente primeiro" traz esta pesagem em primeiro lugar - mesma extracao usada na Task 3.
PESAGEM_ID=$(curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -oE "/pesagens/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*pesagens/([a-f0-9-]+)/editar#\1#')

echo "--- PESAGEM_ID capturado: $PESAGEM_ID ---"

echo "--- excluir pesagem ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/pesagens/$PESAGEM_ID/excluir" | grep -i location

echo "--- observacao nao deve mais aparecer na listagem ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "para excluir no teste"

kill $DEV_PID
```

Expected: o bloco de exclusão redireciona para `/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar` (sem `error=`); o último bloco não imprime nada (a observação não existe mais na página).

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: adiciona exclusao de pesagem de animal"
```
