# Vacinação e Medicação de Animal — Design

> Terceira fatia construída sobre a fundação de cadastro de animal individual (cadastro em `main` commit `cfdbcce`, pesagem em `main` commit `5b92469`). Cobre registro de vacinas e medicamentos aplicados a qualquer animal ativo, com carência de medicamento calculada automaticamente. Confirma o princípio já estabelecido: qualquer novo dado sobre o animal se acumula como histórico ligado ao `animal_id` (ver memória `projeto-ademir-financas-animal-individual-visao`).

## 1. Contexto

O cadastro de animal (`animais`) e o histórico de peso (`pesagens_animal`) já existem, com o mesmo padrão de RLS multi-tenant e exclusão real (diferente de `animais`/`imobilizados`, que nunca deletam). A tela `/dashboard/producao/rebanho/animais/[id]/editar` já tem uma seção "Pesagens" (gráfico + lista + criação); esta fatia adiciona duas seções novas na mesma página, seguindo exatamente o mesmo padrão visual e de rotas.

Existe hoje um `tipo_evento = 'ocorrencia_sanitaria'` já modelado (mas nunca usado no frontend) em `eventos_operacionais`, o sistema de eventos agregados por categoria de rebanho. Esta fatia **não** reaproveita nem se conecta a isso — segue a mesma decisão já tomada para produção e pesagem: dados por animal individual ficam em tabelas próprias, sem ligação com os eventos agregados.

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Duas tabelas separadas** (`vacinas_animal`, `medicamentos_animal`), não uma tabela genérica de "aplicações" — refletem propósitos diferentes (prevenção vs. tratamento) e têm campos próprios (vacina tem "próxima dose prevista"; medicamento tem "dias de carência").
- **Vacina:** data, produto (texto livre), próxima dose prevista (opcional), observação (opcional). Sem lembrete/notificação automática — é só um dado exibido, não um sistema de alertas.
- **Medicamento:** data, produto (texto livre), dias de carência, data de liberação (calculada automaticamente pelo banco: `data + dias_carencia`), observação (opcional).
- **Carência é só informativa nesta fatia** — exibida na tela do animal (ex: "em carência até DD/MM"), sem qualquer integração/bloqueio/aviso cruzado com o lançamento de produção de leite. Essa integração fica para uma fatia futura, se fizer falta na prática.
- **Qualquer animal ativo pode receber lançamento**, mesma regra já estabelecida em pesagem: criação de novo registro é bloqueada para animal inativo (rota + UI), mas edição/exclusão de registros antigos continuam acessíveis independente do status do animal (correção de dado histórico).
- **Edição e exclusão real** (delete direto), mesmo padrão já usado em `pesagens_animal` — são registros de log pontual, não entidades permanentes.
- **Tudo dentro da tela de edição do animal já existente** — duas seções novas, mesmo padrão visual da seção "Pesagens" (lista + form de criação + links de editar/excluir), sem tela dedicada separada.
- **Fora de escopo, registrado para o futuro:** integração/aviso cruzado entre carência e lançamento de produção; lembrete automático de próxima dose de vacina; protocolo sanitário padrão por categoria de animal; ligação com `eventos_operacionais`/`ocorrencia_sanitaria`; anexo de documento/nota fiscal de compra.

## 3. Modelo de dados

```sql
create table public.vacinas_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  data date not null,
  produto text not null,
  proxima_dose_prevista date,
  observacao text,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

create table public.medicamentos_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  data date not null,
  produto text not null,
  dias_carencia integer not null check (dias_carencia >= 0),
  data_liberacao date generated always as (data + dias_carencia) stored,
  observacao text,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);
```

- RLS idêntico ao já usado em `pesagens_animal`: 4 policies (select/insert/update/delete) no padrão `(propriedade_id = usuario_propriedade_id() or usuario_eh_dev()) and tem_permissao('producao', <acao>)`, ação `lancar` cobrindo insert/update/delete.
- `data_liberacao` é uma coluna gerada pelo Postgres (`generated always as ... stored`) — sempre consistente, calculada uma vez no banco, sem duplicar a lógica em cada tela que precisar exibir a data de liberação.
- `on delete restrict` em `animal_id` em ambas as tabelas.
- Sem unicidade em (`animal_id`, `data`) em nenhuma das duas — múltiplas aplicações no mesmo dia são válidas.
- `data` não pode ser no futuro (validado no backend). `proxima_dose_prevista` pode ser qualquer data, inclusive futura (é uma previsão).
- `dias_carencia >= 0` — zero é válido (alguns medicamentos não têm carência).

## 4. Frontend

Duas seções novas em `web/app/dashboard/producao/rebanho/animais/[id]/editar/page.tsx` (mesmo arquivo já estendido pela fatia de pesagem), no mesmo padrão visual da seção "Pesagens":

- **Seção Vacinas**: lista (data, produto, próxima dose prevista se houver, observação), mais recente primeiro, cada linha com link "Editar" e form de exclusão; formulário de lançamento (data, produto, próxima dose opcional, observação opcional), exibido só quando `animal.ativo`.
- **Seção Medicamentos**: lista (data, produto, dias de carência, data de liberação), com destaque visual quando `data_liberacao` ainda não passou (ex: texto "em carência até DD/MM"); formulário de lançamento (data, produto, dias de carência, observação opcional), exibido só quando `animal.ativo`.
- **Telas de edição próprias**: `web/app/dashboard/producao/rebanho/animais/[id]/vacinas/[vacinaId]/editar/page.tsx` e `web/app/dashboard/producao/rebanho/animais/[id]/medicamentos/[medicamentoId]/editar/page.tsx`, mesmo layout simples já usado na edição de pesagem.

## 5. Backend

Rotas novas, todas Route Handlers HTML puro (`method="POST"`, sem JS, redirect com `?error=<codigo>`), seguindo exatamente o padrão já estabelecido em `pesagens_animal`:

- `POST /api/producao/animais/[id]/vacinas` — cria vacina; valida animal ativo, produto não vazio, data não futura.
- `POST /api/producao/animais/[id]/vacinas/[vacinaId]/editar` — edita; mesmas validações (sem checagem de `ativo`); filtra `propriedade_id`+`animal_id` explicitamente.
- `POST /api/producao/animais/[id]/vacinas/[vacinaId]/excluir` — exclusão real, filtrando `propriedade_id`+`animal_id`.
- `POST /api/producao/animais/[id]/medicamentos` — cria medicamento; valida animal ativo, produto não vazio, data não futura, `dias_carencia >= 0`.
- `POST /api/producao/animais/[id]/medicamentos/[medicamentoId]/editar` — edita; mesmas validações (sem checagem de `ativo`).
- `POST /api/producao/animais/[id]/medicamentos/[medicamentoId]/excluir` — exclusão real.

## 6. Testes

**pgTAP:**
- Tabelas `vacinas_animal` e `medicamentos_animal` existem com as colunas esperadas.
- `data_liberacao` calculada corretamente (ex: `data + dias_carencia` dias).
- RLS: usuário de propriedade A não vê/insere/edita/exclui vacina/medicamento de propriedade B (ambas as tabelas, os 4 verbos).
- Check `dias_carencia >= 0` rejeita valores negativos.

**Frontend:** sem suíte automatizada (convenção já estabelecida) — build + `tsc` limpos, e verificação manual via `curl`: lançar vacina, lançar medicamento (confirmar `data_liberacao` calculada corretamente na resposta), editar, excluir, confirmar bloqueio de criação para animal inativo (rota + ausência do formulário na página), confirmar que ambas as seções aparecem na página de edição do animal.

## 7. Fora de escopo

Integração/aviso cruzado entre carência de medicamento e lançamento de produção de leite. Lembrete/notificação automática de próxima dose de vacina. Protocolo sanitário padrão por categoria de animal. Ligação com `eventos_operacionais`/`ocorrencia_sanitaria`. Anexo de documento/nota fiscal de compra do produto. Qualquer relatório agregado de vacinação/medicação do rebanho como um todo.
