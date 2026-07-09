# Cadastro de Animal Individual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o cadastro de animal individual (identidade, categoria, nascimento, mãe/pai) e a captura de produção de leite por animal por ordenha, conforme `docs/superpowers/specs/2026-07-09-cadastro-animal-individual-design.md`.

**Architecture:** Duas tabelas novas (`animais`, `producao_animal`) com RLS multi-tenant no mesmo padrão já usado no projeto, mais uma view (`producao_animal_total_dia`, com `security_invoker = true`) que soma a produção por animal sem alterar o lançamento agregado existente (`producao_leite`). Frontend segue o padrão HTML puro já estabelecido (Route Handlers, sem JavaScript no cliente) — inclusive o lançamento em lote por ordenha, que é um único `<form>` com um campo por animal.

**Tech Stack:** Postgres/Supabase local + pgTAP (backend); Next.js (App Router) + TypeScript + shadcn/ui (frontend, fundação já pronta).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente — toda mudança usa `create table`/`create policy` numa migration nova.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Toda mutação de frontend é Route Handler HTML puro (`method="POST"`), sem JavaScript no cliente.
- Views sobre tabelas com RLS **sempre** usam `with (security_invoker = true)`.
- Sem exclusão de animal — "dar baixa" é sempre um toggle de `ativo`, nunca um `delete`.
- IDs recebidos de formulário que referenciam outra tabela (`mae_id`, `animal_id`) são sempre validados como pertencentes à propriedade do chamador antes de usar.
- Conflito de unicidade já existente é tratado como `insert`-então-`update`, nunca `upsert` ingênuo.
- Cadastro do rebanho atual é manual (sem importação em lote) — fora de escopo desta fatia.
- Sem ligação com `eventos_operacionais`/`rebanho_composicao()` — continuam exatamente como estão.
- Sem suíte de testes automatizados de frontend — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- O Supabase local precisa estar rodando; comandos do Supabase CLI rodam na raiz do repositório, comandos `npm`/`npx` do frontend rodam dentro de `web/`.

### Fixtures de teste

Reutiliza a propriedade seedada (`00000000-0000-0000-0000-000000000001`) e a unidade de negócio "Gado leiteiro" (`00000000-0000-0000-0000-000000000002`, `tipo = 'leite'`). Admin de teste: `admin.producao@ademir.local` / `senha-admin-123` (se a fixture não existir no ambiente local, recrie via Admin API: `POST /auth/v1/admin/users` + insert em `public.usuarios` com `propriedade_id=00000000-0000-0000-0000-000000000001`, `papel=admin`).

---

### Task 1: Schema — tabela `animais`

**Files:**
- Create: `supabase/migrations/20260709170000_animais.sql`
- Create: `supabase/tests/database/34_animais.sql`

**Interfaces:**
- Consumes: `public.propriedades`, `public.unidades_negocio`, `public.usuarios`, `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`, `public.tem_permissao(modulo text, acao text)`.
- Produces: tabela `public.animais` (colunas `id`, `propriedade_id`, `unidade_negocio_id`, `brinco`, `nome`, `sexo`, `categoria`, `data_nascimento`, `mae_id`, `pai_texto`, `ativo`, `criado_por`, `created_at`) — consumida pelas Tasks 2, 3, 4, 5.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/34_animais.sql`:

```sql
begin;
select plan(6);

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

select has_table('public', 'animais', 'tabela animais deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.animais
  (id, propriedade_id, unidade_negocio_id, brinco, nome, sexo, categoria, data_nascimento, criado_por)
values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'Mimosa', 'femea', 'vaca_lactacao', '2020-05-10', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.animais),
  1,
  'admin deve conseguir cadastrar um animal'
);

insert into public.animais
  (propriedade_id, unidade_negocio_id, brinco, sexo, categoria, mae_id, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '102', 'femea', 'terneira_aleitamento', '77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333');

select is(
  (select mae_id from public.animais where brinco = '102'),
  '77777777-7777-7777-7777-777777777777'::uuid,
  'mae_id deve vincular a outro animal da mesma propriedade'
);

select throws_ok(
  $$insert into public.animais (propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'femea', 'vaca_lactacao', '33333333-3333-3333-3333-333333333333')$$,
  'duplicate key value violates unique constraint "animais_propriedade_id_brinco_key"',
  'brinco duplicado na mesma propriedade deve ser rejeitado'
);

select throws_ok(
  $$insert into public.animais (propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '103', 'femea', 'categoria_invalida', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "animais" violates check constraint "animais_categoria_check"',
  'categoria fora da lista deve ser rejeitada'
);

-- usuario de OUTRA propriedade nao deve ver os animais acima
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.animais),
  0,
  'usuario de outra propriedade nao deve ver animais alheios (isolamento RLS)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Da raiz do repositório:

```bash
npx supabase test db
```

Expected: falha em `has_table` (a tabela `animais` ainda não existe).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260709170000_animais.sql`:

```sql
create table public.animais (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  brinco text not null,
  nome text,
  sexo text not null check (sexo in ('femea', 'macho')),
  categoria text not null check (categoria in (
    'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
    'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
  )),
  data_nascimento date,
  mae_id uuid references public.animais(id) on delete set null,
  pai_texto text,
  ativo boolean not null default true,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (propriedade_id, brinco)
);

alter table public.animais enable row level security;

create index animais_propriedade_id_idx on public.animais(propriedade_id);

create policy "ver animais da propria propriedade"
  on public.animais for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar animais da propria propriedade"
  on public.animais for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar animais da propria propriedade"
  on public.animais for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 6 testes de `34_animais.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts 2>/dev/null
cd ..
```

**Atenção:** use `2>/dev/null` para evitar que texto de status do CLI vaze para dentro do arquivo. Confirme que a primeira linha do arquivo é `export type Json = ...`, e rode `npx tsc --noEmit` (dentro de `web/`) para confirmar que o arquivo é TypeScript válido.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260709170000_animais.sql supabase/tests/database/34_animais.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona cadastro de animal individual"
```

---

### Task 2: Schema — tabela `producao_animal` + view `producao_animal_total_dia`

**Files:**
- Create: `supabase/migrations/20260709171000_producao_animal.sql`
- Create: `supabase/tests/database/35_producao_animal.sql`

**Interfaces:**
- Consumes: `public.animais` (Task 1), `public.unidades_negocio`, `public.usuarios`, `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`, `public.tem_permissao(modulo text, acao text)`.
- Produces: tabela `public.producao_animal` (colunas `id`, `propriedade_id`, `animal_id`, `unidade_negocio_id`, `data`, `numero_ordenha`, `litros`, `criado_por`, `created_at`) e view `public.producao_animal_total_dia` (`unidade_negocio_id`, `data`, `total_produzido`, `animais_lancados`) — consumidas pela Task 5.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/35_producao_animal.sql`:

```sql
begin;
select plan(6);

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

select has_table('public', 'producao_animal', 'tabela producao_animal deve existir');
select has_view('public', 'producao_animal_total_dia', 'view producao_animal_total_dia deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.animais (id, propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por) values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '101', 'femea', 'vaca_lactacao', '33333333-3333-3333-3333-333333333333'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '102', 'femea', 'vaca_lactacao', '33333333-3333-3333-3333-333333333333');

insert into public.producao_animal (animal_id, propriedade_id, unidade_negocio_id, data, numero_ordenha, litros, criado_por) values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 1, 12.5, '33333333-3333-3333-3333-333333333333'),
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 2, 10.0, '33333333-3333-3333-3333-333333333333'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 1, 8.0, '33333333-3333-3333-3333-333333333333');

select is(
  (select total_produzido from public.producao_animal_total_dia where unidade_negocio_id = '66666666-6666-6666-6666-666666666666' and data = '2026-07-09'),
  30.5,
  'total produzido deve somar todos os animais e ordenhas do dia (12.5 + 10.0 + 8.0)'
);

select throws_ok(
  $$insert into public.producao_animal (animal_id, propriedade_id, unidade_negocio_id, data, numero_ordenha, litros, criado_por)
    values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 1, 5.0, '33333333-3333-3333-3333-333333333333')$$,
  'duplicate key value violates unique constraint "producao_animal_animal_id_data_numero_ordenha_key"',
  'lancamento duplicado (mesmo animal+data+ordenha) deve ser rejeitado'
);

select throws_ok(
  $$insert into public.producao_animal (animal_id, propriedade_id, unidade_negocio_id, data, numero_ordenha, litros, criado_por)
    values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 3, -1, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "producao_animal" violates check constraint "producao_animal_litros_check"',
  'litros negativo deve ser rejeitado'
);

-- usuario de OUTRA propriedade nao deve ver os lancamentos acima
select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.producao_animal),
  0,
  'usuario de outra propriedade nao deve ver producao por animal alheia (isolamento RLS)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx supabase test db
```

Expected: falha em `has_table` (a tabela `producao_animal` ainda não existe).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260709171000_producao_animal.sql`:

```sql
create table public.producao_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  data date not null,
  numero_ordenha smallint not null check (numero_ordenha > 0),
  litros numeric(10,2) not null check (litros >= 0),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (animal_id, data, numero_ordenha)
);

alter table public.producao_animal enable row level security;

create index producao_animal_propriedade_id_idx on public.producao_animal(propriedade_id);
create index producao_animal_animal_id_idx on public.producao_animal(animal_id);

create policy "ver producao por animal"
  on public.producao_animal for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar producao por animal"
  on public.producao_animal for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar producao por animal"
  on public.producao_animal for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create view public.producao_animal_total_dia
  with (security_invoker = true) as
select
  unidade_negocio_id,
  data,
  sum(litros) as total_produzido,
  count(distinct animal_id) as animais_lancados
from public.producao_animal
group by unidade_negocio_id, data;
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 6 testes de `35_producao_animal.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts 2>/dev/null
cd ..
```

Confirme que a primeira linha é `export type Json = ...` e rode `npx tsc --noEmit` dentro de `web/`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260709171000_producao_animal.sql supabase/tests/database/35_producao_animal.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona producao de leite por animal e total diario"
```

---

### Task 3: Cadastro de animal — listagem e criação

**Files:**
- Create: `web/lib/producao/validar-animal.ts`
- Create: `web/app/dashboard/producao/rebanho/animais/page.tsx`
- Create: `web/app/dashboard/producao/rebanho/animais/novo/page.tsx`
- Create: `web/app/api/producao/animais/route.ts`
- Modify: `web/lib/erros-formulario.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `getUnidadeNegocioLeiteId`, `mensagemErro` (todos já existentes); tabela `animais` (Task 1).
- Produces: `animalPertenceAPropriedade(supabase, animalId, propriedadeId): Promise<boolean>` — consumida pela Task 4.

- [ ] **Step 1: Criar `web/lib/producao/validar-animal.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export async function animalPertenceAPropriedade(
  supabase: SupabaseClient<Database>,
  animalId: string,
  propriedadeId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('animais')
    .select('id')
    .eq('id', animalId)
    .eq('propriedade_id', propriedadeId)
    .maybeSingle()

  return data !== null
}
```

- [ ] **Step 2: Editar `web/lib/erros-formulario.ts`** — adicionar os códigos que faltam ao objeto `MENSAGENS` (junto aos já existentes):

```ts
  brinco_duplicado: 'Já existe um animal cadastrado com este brinco.',
  data_nascimento_invalida: 'Informe uma data de nascimento válida (não pode ser no futuro).',
  mae_invalida: 'Selecione uma mãe válida.',
  ordenha_invalida: 'Informe um número de ordenha válido.',
```

- [ ] **Step 3: Criar `web/app/dashboard/producao/rebanho/animais/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vaca em lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vaca de descarte' },
  { valor: 'vaca_seca', rotulo: 'Vaca seca' },
  { valor: 'novilha_coberta', rotulo: 'Novilha coberta' },
  { valor: 'novilha_recria', rotulo: 'Novilha em recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneira em aleitamento' },
] as const

type Animal = {
  id: string
  brinco: string
  nome: string | null
  categoria: string
  ativo: boolean
}

export default async function AnimaisPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: animais } = await supabase
    .from('animais')
    .select('id, brinco, nome, categoria, ativo')
    .order('brinco')

  const listaAnimais: Animal[] = animais ?? []

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Animais</h1>
        <Link
          href="/dashboard/producao/rebanho/animais/novo"
          className={buttonVariants({ variant: 'default' })}
        >
          Novo animal
        </Link>
      </div>

      {CATEGORIAS.map((categoria) => {
        const animaisDaCategoria = listaAnimais.filter((animal) => animal.categoria === categoria.valor)
        if (animaisDaCategoria.length === 0) {
          return null
        }
        return (
          <div key={categoria.valor} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{categoria.rotulo}</h2>
            <ul className="flex flex-col gap-2">
              {animaisDaCategoria.map((animal) => (
                <li
                  key={animal.id}
                  className={`flex items-center justify-between rounded-lg border border-input p-3 text-sm ${animal.ativo ? '' : 'opacity-50'}`}
                >
                  <div>
                    <p className="font-medium">
                      {animal.brinco}
                      {animal.nome && ` · ${animal.nome}`}
                    </p>
                    {!animal.ativo && <p className="text-muted-foreground">inativo</p>}
                  </div>
                  <Link
                    href={`/dashboard/producao/rebanho/animais/${animal.id}/editar`}
                    className="text-sm underline"
                  >
                    Editar
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </main>
  )
}
```

- [ ] **Step 4: Criar `web/app/dashboard/producao/rebanho/animais/novo/page.tsx`**

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
import { redirect } from 'next/navigation'

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vaca em lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vaca de descarte' },
  { valor: 'vaca_seca', rotulo: 'Vaca seca' },
  { valor: 'novilha_coberta', rotulo: 'Novilha coberta' },
  { valor: 'novilha_recria', rotulo: 'Novilha em recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneira em aleitamento' },
] as const

export default async function NovoAnimalPage({
  searchParams,
}: {
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

  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: maes } = await supabase
    .from('animais')
    .select('id, brinco, nome')
    .eq('sexo', 'femea')
    .order('brinco')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Novo animal</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/producao/animais" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="brinco">Brinco</Label>
              <Input id="brinco" name="brinco" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome (opcional)</Label>
              <Input id="nome" name="nome" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sexo">Sexo</Label>
              <Select id="sexo" name="sexo" required defaultValue="">
                <option value="" disabled>
                  Selecione o sexo
                </option>
                <option value="femea">Fêmea</option>
                <option value="macho">Macho</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select id="categoria" name="categoria" required defaultValue="">
                <option value="" disabled>
                  Selecione a categoria
                </option>
                {CATEGORIAS.map((categoria) => (
                  <option key={categoria.valor} value={categoria.valor}>
                    {categoria.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_nascimento">Data de nascimento (opcional)</Label>
              <Input id="data_nascimento" name="data_nascimento" type="date" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mae_id">Mãe (opcional)</Label>
              <Select id="mae_id" name="mae_id" defaultValue="">
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
              <Input id="pai_texto" name="pai_texto" placeholder="Ex: sêmen touro X" />
            </div>
            <Button type="submit">Criar animal</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 5: Criar `web/app/api/producao/animais/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { animalPertenceAPropriedade } from '@/lib/producao/validar-animal'
import { NextResponse } from 'next/server'

const SEXOS_VALIDOS = ['femea', 'macho']
const CATEGORIAS_VALIDAS = [
  'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
  'novilha_coberta', 'novilha_recria', 'terneira_aleitamento',
]

export async function POST(request: Request) {
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
  const brinco = String(formData.get('brinco') ?? '').trim()
  const nomeForm = String(formData.get('nome') ?? '').trim()
  const nome = nomeForm === '' ? null : nomeForm
  const sexo = String(formData.get('sexo') ?? '')
  const categoria = String(formData.get('categoria') ?? '')
  const dataNascimentoForm = String(formData.get('data_nascimento') ?? '').trim()
  const dataNascimento = dataNascimentoForm === '' ? null : dataNascimentoForm
  const maeIdForm = String(formData.get('mae_id') ?? '').trim()
  const maeId = maeIdForm === '' ? null : maeIdForm
  const paiTextoForm = String(formData.get('pai_texto') ?? '').trim()
  const paiTexto = paiTextoForm === '' ? null : paiTextoForm

  if (!brinco || !SEXOS_VALIDOS.includes(sexo) || !CATEGORIAS_VALIDAS.includes(categoria)) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho/animais/novo?error=dados_invalidos', request.url),
      { status: 303 }
    )
  }

  if (dataNascimento !== null) {
    const hoje = new Date().toISOString().slice(0, 10)
    if (Number.isNaN(Date.parse(dataNascimento)) || dataNascimento > hoje) {
      return NextResponse.redirect(
        new URL('/dashboard/producao/rebanho/animais/novo?error=data_nascimento_invalida', request.url),
        { status: 303 }
      )
    }
  }

  const supabase = await createClient()

  if (maeId !== null) {
    const maeValida = await animalPertenceAPropriedade(supabase, maeId, usuarioAtual.propriedade_id)
    if (!maeValida) {
      return NextResponse.redirect(
        new URL('/dashboard/producao/rebanho/animais/novo?error=mae_invalida', request.url),
        { status: 303 }
      )
    }
  }

  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)
  if (!unidadeNegocioId) {
    return NextResponse.redirect(
      new URL(
        '/dashboard/producao/rebanho/animais/novo?error=unidade_negocio_nao_encontrada',
        request.url
      ),
      { status: 303 }
    )
  }

  const { error: erroInsert } = await supabase.from('animais').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    brinco,
    nome,
    sexo,
    categoria,
    data_nascimento: dataNascimento,
    mae_id: maeId,
    pai_texto: paiTexto,
    criado_por: usuarioAtual.id,
  })

  if (erroInsert) {
    const codigo = erroInsert.code === '23505' ? 'brinco_duplicado' : 'erro_inesperado'
    return NextResponse.redirect(
      new URL(`/dashboard/producao/rebanho/animais/novo?error=${codigo}`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/producao/rebanho/animais', request.url), {
    status: 303,
  })
}
```

- [ ] **Step 6: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 7: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- criar animal valido ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/animais \
  --data-urlencode "brinco=201" \
  --data-urlencode "nome=Estrela" \
  --data-urlencode "sexo=femea" \
  --data-urlencode "categoria=vaca_lactacao" | grep -i location

echo "--- brinco duplicado deve ser rejeitado ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/animais \
  --data-urlencode "brinco=201" \
  --data-urlencode "sexo=femea" \
  --data-urlencode "categoria=vaca_lactacao" | grep -i location

echo "--- listagem deve mostrar o animal criado ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/rebanho/animais | grep -o "Estrela"

kill $DEV_PID
```

Expected: primeiro bloco `location: /dashboard/producao/rebanho/animais`; segundo bloco `location: /dashboard/producao/rebanho/animais/novo?error=brinco_duplicado`; terceiro bloco imprime `Estrela`.

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat: adiciona listagem e criacao de animal individual"
```

---

### Task 4: Cadastro de animal — edição e baixa

**Files:**
- Create: `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`
- Create: `web/app/api/producao/animais/[id]/editar/route.ts`
- Create: `web/app/api/producao/animais/[id]/baixa/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro`, `animalPertenceAPropriedade` (Task 3).

- [ ] **Step 1: Criar `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx`**

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
import { notFound, redirect } from 'next/navigation'

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
    .eq('sexo', 'femea')
    .neq('id', animal.id)
    .order('brinco')

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
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/producao/animais/[id]/editar/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { animalPertenceAPropriedade } from '@/lib/producao/validar-animal'
import { NextResponse } from 'next/server'

const SEXOS_VALIDOS = ['femea', 'macho']
const CATEGORIAS_VALIDAS = [
  'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
  'novilha_coberta', 'novilha_recria', 'terneira_aleitamento',
]

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
  const brinco = String(formData.get('brinco') ?? '').trim()
  const nomeForm = String(formData.get('nome') ?? '').trim()
  const nome = nomeForm === '' ? null : nomeForm
  const sexo = String(formData.get('sexo') ?? '')
  const categoria = String(formData.get('categoria') ?? '')
  const dataNascimentoForm = String(formData.get('data_nascimento') ?? '').trim()
  const dataNascimento = dataNascimentoForm === '' ? null : dataNascimentoForm
  const maeIdForm = String(formData.get('mae_id') ?? '').trim()
  const maeId = maeIdForm === '' ? null : maeIdForm
  const paiTextoForm = String(formData.get('pai_texto') ?? '').trim()
  const paiTexto = paiTextoForm === '' ? null : paiTextoForm

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(`/dashboard/producao/rebanho/animais/${id}/editar?error=${codigo}`, request.url),
      { status: 303 }
    )

  if (!brinco || !SEXOS_VALIDOS.includes(sexo) || !CATEGORIAS_VALIDAS.includes(categoria)) {
    return redirecionarComErro('dados_invalidos')
  }

  if (dataNascimento !== null) {
    const hoje = new Date().toISOString().slice(0, 10)
    if (Number.isNaN(Date.parse(dataNascimento)) || dataNascimento > hoje) {
      return redirecionarComErro('data_nascimento_invalida')
    }
  }

  if (maeId !== null && maeId === id) {
    return redirecionarComErro('mae_invalida')
  }

  const supabase = await createClient()

  if (maeId !== null) {
    const maeValida = await animalPertenceAPropriedade(supabase, maeId, usuarioAtual.propriedade_id)
    if (!maeValida) {
      return redirecionarComErro('mae_invalida')
    }
  }

  const { error: erroUpdate } = await supabase
    .from('animais')
    .update({
      brinco,
      nome,
      sexo,
      categoria,
      data_nascimento: dataNascimento,
      mae_id: maeId,
      pai_texto: paiTexto,
    })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    const codigo = erroUpdate.code === '23505' ? 'brinco_duplicado' : 'erro_inesperado'
    return redirecionarComErro(codigo)
  }

  return NextResponse.redirect(
    new URL(`/dashboard/producao/rebanho/animais/${id}/editar`, request.url),
    { status: 303 }
  )
}
```

- [ ] **Step 3: Criar `web/app/api/producao/animais/[id]/baixa/route.ts`**

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

  const supabase = await createClient()
  const { data: animalAtual } = await supabase
    .from('animais')
    .select('ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!animalAtual) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho/animais?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  const { error: erroUpdate } = await supabase
    .from('animais')
    .update({ ativo: !animalAtual.ativo })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
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

echo "--- editar animal ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/editar" \
  --data-urlencode "brinco=201" \
  --data-urlencode "nome=Estrela do Norte" \
  --data-urlencode "sexo=femea" \
  --data-urlencode "categoria=vaca_lactacao" | grep -i location

echo "--- dar baixa ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/producao/animais/$ANIMAL_ID/baixa" | grep -i location

echo "--- listagem deve mostrar como inativo ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/rebanho/animais | grep -o "inativo"

kill $DEV_PID
```

Expected: primeiros dois blocos `location: /dashboard/producao/rebanho/animais/$ANIMAL_ID/editar`; terceiro bloco imprime `inativo`.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona edicao e baixa de animal individual"
```

---

### Task 5: Lançamento de produção por animal por ordenha

**Files:**
- Create: `web/app/dashboard/producao/leite/por-animal/page.tsx`
- Create: `web/app/api/producao/leite/por-animal/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `getUnidadeNegocioLeiteId`, `mensagemErro`; tabelas `animais` (Task 1), `producao_animal` (Task 2).

- [ ] **Step 1: Criar `web/app/dashboard/producao/leite/por-animal/page.tsx`**

```tsx
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

  const { data: animais } = unidadeNegocioId
    ? await supabase
        .from('animais')
        .select('id, brinco, nome')
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

      {(animais ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum animal ativo em lactação cadastrado para esta unidade.
        </p>
      ) : (
        <form method="POST" action="/api/producao/leite/por-animal" className="flex flex-col gap-4">
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="numero_ordenha" value={numeroOrdenha} />
          {(animais ?? []).map((animal) => (
            <div key={animal.id} className="flex flex-col gap-2">
              <Label htmlFor={`litros_${animal.id}`}>
                {animal.brinco}
                {animal.nome && ` · ${animal.nome}`}
              </Label>
              <Input
                id={`litros_${animal.id}`}
                name={`litros_${animal.id}`}
                type="number"
                step="0.01"
                min="0"
                defaultValue={litrosPorAnimal.get(animal.id) ?? ''}
              />
            </div>
          ))}
          <Button type="submit">Salvar lançamentos</Button>
        </form>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/producao/leite/por-animal/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
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
  const numeroOrdenha = Number(formData.get('numero_ordenha'))

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/producao/leite/por-animal?data=${data}&ordenha=${numeroOrdenha}&error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  if (!data || Number.isNaN(Date.parse(data))) {
    return redirecionarComErro('data_invalida')
  }

  if (Number.isNaN(numeroOrdenha) || numeroOrdenha < 1) {
    return redirecionarComErro('ordenha_invalida')
  }

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  if (!unidadeNegocioId) {
    return redirecionarComErro('unidade_negocio_nao_encontrada')
  }

  const { data: animaisValidos } = await supabase
    .from('animais')
    .select('id')
    .eq('unidade_negocio_id', unidadeNegocioId)
    .eq('categoria', 'vaca_lactacao')
    .eq('ativo', true)

  const idsValidos = new Set((animaisValidos ?? []).map((animal) => animal.id))

  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith('litros_')) {
      continue
    }

    const animalId = chave.slice('litros_'.length)
    const litrosTexto = String(valor).trim()

    if (!idsValidos.has(animalId) || litrosTexto === '') {
      continue
    }

    const litros = Number(litrosTexto)
    if (Number.isNaN(litros) || litros < 0) {
      continue
    }

    const { error: erroInsert } = await supabase.from('producao_animal').insert({
      propriedade_id: usuarioAtual.propriedade_id,
      animal_id: animalId,
      unidade_negocio_id: unidadeNegocioId,
      data,
      numero_ordenha: numeroOrdenha,
      litros,
      criado_por: usuarioAtual.id,
    })

    if (erroInsert && erroInsert.code === '23505') {
      await supabase
        .from('producao_animal')
        .update({ litros })
        .eq('animal_id', animalId)
        .eq('data', data)
        .eq('numero_ordenha', numeroOrdenha)
    }
  }

  return NextResponse.redirect(
    new URL(`/dashboard/producao/leite/por-animal?data=${data}&ordenha=${numeroOrdenha}`, request.url),
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

ANIMAL_ID=$(curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/leite/por-animal" | grep -o 'id="litros_[a-f0-9-]*"' | head -1 | sed 's/id="litros_//;s/"//')

echo "--- ANIMAL_ID capturado: $ANIMAL_ID ---"

echo "--- lancar producao da 1a ordenha ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/leite/por-animal \
  --data-urlencode "data=2026-07-09" \
  --data-urlencode "numero_ordenha=1" \
  --data-urlencode "litros_$ANIMAL_ID=12.5" | grep -i location

echo "--- reabrir a mesma ordenha deve vir pre-preenchido ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/leite/por-animal?data=2026-07-09&ordenha=1" | grep -o 'value="12.5"'

kill $DEV_PID
```

Expected: primeiro bloco `location: /dashboard/producao/leite/por-animal?data=2026-07-09&ordenha=1`; segundo bloco imprime `value="12.5"` (confirma que o valor foi salvo e volta pré-preenchido).

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: adiciona lancamento de producao de leite por animal por ordenha"
```
