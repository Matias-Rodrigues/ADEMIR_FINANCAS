# Motor de Captura Configurável — Produção de Leite Agregada — Design

> Segunda aplicação do motor de captura configurável (a primeira foi em `/dashboard/producao/leite/por-animal`, ver `docs/superpowers/specs/2026-07-09-motor-captura-configuravel-design.md`). Segue a convenção registrada no projeto: cada nova tela de captura de campo replica o padrão (tabela de configuração dedicada, RLS restrita ao papel `dev`, configuração por usuário) em vez de reaproveitar um motor genérico único — ver `projeto-ademir-financas-status-modulos` (convenção nº7).

## 1. Contexto

A tela `/dashboard/producao/leite` já existe: 3 campos numéricos fixos (litros comercial/descarte/consumo) + gravador de áudio opcional para observações, tudo visível ao mesmo tempo, sempre na mesma ordem. Diferente da tela por-animal (que lista um número variável de animais), aqui os "itens" configuráveis são um conjunto fechado e conhecido de 3 campos — não há uma tabela de itens para referenciar via FK, só um enum fixo.

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Ordem dos 3 campos numéricos é configurável** — o `dev` define, por usuário, em que sequência `litros_comercial`/`litros_descarte`/`litros_consumo` aparecem.
- **Estilo de interação também configurável**, mesmo conceito já usado na fatia anterior: todos os campos visíveis (padrão atual) ou tocar para revelar cada campo (`<details>`/`<summary>`).
- **Gravador de áudio permanece sempre fixo**, fora da configuração — sempre no mesmo lugar (após os campos numéricos), sempre visível, independente da configuração. Não participa da ordem nem do estilo de interação.
- **Sem dimensão de "contexto extra"** (equivalente à categoria do animal) — não existe um conceito análogo para 3 campos numéricos fixos; fora de escopo.
- **Tabelas dedicadas para esta tela**, não reaproveitamento das tabelas de `por-animal` — `campo` é um enum fechado de 3 valores, não uma FK para uma tabela de itens; misturar os dois formatos na mesma tabela criaria uma estrutura polimórfica desnecessária.
- **Tela de administração nova e análoga** (`/dashboard/admin/captura-leite`), não reaproveitamento da tela existente de `captura-animal` — a UI de configuração é estruturalmente diferente (3 campos fixos com posição vs. lista variável de animais).
- **Link no dashboard:** "Motor de captura — Produção de leite", visível só para `papel === 'dev'`.
- **Sem configuração = comportamento padrão atual** (ordem comercial→descarte→consumo, todos os campos visíveis).

## 3. Modelo de dados

```sql
create table public.configuracoes_captura_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  estilo_interacao text not null default 'todos_visiveis'
    check (estilo_interacao in ('todos_visiveis', 'tocar_para_revelar')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (usuario_id)
);

create table public.ordem_captura_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  campo text not null check (campo in ('litros_comercial', 'litros_descarte', 'litros_consumo')),
  posicao integer not null check (posicao > 0),
  created_at timestamptz not null default now(),
  unique (usuario_id, campo)
);
```

- RLS idêntico ao já usado em `configuracoes_captura_animal`/`ordem_captura_animal`: SELECT (`usuario_id = auth.uid() or usuario_eh_dev()`) + `for all` restrito a `usuario_eh_dev()`.
- Sem `exibir_categoria` — não se aplica a esta tela.
- `campo` é um enum fechado (sem FK), diferente de `animal_id` em `ordem_captura_animal`.

## 4. Frontend

**Tela de administração nova** (`web/app/dashboard/admin/captura-leite/page.tsx`, só `dev`): mesmo fluxo de 2 seletores em cascata (propriedade → usuário) já usado em `captura-animal`; a seção de configuração mostra os 3 campos fixos com um `<input type="number">` de posição cada, e o `<select>` de estilo de interação.

**Link no dashboard:** "Motor de captura — Produção de leite", condicionado a `papel === 'dev'` estrito (reaproveita `ehDev()` já existente).

**Tela `/dashboard/producao/leite`** (já existente, adaptada): busca a configuração do usuário logado; reordena os 3 campos conforme `ordem_captura_leite` (sem configuração = ordem atual); se `estilo_interacao = 'tocar_para_revelar'`, cada campo fica dentro de `<details><summary>`; gravador de áudio permanece sempre após os campos, sempre visível, sem envolvimento na configuração.

## 5. Backend

- `POST /api/admin/captura-leite` (novo): recebe `propriedade_id`, `usuario_id`, `estilo_interacao`, e as posições dos 3 campos. Protegido por `ehDev()`. Valida `usuario_id` pertence a `propriedade_id` antes de gravar qualquer coisa (validação completa primeiro, escrita depois — mesmo padrão já estabelecido). Grava/atualiza `configuracoes_captura_leite` (insert-então-update) e `ordem_captura_leite`.
- Sem mudança em `POST /api/producao/leite` — nomes de campo (`litros_comercial`, `litros_descarte`, `litros_consumo`) continuam idênticos independente do layout.

## 6. Testes

**pgTAP:** tabelas existem; RLS (SELECT próprio/dev, escrita só dev, isolamento por usuário); check `estilo_interacao`/`campo`/`posicao` rejeitam valores inválidos; unicidade por usuário e por (usuário, campo).

**Frontend:** build + `tsc` limpos; `curl`: acesso negado a não-dev; configurar um usuário; `/leite` reflete ordem/estilo; áudio permanece fixo; outro usuário sem configuração mantém comportamento padrão.

## 7. Fora de escopo

Qualquer dimensão de "contexto extra" nesta tela. Mudança na rota `POST /api/producao/leite`. Aplicar a outras telas além de `/leite` e `/leite/por-animal` (já feito). Configuração de posição/estilo para o gravador de áudio.
