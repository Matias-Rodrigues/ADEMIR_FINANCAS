# Módulo Imobilizado — Design

> Cobre backend + frontend numa spec só, dado o escopo pequeno (mesma abordagem usada em Qualidade do Leite). Constrói sobre a tabela `imobilizados` já existente (`supabase/migrations/20260704225000_imobilizados.sql`) e sobre a fundação de frontend já existente.

## 1. Contexto

A tabela `imobilizados` já existe desde o núcleo de dados, mas incompleta: só tem `nome`, `valor_aquisicao`, `data_aquisicao`, `vida_util_anos` — sem `valor_residual` (necessário para depreciação real), sem `categoria`, e com RLS só de SELECT/INSERT (sem UPDATE). Essa lacuna já estava documentada como pendência na spec original de Produção.

A planilha de referência (`Leitec.Thomas 2023-2.xlsx`) mostra a estrutura real: duas categorias separadas (Benfeitorias: sala de ordenha, casa, galpão, compost; Máquinas e Implementos: trator, ordenhadeira, resfriador, etc.), cada bem com valor novo, valor residual, vida útil e depreciação anual calculada — sempre `(valor novo - valor residual) / vida útil`, sem proração por mês de aquisição.

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Campo `categoria`** (`benfeitoria`/`maquina`) — replica a separação real da planilha, permite listagem agrupada.
- **Depreciação nunca é armazenada** — sempre calculada sob demanda via view, mesmo princípio já usado em `producao_leite_mensal`.
- **View já nasce com `security_invoker = true`** — lição já aplicada retroativamente numa spec anterior, aqui aplicada desde o início.
- **Edição e "baixa" (não exclusão)** — bens ganham UPDATE e um campo `ativo` para marcar bens vendidos/descartados sem apagar o histórico de depreciação.
- **Sem tela de relatório separada** — o total de depreciação (por categoria e geral) aparece na própria tela de listagem, já que não há dimensão temporal/mensal aqui como em Produção.
- **Sem proração** — depreciação anual é sempre o valor cheio, igual à planilha original.

## 3. Modelo de dados

```sql
alter table public.imobilizados
  add column categoria text not null default 'maquina' check (categoria in ('benfeitoria', 'maquina')),
  add column valor_residual numeric(12,2) not null default 0 check (valor_residual >= 0 and valor_residual < valor_aquisicao),
  add column ativo boolean not null default true;

alter table public.imobilizados alter column categoria drop default;
alter table public.imobilizados alter column valor_residual drop default;

create policy "editar imobilizados"
  on public.imobilizados for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'lancar'));

create or replace view public.imobilizados_depreciacao
  with (security_invoker = true) as
select
  id, propriedade_id, unidade_negocio_id, categoria, nome, valor_aquisicao, valor_residual,
  data_aquisicao, vida_util_anos, ativo,
  (valor_aquisicao - valor_residual) / vida_util_anos as depreciacao_anual,
  (valor_aquisicao - valor_residual) / vida_util_anos / 12 as depreciacao_mensal
from public.imobilizados;
```

- `categoria`/`valor_residual` usam `default` só para não quebrar linhas pré-existentes na migration (removido logo em seguida — novas linhas devem sempre informar os dois).
- `valor_residual < valor_aquisicao` garante que o bem não "sobra" mais do que valeu.
- `ativo` é a baixa — sem `delete`, preserva o histórico.
- Policy de UPDATE espelha a de INSERT já existente, incluindo o bypass de `dev` cross-propriedade (`usuario_eh_dev()`), consistente com o padrão já usado nas outras policies de `imobilizados`.

## 4. Frontend

### Listagem

`GET /dashboard/imobilizado` — dois blocos agrupados por categoria ("Benfeitorias", "Máquinas e Implementos"), lidos de `imobilizados_depreciacao`. Cada linha: nome, valor de aquisição, depreciação anual/mensal, status (bens `ativo = false` aparecem esmaecidos, ao final da lista). Total de depreciação anual por categoria + total geral no rodapé (soma só de bens ativos). Link "Novo bem" no topo; link "Editar" por linha.

### Criação

`GET /dashboard/imobilizado/novo` — formulário: `categoria` (select), `nome`, `valor_aquisicao`, `valor_residual`, `data_aquisicao`, `vida_util_anos`, `unidade_negocio_id` (select das unidades da propriedade).

`POST /api/imobilizado` — valida `tem_permissao('imobilizado', 'lancar')`, valida os checks (residual < aquisição, vida útil > 0) antes do insert; erro `valores_invalidos` em caso de falha.

### Edição e baixa

`GET /dashboard/imobilizado/[id]/editar` — mesmo formulário, preenchido (`defaultValue`); mais um form pequeno com botão "Dar baixa" (ou "Reativar" se já inativo).

`POST /api/imobilizado/[id]/editar` — atualização direta pelo `id` (não precisa do padrão insert-então-update usado em Produção, já que aqui não há `unique constraint` por chave natural — cada bem é sua própria linha, editar é sempre um UPDATE simples).

`POST /api/imobilizado/[id]/baixa` — faz o toggle de `ativo` (true↔false).

## 5. Fora de escopo

- Depreciação acumulada / valor contábil atual do bem (quanto já depreciou até hoje) — a planilha só mostra a depreciação anual/mensal corrente, não um valor contábil residual ao longo do tempo. Se necessário, spec futura.
- Vínculo entre imobilizado e o módulo financeiro (ex: lançar a depreciação como despesa mensal em `lancamentos_financeiros_negocio`) — mesma fronteira já traçada com Produção, fica fora daqui.
