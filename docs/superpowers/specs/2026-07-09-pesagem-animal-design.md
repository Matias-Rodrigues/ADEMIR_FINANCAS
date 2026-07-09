# Pesagem de Animal — Design

> Primeira fatia construída sobre a fundação de cadastro de animal individual (mesclada em `main`, commit `cfdbcce`). Cobre registro de peso ao longo do tempo para qualquer animal ativo — não restrito a terneiras, apesar do nome original da ideia ("pesagem de terneiras"). Aprovado como escopo inicial; o texto de "fora de escopo" abaixo já antecipa extensões futuras esperadas, sem comprometer-se com elas agora.

## 1. Contexto

O cadastro de animal individual (`animais`) e a produção por animal (`producao_animal`) já existem, com o princípio confirmado de que qualquer novo dado sobre o animal (produção, e agora peso) deve se acumular como histórico ligado ao `animal_id` (ver memória `projeto-ademir-financas-animal-individual-visao`). Esta fatia era referida como "Pesagem de terneiras" e estava bloqueada até o cadastro de animal existir — agora desbloqueada.

A tela `/dashboard/producao/rebanho/animais/[id]/editar` já existe (edição de dados cadastrais do animal + baixa/reativação). Esta fatia estende essa mesma página com uma seção de histórico/lançamento de peso, em vez de criar uma tela nova separada.

Até aqui, todo o frontend do projeto é HTML puro sem JavaScript no cliente, com uma única exceção justificada (gravação de áudio, que depende de uma API do navegador). Esta fatia introduz o primeiro gráfico do projeto — decidido como SVG renderizado inteiramente no servidor, preservando a convenção de zero JS.

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Qualquer animal ativo pode ser pesado**, não só `terneira_aleitamento` — o usuário preferiu não restringir por categoria.
- **Sem periodicidade fixa** — lançamento sob demanda, sem calendário/lembrete de rotina.
- **Múltiplas pesagens no mesmo dia são permitidas** — sem constraint de unicidade por (`animal_id`, `data`), já que corrigir um erro de balança pode exigir um novo lançamento no mesmo dia.
- **Peso + data + observação livre opcional** — sem outros campos nesta fatia.
- **Edição e exclusão definitiva (hard delete)** de pesagens — diferente do padrão de "nunca deletar, só toggle de ativo" usado em `animais`/`imobilizados` (entidades permanentes). Uma pesagem é um registro de log pontual, não uma entidade com ciclo de vida — corrigir ou remover um lançamento errado não precisa preservar rastro.
- **Visualização: gráfico de evolução (peso × data) + lista**, ambos dentro da tela de edição do animal já existente — sem tela nova dedicada, sem lançamento em lote.
- **Gráfico como SVG gerado no servidor** (função pura dentro do próprio server component), não uma biblioteca client-side — mantém a convenção de zero JS do projeto. Só é exibido com 2 ou mais pontos; com 0 ou 1, mostra-se apenas a lista (ou mensagem de "sem pesagens ainda").
- **Fora de escopo, registrado para o futuro (a pedido do usuário — há espaço para novos usos depois):** lançamento em lote de pesagem (tipo a tela de produção por ordenha); lembrete/rotina de pesagem periódica; curva de referência/meta de peso esperado por categoria para comparação; mudança automática de categoria do animal baseada em peso (continua manual via edição já existente); módulo de gráfico SVG reutilizável (fica inline nesta fatia; generaliza-se só quando houver um segundo consumidor real, ex: o motor de relatórios já registrado como ideia futura em `projeto-ademir-financas-motor-relatorios-ideia`).

## 3. Modelo de dados

```sql
create table public.pesagens_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  data date not null,
  peso_kg numeric(6,2) not null check (peso_kg > 0),
  observacao text,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);
```

- RLS com as 4 policies (select/insert/update/**delete**) no padrão já estabelecido em `animais`/`producao_animal`: `(propriedade_id = usuario_propriedade_id() or usuario_eh_dev()) and tem_permissao('producao', <acao>)`. A ação `lancar` cobre insert/update/delete (mesmo padrão de reaproveitamento já usado em outras tabelas do projeto — não existe ação `excluir` separada no sistema de permissões).
- `on delete restrict` em `animal_id` — não é possível excluir o *animal*, mas excluir uma *pesagem* isolada é livre (delete real, sem soft-delete).
- `data` não pode ser no futuro (validado no backend, mesmo padrão de `data_nascimento` em `animais`).
- Sem unicidade em (`animal_id`, `data`) — múltiplos lançamentos no mesmo dia são válidos.

## 4. Frontend

Tudo dentro de `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx` (arquivo já existente), como uma seção nova abaixo do formulário de edição de dados cadastrais e do botão de baixa/reativação:

- **Gráfico SVG de evolução** — função pura que recebe a lista de pesagens (ordenadas por data) e retorna markup `<svg>` com uma polyline conectando os pontos peso×data, eixos simples. Renderizada só quando há 2+ pesagens.
- **Lista de pesagens** — tabela/lista (data, peso, observação), mais recente primeiro. Cada linha tem um link "editar" (leva a uma sub-rota `.../pesagens/[pesagemId]/editar`) e um form de exclusão (POST inline, mesmo padrão de baixa: sem confirmação client-side, sem JS).
- **Formulário de nova pesagem** — data (default hoje), peso (kg), observação opcional. POST para `web/app/api/producao/animais/[id]/pesagens/route.ts`.
- **Tela de edição de pesagem** — página própria (`web/app/dashboard/producao/rebanho/animais/[id]/pesagens/[pesagemId]/editar/page.tsx`), reaproveitando o layout simples já usado nas outras telas de edição do projeto (card + form), com os 3 campos (data, peso, observação) pré-preenchidos.

## 5. Backend

Rotas novas, todas Route Handlers HTML puro (`method="POST"`, sem JS, redirect com `?error=<codigo>`):
- `POST /api/producao/animais/[id]/pesagens` — cria pesagem; valida `animal_id` pertence à propriedade (reaproveita `animalPertenceAPropriedade`), peso > 0, data não é futuro.
- `POST /api/producao/animais/[id]/pesagens/[pesagemId]/editar` — edita data/peso/observação; mesmas validações; filtra `propriedade_id` explicitamente antes do update (defesa em profundidade).
- `POST /api/producao/animais/[id]/pesagens/[pesagemId]/excluir` — exclusão real (`DELETE`), filtrando `propriedade_id` explicitamente antes de excluir.

## 6. Testes

**pgTAP:**
- Tabela `pesagens_animal` existe com as colunas esperadas.
- RLS: usuário de propriedade A não vê/insere/edita/exclui pesagem de propriedade B.
- Check `peso_kg > 0` rejeita valores inválidos (ex.: zero ou negativo).
- Update funciona para o dono da propriedade, é bloqueado (não afeta linha) para outra propriedade.
- Delete funciona para o dono, é bloqueado para outra propriedade.
- Múltiplas pesagens no mesmo `animal_id`+`data` são aceitas sem erro de unicidade.

**Frontend:** sem suíte automatizada (convenção já estabelecida) — build + `tsc` limpos, e verificação manual via `curl`: lançar pesagem, listar, editar, excluir, e confirmar que o gráfico SVG aparece corretamente com 2+ pontos (e não aparece / mostra mensagem apropriada com 0 ou 1 ponto).

## 7. Fora de escopo

Lançamento em lote de pesagem. Lembrete/rotina de pesagem periódica. Curva de referência/meta de peso esperado por categoria. Mudança automática de categoria baseada em peso. Módulo de gráfico SVG reutilizável entre features. Restrição de pesagem por categoria do animal. Qualquer relatório agregado de crescimento do rebanho como um todo (isso pertenceria a uma fatia futura do motor de relatórios).
