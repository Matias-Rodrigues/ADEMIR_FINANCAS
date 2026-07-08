# Módulo Financeiro do Negócio — Design

> Cobre backend (uma migration pequena) + frontend numa spec só, dado o escopo pequeno (mesma abordagem usada em Imobilizado e Qualidade do Leite). Constrói sobre a tabela `lancamentos_financeiros_negocio` já existente (`supabase/migrations/20260704222521_lancamentos_financeiros_negocio.sql`) e sobre a fundação de frontend já existente.

## 1. Contexto

A tabela `lancamentos_financeiros_negocio` já existe desde o núcleo de dados: `tipo` (receita/despesa), `valor`, `data`, `descricao`, `categoria` (texto livre, sem lista fixa), `origem`, `unidade_negocio_id`, `criado_por`. RLS hoje só tem policy de SELECT e INSERT — falta UPDATE. Nenhuma tela de frontend existe ainda.

Segundo `PLANO_EXECUCAO_CRM.md`, este módulo é o "fluxo de caixa consolidado por unidade [de negócio]" — objetivo final é dar visibilidade de custo/receita por atividade (leite, suínos), base para o futuro módulo de ponto de equilíbrio (fora de escopo aqui).

Existe também `lancamentos_custo_compartilhado` + `rateio_custo_compartilhado_itens` (rateio de custo entre unidades/família), já modelada no schema, mas decidida como fora desta fatia.

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Rateio de custo compartilhado fica fora desta fatia** — só o lançamento simples de receita/despesa por unidade de negócio entra agora. Rateio é uma fatia futura separada.
- **Inclui edição** — ao contrário da primeira versão de Produção, este módulo já nasce com UPDATE (policy nova + tela de edição), seguindo o padrão consolidado em Imobilizado.
- **Categorias em lista fixa por tipo, mas sem mudança de schema** — a coluna `categoria` continua `text` livre no banco (sem `check` constraint); a lista fixa é uma restrição da UI e da validação na Route Handler. Isso evita lançamentos inconsistentes (`"Ração"` vs `"racao"`) sem fechar a porta para novas categorias futuras sem migration.
  - Receita: `venda_leite`, `venda_suino`, `outras_receitas`
  - Despesa: `racao`, `insumo`, `veterinario`, `combustivel`, `energia`, `manutencao`, `mao_de_obra`, `outras_despesas`
- **Listagem do mês corrente, agrupada por unidade de negócio, com totais** — dá visão de fluxo de caixa sem construir um módulo de relatório completo agora (esse fica para uma fatia futura, quando entrar seletor de período). Sem seletor de mês nesta versão — sempre mostra o mês corrente, mesmo princípio da primeira versão de outras telas do projeto.

## 3. Modelo de dados

```sql
create policy "editar lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'));
```

- Reaproveita a permissão `lancar` (mesmo padrão do Imobilizado — não existe ação `editar` separada no sistema de permissões, que só tem `pode_ver`/`pode_lancar`).
- Inclui o bypass de `dev` cross-propriedade (`usuario_eh_dev()`), consistente com a policy de SELECT/INSERT já existente para esta tabela (ver `20260705161427_dev_acesso_cross_propriedade.sql`).
- Sem `unique constraint` nesta tabela (cada lançamento é sua própria linha, diferente de `producao_leite`) — edição é sempre um UPDATE simples pelo `id`, não precisa do padrão insert-então-update.
- Nenhuma alteração de coluna necessária.

## 4. Frontend

### Listagem

`GET /dashboard/financeiro-negocio` — filtra `data` dentro do mês corrente (calculado no servidor). Agrupa por unidade de negócio; cada grupo lista os lançamentos do mês (data, categoria, descrição, valor, com indicação visual de receita/despesa — mais recente primeiro) e mostra total de receita, total de despesa e saldo (receita − despesa) do grupo. Saldo geral consolidado da propriedade no topo/rodapé da página. Link "Novo lançamento" no topo; cada linha linka para `/[id]/editar`.

### Criação

`GET /dashboard/financeiro-negocio/novo` — formulário: `tipo` (select receita/despesa), `unidade_negocio_id` (select das unidades da propriedade, mesmo padrão de Imobilizado), `categoria` (select — as opções mudam conforme o `tipo` escolhido, via JS simples no client ou dois `<optgroup>`/listas ocultas trocadas por `tipo`), `valor` (number, > 0), `data`, `descricao` (opcional).

`POST /api/financeiro-negocio` — valida `tem_permissao('financeiro_negocio', 'lancar')`; valida `tipo ∈ {receita, despesa}`; valida `categoria` pertence à lista do `tipo` escolhido; valida `valor` numérico > 0; valida `data`; valida `unidade_negocio_id` como pertencente à propriedade do usuário antes do insert (mesma checagem já usada 2x em Imobilizado). Erros redirecionam de volta ao formulário com `?error=<codigo>`.

### Edição

`GET /dashboard/financeiro-negocio/[id]/editar` — mesmo formulário, preenchido (`defaultValue`).

`POST /api/financeiro-negocio/[id]/editar` — mesmas validações da criação; atualização direta via `.update()` filtrando por `id` e `propriedade_id` do usuário (não precisa do padrão insert-então-update).

## 5. Fora de escopo

- Rateio de custo compartilhado (`lancamentos_custo_compartilhado`) — fatia futura separada.
- Seletor de período/mês na listagem e relatório histórico — fatia futura, quando o volume de dados justificar.
- Ponto de equilíbrio / vínculo com depreciação do Imobilizado — módulo futuro separado, já citado no roteiro do `PLANO_EXECUCAO_CRM.md`.
- Exclusão de lançamento — só criação e edição nesta fatia (correção de erro é edição, não exclusão nem novo lançamento de ajuste).
