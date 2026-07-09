# Vacinação e Medicação de Animal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar registro de vacinas e medicamentos aplicados a qualquer animal ativo, com carência de medicamento calculada automaticamente, conforme `docs/superpowers/specs/2026-07-09-vacinacao-medicacao-animal-design.md`.

**Architecture:** Duas tabelas novas (`vacinas_animal`, `medicamentos_animal`) com RLS multi-tenant (4 policies cada: select/insert/update/delete) no mesmo padrão já usado em `pesagens_animal`. Frontend estende a página de edição de animal já existente (`web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`) com duas seções novas, mesmo padrão visual e de rotas já usado pela seção "Pesagens". `data_liberacao` (data em que a carência termina) é uma coluna gerada pelo Postgres (`generated always as ... stored`), calculada uma única vez no banco.

**Tech Stack:** Postgres/Supabase local + pgTAP (backend); Next.js (App Router) + TypeScript + shadcn/ui (frontend, fundação já pronta).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente — toda mudança usa `create table`/`create policy` numa migration nova.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Toda mutação de frontend é Route Handler HTML puro (`method="POST"`), sem JavaScript no cliente.
- Qualquer animal ativo pode receber vacina/medicamento — criação de novo lançamento é bloqueada para animal inativo (rota + UI, mesmo padrão já usado em `pesagens_animal`); edição/exclusão de registros antigos continuam acessíveis independente do status do animal.
- Sem unicidade em (`animal_id`, `data`) em nenhuma das duas tabelas — múltiplas aplicações no mesmo dia são válidas.
- `data` não pode ser no futuro. `proxima_dose_prevista` (vacina) pode ser qualquer data, inclusive futura.
- `dias_carencia >= 0` (zero é válido).
- Carência é só informativa nesta fatia — sem integração/bloqueio cruzado com produção de leite.
- Edição e exclusão são reais (update/delete diretos) — mesmo padrão de `pesagens_animal`, diferente do toggle de `ativo` usado em `animais`/`imobilizados`.
- Toda query/mutação filtra `propriedade_id` (e `animal_id`, quando aplicável) explicitamente — defesa em profundidade, sem confiar só em RLS.
- Sem suíte de testes automatizados de frontend — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- O Supabase local precisa estar rodando; comandos do Supabase CLI rodam na raiz do repositório, comandos `npm`/`npx` do frontend rodam dentro de `web/`.

### Fixtures de teste

Reutiliza a propriedade seedada (`00000000-0000-0000-0000-000000000001`) e a unidade de negócio "Gado leiteiro" (`00000000-0000-0000-0000-000000000002`, `tipo = 'leite'`). Admin de teste: `admin.producao@ademir.local` / `senha-admin-123` (se a fixture não existir no ambiente local, recrie via Admin API: `POST /auth/v1/admin/users` + insert em `public.usuarios` com `propriedade_id=00000000-0000-0000-0000-000000000001`, `papel=admin`). Para testar via curl é necessário pelo menos um animal cadastrado — se não houver, crie um via `POST /api/producao/animais` (rota já existente).

---

### Task 1: Schema — tabelas `vacinas_animal` e `medicamentos_animal`

**Files:**
- Create: `supabase/migrations/20260709173000_vacinas_medicamentos_animal.sql`
- Create: `supabase/tests/database/37_vacinas_medicamentos_animal.sql`

**Interfaces:**
- Consumes: `public.animais` (já existente), `public.propriedades`, `public.usuarios`, `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`, `public.tem_permissao(modulo text, acao text)`.
- Produces: tabelas `public.vacinas_animal` (`id`, `propriedade_id`, `animal_id`, `data`, `produto`, `proxima_dose_prevista`, `observacao`, `criado_por`, `created_at`) e `public.medicamentos_animal` (`id`, `propriedade_id`, `animal_id`, `data`, `produto`, `dias_carencia`, `data_liberacao`, `observacao`, `criado_por`, `created_at`) — consumidas pelas Tasks 2-5.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/37_vacinas_medicamentos_animal.sql`:

```sql
begin;
select plan(9);

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

select has_table('public', 'vacinas_animal', 'tabela vacinas_animal deve existir');
select has_table('public', 'medicamentos_animal', 'tabela medicamentos_animal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.animais (id, propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por) values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'femea', 'terneira_aleitamento', '33333333-3333-3333-3333-333333333333');

insert into public.vacinas_animal (propriedade_id, animal_id, data, produto, criado_por) values
  ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 'Vacina Aftosa', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.vacinas_animal),
  1,
  'admin deve conseguir lancar uma vacina'
);

insert into public.medicamentos_animal (id, propriedade_id, animal_id, data, produto, dias_carencia, criado_por) values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-01', 'Antibiotico X', 5, '33333333-3333-3333-3333-333333333333');

select is(
  (select data_liberacao from public.medicamentos_animal where id = '88888888-8888-8888-8888-888888888888'),
  '2026-07-06'::date,
  'data_liberacao deve ser calculada como data + dias_carencia'
);

select throws_ok(
  $$insert into public.medicamentos_animal (propriedade_id, animal_id, data, produto, dias_carencia, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', '2026-07-09', 'Produto invalido', -1, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "medicamentos_animal" violates check constraint "medicamentos_animal_dias_carencia_check"',
  'dias_carencia negativo deve ser rejeitado'
);

-- usuario de OUTRA propriedade nao deve ver, editar nem excluir os registros acima
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.vacinas_animal),
  0,
  'usuario de outra propriedade nao deve ver vacinas alheias (isolamento RLS)'
);

select is(
  (select count(*)::int from public.medicamentos_animal),
  0,
  'usuario de outra propriedade nao deve ver medicamentos alheios (isolamento RLS)'
);

update public.medicamentos_animal set dias_carencia = 999 where id = '88888888-8888-8888-8888-888888888888';
delete from public.medicamentos_animal where id = '88888888-8888-8888-8888-888888888888';

-- volta ao contexto do admin dono para conferir que nada mudou
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select dias_carencia from public.medicamentos_animal where id = '88888888-8888-8888-8888-888888888888'),
  5,
  'usuario de outra propriedade nao deve conseguir editar medicamento alheio (isolamento RLS)'
);

select is(
  (select count(*)::int from public.medicamentos_animal where id = '88888888-8888-8888-8888-888888888888'),
  1,
  'usuario de outra propriedade nao deve conseguir excluir medicamento alheio (isolamento RLS)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Da raiz do repositório:

```bash
npx supabase test db
```

Expected: falha em `has_table` (as tabelas `vacinas_animal`/`medicamentos_animal` ainda não existem).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260709173000_vacinas_medicamentos_animal.sql`:

```sql
create table public.vacinas_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  data date not null,
  produto text not null,
  proxima_dose_prevista date,
  observacao text,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.vacinas_animal enable row level security;

create index vacinas_animal_propriedade_id_idx on public.vacinas_animal(propriedade_id);
create index vacinas_animal_animal_id_idx on public.vacinas_animal(animal_id);

create policy "ver vacinas de animal da propria propriedade"
  on public.vacinas_animal for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar vacinas de animal da propria propriedade"
  on public.vacinas_animal for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar vacinas de animal da propria propriedade"
  on public.vacinas_animal for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "excluir vacinas de animal da propria propriedade"
  on public.vacinas_animal for delete
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create table public.medicamentos_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  data date not null,
  produto text not null,
  dias_carencia integer not null check (dias_carencia >= 0),
  data_liberacao date generated always as (data + dias_carencia) stored,
  observacao text,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.medicamentos_animal enable row level security;

create index medicamentos_animal_propriedade_id_idx on public.medicamentos_animal(propriedade_id);
create index medicamentos_animal_animal_id_idx on public.medicamentos_animal(animal_id);

create policy "ver medicamentos de animal da propria propriedade"
  on public.medicamentos_animal for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar medicamentos de animal da propria propriedade"
  on public.medicamentos_animal for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar medicamentos de animal da propria propriedade"
  on public.medicamentos_animal for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "excluir medicamentos de animal da propria propriedade"
  on public.medicamentos_animal for delete
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 9 testes de `37_vacinas_medicamentos_animal.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts 2>/dev/null
cd ..
```

**Atenção:** use `2>/dev/null` para evitar que texto de status do CLI vaze para dentro do arquivo. Confirme que a primeira linha é `export type Json = ...` e rode `npx tsc --noEmit` dentro de `web/`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260709173000_vacinas_medicamentos_animal.sql supabase/tests/database/37_vacinas_medicamentos_animal.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona tabelas de vacinas e medicamentos de animal"
```

---

### Task 2: Vacinas — listagem e criação

**Files:**
- Create: `web/app/api/producao/animais/[id]/vacinas/route.ts`
- Modify: `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`
- Modify: `web/lib/erros-formulario.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro` (já existentes); tabela `vacinas_animal` (Task 1).
- Produces: seção "Vacinas" em `page.tsx`, consumida (estendida) pela Task 3.

- [ ] **Step 1: Editar `web/lib/erros-formulario.ts`** — adicionar os códigos que faltam ao objeto `MENSAGENS` (junto aos já existentes):

```ts
  produto_invalido: 'Informe o nome do produto.',
  dias_carencia_invalido: 'Informe um número de dias de carência válido (0 ou mais).',
```

- [ ] **Step 2: Criar `web/app/api/producao/animais/[id]/vacinas/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
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
  const produto = String(formData.get('produto') ?? '').trim()
  const proximaDoseForm = String(formData.get('proxima_dose_prevista') ?? '').trim()
  const proximaDosePrevista = proximaDoseForm === '' ? null : proximaDoseForm
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

  if (!produto) {
    return redirecionarComErro('produto_invalido')
  }

  const supabase = await createClient()
  const { data: animal } = await supabase
    .from('animais')
    .select('ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!animal) {
    return redirecionarComErro('erro_inesperado')
  }

  if (!animal.ativo) {
    return redirecionarComErro('animal_inativo')
  }

  const { error: erroInsert } = await supabase.from('vacinas_animal').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    animal_id: id,
    data,
    produto,
    proxima_dose_prevista: proximaDosePrevista,
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

- [ ] **Step 3: Editar `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`** para o conteúdo completo abaixo (adiciona a busca de `vacinas` e uma terceira `Card` com listagem + criação, mantendo tudo que já existe):

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

  const { data: vacinasDb } = await supabase
    .from('vacinas_animal')
    .select('id, data, produto, proxima_dose_prevista, observacao')
    .eq('animal_id', animal.id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('data', { ascending: false })

  const vacinas = vacinasDb ?? []

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
    </main>
  )
}
```

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

ANIMAL_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/rebanho/animais | grep -oE "/dashboard/producao/rebanho/animais/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*animais/([a-f0-9-]+)/editar#\1#')

echo "--- ANIMAL_ID capturado: $ANIMAL_ID ---"

echo "--- lancar vacina valida ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/vacinas" \
  --data-urlencode "data=2026-07-09" \
  --data-urlencode "produto=Vacina Aftosa" \
  --data-urlencode "proxima_dose_prevista=2026-10-09" | grep -i location

echo "--- produto vazio deve ser rejeitado ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/vacinas" \
  --data-urlencode "data=2026-07-09" \
  --data-urlencode "produto=" | grep -i location

echo "--- pagina deve mostrar a vacina lancada ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "Vacina Aftosa"

echo "--- dar baixa no animal e confirmar bloqueio de criacao ---"
curl -s -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/baixa" -o /dev/null

curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/vacinas" \
  --data-urlencode "data=2026-07-09" \
  --data-urlencode "produto=Nao deveria salvar" | grep -i location

echo "--- formulario de nova vacina nao deve aparecer com animal inativo ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "Registrar vacina"

echo "--- reativar o animal para nao deixar dados de teste inconsistentes ---"
curl -s -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/baixa" -o /dev/null

kill $DEV_PID
```

Expected: primeiro bloco redireciona sem `error=`; segundo bloco redireciona com `error=produto_invalido`; terceiro bloco imprime `Vacina Aftosa`; bloco de bloqueio redireciona com `error=animal_inativo` e a linha seguinte não imprime nada (formulário ausente).

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona listagem e criacao de vacina de animal"
```

---

### Task 3: Vacinas — edição e exclusão

**Files:**
- Create: `web/app/dashboard/producao/rebanho/animais/[id]/vacinas/[vacinaId]/editar/page.tsx`
- Create: `web/app/api/producao/animais/[id]/vacinas/[vacinaId]/editar/route.ts`
- Create: `web/app/api/producao/animais/[id]/vacinas/[vacinaId]/excluir/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro` (Task 2); tabela `vacinas_animal` (Task 1).

- [ ] **Step 1: Criar `web/app/dashboard/producao/rebanho/animais/[id]/vacinas/[vacinaId]/editar/page.tsx`**

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

export default async function EditarVacinaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; vacinaId: string }>
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

  const { id, vacinaId } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: vacina } = await supabase
    .from('vacinas_animal')
    .select('id, data, produto, proxima_dose_prevista, observacao')
    .eq('id', vacinaId)
    .eq('animal_id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!vacina) {
    notFound()
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar vacina</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/producao/animais/${id}/vacinas/${vacina.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={vacina.data} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="produto">Produto</Label>
              <Input id="produto" name="produto" defaultValue={vacina.produto} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="proxima_dose_prevista">Próxima dose prevista (opcional)</Label>
              <Input
                id="proxima_dose_prevista"
                name="proxima_dose_prevista"
                type="date"
                defaultValue={vacina.proxima_dose_prevista ?? ''}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input id="observacao" name="observacao" defaultValue={vacina.observacao ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/producao/animais/[id]/vacinas/[vacinaId]/editar/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; vacinaId: string }> }
) {
  const { id, vacinaId } = await params
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
  const produto = String(formData.get('produto') ?? '').trim()
  const proximaDoseForm = String(formData.get('proxima_dose_prevista') ?? '').trim()
  const proximaDosePrevista = proximaDoseForm === '' ? null : proximaDoseForm
  const observacaoForm = String(formData.get('observacao') ?? '').trim()
  const observacao = observacaoForm === '' ? null : observacaoForm

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/producao/rebanho/animais/${id}/vacinas/${vacinaId}/editar?error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  const hoje = new Date().toISOString().slice(0, 10)
  if (!data || Number.isNaN(Date.parse(data)) || data > hoje) {
    return redirecionarComErro('data_invalida')
  }

  if (!produto) {
    return redirecionarComErro('produto_invalido')
  }

  const supabase = await createClient()
  const { error: erroUpdate } = await supabase
    .from('vacinas_animal')
    .update({ data, produto, proxima_dose_prevista: proximaDosePrevista, observacao })
    .eq('id', vacinaId)
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

- [ ] **Step 3: Criar `web/app/api/producao/animais/[id]/vacinas/[vacinaId]/excluir/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; vacinaId: string }> }
) {
  const { id, vacinaId } = await params
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
    .from('vacinas_animal')
    .delete()
    .eq('id', vacinaId)
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

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

ANIMAL_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/rebanho/animais | grep -oE "/dashboard/producao/rebanho/animais/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*animais/([a-f0-9-]+)/editar#\1#')

curl -s -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/vacinas" \
  --data-urlencode "data=2026-07-08" \
  --data-urlencode "produto=Vacina Brucelose" -o /dev/null

VACINA_ID=$(curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -oE "/vacinas/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*vacinas/([a-f0-9-]+)/editar#\1#')

echo "--- VACINA_ID capturado: $VACINA_ID ---"

echo "--- editar vacina ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/vacinas/$VACINA_ID/editar" \
  --data-urlencode "data=2026-07-08" \
  --data-urlencode "produto=Vacina Brucelose (dose unica)" | grep -i location

echo "--- pagina deve mostrar o produto corrigido ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "Vacina Brucelose (dose unica)"

echo "--- excluir vacina ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/vacinas/$VACINA_ID/excluir" | grep -i location

echo "--- produto excluido nao deve mais aparecer ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "Vacina Brucelose (dose unica)"

kill $DEV_PID
```

Expected: bloco de edição redireciona sem `error=`; bloco seguinte imprime `Vacina Brucelose (dose unica)`; bloco de exclusão redireciona sem `error=`; último bloco não imprime nada.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona edicao e exclusao de vacina de animal"
```

---

### Task 4: Medicamentos — listagem e criação

**Files:**
- Create: `web/app/api/producao/animais/[id]/medicamentos/route.ts`
- Modify: `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro` (já existentes); tabela `medicamentos_animal` (Task 1).
- Produces: seção "Medicamentos" em `page.tsx`, consumida (estendida) pela Task 5.

- [ ] **Step 1: Criar `web/app/api/producao/animais/[id]/medicamentos/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
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
  const produto = String(formData.get('produto') ?? '').trim()
  const diasCarencia = Number(formData.get('dias_carencia'))
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

  if (!produto) {
    return redirecionarComErro('produto_invalido')
  }

  if (Number.isNaN(diasCarencia) || diasCarencia < 0 || !Number.isInteger(diasCarencia)) {
    return redirecionarComErro('dias_carencia_invalido')
  }

  const supabase = await createClient()
  const { data: animal } = await supabase
    .from('animais')
    .select('ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!animal) {
    return redirecionarComErro('erro_inesperado')
  }

  if (!animal.ativo) {
    return redirecionarComErro('animal_inativo')
  }

  const { error: erroInsert } = await supabase.from('medicamentos_animal').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    animal_id: id,
    data,
    produto,
    dias_carencia: diasCarencia,
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

- [ ] **Step 2: Editar `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`** para o conteúdo completo abaixo (adiciona a busca de `medicamentos` e uma quarta `Card`, mantendo tudo da Task 2):

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

echo "--- lancar medicamento com carencia ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/medicamentos" \
  --data-urlencode "data=2026-07-01" \
  --data-urlencode "produto=Antibiotico X" \
  --data-urlencode "dias_carencia=10" | grep -i location

echo "--- dias_carencia negativo deve ser rejeitado ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/medicamentos" \
  --data-urlencode "data=2026-07-09" \
  --data-urlencode "produto=Produto invalido" \
  --data-urlencode "dias_carencia=-1" | grep -i location

echo "--- pagina deve mostrar o medicamento e o aviso de carencia ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "Antibiotico X"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "Em carência até 2026-07-11"

echo "--- dar baixa no animal e confirmar bloqueio de criacao ---"
curl -s -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/baixa" -o /dev/null

curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/medicamentos" \
  --data-urlencode "data=2026-07-09" \
  --data-urlencode "produto=Nao deveria salvar" \
  --data-urlencode "dias_carencia=1" | grep -i location

echo "--- formulario de novo medicamento nao deve aparecer com animal inativo ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "Registrar medicamento"

echo "--- reativar o animal para nao deixar dados de teste inconsistentes ---"
curl -s -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/baixa" -o /dev/null

kill $DEV_PID
```

Expected: primeiro bloco redireciona sem `error=`; segundo bloco redireciona com `error=dias_carencia_invalido`; terceiro bloco imprime `Antibiotico X`; quarto bloco imprime `Em carência até 2026-07-11` (2026-07-01 + 10 dias); bloco de bloqueio redireciona com `error=animal_inativo` e a linha seguinte não imprime nada (formulário ausente).

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: adiciona listagem e criacao de medicamento de animal"
```

---

### Task 5: Medicamentos — edição e exclusão

**Files:**
- Create: `web/app/dashboard/producao/rebanho/animais/[id]/medicamentos/[medicamentoId]/editar/page.tsx`
- Create: `web/app/api/producao/animais/[id]/medicamentos/[medicamentoId]/editar/route.ts`
- Create: `web/app/api/producao/animais/[id]/medicamentos/[medicamentoId]/excluir/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro` (Task 2/4); tabela `medicamentos_animal` (Task 1).

- [ ] **Step 1: Criar `web/app/dashboard/producao/rebanho/animais/[id]/medicamentos/[medicamentoId]/editar/page.tsx`**

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

export default async function EditarMedicamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; medicamentoId: string }>
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

  const { id, medicamentoId } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: medicamento } = await supabase
    .from('medicamentos_animal')
    .select('id, data, produto, dias_carencia, observacao')
    .eq('id', medicamentoId)
    .eq('animal_id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!medicamento) {
    notFound()
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar medicamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/producao/animais/${id}/medicamentos/${medicamento.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={medicamento.data} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="produto">Produto</Label>
              <Input id="produto" name="produto" defaultValue={medicamento.produto} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dias_carencia">Dias de carência</Label>
              <Input
                id="dias_carencia"
                name="dias_carencia"
                type="number"
                min="0"
                step="1"
                defaultValue={medicamento.dias_carencia}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input id="observacao" name="observacao" defaultValue={medicamento.observacao ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/producao/animais/[id]/medicamentos/[medicamentoId]/editar/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; medicamentoId: string }> }
) {
  const { id, medicamentoId } = await params
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
  const produto = String(formData.get('produto') ?? '').trim()
  const diasCarencia = Number(formData.get('dias_carencia'))
  const observacaoForm = String(formData.get('observacao') ?? '').trim()
  const observacao = observacaoForm === '' ? null : observacaoForm

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/producao/rebanho/animais/${id}/medicamentos/${medicamentoId}/editar?error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  const hoje = new Date().toISOString().slice(0, 10)
  if (!data || Number.isNaN(Date.parse(data)) || data > hoje) {
    return redirecionarComErro('data_invalida')
  }

  if (!produto) {
    return redirecionarComErro('produto_invalido')
  }

  if (Number.isNaN(diasCarencia) || diasCarencia < 0 || !Number.isInteger(diasCarencia)) {
    return redirecionarComErro('dias_carencia_invalido')
  }

  const supabase = await createClient()
  const { error: erroUpdate } = await supabase
    .from('medicamentos_animal')
    .update({ data, produto, dias_carencia: diasCarencia, observacao })
    .eq('id', medicamentoId)
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

- [ ] **Step 3: Criar `web/app/api/producao/animais/[id]/medicamentos/[medicamentoId]/excluir/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; medicamentoId: string }> }
) {
  const { id, medicamentoId } = await params
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
    .from('medicamentos_animal')
    .delete()
    .eq('id', medicamentoId)
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

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

ANIMAL_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/rebanho/animais | grep -oE "/dashboard/producao/rebanho/animais/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*animais/([a-f0-9-]+)/editar#\1#')

curl -s -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/medicamentos" \
  --data-urlencode "data=2026-07-05" \
  --data-urlencode "produto=Vermifugo Y" \
  --data-urlencode "dias_carencia=3" -o /dev/null

# 2026-07-05 e mais recente que o medicamento da Task 4 (2026-07-01), entao a lista
# "mais recente primeiro" traz este em primeiro lugar - mesma extracao ja usada em pesagem/vacina.
MEDICAMENTO_ID=$(curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -oE "/medicamentos/[a-f0-9-]{8,}/editar" | head -1 | sed -E 's#.*medicamentos/([a-f0-9-]+)/editar#\1#')

echo "--- MEDICAMENTO_ID capturado: $MEDICAMENTO_ID ---"

echo "--- editar medicamento ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/medicamentos/$MEDICAMENTO_ID/editar" \
  --data-urlencode "data=2026-07-05" \
  --data-urlencode "produto=Vermifugo Y (reforco)" \
  --data-urlencode "dias_carencia=5" | grep -i location

echo "--- pagina deve mostrar o produto e carencia corrigidos ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "Vermifugo Y (reforco)"

echo "--- excluir medicamento ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/medicamentos/$MEDICAMENTO_ID/excluir" | grep -i location

echo "--- produto excluido nao deve mais aparecer ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/rebanho/animais/$ANIMAL_ID/editar" | grep -o "Vermifugo Y (reforco)"

kill $DEV_PID
```

Expected: bloco de edição redireciona sem `error=`; bloco seguinte imprime `Vermifugo Y (reforco)`; bloco de exclusão redireciona sem `error=`; último bloco não imprime nada.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona edicao e exclusao de medicamento de animal"
```
