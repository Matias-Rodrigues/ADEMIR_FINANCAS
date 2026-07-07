# Qualidade do Leite — Design

> Extensão do módulo Produção. Constrói sobre o schema e frontend já aprovados e mesclados em `docs/superpowers/specs/2026-07-07-producao-leite-rebanho-design.md` e `docs/superpowers/specs/2026-07-07-frontend-producao-leite-rebanho-design.md`. Cobre backend + frontend numa spec só, dado o escopo pequeno.

## 1. Contexto

A spec original de Produção listou "Qualidade do leite" como fora de escopo, adiada para uma iteração de baixo custo. A planilha de referência (`Leitec.Thomas 2023-2.xlsx`, aba "Qualidade") tem uma linha por mês com CCS, CBT, gordura, proteína e ESD.

**Origem do dado:** diferente da produção diária (que o Ademir mede em casa), qualidade é resultado de análise laboratorial feita pela cooperativa/laticínio, reportado por boletim mensal — um resultado por mês, não algo lançado dia a dia.

**Pesagem de terneiras** permanece fora de escopo (ciclo futuro separado, por exigir cadastro de animal individual).

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Só qualidade do leite nesta spec** — pesagem de terneiras é um subsistema independente, maior, adiado para depois.
- **Lançamento mensal direto**, um resultado por mês por unidade de negócio — sem agregação a partir de dados diários (diferente do padrão usado para litros de leite).
- **Tabela dedicada `qualidade_leite`**, não reaproveita `eventos_operacionais` (dado irregular) nem `producao_leite` (granularidade diária) — mesmo raciocínio já usado para separar produção de leite de movimentação de rebanho.
- **Aparece como 3ª tabela na tela de Relatório mensal já existente** (`/dashboard/producao/relatorio`), não como tela de visualização própria — só o lançamento fica em rota separada.
- **Edição usa o padrão insert-então-update** (não upsert ingênuo) — lição já aplicada retroativamente ao lançamento de leite após o bug de `criado_por`/`origem` ser sobrescrito.

## 3. Modelo de dados

```sql
create table public.qualidade_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  mes date not null,
  ccs numeric(10,2) not null check (ccs >= 0),
  cbt numeric(10,2) not null check (cbt >= 0),
  gordura numeric(5,2) not null check (gordura >= 0 and gordura <= 100),
  proteina numeric(5,2) not null check (proteina >= 0 and proteina <= 100),
  esd numeric(5,2) not null check (esd >= 0 and esd <= 100),
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (unidade_negocio_id, mes)
);

alter table public.qualidade_leite enable row level security;

create policy "ver qualidade do leite"
  on public.qualidade_leite for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar qualidade do leite"
  on public.qualidade_leite for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));

create policy "editar qualidade do leite"
  on public.qualidade_leite for update
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'))
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
```

- `mes date` sempre representa o dia 1 do mês (`2026-07-01`), mesma convenção da view `producao_leite_mensal.mes` — facilita o cruzamento na tela de relatório.
- `gordura`/`proteina`/`esd` limitados a 0–100 (percentuais); `ccs`/`cbt` só não-negativos (contagens x1000, sem teto natural).
- `unique(unidade_negocio_id, mes)` — um resultado por mês por unidade.
- Policy de UPDATE já incluída desde o início (diferente da primeira versão de `producao_leite`, que precisou de correção depois).

## 4. Frontend

### Lançamento

`GET /dashboard/producao/qualidade` (aceita `?mes=YYYY-MM`):
- `mes` (`<Input type="month">`, convertido para `YYYY-MM-01` no Route Handler)
- `ccs`, `cbt`, `gordura`, `proteina`, `esd` (`<Input type="number">`)
- Se já existe resultado para o mês, campos vêm preenchidos para edição
- Lista dos últimos ~6 meses lançados, com link "Editar"

`POST /api/producao/qualidade`:
- Valida `tem_permissao('producao', 'lancar')`
- Valida ranges (`gordura`/`proteina`/`esd` entre 0–100; `ccs`/`cbt` ≥ 0) — erros `valores_invalidos`
- Resolve unidade de negócio via `getUnidadeNegocioLeiteId` (já existente) — erro `unidade_negocio_nao_encontrada` se ausente
- **Insert-então-update-nos-valores**: tenta `insert`; se falhar por `23505` (unique violation), faz `update` só de `ccs`/`cbt`/`gordura`/`proteina`/`esd` — nunca sobrescreve `criado_por`/`origem`/`propriedade_id`
- Redireciona para `/dashboard/producao/qualidade` em sucesso, ou `?mes=<mes>&error=<codigo>` em falha

### Relatório mensal

`/dashboard/producao/relatorio` ganha uma 3ª tabela, "Qualidade do leite": `select * from qualidade_leite where unidade_negocio_id = ... and mes between <ano>-01-01 and <ano>-12-31 order by mes`. Só meses com resultado lançado aparecem (sem preenchimento de zero — ausência de boletim não é "zero", é "sem dado"), mesma regra já usada para a tabela de produção.

## 5. Fora de escopo

- Pesagem de terneiras — ciclo futuro separado, exige cadastro de animal individual.
- Qualquer vínculo entre qualidade (CCS/CBT) e preço pago pela cooperativa — isso é dado financeiro, pertence ao módulo `financeiro_negocio`, mesma fronteira já traçada na spec original de Produção.
