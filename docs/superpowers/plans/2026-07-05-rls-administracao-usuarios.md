# RLS de Administração de Usuários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar RLS às 4 tabelas hoje sem nenhuma policy (`propriedades`, `pessoas_fisicas`, `perfis_acesso`, `perfil_acesso_permissoes`) e corrigir a policy de SELECT de `usuarios` para que o admin veja todos os usuários da própria propriedade — conforme `docs/superpowers/specs/2026-07-05-rls-administracao-usuarios-design.md`.

**Architecture:** Uma função nova `public.usuario_eh_admin()` (espelha `usuario_eh_dev()` já existente), usada junto com `usuario_propriedade_id()`/`usuario_eh_dev()` nas policies das 4 tabelas novas e no retrofit de `usuarios`. Sem uso de `tem_permissao()` nestas policies — acesso restrito a `admin` (própria propriedade) e `dev` (cross-propriedade), por decisão explícita de não habilitar delegação nesta spec. `usuarios` não ganha policy de INSERT (criação de usuário sempre via rota server-side com service role, fora deste plano).

**Tech Stack:** Postgres/Supabase local, pgTAP (`supabase test db`), mesmo ambiente já em uso pelas specs de backend anteriores.

## Global Constraints

- **Sem delegação via `tem_permissao()`**: todas as policies desta spec checam `usuario_eh_admin()`/`usuario_eh_dev()` diretamente, nunca `tem_permissao('administracao_usuarios', ...)`.
- **`usuarios` não ganha policy de INSERT** — deve continuar bloqueado para o client autenticado (mesmo admin), sem exceção.
- Nenhuma migration histórica já aplicada é editada diretamente — toda mudança em policy existente (`usuarios` SELECT) usa `drop policy` + `create policy` numa migration nova; toda tabela sem policy ganha `create policy` direto (não há nada para dropar).
- Testes em pgTAP via `supabase test db`, todo teste dentro de `begin; ... rollback;`, seguindo a numeração sequencial de `supabase/tests/database/` (próximo arquivo livre: `19_`).
- Padrão de teste de bloqueio de INSERT/violação de RLS: `select throws_ok($$...$$, 'new row violates row-level security policy for table "NOME_TABELA"', '...')`.
- Padrão de sessão de teste: `select set_config('request.jwt.claims', json_build_object('sub', '<uuid>')::text, true); set local role authenticated;` antes de cada bloco que simula um usuário logado.
- Ao final de cada task, a suíte completa de testes deve passar (nenhuma task pode deixar o repositório com testes quebrados). Suíte atual antes deste plano: 19 arquivos, 57 testes, 100% PASS.

---

### Task 1: Função `usuario_eh_admin()`

**Files:**
- Create: `supabase/migrations/<timestamp>_usuario_eh_admin.sql`
- Create: `supabase/tests/database/19_usuario_eh_admin.sql`

**Interfaces:**
- Consumes: tabela `usuarios` (papel).
- Produces: `public.usuario_eh_admin() returns boolean` — usada pelas Tasks 2-6 deste plano.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/19_usuario_eh_admin.sql`:

```sql
begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Teste');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select ok(
  public.usuario_eh_admin(),
  'usuario_eh_admin() deve retornar true para papel=admin'
);

select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select ok(
  not public.usuario_eh_admin(),
  'usuario_eh_admin() deve retornar false para papel diferente de admin'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `function public.usuario_eh_admin() does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new usuario_eh_admin
```

```sql
create or replace function public.usuario_eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select papel = 'admin' from public.usuarios where id = auth.uid();
$$;
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..2` no arquivo novo, todos `ok`; suíte completa sem regressão (59 testes acumulados: 57 + 2 novos).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: adiciona funcao usuario_eh_admin"
```

---

### Task 2: RLS de `propriedades`

**Files:**
- Create: `supabase/migrations/<timestamp>_rls_propriedades.sql`
- Create: `supabase/tests/database/20_rls_propriedades.sql`

**Interfaces:**
- Consumes: `public.usuario_eh_admin()` (Task 1), `public.usuario_propriedade_id()` e `public.usuario_eh_dev()` (já existentes).
- Produces: policies de SELECT/UPDATE/INSERT/DELETE em `propriedades` — não consumidas por nenhuma task seguinte deste plano (tabelas independentes), mas fixam o padrão repetido nas Tasks 3-5.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/20_rls_propriedades.sql`:

```sql
begin;
select plan(6);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

-- membro nao-admin: SELECT so na propria propriedade
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.propriedades where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'membro nao-admin deve enxergar a propria propriedade'
);

select is(
  (select count(*)::int from public.propriedades where id = '77777777-7777-7777-7777-777777777777'),
  0,
  'membro nao-admin nao deve enxergar propriedade de outro cliente'
);

-- admin: UPDATE so na propria propriedade
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

update public.propriedades set nome = 'Propriedade Ademir Renomeada' where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select nome from public.propriedades where id = '11111111-1111-1111-1111-111111111111'),
  'Propriedade Ademir Renomeada',
  'admin deve conseguir renomear a propria propriedade'
);

update public.propriedades set nome = 'Hackeado' where id = '77777777-7777-7777-7777-777777777777';

select is(
  (select nome from public.propriedades where id = '77777777-7777-7777-7777-777777777777'),
  'Propriedade Cliente B',
  'admin nao deve conseguir renomear propriedade de outro cliente'
);

select throws_ok(
  $$insert into public.propriedades (nome) values ('Propriedade Nova')$$,
  'new row violates row-level security policy for table "propriedades"',
  'admin nao deve conseguir criar uma nova propriedade'
);

-- dev: INSERT liberado
select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.propriedades (id, nome) values ('99999999-9999-9999-9999-999999999999', 'Propriedade Nova do Dev');

select is(
  (select count(*)::int from public.propriedades where id = '99999999-9999-9999-9999-999999999999'),
  1,
  'dev deve conseguir criar uma nova propriedade'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — sem nenhuma policy em `propriedades`, todos os SELECTs retornam 0 linhas (inclusive para a própria propriedade) e os UPDATEs não afetam nenhuma linha.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new rls_propriedades
```

```sql
create policy "membros da propriedade e dev podem ver propriedade"
  on public.propriedades for select
  using (id = public.usuario_propriedade_id() or public.usuario_eh_dev());

create policy "admin da propriedade e dev podem atualizar propriedade"
  on public.propriedades for update
  using (
    (id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "somente dev pode criar propriedade"
  on public.propriedades for insert
  with check (public.usuario_eh_dev());

create policy "somente dev pode excluir propriedade"
  on public.propriedades for delete
  using (public.usuario_eh_dev());
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..6` no arquivo novo, todos `ok`; suíte completa sem regressão (65 testes acumulados).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: adiciona RLS de propriedades"
```

---

### Task 3: RLS de `pessoas_fisicas`

**Files:**
- Create: `supabase/migrations/<timestamp>_rls_pessoas_fisicas.sql`
- Create: `supabase/tests/database/21_rls_pessoas_fisicas.sql`

**Interfaces:**
- Consumes: `public.usuario_eh_admin()` (Task 1), `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`.
- Produces: policies de SELECT/INSERT/UPDATE/DELETE em `pessoas_fisicas`, restritas a admin (própria propriedade) e dev.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/21_rls_pessoas_fisicas.sql`:

```sql
begin;
select plan(6);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

insert into public.pessoas_fisicas (id, propriedade_id, nome, cpf) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Ademir', '11111111111'),
  ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'Cliente B', '22222222222');

-- membro nao-admin: nenhum acesso, nem leitura
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'membro nao-admin nao deve enxergar pessoas_fisicas, nem da propria propriedade'
);

-- admin: SELECT/INSERT so na propria propriedade
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'admin deve enxergar pessoas_fisicas da propria propriedade'
);

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  0,
  'admin nao deve enxergar pessoas_fisicas de outra propriedade'
);

insert into public.pessoas_fisicas (propriedade_id, nome, cpf) values ('11111111-1111-1111-1111-111111111111', 'Filho do Ademir', '33333333333');

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'admin deve conseguir inserir pessoa fisica na propria propriedade'
);

select throws_ok(
  $$insert into public.pessoas_fisicas (propriedade_id, nome, cpf) values ('77777777-7777-7777-7777-777777777777', 'Intruso', '44444444444')$$,
  'new row violates row-level security policy for table "pessoas_fisicas"',
  'admin nao deve conseguir inserir pessoa fisica em outra propriedade'
);

-- dev: INSERT liberado em qualquer propriedade
select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.pessoas_fisicas (propriedade_id, nome, cpf) values ('77777777-7777-7777-7777-777777777777', 'Suporte Dev', '55555555555');

select is(
  (select count(*)::int from public.pessoas_fisicas where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  2,
  'dev deve conseguir inserir pessoa fisica em propriedade que nao e a sua'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — sem nenhuma policy em `pessoas_fisicas`, admin não enxerga nem insere nada.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new rls_pessoas_fisicas
```

```sql
create policy "admin da propriedade e dev podem ver pessoas_fisicas"
  on public.pessoas_fisicas for select
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem inserir pessoas_fisicas"
  on public.pessoas_fisicas for insert
  with check (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem atualizar pessoas_fisicas"
  on public.pessoas_fisicas for update
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem excluir pessoas_fisicas"
  on public.pessoas_fisicas for delete
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..6` no arquivo novo, todos `ok`; suíte completa sem regressão (71 testes acumulados).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: adiciona RLS de pessoas_fisicas"
```

---

### Task 4: RLS de `perfis_acesso`

**Files:**
- Create: `supabase/migrations/<timestamp>_rls_perfis_acesso.sql`
- Create: `supabase/tests/database/22_rls_perfis_acesso.sql`

**Interfaces:**
- Consumes: `public.usuario_eh_admin()` (Task 1), `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`.
- Produces: policies de SELECT/INSERT/UPDATE/DELETE em `perfis_acesso`, restritas a admin (própria propriedade) e dev. Consumida pela Task 5 (join a partir de `perfil_acesso_permissoes`).

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/22_rls_perfis_acesso.sql`:

```sql
begin;
select plan(6);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

insert into public.perfis_acesso (id, propriedade_id, nome) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Financeiro básico'),
  ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'Perfil Cliente B');

-- membro nao-admin: nenhum acesso, nem leitura
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.perfis_acesso where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'membro nao-admin nao deve enxergar perfis_acesso, nem da propria propriedade'
);

-- admin: SELECT/INSERT so na propria propriedade
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.perfis_acesso where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'admin deve enxergar perfis_acesso da propria propriedade'
);

select is(
  (select count(*)::int from public.perfis_acesso where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  0,
  'admin nao deve enxergar perfis_acesso de outra propriedade'
);

insert into public.perfis_acesso (propriedade_id, nome) values ('11111111-1111-1111-1111-111111111111', 'Perfil Ajudante');

select is(
  (select count(*)::int from public.perfis_acesso where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'admin deve conseguir criar perfil de acesso na propria propriedade'
);

select throws_ok(
  $$insert into public.perfis_acesso (propriedade_id, nome) values ('77777777-7777-7777-7777-777777777777', 'Intruso')$$,
  'new row violates row-level security policy for table "perfis_acesso"',
  'admin nao deve conseguir criar perfil de acesso em outra propriedade'
);

-- dev: INSERT liberado em qualquer propriedade
select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.perfis_acesso (propriedade_id, nome) values ('77777777-7777-7777-7777-777777777777', 'Perfil Suporte Dev');

select is(
  (select count(*)::int from public.perfis_acesso where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  2,
  'dev deve conseguir criar perfil de acesso em propriedade que nao e a sua'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — sem nenhuma policy em `perfis_acesso`, admin não enxerga nem insere nada.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new rls_perfis_acesso
```

```sql
create policy "admin da propriedade e dev podem ver perfis_acesso"
  on public.perfis_acesso for select
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem inserir perfis_acesso"
  on public.perfis_acesso for insert
  with check (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem atualizar perfis_acesso"
  on public.perfis_acesso for update
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem excluir perfis_acesso"
  on public.perfis_acesso for delete
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..6` no arquivo novo, todos `ok`; suíte completa sem regressão (77 testes acumulados).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: adiciona RLS de perfis_acesso"
```

---

### Task 5: RLS de `perfil_acesso_permissoes`

**Files:**
- Create: `supabase/migrations/<timestamp>_rls_perfil_acesso_permissoes.sql`
- Create: `supabase/tests/database/23_rls_perfil_acesso_permissoes.sql`

**Interfaces:**
- Consumes: `public.usuario_eh_admin()` (Task 1), `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`, tabela `perfis_acesso` (Task 4) para o join de escopo.
- Produces: policies de SELECT/INSERT/UPDATE/DELETE em `perfil_acesso_permissoes`, escopadas via `perfil_acesso_id` → `perfis_acesso.propriedade_id`.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/23_rls_perfil_acesso_permissoes.sql`:

```sql
begin;
select plan(6);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

insert into public.perfis_acesso (id, propriedade_id, nome) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Financeiro básico'),
  ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'Perfil Cliente B');

insert into public.perfil_acesso_permissoes (id, perfil_acesso_id, modulo, pode_ver, pode_lancar) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'financeiro_negocio', true, false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'producao', true, true);

-- membro nao-admin: nenhum acesso, nem leitura
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'membro nao-admin nao deve enxergar perfil_acesso_permissoes, nem da propria propriedade'
);

-- admin: SELECT/INSERT so nos perfis da propria propriedade
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '44444444-4444-4444-4444-444444444444'),
  1,
  'admin deve enxergar permissoes de perfil da propria propriedade'
);

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '66666666-6666-6666-6666-666666666666'),
  0,
  'admin nao deve enxergar permissoes de perfil de outra propriedade'
);

insert into public.perfil_acesso_permissoes (perfil_acesso_id, modulo, pode_ver, pode_lancar)
values ('44444444-4444-4444-4444-444444444444', 'imobilizado', true, false);

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '44444444-4444-4444-4444-444444444444'),
  2,
  'admin deve conseguir inserir permissao em perfil da propria propriedade'
);

select throws_ok(
  $$insert into public.perfil_acesso_permissoes (perfil_acesso_id, modulo, pode_ver, pode_lancar) values ('66666666-6666-6666-6666-666666666666', 'fiscal', true, false)$$,
  'new row violates row-level security policy for table "perfil_acesso_permissoes"',
  'admin nao deve conseguir inserir permissao em perfil de outra propriedade'
);

-- dev: INSERT liberado em qualquer perfil
select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.perfil_acesso_permissoes (perfil_acesso_id, modulo, pode_ver, pode_lancar)
values ('66666666-6666-6666-6666-666666666666', 'fiscal', true, false);

select is(
  (select count(*)::int from public.perfil_acesso_permissoes where perfil_acesso_id = '66666666-6666-6666-6666-666666666666'),
  2,
  'dev deve conseguir inserir permissao em perfil de propriedade que nao e a sua'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — sem nenhuma policy em `perfil_acesso_permissoes`, admin não enxerga nem insere nada.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new rls_perfil_acesso_permissoes
```

```sql
create policy "admin da propriedade e dev podem ver perfil_acesso_permissoes"
  on public.perfil_acesso_permissoes for select
  using (
    (
      perfil_acesso_id in (select id from public.perfis_acesso where propriedade_id = public.usuario_propriedade_id())
      and public.usuario_eh_admin()
    )
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem inserir perfil_acesso_permissoes"
  on public.perfil_acesso_permissoes for insert
  with check (
    (
      perfil_acesso_id in (select id from public.perfis_acesso where propriedade_id = public.usuario_propriedade_id())
      and public.usuario_eh_admin()
    )
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem atualizar perfil_acesso_permissoes"
  on public.perfil_acesso_permissoes for update
  using (
    (
      perfil_acesso_id in (select id from public.perfis_acesso where propriedade_id = public.usuario_propriedade_id())
      and public.usuario_eh_admin()
    )
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem excluir perfil_acesso_permissoes"
  on public.perfil_acesso_permissoes for delete
  using (
    (
      perfil_acesso_id in (select id from public.perfis_acesso where propriedade_id = public.usuario_propriedade_id())
      and public.usuario_eh_admin()
    )
    or public.usuario_eh_dev()
  );
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..6` no arquivo novo, todos `ok`; suíte completa sem regressão (83 testes acumulados).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: adiciona RLS de perfil_acesso_permissoes"
```

---

### Task 6: Retrofit de `usuarios` — SELECT completo para admin + UPDATE/DELETE

**Files:**
- Create: `supabase/migrations/<timestamp>_usuarios_admin_gerencia.sql`
- Create: `supabase/tests/database/24_usuarios_admin_gerencia.sql`

**Interfaces:**
- Consumes: `public.usuario_eh_admin()` (Task 1), `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`.
- Produces: `usuarios` SELECT passa a incluir "admin vê todos os usuários da própria propriedade"; novas policies de UPDATE e DELETE; confirma ausência de policy de INSERT.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/24_usuarios_admin_gerencia.sql`:

```sql
begin;
select plan(6);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'membro@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com'),
  ('99999999-9999-9999-9999-999999999999', 'admin-b@teste.com');

insert into public.usuarios (id, propriedade_id, papel, ativo) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin', true),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'membro_familia', true),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev', true),
  ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', 'admin', true);

-- admin: SELECT deve enxergar todos os usuarios da propria propriedade, nao so a propria linha
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.usuarios where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'admin deve enxergar todos os usuarios da propria propriedade, nao so a propria linha'
);

select is(
  (select count(*)::int from public.usuarios where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  0,
  'admin nao deve enxergar usuarios de outra propriedade'
);

-- admin: UPDATE (desativar) usuario da propria propriedade
update public.usuarios set ativo = false where id = '55555555-5555-5555-5555-555555555555';

select is(
  (select ativo from public.usuarios where id = '55555555-5555-5555-5555-555555555555'),
  false,
  'admin deve conseguir desativar um usuario da propria propriedade'
);

-- admin: UPDATE em usuario de outra propriedade nao deve ter efeito
update public.usuarios set ativo = false where id = '99999999-9999-9999-9999-999999999999';

select is(
  (select ativo from public.usuarios where id = '99999999-9999-9999-9999-999999999999'),
  true,
  'admin nao deve conseguir desativar usuario de outra propriedade'
);

-- admin: INSERT continua bloqueado (sem policy)
select throws_ok(
  $$insert into public.usuarios (id, propriedade_id, papel) values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'membro_familia')$$,
  'new row violates row-level security policy for table "usuarios"',
  'admin nao deve conseguir inserir usuario diretamente (sem policy de insert)'
);

-- membro nao-admin: continua so vendo a propria linha
select set_config('request.jwt.claims', json_build_object('sub', '55555555-5555-5555-5555-555555555555')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.usuarios where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'membro nao-admin deve continuar vendo so a propria linha, nao os demais usuarios'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — a policy de SELECT atual só retorna a própria linha, então "admin deve enxergar todos os usuarios da propria propriedade" falha com `count = 1` em vez de `3`; UPDATE falha por não existir policy.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new usuarios_admin_gerencia
```

```sql
drop policy "usuarios podem ver a própria linha" on public.usuarios;

create policy "usuarios podem ver a própria linha"
  on public.usuarios for select
  using (
    id = auth.uid()
    or public.usuario_eh_dev()
    or (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
  );

create policy "admin da propriedade e dev podem atualizar usuarios"
  on public.usuarios for update
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );

create policy "admin da propriedade e dev podem excluir usuarios"
  on public.usuarios for delete
  using (
    (propriedade_id = public.usuario_propriedade_id() and public.usuario_eh_admin())
    or public.usuario_eh_dev()
  );
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..6` no arquivo novo, todos `ok`; suíte completa sem regressão (89 testes acumulados: 83 + 6 novos). Nenhum teste de arquivos anteriores (ex: `15_dev_acesso_cross_propriedade.sql`, que já testa SELECT de `usuarios` pelo dev) deve quebrar, já que a condição `usuario_eh_dev()` permanece no `or`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: retrofit de usuarios para admin gerenciar usuarios da propria propriedade"
```
