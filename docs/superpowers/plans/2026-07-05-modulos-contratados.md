# Sistema de Módulos Contratados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao schema já aprovado do CRM ADEMIR_FINANÇAS o conceito de entitlement (quais módulos uma propriedade tem contratados) como camada de segurança real no banco (RLS), e formalizar o acesso cross-propriedade do papel `dev` para suporte/implantação — conforme `docs/superpowers/specs/2026-07-05-modulos-contratados-design.md`.

**Architecture:** Duas mudanças centrais na função já existente `public.tem_permissao()` (bypass para `dev`, depois gate de entitlement), uma função nova `public.usuario_eh_dev()`, uma tabela nova `propriedade_modulos_contratados`, e um retrofit mecânico das policies de RLS das 11 tabelas de negócio + `usuarios` já aprovadas para permitir acesso cross-propriedade do `dev`. Nenhuma mudança de coluna/estrutura nas tabelas já aprovadas — só policies.

**Tech Stack:** Igual ao núcleo de dados (Postgres/Supabase local, pgTAP).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente neste plano — toda mudança de função usa `create or replace function`, e toda mudança de policy usa `drop policy` + `create policy` numa migration nova. Isso evita reordenar migrations já commitadas.
- **Negar por padrão**: sem linha de entitlement (ou `ativo = false`) para um módulo, ninguém vê aquele módulo — nem `admin`. `administracao_usuarios` é a única exceção, sempre ativo.
- **`dev` tem bypass total**: `tem_permissao()` retorna `true` para `dev` antes de qualquer outra checagem (inclusive antes do gate de entitlement), e toda policy de RLS cross-propriedade ganha `or public.usuario_eh_dev()`.
- Toda tabela nova segue os constraints já estabelecidos no núcleo de dados: `id uuid primary key default gen_random_uuid()`, `propriedade_id uuid not null references propriedades(id)`, `created_at timestamptz not null default now()`, RLS habilitado na mesma migration que cria a tabela.
- Testes em pgTAP via `supabase test db`, todo teste dentro de `begin; ... rollback;`.
- Ao final de cada task, a suíte completa de testes deve passar (nenhuma task pode deixar o repositório com testes quebrados).

---

### Task 1: Função `usuario_eh_dev()`

**Files:**
- Create: `supabase/migrations/<timestamp>_usuario_eh_dev.sql`
- Create: `supabase/tests/database/13_usuario_eh_dev.sql`

**Interfaces:**
- Consumes: tabela `usuarios` (Task 3 do núcleo de dados).
- Produces: `public.usuario_eh_dev() returns boolean` — usada pelas Tasks 3 e 4 deste plano.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/13_usuario_eh_dev.sql`:

```sql
begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Teste');
insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');
insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

select ok(
  public.usuario_eh_dev(),
  'usuario_eh_dev() deve retornar true para papel=dev'
);

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select ok(
  not public.usuario_eh_dev(),
  'usuario_eh_dev() deve retornar false para papel diferente de dev'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `function public.usuario_eh_dev() does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new usuario_eh_dev
```

```sql
create or replace function public.usuario_eh_dev()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select papel = 'dev' from public.usuarios where id = auth.uid();
$$;
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..2` no arquivo novo, todos `ok`; suíte completa sem regressão (43 testes acumulados: 41 do núcleo de dados + 2 novos).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: adiciona funcao usuario_eh_dev"
```

---

### Task 2: `tem_permissao()` ganha bypass para `dev`

**Files:**
- Create: `supabase/migrations/<timestamp>_tem_permissao_dev_bypass.sql`
- Create: `supabase/tests/database/14_tem_permissao_dev_bypass.sql`

**Interfaces:**
- Consumes: `usuarios.papel` (Task 3 do núcleo de dados).
- Produces: nova versão de `public.tem_permissao(p_modulo, p_acao)` — `dev` sempre `true`, resto do comportamento idêntico ao anterior (ainda sem gate de entitlement, que só entra na Task 5).

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/14_tem_permissao_dev_bypass.sql`:

```sql
begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Teste');
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');
insert into public.usuarios (id, propriedade_id, papel) values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

select ok(
  public.tem_permissao('fiscal', 'ver'),
  'dev sem perfil_acesso_id deve ter tem_permissao=true (bypass antes da checagem de perfil)'
);

select ok(
  public.tem_permissao('financeiro_negocio', 'lancar'),
  'dev deve ter tem_permissao=true para qualquer combinacao de modulo/acao'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — os dois `ok()` recebem `false` (dev cai no ramo `v_perfil_id is null then return false` da versão atual da função).

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new tem_permissao_dev_bypass
```

```sql
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

  if v_papel = 'dev' then
    return true;
  end if;

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
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..2` no arquivo novo, todos `ok`; suíte completa sem regressão (45 testes acumulados).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: adiciona bypass do papel dev em tem_permissao"
```

---

### Task 3: Retrofit de RLS — acesso cross-propriedade do `dev`

**Files:**
- Create: `supabase/migrations/<timestamp>_dev_acesso_cross_propriedade.sql`
- Create: `supabase/tests/database/15_dev_acesso_cross_propriedade.sql`

**Interfaces:**
- Consumes: `public.usuario_eh_dev()` (Task 1), `public.tem_permissao()` já com bypass de `dev` (Task 2).
- Produces: policies de SELECT/INSERT retrofitadas em 11 tabelas de negócio + a policy de SELECT de `usuarios`, todas passando a aceitar `or public.usuario_eh_dev()` na checagem de propriedade.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/15_dev_acesso_cross_propriedade.sql`:

```sql
begin;
select plan(4);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Cliente A'),
  ('99999999-9999-9999-9999-999999999999', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com'),
  ('55555555-5555-5555-5555-555555555555', 'clienteB@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev'),
  ('55555555-5555-5555-5555-555555555555', '99999999-9999-9999-9999-999999999999', 'admin');

insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '99999999-9999-9999-9999-999999999999', 'Gado leiteiro', 'leite');

insert into public.lancamentos_custo_compartilhado (id, propriedade_id, data, descricao, valor_total, criado_por)
  values ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999999', '2026-07-01', 'Conta de energia', 500.00, '55555555-5555-5555-5555-555555555555');

insert into public.rateio_custo_compartilhado_itens (lancamento_custo_compartilhado_id, destino_tipo, unidade_negocio_id, valor)
  values ('99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'unidade_negocio', '66666666-6666-6666-6666-666666666666', 500.00);

-- dev pertence a propriedade A mas precisa enxergar dados da propriedade B (suporte)
select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.unidades_negocio where propriedade_id = '99999999-9999-9999-9999-999999999999'),
  1,
  'dev deve enxergar unidades_negocio de uma propriedade que nao e a sua'
);

select is(
  (select count(*)::int from public.rateio_custo_compartilhado_itens where lancamento_custo_compartilhado_id = '99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'dev deve enxergar itens de rateio (tabela filho via EXISTS) de uma propriedade que nao e a sua'
);

select is(
  (select count(*)::int from public.usuarios where id = '55555555-5555-5555-5555-555555555555'),
  1,
  'dev deve enxergar a linha de usuarios de uma propriedade que nao e a sua'
);

select is(
  (select papel from public.usuarios where id = '55555555-5555-5555-5555-555555555555'),
  'admin',
  'dev deve conseguir ler os dados completos da linha de usuarios de outra propriedade'
);

select * from finish();
rollback;
```

> Nota de cobertura: este teste cobre as 3 formas distintas de policy existentes no schema (checagem direta de `propriedade_id`, checagem direta combinada com `tem_permissao`, e checagem via `EXISTS` numa tabela pai) mais o caso especial de `usuarios`. As demais 8 tabelas seguem exatamente um dos dois primeiros padrões e são retrofitadas com a mesma transformação mecânica — não precisam de teste dedicado individual.

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — os 4 `is()` retornam 0 (dev não pertence à propriedade B, RLS bloqueia).

- [ ] **Step 3: Criar a migration com o retrofit completo**

```bash
npx supabase migration new dev_acesso_cross_propriedade
```

```sql
-- usuarios (Task 3 do nucleo de dados)
drop policy "usuarios podem ver a própria linha" on public.usuarios;
create policy "usuarios podem ver a própria linha"
  on public.usuarios for select
  using (id = auth.uid() or public.usuario_eh_dev());

-- unidades_negocio (Task 4 do nucleo de dados)
drop policy "ver unidades de negocio da propria propriedade" on public.unidades_negocio;
create policy "ver unidades de negocio da propria propriedade"
  on public.unidades_negocio for select
  using (propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev());

drop policy "gerenciar unidades de negocio da propria propriedade" on public.unidades_negocio;
create policy "gerenciar unidades de negocio da propria propriedade"
  on public.unidades_negocio for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

-- eventos_operacionais (Task 5 do nucleo de dados)
drop policy "ver eventos operacionais da propria propriedade" on public.eventos_operacionais;
create policy "ver eventos operacionais da propria propriedade"
  on public.eventos_operacionais for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

drop policy "lancar eventos operacionais da propria propriedade" on public.eventos_operacionais;
create policy "lancar eventos operacionais da propria propriedade"
  on public.eventos_operacionais for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

-- lancamentos_financeiros_negocio (Task 6 do nucleo de dados)
drop policy "ver lancamentos financeiros do negocio" on public.lancamentos_financeiros_negocio;
create policy "ver lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'ver'));

drop policy "lancar lancamentos financeiros do negocio" on public.lancamentos_financeiros_negocio;
create policy "lancar lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'));

-- lancamentos_financeiros_familiares (Task 7 do nucleo de dados)
drop policy "ver lancamentos financeiros familiares" on public.lancamentos_financeiros_familiares;
create policy "ver lancamentos financeiros familiares"
  on public.lancamentos_financeiros_familiares for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_familiar', 'ver'));

drop policy "lancar lancamentos financeiros familiares" on public.lancamentos_financeiros_familiares;
create policy "lancar lancamentos financeiros familiares"
  on public.lancamentos_financeiros_familiares for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_familiar', 'lancar'));

-- lancamentos_custo_compartilhado (Task 8 do nucleo de dados)
drop policy "ver rateio de custo compartilhado" on public.lancamentos_custo_compartilhado;
create policy "ver rateio de custo compartilhado"
  on public.lancamentos_custo_compartilhado for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'ver'));

drop policy "lancar rateio de custo compartilhado" on public.lancamentos_custo_compartilhado;
create policy "lancar rateio de custo compartilhado"
  on public.lancamentos_custo_compartilhado for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'));

-- rateio_custo_compartilhado_itens (Task 8 do nucleo de dados, ja com fix de permissao do commit c59fae8)
drop policy "ver itens de rateio da propria propriedade" on public.rateio_custo_compartilhado_itens;
create policy "ver itens de rateio da propria propriedade"
  on public.rateio_custo_compartilhado_itens for select
  using (exists (
    select 1 from public.lancamentos_custo_compartilhado lcc
    where lcc.id = lancamento_custo_compartilhado_id
      and (lcc.propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev())
      and public.tem_permissao('financeiro_negocio', 'ver')
  ));

drop policy "lancar itens de rateio da propria propriedade" on public.rateio_custo_compartilhado_itens;
create policy "lancar itens de rateio da propria propriedade"
  on public.rateio_custo_compartilhado_itens for insert
  with check (exists (
    select 1 from public.lancamentos_custo_compartilhado lcc
    where lcc.id = lancamento_custo_compartilhado_id
      and (lcc.propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev())
      and public.tem_permissao('financeiro_negocio', 'lancar')
  ));

-- obrigacoes_credito (Task 9 do nucleo de dados)
drop policy "ver obrigacoes de credito" on public.obrigacoes_credito;
create policy "ver obrigacoes de credito"
  on public.obrigacoes_credito for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('credito_obrigacoes', 'ver'));

drop policy "lancar obrigacoes de credito" on public.obrigacoes_credito;
create policy "lancar obrigacoes de credito"
  on public.obrigacoes_credito for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('credito_obrigacoes', 'lancar'));

-- parcelas_credito (Task 9 do nucleo de dados, ja com fix de permissao do commit c59fae8)
drop policy "ver parcelas de credito" on public.parcelas_credito;
create policy "ver parcelas de credito"
  on public.parcelas_credito for select
  using (exists (
    select 1 from public.obrigacoes_credito oc
    where oc.id = obrigacao_credito_id
      and (oc.propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev())
      and public.tem_permissao('credito_obrigacoes', 'ver')
  ));

drop policy "lancar parcelas de credito" on public.parcelas_credito;
create policy "lancar parcelas de credito"
  on public.parcelas_credito for insert
  with check (exists (
    select 1 from public.obrigacoes_credito oc
    where oc.id = obrigacao_credito_id
      and (oc.propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev())
      and public.tem_permissao('credito_obrigacoes', 'lancar')
  ));

-- imobilizados (Task 10 do nucleo de dados)
drop policy "ver imobilizados" on public.imobilizados;
create policy "ver imobilizados"
  on public.imobilizados for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'ver'));

drop policy "lancar imobilizados" on public.imobilizados;
create policy "lancar imobilizados"
  on public.imobilizados for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'lancar'));

-- documentos_fiscais (Task 11 do nucleo de dados)
drop policy "ver documentos fiscais" on public.documentos_fiscais;
create policy "ver documentos fiscais"
  on public.documentos_fiscais for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('fiscal', 'ver'));

drop policy "lancar documentos fiscais" on public.documentos_fiscais;
create policy "lancar documentos fiscais"
  on public.documentos_fiscais for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('fiscal', 'lancar'));

-- parcerias_integracao (Task 12 do nucleo de dados)
drop policy "ver parcerias de integracao" on public.parcerias_integracao;
create policy "ver parcerias de integracao"
  on public.parcerias_integracao for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

drop policy "lancar parcerias de integracao" on public.parcerias_integracao;
create policy "lancar parcerias de integracao"
  on public.parcerias_integracao for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..4` no arquivo novo, todos `ok`; suíte completa sem regressão (49 testes acumulados).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: retrofit de RLS para acesso cross-propriedade do papel dev"
```

---

### Task 4: Tabela `propriedade_modulos_contratados`

**Files:**
- Create: `supabase/migrations/<timestamp>_propriedade_modulos_contratados.sql`
- Create: `supabase/tests/database/16_propriedade_modulos_contratados.sql`

**Interfaces:**
- Consumes: `public.usuario_propriedade_id()`, `public.usuario_eh_dev()` (Task 1).
- Produces: `propriedade_modulos_contratados(id, propriedade_id, modulo, ativo, created_at)` — consumida pela Task 5 (gate de entitlement em `tem_permissao()`).

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/16_propriedade_modulos_contratados.sql`:

```sql
begin;
select plan(4);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

select has_table('public', 'propriedade_modulos_contratados', 'tabela propriedade_modulos_contratados deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('77777777-7777-7777-7777-777777777777', 'producao', true);

select is(
  (select count(*)::int from public.propriedade_modulos_contratados where propriedade_id = '77777777-7777-7777-7777-777777777777'),
  1,
  'dev deve conseguir inserir entitlement para propriedade que nao e a sua'
);

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select throws_ok(
  $$insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo) values ('11111111-1111-1111-1111-111111111111', 'fiscal', true)$$,
  'new row violates row-level security policy for table "propriedade_modulos_contratados"',
  'admin nao deve conseguir gerenciar (inserir) modulos contratados'
);

select is(
  (select count(*)::int from public.propriedade_modulos_contratados where propriedade_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'admin deve conseguir consultar (mesmo vazio) os modulos contratados da propria propriedade, sem erro de permissao'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.propriedade_modulos_contratados" does not exist`.

- [ ] **Step 3: Criar a migration**

```bash
npx supabase migration new propriedade_modulos_contratados
```

```sql
create table public.propriedade_modulos_contratados (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  modulo text not null check (modulo in (
    'producao', 'financeiro_negocio', 'financeiro_familiar',
    'credito_obrigacoes', 'imobilizado', 'ponto_equilibrio', 'fiscal'
  )),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (propriedade_id, modulo)
);

alter table public.propriedade_modulos_contratados enable row level security;

create index propriedade_modulos_contratados_propriedade_id_idx on public.propriedade_modulos_contratados(propriedade_id);

create policy "ver modulos contratados da propria propriedade"
  on public.propriedade_modulos_contratados for select
  using (propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev());

create policy "dev gerencia modulos contratados de qualquer propriedade"
  on public.propriedade_modulos_contratados for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());
```

- [ ] **Step 4: Aplicar e rodar os testes**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..4` no arquivo novo, todos `ok`; suíte completa sem regressão (53 testes acumulados).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: cria propriedade_modulos_contratados com RLS dev-only para escrita"
```

---

### Task 5: Gate de entitlement em `tem_permissao()` + retrofit das fixtures existentes

**Files:**
- Create: `supabase/migrations/<timestamp>_tem_permissao_entitlement_gate.sql`
- Create: `supabase/tests/database/17_entitlement_gate_negacao_padrao.sql`
- Modify: `supabase/tests/database/02_usuarios_perfis_acesso.sql`
- Modify: `supabase/tests/database/03_unidades_negocio.sql`
- Modify: `supabase/tests/database/04_eventos_operacionais.sql`
- Modify: `supabase/tests/database/05_lancamentos_financeiros_negocio.sql`
- Modify: `supabase/tests/database/06_lancamentos_financeiros_familiares.sql`
- Modify: `supabase/tests/database/07_rateio_custo_compartilhado.sql`
- Modify: `supabase/tests/database/08_obrigacoes_credito.sql`
- Modify: `supabase/tests/database/09_imobilizados.sql`
- Modify: `supabase/tests/database/10_documentos_fiscais.sql`
- Modify: `supabase/tests/database/11_parcerias_integracao.sql`
- Modify: `supabase/tests/database/12_grants_e_permissao_regressao.sql`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Consumes: `propriedade_modulos_contratados` (Task 4).
- Produces: `tem_permissao()` com gate de entitlement — nega por padrão para todo módulo exceto `administracao_usuarios`, exceto para `dev` (bypass, checado antes do gate).

Esta é a única task deste plano que muda o comportamento observável de testes já aprovados (negar por padrão quebra os 53 testes acumulados até cada fixture ganhar sua linha de entitlement). Por isso o Step 3 (migration) e os Steps 4-13 (retrofit de cada arquivo de teste + seed) precisam ser aplicados juntos antes de rodar a suíte pela primeira vez neste task.

- [ ] **Step 1: Escrever o teste novo (falhando)**

`supabase/tests/database/17_entitlement_gate_negacao_padrao.sql`:

```sql
begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Sem Entitlement');
insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com');
insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev');

-- propriedade nao tem NENHUMA linha em propriedade_modulos_contratados

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select ok(
  not public.tem_permissao('fiscal', 'ver'),
  'admin de propriedade sem entitlement para o modulo nao deve ter tem_permissao=true, mesmo sendo admin'
);

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

select ok(
  public.tem_permissao('fiscal', 'ver'),
  'dev deve continuar com tem_permissao=true mesmo em modulo nao contratado (bypass e checado antes do gate de entitlement)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar teste, confirmar falha**

```bash
npx supabase test db
```

Expected: FAIL — o primeiro `ok()` falha (`tem_permissao('fiscal', 'ver')` retorna `true` para admin na versão atual da função, já que ainda não há gate de entitlement).

- [ ] **Step 3: Criar a migration com o gate de entitlement**

```bash
npx supabase migration new tem_permissao_entitlement_gate
```

```sql
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
  v_propriedade_id uuid;
  v_contratado boolean;
  v_permitido boolean;
begin
  select papel, perfil_acesso_id, propriedade_id into v_papel, v_perfil_id, v_propriedade_id
  from public.usuarios where id = auth.uid();

  if v_papel = 'dev' then
    return true;
  end if;

  if p_modulo <> 'administracao_usuarios' then
    select ativo into v_contratado
    from public.propriedade_modulos_contratados
    where propriedade_id = v_propriedade_id and modulo = p_modulo;

    if coalesce(v_contratado, false) = false then
      return false;
    end if;
  end if;

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
```

- [ ] **Step 4: Retrofit de `supabase/tests/database/02_usuarios_perfis_acesso.sql`**

Logo após o bloco `insert into public.propriedades (id, nome) values (...);`, adicione:

```sql
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'financeiro_negocio', true);
```

- [ ] **Step 5: Retrofit de `supabase/tests/database/03_unidades_negocio.sql`**

Logo após o bloco `insert into public.propriedades (id, nome) values (...), (...);`, adicione:

```sql
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
```

- [ ] **Step 6: Retrofit de `supabase/tests/database/04_eventos_operacionais.sql`**

Logo após `insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');`, adicione:

```sql
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
```

- [ ] **Step 7: Retrofit de `supabase/tests/database/05_lancamentos_financeiros_negocio.sql`, `06_lancamentos_financeiros_familiares.sql`, `07_rateio_custo_compartilhado.sql`, `08_obrigacoes_credito.sql`, `09_imobilizados.sql`, `10_documentos_fiscais.sql`, `11_parcerias_integracao.sql`**

Em cada um destes 7 arquivos, logo após o `insert into public.propriedades (id, nome) values (...)` inicial, adicione a linha de entitlement com o módulo correspondente:

| Arquivo | Módulo a inserir |
|---|---|
| `05_lancamentos_financeiros_negocio.sql` | `financeiro_negocio` |
| `06_lancamentos_financeiros_familiares.sql` | `financeiro_familiar` |
| `07_rateio_custo_compartilhado.sql` | `financeiro_negocio` |
| `08_obrigacoes_credito.sql` | `credito_obrigacoes` |
| `09_imobilizados.sql` | `imobilizado` |
| `10_documentos_fiscais.sql` | `fiscal` |
| `11_parcerias_integracao.sql` | `producao` |

Exemplo exato para `05_lancamentos_financeiros_negocio.sql`:

```sql
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'financeiro_negocio', true);
```

(repita o mesmo padrão nos outros 6 arquivos, trocando só o valor do `modulo` conforme a tabela acima — a propriedade em todos eles é `'11111111-1111-1111-1111-111111111111'`).

- [ ] **Step 8: Retrofit de `supabase/tests/database/12_grants_e_permissao_regressao.sql`**

Logo após `insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Teste');`, adicione:

```sql
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'credito_obrigacoes', true);
```

Isso garante que o Cenário 2 deste arquivo (usuário sem `pode_ver` em `credito_obrigacoes` deve ver 0 linhas em `parcelas_credito`) continue isolando exclusivamente a negação por permissão — sem esta linha, o teste passaria pelo motivo errado (falta de entitlement, não falta de permissão de perfil).

- [ ] **Step 9: Atualizar `supabase/seed.sql`**

Adicione ao final do arquivo:

```sql
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo) values
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'producao', true),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'financeiro_negocio', true),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'financeiro_familiar', true),
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'credito_obrigacoes', true),
  ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'imobilizado', true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'ponto_equilibrio', true),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000001', 'fiscal', true)
on conflict (id) do nothing;
```

(propriedade do Ademir com os 7 módulos contratáveis todos ativos — ele é o piloto usando tudo).

- [ ] **Step 10: Aplicar e rodar a suíte completa**

```bash
npx supabase db reset
npx supabase test db
```

Expected: `1..2` no arquivo novo (17), todos `ok`; suíte completa sem regressão nos arquivos 02-12 retrofitados; total de 55 testes acumulados (53 anteriores + 2 novos deste arquivo), todos `PASS`, exit code 0.

- [ ] **Step 11: Commit**

```bash
git add supabase/
git commit -m "feat: adiciona gate de entitlement em tem_permissao e retrofit das fixtures existentes"
```

---

## Depois deste plano

Com o entitlement e o acesso de suporte do `dev` implementados e testados, o roteiro geral segue para a **Task 2 do roteiro do CRM** (administração de usuários e permissões — UI sobre este schema), que precisa cobrir explicitamente: CRUD de `perfis_acesso`/`perfil_acesso_permissoes` (hoje sem nenhuma policy), tela "meu plano" (consumindo `propriedade_modulos_contratados` via SELECT), e o fluxo de recuperação de senha (usuário e admin) via Supabase Auth.
