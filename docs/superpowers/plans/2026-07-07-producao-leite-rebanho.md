# Produção de Leite e Rebanho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modelar no banco (Postgres/Supabase) a produção diária de leite e a movimentação de rebanho da atividade leiteira, conforme `docs/superpowers/specs/2026-07-07-producao-leite-rebanho-design.md` — sem telas de frontend (spec própria depois).

**Architecture:** Tabela nova dedicada `producao_leite` (lançamento diário, 3 destinos de litros). Extensão da tabela genérica já existente `eventos_operacionais` com novos `tipo_evento` (`nascimento`, `mudanca_categoria`, `compra_animal`, `venda_animal`, `ajuste_inventario`) e duas colunas (`categoria_animal`, `categoria_origem`) para modelar movimentação de rebanho. Função `rebanho_composicao(unidade_negocio_id, data)` reconstrói a contagem por categoria a partir do último `ajuste_inventario` + eventos posteriores. View `producao_leite_mensal` agrega litros por mês e cruza com a composição do rebanho no fim do mês para calcular médias por vaca em lactação.

**Tech Stack:** Postgres/Supabase local, pgTAP para testes (`npx supabase test db`, rodado da raiz do repositório).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente — toda mudança de tabela usa `alter table`/`create table` numa migration nova.
- Toda tabela nova segue os constraints já estabelecidos: `id uuid primary key default gen_random_uuid()`, `propriedade_id uuid not null references propriedades(id)`, `created_at timestamptz not null default now()`, RLS habilitado na mesma migration que cria a tabela.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Ao final de cada task, a suíte completa de testes deve passar (nenhuma task pode deixar o repositório com testes quebrados).
- O Supabase local precisa estar rodando (`npx supabase status` na raiz; `npx supabase start` se não estiver).
- Sem telas de frontend nesta spec — só schema/funções/views, verificado via pgTAP.

---

### Task 1: Tabela `producao_leite`

**Files:**
- Create: `supabase/migrations/20260707140000_producao_leite.sql`
- Create: `supabase/tests/database/26_producao_leite.sql`

**Interfaces:**
- Consumes: `public.propriedades`, `public.unidades_negocio`, `public.usuarios`, `public.usuario_propriedade_id()`, `public.tem_permissao(modulo text, acao text)` (já existentes).
- Produces: tabela `public.producao_leite` — consumida pela Task 4 (view `producao_leite_mensal`).

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/26_producao_leite.sql`:

```sql
begin;
select plan(4);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'producao_leite', 'tabela producao_leite deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.producao_leite
  (propriedade_id, unidade_negocio_id, data, litros_comercial, litros_descarte, litros_consumo, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 965.6, 15, 10, 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.producao_leite),
  1,
  'lançamento de produção de leite deve ser inserido e visível pelo admin'
);

select throws_ok(
  $$insert into public.producao_leite (propriedade_id, unidade_negocio_id, data, litros_comercial, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', -10, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "producao_leite" violates check constraint "producao_leite_litros_comercial_check"',
  'litros_comercial negativo deve ser rejeitado'
);

select throws_ok(
  $$insert into public.producao_leite (propriedade_id, unidade_negocio_id, data, litros_comercial, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 900, '33333333-3333-3333-3333-333333333333')$$,
  'duplicate key value violates unique constraint "producao_leite_unidade_negocio_id_data_key"',
  'segundo lançamento no mesmo dia/unidade deve ser rejeitado pelo unique'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Da raiz do repositório:

```bash
npx supabase test db
```

Expected: falha em `has_table` (tabela `producao_leite` não existe).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260707140000_producao_leite.sql`:

```sql
create table public.producao_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  data date not null,
  litros_comercial numeric(10,2) not null default 0 check (litros_comercial >= 0),
  litros_descarte numeric(10,2) not null default 0 check (litros_descarte >= 0),
  litros_consumo numeric(10,2) not null default 0 check (litros_consumo >= 0),
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (unidade_negocio_id, data)
);

alter table public.producao_leite enable row level security;

create index producao_leite_propriedade_id_idx on public.producao_leite(propriedade_id);
create index producao_leite_unidade_negocio_id_idx on public.producao_leite(unidade_negocio_id);

create policy "ver producao de leite"
  on public.producao_leite for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar producao de leite"
  on public.producao_leite for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 4 testes de `26_producao_leite.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260707140000_producao_leite.sql supabase/tests/database/26_producao_leite.sql
git commit -m "feat: adiciona tabela producao_leite"
```

---

### Task 2: Movimentação de rebanho (extensão de `eventos_operacionais`)

**Files:**
- Create: `supabase/migrations/20260707141000_movimentacao_rebanho.sql`
- Create: `supabase/tests/database/27_movimentacao_rebanho.sql`

**Interfaces:**
- Consumes: `public.eventos_operacionais` (já existente, Task 3 do núcleo de dados).
- Produces: novos valores de `tipo_evento` (`nascimento`, `mudanca_categoria`, `compra_animal`, `venda_animal`, `ajuste_inventario`) e colunas `categoria_animal`/`categoria_origem` em `eventos_operacionais` — consumidos pela Task 3 (`rebanho_composicao`).

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/27_movimentacao_rebanho.sql`:

```sql
begin;
select plan(5);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_column('public', 'eventos_operacionais', 'categoria_animal', 'coluna categoria_animal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'ajuste_inventario', '2026-07-01', 38, 'vaca_lactacao', 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.eventos_operacionais where tipo_evento = 'ajuste_inventario'),
  1,
  'ajuste_inventario deve ser inserido e visível pelo admin'
);

insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, categoria_origem, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'mudanca_categoria', '2026-07-10', 2, 'vaca_lactacao', 'novilha_recria', 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.eventos_operacionais where tipo_evento = 'mudanca_categoria'),
  1,
  'mudanca_categoria deve ser inserida e visível pelo admin'
);

select throws_ok(
  $$insert into public.eventos_operacionais (propriedade_id, unidade_negocio_id, tipo_evento, data, categoria_animal, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'nascimento', '2026-07-11', 'categoria_invalida', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "eventos_operacionais" violates check constraint "eventos_operacionais_categoria_animal_check"',
  'categoria_animal fora do enum deve ser rejeitada'
);

select throws_ok(
  $$insert into public.eventos_operacionais (propriedade_id, unidade_negocio_id, tipo_evento, data, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'tipo_invalido', '2026-07-11', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "eventos_operacionais" violates check constraint "eventos_operacionais_tipo_evento_check"',
  'tipo_evento fora do enum estendido continua sendo rejeitado'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx supabase test db
```

Expected: falha em `has_column` (coluna `categoria_animal` não existe ainda).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260707141000_movimentacao_rebanho.sql`:

```sql
alter table public.eventos_operacionais
  drop constraint eventos_operacionais_tipo_evento_check,
  add constraint eventos_operacionais_tipo_evento_check
    check (tipo_evento in (
      'producao', 'mortalidade', 'insumo', 'venda', 'ocorrencia_sanitaria',
      'nascimento', 'mudanca_categoria', 'compra_animal', 'venda_animal', 'ajuste_inventario'
    ));

alter table public.eventos_operacionais
  add column categoria_animal text check (categoria_animal in (
    'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
    'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
  )),
  add column categoria_origem text check (categoria_origem in (
    'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
    'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
  ));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 5 testes de `27_movimentacao_rebanho.sql` passam (e todos os anteriores continuam passando — em especial `04_eventos_operacionais.sql`, que testa o `tipo_evento` original).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260707141000_movimentacao_rebanho.sql supabase/tests/database/27_movimentacao_rebanho.sql
git commit -m "feat: adiciona movimentacao de rebanho a eventos_operacionais"
```

---

### Task 3: Função `rebanho_composicao()`

**Files:**
- Create: `supabase/migrations/20260707142000_rebanho_composicao.sql`
- Create: `supabase/tests/database/28_rebanho_composicao.sql`

**Interfaces:**
- Consumes: `public.eventos_operacionais` com os campos da Task 2 (`tipo_evento`, `categoria_animal`, `categoria_origem`, `quantidade`, `data`).
- Produces: `public.rebanho_composicao(p_unidade_negocio_id uuid, p_data date) returns table (categoria text, quantidade bigint)` — consumida pela Task 4.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/28_rebanho_composicao.sql`:

```sql
begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_function('public', 'rebanho_composicao', array['uuid', 'date'], 'funcao rebanho_composicao deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

-- inventário inicial em 2026-07-01: 38 vacas em lactação, 8 novilhas em recria
insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'ajuste_inventario', '2026-07-01', 38, 'vaca_lactacao', 'manual', '33333333-3333-3333-3333-333333333333'),
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'ajuste_inventario', '2026-07-01', 8, 'novilha_recria', 'manual', '33333333-3333-3333-3333-333333333333');

-- 10/07: 2 novilhas em recria viram vacas em lactação (pariram)
insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, categoria_origem, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'mudanca_categoria', '2026-07-10', 2, 'vaca_lactacao', 'novilha_recria', 'manual', '33333333-3333-3333-3333-333333333333');

-- 15/07: 1 vaca em lactação morre
insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'mortalidade', '2026-07-15', 1, 'vaca_lactacao', 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select quantidade from public.rebanho_composicao('66666666-6666-6666-6666-666666666666', '2026-07-20') where categoria = 'vaca_lactacao'),
  39::bigint,
  'vacas em lactacao em 20/07 deve ser 38 + 2 (mudanca) - 1 (morte) = 39'
);

select is(
  (select quantidade from public.rebanho_composicao('66666666-6666-6666-6666-666666666666', '2026-07-20') where categoria = 'novilha_recria'),
  6::bigint,
  'novilhas em recria em 20/07 deve ser 8 - 2 (mudanca) = 6'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx supabase test db
```

Expected: falha em `has_function` (função `rebanho_composicao` não existe ainda).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260707142000_rebanho_composicao.sql`:

```sql
create or replace function public.rebanho_composicao(p_unidade_negocio_id uuid, p_data date)
returns table (categoria text, quantidade bigint)
language sql
stable
as $$
  with categorias as (
    select unnest(array[
      'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
      'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
    ]) as categoria
  ),
  ultimo_ajuste as (
    select distinct on (categoria_animal)
      categoria_animal as categoria, quantidade, data
    from public.eventos_operacionais
    where unidade_negocio_id = p_unidade_negocio_id
      and tipo_evento = 'ajuste_inventario'
      and data <= p_data
    order by categoria_animal, data desc, created_at desc
  ),
  entradas as (
    select eo.categoria_animal as categoria, coalesce(sum(eo.quantidade), 0) as total
    from public.eventos_operacionais eo
    left join ultimo_ajuste ua on ua.categoria = eo.categoria_animal
    where eo.unidade_negocio_id = p_unidade_negocio_id
      and eo.tipo_evento in ('nascimento', 'compra_animal')
      and eo.data <= p_data
      and eo.data > coalesce(ua.data, '0001-01-01'::date)
    group by eo.categoria_animal
  ),
  saidas as (
    select eo.categoria_animal as categoria, coalesce(sum(eo.quantidade), 0) as total
    from public.eventos_operacionais eo
    left join ultimo_ajuste ua on ua.categoria = eo.categoria_animal
    where eo.unidade_negocio_id = p_unidade_negocio_id
      and eo.tipo_evento in ('mortalidade', 'venda_animal')
      and eo.data <= p_data
      and eo.data > coalesce(ua.data, '0001-01-01'::date)
    group by eo.categoria_animal
  ),
  mudancas_entrada as (
    select eo.categoria_animal as categoria, coalesce(sum(eo.quantidade), 0) as total
    from public.eventos_operacionais eo
    left join ultimo_ajuste ua on ua.categoria = eo.categoria_animal
    where eo.unidade_negocio_id = p_unidade_negocio_id
      and eo.tipo_evento = 'mudanca_categoria'
      and eo.data <= p_data
      and eo.data > coalesce(ua.data, '0001-01-01'::date)
    group by eo.categoria_animal
  ),
  mudancas_saida as (
    select eo.categoria_origem as categoria, coalesce(sum(eo.quantidade), 0) as total
    from public.eventos_operacionais eo
    left join ultimo_ajuste ua on ua.categoria = eo.categoria_origem
    where eo.unidade_negocio_id = p_unidade_negocio_id
      and eo.tipo_evento = 'mudanca_categoria'
      and eo.data <= p_data
      and eo.data > coalesce(ua.data, '0001-01-01'::date)
    group by eo.categoria_origem
  )
  select
    c.categoria,
    (coalesce((select ua.quantidade from ultimo_ajuste ua where ua.categoria = c.categoria), 0)
      + coalesce((select total from entradas e where e.categoria = c.categoria), 0)
      - coalesce((select total from saidas s where s.categoria = c.categoria), 0)
      + coalesce((select total from mudancas_entrada me where me.categoria = c.categoria), 0)
      - coalesce((select total from mudancas_saida ms where ms.categoria = c.categoria), 0)
    )::bigint as quantidade
  from categorias c;
$$;
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 3 testes de `28_rebanho_composicao.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260707142000_rebanho_composicao.sql supabase/tests/database/28_rebanho_composicao.sql
git commit -m "feat: adiciona funcao rebanho_composicao"
```

---

### Task 4: View `producao_leite_mensal`

**Files:**
- Create: `supabase/migrations/20260707143000_producao_leite_mensal.sql`
- Create: `supabase/tests/database/29_producao_leite_mensal.sql`

**Interfaces:**
- Consumes: `public.producao_leite` (Task 1), `public.rebanho_composicao()` (Task 3).
- Produces: view `public.producao_leite_mensal` — sem consumidores futuros nesta spec (a spec de frontend consome diretamente).

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/29_producao_leite_mensal.sql`:

```sql
begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_view('public', 'producao_leite_mensal', 'view producao_leite_mensal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, categoria_animal, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'ajuste_inventario', '2026-07-01', 40, 'vaca_lactacao', 'manual', '33333333-3333-3333-3333-333333333333');

insert into public.producao_leite
  (propriedade_id, unidade_negocio_id, data, litros_comercial, litros_descarte, litros_consumo, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 965.6, 15, 10, 'manual', '33333333-3333-3333-3333-333333333333'),
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-02', 869.1, 10, 5, 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select producao_total from public.producao_leite_mensal
    where unidade_negocio_id = '66666666-6666-6666-6666-666666666666' and mes = '2026-07-01'),
  1874.7,
  'producao_total de julho deve ser a soma dos 3 destinos dos 2 dias lancados'
);

select is(
  (select vacas_lactacao from public.producao_leite_mensal
    where unidade_negocio_id = '66666666-6666-6666-6666-666666666666' and mes = '2026-07-01'),
  40::bigint,
  'vacas_lactacao de julho deve vir de rebanho_composicao no ultimo dia do mes'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx supabase test db
```

Expected: falha em `has_view` (view `producao_leite_mensal` não existe ainda).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260707143000_producao_leite_mensal.sql`:

```sql
create or replace view public.producao_leite_mensal as
with mensal as (
  select
    unidade_negocio_id,
    date_trunc('month', data)::date as mes,
    sum(litros_comercial) as litros_comercial,
    sum(litros_descarte) as litros_descarte,
    sum(litros_consumo) as litros_consumo,
    sum(litros_comercial + litros_descarte + litros_consumo) as producao_total,
    count(distinct data) as dias_com_lancamento
  from public.producao_leite
  group by unidade_negocio_id, date_trunc('month', data)
)
select
  m.unidade_negocio_id,
  m.mes,
  m.litros_comercial,
  m.litros_descarte,
  m.litros_consumo,
  m.producao_total,
  m.producao_total / m.dias_com_lancamento as media_diaria,
  rc.quantidade as vacas_lactacao,
  case when rc.quantidade > 0
    then (m.producao_total / m.dias_com_lancamento) / rc.quantidade
    else null end as media_por_vaca_lactacao_dia
from mensal m
cross join lateral (
  select quantidade
  from public.rebanho_composicao(m.unidade_negocio_id, (m.mes + interval '1 month' - interval '1 day')::date)
  where categoria = 'vaca_lactacao'
) rc;
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 3 testes de `29_producao_leite_mensal.sql` passam, e a suíte completa (todos os arquivos em `supabase/tests/database/`) passa sem falhas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260707143000_producao_leite_mensal.sql supabase/tests/database/29_producao_leite_mensal.sql
git commit -m "feat: adiciona view producao_leite_mensal"
```
