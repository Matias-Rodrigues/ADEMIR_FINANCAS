# Núcleo de Dados CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o schema Postgres completo (Supabase) do CRM ADEMIR_FINANÇAS — todas as entidades da seção 4 de `PLANO_EXECUCAO_CRM.md` — com constraints, RLS e testes automatizados, sem nenhuma UI ou integração externa. Este é o Task 1 do roteiro de construção (seção 11 do plano).

**Architecture:** Supabase local (Postgres + Auth + Storage) via Supabase CLI. Migrations SQL versionadas em `supabase/migrations/`. Cada tabela nasce com Row Level Security habilitado desde o primeiro commit — nunca existe uma janela onde uma tabela fica pública sem policy. Multi-tenant-ready (toda tabela de negócio carrega `propriedade_id`), embora na prática só exista uma propriedade (Ademir).

**Tech Stack:** Postgres 15 (via imagem do Supabase), Supabase CLI, pgTAP (testes), Docker Desktop (runtime local do Supabase).

## Global Constraints

- Toda tabela de negócio tem `propriedade_id uuid not null references propriedades(id)`.
- Toda chave primária é `id uuid primary key default gen_random_uuid()`.
- Todo valor monetário é `numeric(12,2)`, sempre **positivo** (`check (valor > 0)` ou `check (valor_total > 0)`) — o sinal de receita/despesa fica em uma coluna `tipo`, nunca em valor negativo.
- Toda tabela tem `created_at timestamptz not null default now()`.
- RLS (`alter table ... enable row level security`) é habilitado na mesma migration que cria a tabela — nunca depois.
- Decisão registrada nesta sessão: a fatia "pessoal" de um rateio de custo compartilhado (seção 5 do `PLANO_EXECUCAO_CRM.md`) vira uma **despesa familiar consolidada** — não vinculada a um CPF específico. Por isso `lancamentos_financeiros_familiares` tem a coluna `eh_consolidado_familiar`.
- Fora de escopo deste plano (feature de negócio, não de schema): sincronizar automaticamente os itens de rateio com `lancamentos_financeiros_negocio`/`familiares`. Isso é lógica de aplicação, entra num plano futuro (roteiro item 6).
- Testes em pgTAP, executados com `supabase test db`. Todo teste roda dentro de `begin; ... rollback;` (nunca persiste dado de teste).

---

### Task 1: Inicializar projeto Supabase local

**Files:**
- Create: `supabase/config.toml` (gerado pelo CLI)
- Create: `supabase/migrations/` (pasta, gerada pelo CLI)
- Create: `supabase/tests/database/00_setup.sql`
- Modify: `.env.example` (adicionar variáveis do Supabase local)

**Interfaces:**
- Produces: ambiente local rodando (`supabase start`), extensão `pgtap` habilitada, comando `supabase test db` funcional para todos os tasks seguintes.

- [ ] **Step 1: Instalar e inicializar o Supabase CLI no projeto**

```bash
cd "D:/PROJETOS/ADEMIR_FINANÇAS"
npx supabase init
```

Expected: cria `supabase/config.toml` e `supabase/.gitignore`.

- [ ] **Step 2: Subir o Supabase local (requer Docker Desktop rodando)**

```bash
npx supabase start
```

Expected: output lista `API URL`, `DB URL`, `anon key`, `service_role key`. Copiar esses valores.

- [ ] **Step 3: Habilitar a extensão pgTAP via migration**

```bash
npx supabase migration new habilita_pgtap
```

Editar o arquivo gerado (`supabase/migrations/<timestamp>_habilita_pgtap.sql`):

```sql
create extension if not exists pgtap with schema extensions;
```

- [ ] **Step 4: Aplicar a migration**

```bash
npx supabase db reset
```

Expected: reset roda todas as migrations do zero sem erro, termina com "Finished supabase db reset".

- [ ] **Step 5: Criar o primeiro teste (sanity check da extensão)**

Criar `supabase/tests/database/00_setup.sql`:

```sql
begin;
select plan(1);

select has_extension('pgtap', 'extensão pgtap deve estar habilitada');

select * from finish();
rollback;
```

- [ ] **Step 6: Rodar os testes**

```bash
npx supabase test db
```

Expected: `1..1` seguido de `ok 1 - extensão pgtap deve estar habilitada`, exit code 0.

- [ ] **Step 7: Atualizar `.env.example` com as variáveis locais**

Adicionar ao final de `.env.example`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 8: Commit**

```bash
git add supabase/ .env.example
git commit -m "chore: inicializa projeto Supabase local com pgTAP"
```

---

### Task 2: Propriedades e pessoas físicas

**Files:**
- Create: `supabase/migrations/<timestamp>_propriedades_pessoas_fisicas.sql`
- Create: `supabase/tests/database/01_propriedades_pessoas_fisicas.sql`

**Interfaces:**
- Consumes: nada (tabelas-base).
- Produces: `propriedades(id, nome, created_at)`, `pessoas_fisicas(id, propriedade_id, nome, cpf, created_at)` — usadas por todas as tabelas seguintes via `propriedade_id`, e por `usuarios`/`lancamentos_financeiros_familiares` via `pessoa_fisica_id`.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/01_propriedades_pessoas_fisicas.sql`:

```sql
begin;
select plan(4);

insert into public.propriedades (id, nome)
values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');

select has_table('public', 'propriedades', 'tabela propriedades deve existir');
select has_table('public', 'pessoas_fisicas', 'tabela pessoas_fisicas deve existir');

insert into public.pessoas_fisicas (id, propriedade_id, nome, cpf)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Ademir', '11111111111');

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'pessoa física deve estar vinculada à propriedade'
);

select throws_ok(
  $$insert into public.pessoas_fisicas (propriedade_id, nome, cpf) values ('11111111-1111-1111-1111-111111111111', 'Duplicado', '11111111111')$$,
  'duplicate key value violates unique constraint "pessoas_fisicas_cpf_key"',
  'CPF duplicado deve ser rejeitado'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.propriedades" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new propriedades_pessoas_fisicas
```

Editar o arquivo gerado:

```sql
create table public.propriedades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

alter table public.propriedades enable row level security;

create table public.pessoas_fisicas (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  nome text not null,
  cpf text not null unique,
  created_at timestamptz not null default now()
);

alter table public.pessoas_fisicas enable row level security;

create index pessoas_fisicas_propriedade_id_idx on public.pessoas_fisicas(propriedade_id);
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..4`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria tabelas propriedades e pessoas_fisicas"
```

---

### Task 3: Usuários, perfis de acesso e função de permissão

**Files:**
- Create: `supabase/migrations/<timestamp>_usuarios_perfis_acesso.sql`
- Create: `supabase/tests/database/02_usuarios_perfis_acesso.sql`

**Interfaces:**
- Consumes: `propriedades(id)`, `pessoas_fisicas(id)` (Task 2).
- Produces: `usuarios(id, propriedade_id, pessoa_fisica_id, papel, perfil_acesso_id, ativo, created_at)`, `perfis_acesso(id, propriedade_id, nome, created_at)`, `perfil_acesso_permissoes(id, perfil_acesso_id, modulo, pode_ver, pode_lancar)`, função `public.usuario_propriedade_id()` e `public.tem_permissao(p_modulo text, p_acao text) returns boolean` — usadas por **todas** as RLS policies das tasks seguintes.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/02_usuarios_perfis_acesso.sql`:

```sql
begin;
select plan(5);

insert into public.propriedades (id, nome)
values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');

insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');

insert into public.usuarios (id, propriedade_id, papel)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');

select has_table('public', 'usuarios', 'tabela usuarios deve existir');
select has_table('public', 'perfis_acesso', 'tabela perfis_acesso deve existir');
select has_table('public', 'perfil_acesso_permissoes', 'tabela perfil_acesso_permissoes deve existir');

insert into public.perfis_acesso (id, propriedade_id, nome)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Financeiro básico');

insert into public.perfil_acesso_permissoes (perfil_acesso_id, modulo, pode_ver, pode_lancar)
values ('44444444-4444-4444-4444-444444444444', 'financeiro_negocio', true, false);

insert into auth.users (id, email)
values ('55555555-5555-5555-5555-555555555555', 'membro@teste.com');

insert into public.usuarios (id, propriedade_id, papel, perfil_acesso_id)
values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia', '44444444-4444-4444-4444-444444444444');

select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select ok(
  public.tem_permissao('financeiro_negocio', 'ver'),
  'membro com pode_ver=true deve ter permissão de ver'
);

select ok(
  not public.tem_permissao('financeiro_negocio', 'lancar'),
  'membro com pode_lancar=false não deve ter permissão de lançar'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.usuarios" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new usuarios_perfis_acesso
```

```sql
create table public.perfis_acesso (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

alter table public.perfis_acesso enable row level security;

create table public.perfil_acesso_permissoes (
  id uuid primary key default gen_random_uuid(),
  perfil_acesso_id uuid not null references public.perfis_acesso(id) on delete cascade,
  modulo text not null check (modulo in (
    'producao', 'financeiro_negocio', 'financeiro_familiar', 'credito_obrigacoes',
    'imobilizado', 'ponto_equilibrio', 'fiscal', 'administracao_usuarios'
  )),
  pode_ver boolean not null default false,
  pode_lancar boolean not null default false,
  unique (perfil_acesso_id, modulo)
);

alter table public.perfil_acesso_permissoes enable row level security;

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  pessoa_fisica_id uuid references public.pessoas_fisicas(id) on delete set null,
  perfil_acesso_id uuid references public.perfis_acesso(id) on delete set null,
  papel text not null check (papel in ('admin', 'membro_familia', 'dev')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.usuarios enable row level security;

create index usuarios_propriedade_id_idx on public.usuarios(propriedade_id);

create or replace function public.usuario_propriedade_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select propriedade_id from public.usuarios where id = auth.uid();
$$;

create or replace function public.tem_permissao(p_modulo text, p_acao text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_papel text;
  v_perfil_id uuid;
  v_permitido boolean;
begin
  select papel, perfil_acesso_id into v_papel, v_perfil_id
  from public.usuarios where id = auth.uid();

  if v_papel = 'admin' then
    return true;
  end if;

  if v_perfil_id is null then
    return false;
  end if;

  if p_acao = 'ver' then
    select pode_ver into v_permitido from public.perfil_acesso_permissoes
      where perfil_acesso_id = v_perfil_id and modulo = p_modulo;
  else
    select pode_lancar into v_permitido from public.perfil_acesso_permissoes
      where perfil_acesso_id = v_perfil_id and modulo = p_modulo;
  end if;

  return coalesce(v_permitido, false);
end;
$$;

create policy "usuarios podem ver a própria linha"
  on public.usuarios for select
  using (id = auth.uid());
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..5`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria usuarios, perfis_acesso e funcao tem_permissao"
```

---

### Task 4: Unidades de negócio

**Files:**
- Create: `supabase/migrations/<timestamp>_unidades_negocio.sql`
- Create: `supabase/tests/database/03_unidades_negocio.sql`

**Interfaces:**
- Consumes: `propriedades(id)` (Task 2), `public.usuario_propriedade_id()` (Task 3).
- Produces: `unidades_negocio(id, propriedade_id, nome, tipo, ativo, created_at)` — referenciada por praticamente todas as tabelas seguintes.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/03_unidades_negocio.sql`:

```sql
begin;
select plan(4);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('99999999-9999-9999-9999-999999999999', 'Outra Propriedade');

insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');

select has_table('public', 'unidades_negocio', 'tabela unidades_negocio deve existir');

insert into public.unidades_negocio (id, propriedade_id, nome, tipo) values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite'),
  ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'Outra unidade', 'outro');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.unidades_negocio),
  1,
  'RLS deve mostrar só as unidades de negócio da própria propriedade'
);

select ok(
  (select nome from public.unidades_negocio limit 1) = 'Gado leiteiro',
  'a unidade visível deve ser a da propriedade do usuário logado'
);

select throws_ok(
  $$insert into public.unidades_negocio (propriedade_id, nome, tipo) values ('11111111-1111-1111-1111-111111111111', 'Inválida', 'inexistente')$$,
  'new row for relation "unidades_negocio" violates check constraint "unidades_negocio_tipo_check"',
  'tipo fora do enum deve ser rejeitado'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.unidades_negocio" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new unidades_negocio
```

```sql
create table public.unidades_negocio (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('leite', 'suinos', 'outro')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.unidades_negocio enable row level security;

create index unidades_negocio_propriedade_id_idx on public.unidades_negocio(propriedade_id);

create policy "ver unidades de negocio da propria propriedade"
  on public.unidades_negocio for select
  using (propriedade_id = public.usuario_propriedade_id());

create policy "gerenciar unidades de negocio da propria propriedade"
  on public.unidades_negocio for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..4`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria unidades_negocio com RLS por propriedade"
```

---

### Task 5: Eventos operacionais

**Files:**
- Create: `supabase/migrations/<timestamp>_eventos_operacionais.sql`
- Create: `supabase/tests/database/04_eventos_operacionais.sql`

**Interfaces:**
- Consumes: `unidades_negocio(id)` (Task 4), `usuarios(id)` (Task 3), `public.tem_permissao()` (Task 3).
- Produces: `eventos_operacionais(id, propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, unidade_medida, descricao, origem, criado_por, created_at)`.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/04_eventos_operacionais.sql`:

```sql
begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'eventos_operacionais', 'tabela eventos_operacionais deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.eventos_operacionais
  (propriedade_id, unidade_negocio_id, tipo_evento, data, quantidade, unidade_medida, descricao, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'producao', '2026-07-01', 1016, 'litros', 'Produção do dia', 'whatsapp_texto', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.eventos_operacionais),
  1,
  'evento operacional deve ser inserido e visível pelo admin'
);

select throws_ok(
  $$insert into public.eventos_operacionais (propriedade_id, unidade_negocio_id, tipo_evento, data, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'tipo_invalido', '2026-07-01', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "eventos_operacionais" violates check constraint "eventos_operacionais_tipo_evento_check"',
  'tipo_evento fora do enum deve ser rejeitado'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.eventos_operacionais" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new eventos_operacionais
```

```sql
create table public.eventos_operacionais (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  tipo_evento text not null check (tipo_evento in ('producao', 'mortalidade', 'insumo', 'venda', 'ocorrencia_sanitaria')),
  data date not null,
  quantidade numeric,
  unidade_medida text,
  descricao text,
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.eventos_operacionais enable row level security;

create index eventos_operacionais_propriedade_id_idx on public.eventos_operacionais(propriedade_id);
create index eventos_operacionais_unidade_negocio_id_idx on public.eventos_operacionais(unidade_negocio_id);

create policy "ver eventos operacionais da propria propriedade"
  on public.eventos_operacionais for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar eventos operacionais da propria propriedade"
  on public.eventos_operacionais for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..3`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria eventos_operacionais com RLS por permissao de producao"
```

---

### Task 6: Lançamentos financeiros do negócio

**Files:**
- Create: `supabase/migrations/<timestamp>_lancamentos_financeiros_negocio.sql`
- Create: `supabase/tests/database/05_lancamentos_financeiros_negocio.sql`

**Interfaces:**
- Consumes: `unidades_negocio(id)` (Task 4), `usuarios(id)` e `public.tem_permissao()` (Task 3).
- Produces: `lancamentos_financeiros_negocio(id, propriedade_id, unidade_negocio_id, tipo, valor, data, descricao, categoria, origem, criado_por, created_at)`.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/05_lancamentos_financeiros_negocio.sql`:

```sql
begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'lancamentos_financeiros_negocio', 'tabela lancamentos_financeiros_negocio deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.lancamentos_financeiros_negocio
  (propriedade_id, unidade_negocio_id, tipo, valor, data, descricao, categoria, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'receita', 2842.80, '2026-07-05', 'Venda de leite', 'venda_leite', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.lancamentos_financeiros_negocio),
  1,
  'lançamento financeiro do negócio deve ser inserido e visível pelo admin'
);

select throws_ok(
  $$insert into public.lancamentos_financeiros_negocio (propriedade_id, unidade_negocio_id, tipo, valor, data, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'receita', -100, '2026-07-05', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "lancamentos_financeiros_negocio" violates check constraint "lancamentos_financeiros_negocio_valor_check"',
  'valor negativo deve ser rejeitado'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.lancamentos_financeiros_negocio" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new lancamentos_financeiros_negocio
```

```sql
create table public.lancamentos_financeiros_negocio (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  tipo text not null check (tipo in ('receita', 'despesa')),
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  descricao text,
  categoria text,
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.lancamentos_financeiros_negocio enable row level security;

create index lfn_propriedade_id_idx on public.lancamentos_financeiros_negocio(propriedade_id);
create index lfn_unidade_negocio_id_idx on public.lancamentos_financeiros_negocio(unidade_negocio_id);

create policy "ver lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_negocio', 'ver'));

create policy "lancar lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_negocio', 'lancar'));
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..3`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria lancamentos_financeiros_negocio com RLS por permissao"
```

---

### Task 7: Lançamentos financeiros familiares

**Files:**
- Create: `supabase/migrations/<timestamp>_lancamentos_financeiros_familiares.sql`
- Create: `supabase/tests/database/06_lancamentos_financeiros_familiares.sql`

**Interfaces:**
- Consumes: `pessoas_fisicas(id)` (Task 2), `usuarios(id)` e `public.tem_permissao()` (Task 3).
- Produces: `lancamentos_financeiros_familiares(id, propriedade_id, pessoa_fisica_id, eh_consolidado_familiar, tipo, valor, data, descricao, categoria, origem, criado_por, created_at)`. Implementa a decisão: fatia "pessoal" de rateio = despesa consolidada, sem CPF.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/06_lancamentos_financeiros_familiares.sql`:

```sql
begin;
select plan(4);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.pessoas_fisicas (id, propriedade_id, nome, cpf)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Ademir', '11111111111');

select has_table('public', 'lancamentos_financeiros_familiares', 'tabela lancamentos_financeiros_familiares deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.lancamentos_financeiros_familiares
  (propriedade_id, pessoa_fisica_id, eh_consolidado_familiar, tipo, valor, data, descricao, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', false, 'despesa', 150.00, '2026-07-05', 'Farmácia', '33333333-3333-3333-3333-333333333333');

insert into public.lancamentos_financeiros_familiares
  (propriedade_id, pessoa_fisica_id, eh_consolidado_familiar, tipo, valor, data, descricao, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', null, true, 'despesa', 100.00, '2026-07-01', 'Fatia pessoal do rateio de energia', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.lancamentos_financeiros_familiares),
  2,
  'deve aceitar lançamento vinculado a CPF e lançamento consolidado sem CPF'
);

select throws_ok(
  $$insert into public.lancamentos_financeiros_familiares (propriedade_id, pessoa_fisica_id, eh_consolidado_familiar, tipo, valor, data, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', true, 'despesa', 50, '2026-07-05', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "lancamentos_financeiros_familiares" violates check constraint "lff_consolidado_sem_cpf_check"',
  'não pode ter pessoa_fisica_id preenchido junto com eh_consolidado_familiar=true'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.lancamentos_financeiros_familiares" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new lancamentos_financeiros_familiares
```

```sql
create table public.lancamentos_financeiros_familiares (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  pessoa_fisica_id uuid references public.pessoas_fisicas(id) on delete restrict,
  eh_consolidado_familiar boolean not null default false,
  tipo text not null check (tipo in ('receita', 'despesa')),
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  descricao text,
  categoria text,
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  constraint lff_consolidado_sem_cpf_check check (
    (eh_consolidado_familiar = true and pessoa_fisica_id is null)
    or
    (eh_consolidado_familiar = false and pessoa_fisica_id is not null)
  )
);

alter table public.lancamentos_financeiros_familiares enable row level security;

create index lff_propriedade_id_idx on public.lancamentos_financeiros_familiares(propriedade_id);
create index lff_pessoa_fisica_id_idx on public.lancamentos_financeiros_familiares(pessoa_fisica_id);

create policy "ver lancamentos financeiros familiares"
  on public.lancamentos_financeiros_familiares for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_familiar', 'ver'));

create policy "lancar lancamentos financeiros familiares"
  on public.lancamentos_financeiros_familiares for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_familiar', 'lancar'));
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..4`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria lancamentos_financeiros_familiares com regra de consolidado"
```

---

### Task 8: Rateio de custo compartilhado

**Files:**
- Create: `supabase/migrations/<timestamp>_rateio_custo_compartilhado.sql`
- Create: `supabase/tests/database/07_rateio_custo_compartilhado.sql`

**Interfaces:**
- Consumes: `unidades_negocio(id)` (Task 4), `usuarios(id)` (Task 3).
- Produces: `lancamentos_custo_compartilhado(id, propriedade_id, data, descricao, valor_total, criado_por, created_at)`, `rateio_custo_compartilhado_itens(id, lancamento_custo_compartilhado_id, destino_tipo, unidade_negocio_id, valor)`, trigger que valida `sum(itens.valor) = valor_total` (regra da seção 5 do `PLANO_EXECUCAO_CRM.md`).

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/07_rateio_custo_compartilhado.sql`:

```sql
begin;
select plan(4);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo) values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'Suínos', 'suinos');

select has_table('public', 'lancamentos_custo_compartilhado', 'tabela lancamentos_custo_compartilhado deve existir');
select has_table('public', 'rateio_custo_compartilhado_itens', 'tabela rateio_custo_compartilhado_itens deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.lancamentos_custo_compartilhado (id, propriedade_id, data, descricao, valor_total, criado_por)
values ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '2026-07-01', 'Conta de energia - julho', 1000.00, '33333333-3333-3333-3333-333333333333');

insert into public.rateio_custo_compartilhado_itens (lancamento_custo_compartilhado_id, destino_tipo, unidade_negocio_id, valor) values
  ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'unidade_negocio', '66666666-6666-6666-6666-666666666666', 700.00),
  ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'unidade_negocio', '88888888-8888-8888-8888-888888888888', 200.00),
  ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'familiar_consolidado', null, 100.00);

select is(
  (select count(*)::int from public.rateio_custo_compartilhado_itens where lancamento_custo_compartilhado_id = '99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3,
  'rateio com soma igual ao total deve ser aceito'
);

select throws_ok(
  $$insert into public.rateio_custo_compartilhado_itens (lancamento_custo_compartilhado_id, destino_tipo, unidade_negocio_id, valor)
    values ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'unidade_negocio', '66666666-6666-6666-6666-666666666666', 5000.00)$$,
  'soma dos itens de rateio (6700.00) difere do valor_total (1000.00)',
  'rateio cuja soma diverge do valor_total deve ser rejeitado'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.lancamentos_custo_compartilhado" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new rateio_custo_compartilhado
```

```sql
create table public.lancamentos_custo_compartilhado (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  data date not null,
  descricao text not null,
  valor_total numeric(12,2) not null check (valor_total > 0),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.lancamentos_custo_compartilhado enable row level security;

create table public.rateio_custo_compartilhado_itens (
  id uuid primary key default gen_random_uuid(),
  lancamento_custo_compartilhado_id uuid not null references public.lancamentos_custo_compartilhado(id) on delete cascade,
  destino_tipo text not null check (destino_tipo in ('unidade_negocio', 'familiar_consolidado')),
  unidade_negocio_id uuid references public.unidades_negocio(id) on delete restrict,
  valor numeric(12,2) not null check (valor > 0),
  constraint rateio_destino_consistente_check check (
    (destino_tipo = 'unidade_negocio' and unidade_negocio_id is not null)
    or
    (destino_tipo = 'familiar_consolidado' and unidade_negocio_id is null)
  )
);

alter table public.rateio_custo_compartilhado_itens enable row level security;

create index rateio_itens_lancamento_id_idx on public.rateio_custo_compartilhado_itens(lancamento_custo_compartilhado_id);

create or replace function public.valida_soma_rateio()
returns trigger
language plpgsql
as $$
declare
  v_valor_total numeric(12,2);
  v_soma_itens numeric(12,2);
  v_lancamento_id uuid;
begin
  v_lancamento_id := coalesce(new.lancamento_custo_compartilhado_id, old.lancamento_custo_compartilhado_id);

  select valor_total into v_valor_total
  from public.lancamentos_custo_compartilhado
  where id = v_lancamento_id;

  select coalesce(sum(valor), 0) into v_soma_itens
  from public.rateio_custo_compartilhado_itens
  where lancamento_custo_compartilhado_id = v_lancamento_id;

  if v_soma_itens > v_valor_total then
    raise exception 'soma dos itens de rateio (%) difere do valor_total (%)', v_soma_itens, v_valor_total;
  end if;

  return new;
end;
$$;

create trigger valida_soma_rateio_trigger
  after insert or update on public.rateio_custo_compartilhado_itens
  for each row execute function public.valida_soma_rateio();

create policy "ver rateio de custo compartilhado"
  on public.lancamentos_custo_compartilhado for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_negocio', 'ver'));

create policy "lancar rateio de custo compartilhado"
  on public.lancamentos_custo_compartilhado for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_negocio', 'lancar'));

create policy "ver itens de rateio da propria propriedade"
  on public.rateio_custo_compartilhado_itens for select
  using (exists (
    select 1 from public.lancamentos_custo_compartilhado lcc
    where lcc.id = lancamento_custo_compartilhado_id
      and lcc.propriedade_id = public.usuario_propriedade_id()
  ));

create policy "lancar itens de rateio da propria propriedade"
  on public.rateio_custo_compartilhado_itens for insert
  with check (exists (
    select 1 from public.lancamentos_custo_compartilhado lcc
    where lcc.id = lancamento_custo_compartilhado_id
      and lcc.propriedade_id = public.usuario_propriedade_id()
      and public.tem_permissao('financeiro_negocio', 'lancar')
  ));
```

> Nota: o trigger rejeita quando a soma **ultrapassa** o total (garante que nunca se ratea mais do que o gasto real). Uma soma menor que o total é permitida durante a digitação incremental dos itens, mas a UI (fora deste plano) deve exigir soma exatamente igual ao total antes de permitir salvar — a validação final de "soma == total" é responsabilidade da camada de aplicação/UI descrita no roteiro item 6.

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..4`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria rateio de custo compartilhado com trigger de validacao de soma"
```

---

### Task 9: Obrigações de crédito e parcelas

**Files:**
- Create: `supabase/migrations/<timestamp>_obrigacoes_credito.sql`
- Create: `supabase/tests/database/08_obrigacoes_credito.sql`

**Interfaces:**
- Consumes: `unidades_negocio(id)` (Task 4), `usuarios(id)` (Task 3).
- Produces: `obrigacoes_credito(id, propriedade_id, instituicao, tipo, unidade_negocio_id, valor_total, data_contratacao, created_at)`, `parcelas_credito(id, obrigacao_credito_id, numero_parcela, valor, data_vencimento, status, data_pagamento)`.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/08_obrigacoes_credito.sql`:

```sql
begin;
select plan(4);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'obrigacoes_credito', 'tabela obrigacoes_credito deve existir');
select has_table('public', 'parcelas_credito', 'tabela parcelas_credito deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.obrigacoes_credito (id, propriedade_id, instituicao, tipo, unidade_negocio_id, valor_total, data_contratacao)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Cresol', 'consorcio', '66666666-6666-6666-6666-666666666666', 150000.00, '2025-01-15');

insert into public.parcelas_credito (obrigacao_credito_id, numero_parcela, valor, data_vencimento)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 15000.00, '2026-08-15');

select is(
  (select count(*)::int from public.parcelas_credito where obrigacao_credito_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'parcela deve ser inserida vinculada à obrigação'
);

select throws_ok(
  $$insert into public.parcelas_credito (obrigacao_credito_id, numero_parcela, valor, data_vencimento)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 15000.00, '2026-09-15')$$,
  'duplicate key value violates unique constraint "parcelas_credito_obrigacao_credito_id_numero_parcela_key"',
  'não pode haver duas parcelas com o mesmo número para a mesma obrigação'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.obrigacoes_credito" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new obrigacoes_credito
```

```sql
create table public.obrigacoes_credito (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  instituicao text not null,
  tipo text not null check (tipo in ('emprestimo', 'consorcio', 'linha_credito', 'financiamento')),
  unidade_negocio_id uuid references public.unidades_negocio(id) on delete set null,
  valor_total numeric(12,2) not null check (valor_total > 0),
  data_contratacao date not null,
  created_at timestamptz not null default now()
);

alter table public.obrigacoes_credito enable row level security;

create table public.parcelas_credito (
  id uuid primary key default gen_random_uuid(),
  obrigacao_credito_id uuid not null references public.obrigacoes_credito(id) on delete cascade,
  numero_parcela int not null check (numero_parcela > 0),
  valor numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado')),
  data_pagamento date,
  unique (obrigacao_credito_id, numero_parcela)
);

alter table public.parcelas_credito enable row level security;

create index obrigacoes_credito_propriedade_id_idx on public.obrigacoes_credito(propriedade_id);
create index parcelas_credito_obrigacao_id_idx on public.parcelas_credito(obrigacao_credito_id);

create policy "ver obrigacoes de credito"
  on public.obrigacoes_credito for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('credito_obrigacoes', 'ver'));

create policy "lancar obrigacoes de credito"
  on public.obrigacoes_credito for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('credito_obrigacoes', 'lancar'));

create policy "ver parcelas de credito"
  on public.parcelas_credito for select
  using (exists (
    select 1 from public.obrigacoes_credito oc
    where oc.id = obrigacao_credito_id
      and oc.propriedade_id = public.usuario_propriedade_id()
  ));

create policy "lancar parcelas de credito"
  on public.parcelas_credito for insert
  with check (exists (
    select 1 from public.obrigacoes_credito oc
    where oc.id = obrigacao_credito_id
      and oc.propriedade_id = public.usuario_propriedade_id()
      and public.tem_permissao('credito_obrigacoes', 'lancar')
  ));
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..4`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria obrigacoes_credito e parcelas_credito"
```

---

### Task 10: Imobilizado

**Files:**
- Create: `supabase/migrations/<timestamp>_imobilizados.sql`
- Create: `supabase/tests/database/09_imobilizados.sql`

**Interfaces:**
- Consumes: `unidades_negocio(id)` (Task 4), `usuarios(id)` (Task 3).
- Produces: `imobilizados(id, propriedade_id, unidade_negocio_id, nome, valor_aquisicao, data_aquisicao, vida_util_anos, created_at)`.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/09_imobilizados.sql`:

```sql
begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'Suínos', 'suinos');

select has_table('public', 'imobilizados', 'tabela imobilizados deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.imobilizados (propriedade_id, unidade_negocio_id, nome, valor_aquisicao, data_aquisicao, vida_util_anos)
values ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', 'Galpão de suínos 2017', 240000.00, '2017-03-01', 25);

select is(
  (select count(*)::int from public.imobilizados),
  1,
  'imobilizado deve ser inserido e visível pelo admin'
);

select throws_ok(
  $$insert into public.imobilizados (propriedade_id, unidade_negocio_id, nome, valor_aquisicao, data_aquisicao, vida_util_anos)
    values ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', 'Item inválido', 1000.00, '2020-01-01', 0)$$,
  'new row for relation "imobilizados" violates check constraint "imobilizados_vida_util_anos_check"',
  'vida_util_anos deve ser maior que zero'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.imobilizados" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new imobilizados
```

```sql
create table public.imobilizados (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid references public.unidades_negocio(id) on delete set null,
  nome text not null,
  valor_aquisicao numeric(12,2) not null check (valor_aquisicao > 0),
  data_aquisicao date not null,
  vida_util_anos int not null check (vida_util_anos > 0),
  created_at timestamptz not null default now()
);

alter table public.imobilizados enable row level security;

create index imobilizados_propriedade_id_idx on public.imobilizados(propriedade_id);

create policy "ver imobilizados"
  on public.imobilizados for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('imobilizado', 'ver'));

create policy "lancar imobilizados"
  on public.imobilizados for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('imobilizado', 'lancar'));
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..3`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria imobilizados com RLS por permissao"
```

---

### Task 11: Documentos fiscais

**Files:**
- Create: `supabase/migrations/<timestamp>_documentos_fiscais.sql`
- Create: `supabase/tests/database/10_documentos_fiscais.sql`

**Interfaces:**
- Consumes: `lancamentos_financeiros_negocio(id)` (Task 6), `lancamentos_financeiros_familiares(id)` (Task 7), `usuarios(id)` (Task 3).
- Produces: `documentos_fiscais(id, propriedade_id, tipo, numero_documento, valor, data_emissao, arquivo_url, lancamento_financeiro_negocio_id, lancamento_financeiro_familiar_id, status_revisao, created_at)`.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/10_documentos_fiscais.sql`:

```sql
begin;
select plan(3);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');

select has_table('public', 'documentos_fiscais', 'tabela documentos_fiscais deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.documentos_fiscais (propriedade_id, tipo, numero_documento, valor, data_emissao, arquivo_url)
values ('11111111-1111-1111-1111-111111111111', 'boleto', '00012345', 890.50, '2026-07-01', 'documentos/boleto-00012345.jpg');

select is(
  (select count(*)::int from public.documentos_fiscais),
  1,
  'documento fiscal deve ser inserido com status_revisao padrão pendente'
);

select is(
  (select status_revisao from public.documentos_fiscais limit 1),
  'pendente_revisao',
  'status_revisao deve nascer como pendente_revisao por padrão'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.documentos_fiscais" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new documentos_fiscais
```

```sql
create table public.documentos_fiscais (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  tipo text not null check (tipo in ('nfpe', 'boleto', 'cupom_fiscal', 'recibo', 'outro')),
  numero_documento text,
  valor numeric(12,2),
  data_emissao date,
  arquivo_url text,
  lancamento_financeiro_negocio_id uuid references public.lancamentos_financeiros_negocio(id) on delete set null,
  lancamento_financeiro_familiar_id uuid references public.lancamentos_financeiros_familiares(id) on delete set null,
  status_revisao text not null default 'pendente_revisao' check (status_revisao in ('pendente_revisao', 'confirmado', 'rejeitado')),
  created_at timestamptz not null default now()
);

alter table public.documentos_fiscais enable row level security;

create index documentos_fiscais_propriedade_id_idx on public.documentos_fiscais(propriedade_id);

create policy "ver documentos fiscais"
  on public.documentos_fiscais for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('fiscal', 'ver'));

create policy "lancar documentos fiscais"
  on public.documentos_fiscais for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('fiscal', 'lancar'));
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..3`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria documentos_fiscais com fluxo de revisao"
```

---

### Task 12: Parcerias de integração

**Files:**
- Create: `supabase/migrations/<timestamp>_parcerias_integracao.sql`
- Create: `supabase/tests/database/11_parcerias_integracao.sql`

**Interfaces:**
- Consumes: `unidades_negocio(id)` (Task 4), `usuarios(id)` (Task 3).
- Produces: `parcerias_integracao(id, propriedade_id, unidade_negocio_id, empresa_parceira, condicoes, ciclo_dias, forma_pagamento, created_at)`.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/11_parcerias_integracao.sql`:

```sql
begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'Suínos', 'suinos');

select has_table('public', 'parcerias_integracao', 'tabela parcerias_integracao deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.parcerias_integracao (propriedade_id, unidade_negocio_id, empresa_parceira, condicoes, ciclo_dias, forma_pagamento)
values ('11111111-1111-1111-1111-111111111111', '88888888-8888-8888-8888-888888888888', 'Alibem Alimentos', 'Exclusividade - fornece leitões, ração e assistência técnica', 120, '30 dias após carregamento');

select is(
  (select count(*)::int from public.parcerias_integracao),
  1,
  'parceria de integração deve ser inserida e visível pelo admin'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.parcerias_integracao" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new parcerias_integracao
```

```sql
create table public.parcerias_integracao (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete cascade,
  empresa_parceira text not null,
  condicoes text,
  ciclo_dias int,
  forma_pagamento text,
  created_at timestamptz not null default now()
);

alter table public.parcerias_integracao enable row level security;

create index parcerias_integracao_propriedade_id_idx on public.parcerias_integracao(propriedade_id);

create policy "ver parcerias de integracao"
  on public.parcerias_integracao for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar parcerias de integracao"
  on public.parcerias_integracao for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..2`, todos `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria parcerias_integracao"
```

---

### Task 13: Seed de dados baseline e verificação final completa

**Files:**
- Create: `supabase/seed.sql`
- Test: rodar suíte completa

**Interfaces:**
- Consumes: todas as tabelas das Tasks 1–12.
- Produces: dados iniciais reais da propriedade (seção 9 do `PLANO_EXECUCAO_CRM.md`) para uso em desenvolvimento local — propriedade do Ademir, as duas unidades de negócio (leite e suínos) e a parceria com a Alibem.

- [ ] **Step 1: Escrever `supabase/seed.sql`**

```sql
insert into public.propriedades (id, nome)
values ('00000000-0000-0000-0000-000000000001', 'Propriedade Ademir')
on conflict (id) do nothing;

insert into public.unidades_negocio (id, propriedade_id, nome, tipo) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Gado leiteiro', 'leite'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Suínos', 'suinos')
on conflict (id) do nothing;

insert into public.parcerias_integracao (propriedade_id, unidade_negocio_id, empresa_parceira, condicoes, ciclo_dias, forma_pagamento)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  'Alibem Alimentos',
  'Fornece leitões, ração e assistência técnica. Contrato de exclusividade: não pode ter outros suínos na propriedade.',
  120,
  '30 dias após carregamento'
)
on conflict do nothing;
```

- [ ] **Step 2: Rodar reset completo (aplica migrations + seed) e a suíte inteira de testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: todas as migrations aplicam sem erro, seed roda sem erro, e a suíte completa (Tasks 1–12, ~38 asserts) termina com todos os `ok` e exit code 0.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: adiciona seed de dados baseline da propriedade"
```

---

## Depois deste plano

Com o schema completo, validado e testado, o roteiro (seção 11 do `PLANO_EXECUCAO_CRM.md`) segue para o **Task 2: administração de usuários e permissões** (a UI que o Ademir vai usar para criar contas e perfis de acesso sobre este schema) — deve virar um plano próprio, separado deste.
