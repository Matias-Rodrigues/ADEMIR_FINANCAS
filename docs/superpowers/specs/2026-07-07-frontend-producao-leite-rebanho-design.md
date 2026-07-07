# Telas de Produção de Leite e Rebanho — Design

> Segunda das duas specs do módulo de Produção. Constrói sobre o schema já aprovado e mesclado em `docs/superpowers/specs/2026-07-07-producao-leite-rebanho-design.md` (tabela `producao_leite`, extensão de `eventos_operacionais`, função `rebanho_composicao()`, view `producao_leite_mensal`) e sobre a fundação de frontend já existente (Next.js, Route Handlers HTML puro, shadcn/ui, padrão de erro `?error=<codigo>`).

## 1. Contexto

O backend do módulo `producao` está pronto, mas sem nenhuma tela — hoje só é acessível via SQL direto. Esta spec cobre as 3 telas que faltam: lançamento diário de leite, movimentação de rebanho, e relatório mensal cruzando os dois.

Diferente do módulo de administração de usuários (restrito a `admin`/`dev`), este é o **primeiro módulo do frontend onde um `membro_familia` pode ter acesso**, via perfil de acesso configurado (`perfil_acesso_permissoes.pode_ver`/`pode_lancar` para `modulo = 'producao'`). Isso exige checar `tem_permissao()` do banco, não apenas `papel`, algo que nenhuma tela existente faz hoje.

**Fora de escopo:** o schema (`producao_leite`, categorias de rebanho) é inteiramente específico de atividade leiteira — nenhuma tela aqui cobre suínos, que exigiria um módulo/schema próprio no futuro (métricas de suinocultura não têm equivalente nas tabelas atuais).

## 2. Decisões de escopo (via brainstorming com o usuário)

- **As 3 telas nesta única spec** (lançamento diário, movimentação de rebanho, relatório mensal) — tela pequenas e fortemente relacionadas, mesmo padrão de agrupamento já usado na spec de administração de usuários.
- **Lançamento diário de leite aceita qualquer data**, não só hoje — se já existe lançamento naquele dia (bate no `unique(unidade_negocio_id, data)`), a tela carrega os valores existentes para edição, usando a policy de UPDATE já criada no backend.
- **Movimentação de rebanho é um formulário único**, todos os campos sempre visíveis (sem JavaScript, mantendo o padrão HTML puro já estabelecido no projeto) — o campo `categoria_origem` só é gravado quando `tipo = 'mudanca_categoria'`, ignorado nos demais tipos mesmo se vier preenchido.
- **Sem edição de movimentações de rebanho já lançadas** — diferente do leite, um evento de rebanho passado não se edita; correções entram como um novo evento (ex: um `ajuste_inventario` de correção).
- **Relatório mensal é uma tabela por ano** (12 linhas, uma por mês), não navegação mês-a-mês — bate com o formato da planilha original do Ademir.
- **Composição do rebanho por mês fica em tabela separada, mesma tela** do relatório de leite (não uma tabela única combinada, nem uma tela à parte).
- **Sem seletor de unidade de negócio** — as queries filtram por `unidades_negocio.tipo = 'leite'` diretamente (não "a primeira unidade que existir"), o que já exclui suínos corretamente por construção. Se a propriedade um dia tiver duas unidades do tipo leite, um seletor vira necessário — fora de escopo agora.

## 3. Arquitetura geral

**Novo helper de permissão** (`web/lib/auth/tem-permissao.ts`) — primeira vez que o frontend consulta a função `tem_permissao()` do banco em vez de checar só `papel`:

```ts
import { createClient } from '@/lib/supabase/server'

export async function temPermissao(modulo: string, acao: 'ver' | 'lancar'): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('tem_permissao', { p_modulo: modulo, p_acao: acao })
  return data === true
}
```

Toda página sob `/dashboard/producao/*` chama `temPermissao('producao', 'ver')` para acesso (redirect para `/dashboard` se falso, mesmo padrão de `requireAdmin`); toda mutação (Route Handler) chama `temPermissao('producao', 'lancar')` antes de escrever.

**Padrão de mutação:** idêntico ao já usado — formulário HTML puro (`method="POST"`) para um Route Handler que processa e redireciona com `?error=<codigo>` em caso de falha. Nenhuma mutação deste módulo precisa de service role — todas passam pelo client autenticado normal, já que a RLS de `producao_leite` e `eventos_operacionais` cobre INSERT/UPDATE para quem tem `tem_permissao('producao', 'lancar')`.

## 4. Rotas e páginas

### Navegação

`web/app/dashboard/page.tsx` ganha um link "Produção" → `/dashboard/producao`, visível se `temPermissao('producao', 'ver')` (não mais restrito a admin/dev, como os links existentes).

`/dashboard/producao/page.tsx` — página-índice com 3 links: "Lançar produção do dia", "Relatório mensal", "Movimentar rebanho".

### Lançamento diário de leite

- `GET /dashboard/producao/leite` (aceita `?data=YYYY-MM-DD`) — formulário com `data` (default: hoje, ou o valor da query), `litros_comercial`, `litros_descarte`, `litros_consumo`. Se já existe lançamento para a unidade de negócio + data (busca direta em `producao_leite`), os campos vêm preenchidos via `defaultValue` para edição. Abaixo, lista dos últimos 7 dias lançados (`order by data desc limit 7`), cada um com link "Editar" (`?data=...`).
- `POST /api/producao/leite` — valida `tem_permissao('producao', 'lancar')`; resolve a `unidade_negocio_id` filtrando `tipo = 'leite'` da propriedade do chamador; faz upsert (`insert ... on conflict (unidade_negocio_id, data) do update set litros_comercial = ..., litros_descarte = ..., litros_consumo = ...`) via client autenticado normal; erros de validação (`data_invalida`, `valores_invalidos`) redirecionam para `/dashboard/producao/leite?data=<data>&error=<codigo>`; sucesso redireciona para `/dashboard/producao/leite`.

### Movimentação de rebanho

- `GET /dashboard/producao/rebanho` — mostra a composição atual (`rebanho_composicao(unidade_negocio_id, hoje)`, 6 categorias); formulário único com `tipo` (select: `nascimento`/`mortalidade`/`mudanca_categoria`/`compra_animal`/`venda_animal`/`ajuste_inventario`), `categoria` (select, 6 categorias), `categoria_origem` (select com opção "não se aplica", só relevante para `mudanca_categoria`), `quantidade`, `data` (default: hoje). Abaixo, histórico só-leitura das últimas ~10 movimentações.
- `POST /api/producao/rebanho/movimentacao` — valida `tem_permissao('producao', 'lancar')`; se `tipo = 'mudanca_categoria'`, exige `categoria_origem` preenchido e diferente de `categoria` (erro `categoria_origem_invalida` caso contrário); para os demais tipos, ignora `categoria_origem` mesmo se vier no formulário; insere em `eventos_operacionais` (`tipo_evento = tipo`, `categoria_animal = categoria`, `categoria_origem` só quando aplicável, `criado_por`, `origem = 'manual'`); redireciona para `/dashboard/producao/rebanho` em sucesso, ou com `?error=<codigo>` em falha.

### Relatório mensal

- `GET /dashboard/producao/relatorio?ano=2026` (default: ano atual) — duas tabelas:
  - **Produção de leite**: linhas da view `producao_leite_mensal` filtradas pelo ano (só meses com lançamento aparecem — sem preenchimento de zero para meses vazios).
  - **Composição do rebanho**: 12 linhas fixas (uma por mês do ano selecionado), cada uma chamando `rebanho_composicao(unidade_negocio_id, <último dia do mês>)` no Server Component — sempre mostra os 12 meses, com 0 nas categorias sem movimentação.
  - Seletor de ano no topo: `<select>` com os últimos 5 anos + o atual, dentro de um `<form method="GET">` com botão "Ver" (sem JavaScript) que navega para `?ano=<selecionado>`.
