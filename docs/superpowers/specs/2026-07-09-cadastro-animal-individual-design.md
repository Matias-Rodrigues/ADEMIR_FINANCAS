# Cadastro de animal individual + produção de leite por animal — Design

> Fatia derivada de uma ideia maior (personalização da captura de dados no app celular). Durante o brainstorm ficou claro que essa ideia embutia dois projetos independentes: (1) cadastro de animal individual — fundação de dados que hoje não existe — e (2) um motor de captura configurável (botões, ordem, por usuário/cliente). Esta spec cobre só o primeiro. O motor de captura configurável, o acompanhamento de vacinação/medicação por animal, e um motor de relatórios genérico (padrão + personalizável) ficam registrados como projetos futuros, fora de escopo aqui.

## 1. Contexto

O sistema de rebanho hoje (`eventos_operacionais` + `rebanho_composicao()`) rastreia só quantidades agregadas por categoria de animal (nascimento, morte, mudança de categoria, compra, venda, ajuste de inventário) — não existe identidade individual de animal em nenhuma tabela. A "Pesagem de terneiras" já tinha sido adiada anteriormente por depender exatamente dessa peça faltante.

No negócio de produção de leite, os dados relevantes (produção, e no futuro vacinação/medicação) são sempre avaliados por animal individual para gerar estatística de desempenho — não é um detalhe secundário, é estrutural para melhoria de resultados e manutenção do rebanho (ver memória `projeto-ademir-financas-animal-individual-visao`). Esta fatia é a fundação sobre a qual essas análises futuras serão construídas.

A propriedade tem hoje 3 ordenhas por dia. O lançamento agregado diário (`producao_leite`: litros comercial/descarte/consumo) já existe e continua funcionando exatamente como está — ele representa o **destino** do leite (venda/descarte/consumo), uma decisão de tanque, não uma propriedade do animal.

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Escopo desta fatia: gado leiteiro apenas.** Suínos não têm nenhuma tabela ainda.
- **Cadastro de animal fica separado dos eventos agregados existentes.** Nascimento/morte/venda/mudança de categoria em `eventos_operacionais` continuam exatamente como hoje, sem tocar no cadastro de animal — integração entre os dois sistemas fica para uma fatia futura, se fizer falta.
- **Sem importação em lote.** O rebanho atual (20-60 vacas) é cadastrado manualmente, um por um — custo único aceitável por ser pontual.
- **Mãe é vínculo a outro animal; pai é texto livre.** Mãe quase sempre é uma vaca da própria propriedade; pai geralmente é sêmen de inseminação artificial, sem cadastro próprio.
- **Produção por animal é capturada por ordenha, não por dia agregado.** A propriedade faz 3 ordenhas/dia; cada uma gera um lançamento por animal. O número da ordenha é digitado (1, 2, 3, ...; não fixado em 3 para não exigir migration se a rotina mudar); o horário é sempre o timestamp automático do sistema — nunca digitado — para permitir análise futura de intervalo entre ordenhas x produtividade.
- **O total produzido por animal se soma numa métrica nova, separada dos 3 destinos.** Uma view soma a produção por animal em um "total produzido" por unidade/dia. Os 3 destinos (comercial/descarte/consumo) continuam sendo digitados em agregado, sem nenhuma validação cruzada com esse total nesta fatia.
- **Fora de escopo, registrado para não esquecer:** vacinação/medicação/ocorrências sanitárias por animal (próxima fatia natural sobre esta fundação — ver memória `projeto-ademir-financas-animal-individual-visao`); motor de captura configurável/personalizável (ver memória `projeto-ademir-financas-app-celular-voz`); motor de relatórios padrão + personalizáveis (ver memória `projeto-ademir-financas-motor-relatorios-ideia`); relatório de correlação intervalo-entre-ordenhas x produtividade (os dados ficam disponíveis via timestamp automático, mas o relatório em si não é construído aqui).

## 3. Modelo de dados

```sql
create table public.animais (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id),
  unidade_negocio_id uuid not null references public.unidades_negocio(id),
  brinco text not null,
  nome text,
  sexo text not null check (sexo in ('femea', 'macho')),
  categoria text not null check (categoria in (
    'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
    'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
  )),
  data_nascimento date,
  mae_id uuid references public.animais(id),
  pai_texto text,
  ativo boolean not null default true,
  criado_por uuid not null references public.usuarios(id),
  criado_em timestamptz not null default now(),
  unique (propriedade_id, brinco)
);

create table public.producao_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id),
  animal_id uuid not null references public.animais(id),
  unidade_negocio_id uuid not null references public.unidades_negocio(id),
  data date not null,
  numero_ordenha smallint not null check (numero_ordenha > 0),
  litros numeric(10,2) not null check (litros >= 0),
  criado_por uuid not null references public.usuarios(id),
  criado_em timestamptz not null default now(),
  unique (animal_id, data, numero_ordenha)
);

create view public.producao_animal_total_dia
  with (security_invoker = true) as
  select unidade_negocio_id, data, sum(litros) as total_produzido, count(distinct animal_id) as animais_lancados
  from public.producao_animal
  group by unidade_negocio_id, data;
```

- RLS em `animais` e `producao_animal` segue o padrão já estabelecido: isolamento por `propriedade_id = usuario_propriedade_id()`, com bypass para o papel `dev`, igual às demais tabelas de negócio.
- `mae_id`, quando informado, é validado no backend como pertencente à mesma `propriedade_id` antes de salvar (mesmo gap de validação já corrigido 2x em outras tabelas — `unidade_negocio_id`, `perfil_acesso_id`).
- `data_nascimento` não pode ser no futuro (validado no backend).
- Conflito em (`animal_id`, `data`, `numero_ordenha`) já existente é tratado como `insert`-então-`update`, nunca `upsert` ingênuo — mesmo padrão do resto do projeto.
- Nenhuma alteração em `eventos_operacionais`, `rebanho_composicao()` ou `producao_leite` (o lançamento agregado existente continua intocado).

## 4. Frontend

**Cadastro de animal** (dentro de Produção → Rebanho, tudo HTML puro, sem JS):
- `/dashboard/producao/rebanho/animais` — listagem com filtro por categoria e ativo/inativo, botão "novo animal".
- `/dashboard/producao/rebanho/animais/novo` — formulário: brinco, nome, sexo, categoria, data de nascimento, mãe (`<select>` com os animais já cadastrados na propriedade), pai (texto livre).
- `/dashboard/producao/rebanho/animais/[id]/editar` — edição dos mesmos campos + ação de dar baixa/reativar (mesmo padrão de `imobilizados`).

**Lançamento de produção por animal:**
- Nova página (`/dashboard/producao/leite/por-animal`) — usuário escolhe data + número da ordenha; a página lista todos os animais ativos com categoria `vaca_lactacao` daquela unidade, um campo de litros por animal, um único `<form>` POST em lote (evita N submits para N animais).
- Se já existir lançamento para algum animal+data+ordenha, o campo vem pré-preenchido com o valor salvo (reabrir a mesma tela funciona como edição).
- Se não houver nenhum animal ativo em `vaca_lactacao`, a página mostra uma mensagem em vez de um formulário vazio.

## 5. Backend

Rotas novas, todas Route Handlers HTML puro (`method="POST"`, sem JS, redirect com `?error=<codigo>`):
- `POST /api/producao/animais` — cria animal; valida `mae_id` (pertence à propriedade) e `data_nascimento` (não é futuro) antes de inserir.
- `POST /api/producao/animais/[id]/editar` — edita campos + baixa/reativa (`ativo`).
- `POST /api/producao/leite/por-animal` — recebe a data, o número da ordenha, e os litros de cada animal (um campo por `animal_id` no formulário); para cada animal com valor preenchido, faz insert-então-update em `producao_animal`. Campos deixados em branco são ignorados (nenhum lançamento é criado/alterado para aquele animal) — permite pular um animal que não foi ordenhado numa ordenha específica, sem exigir um valor para todos.

## 6. Testes

**pgTAP:**
- `animais` e `producao_animal` existem com as colunas esperadas.
- RLS: usuário de propriedade A não vê/insere/edita animal ou produção de propriedade B (incluindo tentativa de `mae_id` apontando para animal de outra propriedade).
- Constraint única (`propriedade_id`, `brinco`) e (`animal_id`, `data`, `numero_ordenha`) rejeitam duplicados.
- Checks de `categoria`/`sexo`/`numero_ordenha`/`litros` rejeitam valores inválidos.
- View `producao_animal_total_dia` soma corretamente múltiplos animais e múltiplas ordenhas no mesmo dia/unidade.

**Frontend:** sem suíte automatizada (convenção já estabelecida) — build + `tsc` limpos, e verificação manual via `curl` cobrindo: criar animal, tentar duplicar brinco (deve falhar), lançar produção em lote por ordenha, reabrir a mesma ordenha (deve vir pré-preenchido), editar animal, dar baixa e confirmar que ele desaparece da lista de lançamento por ordenha.

## 7. Fora de escopo

Vacinação/medicação/ocorrências sanitárias por animal. Integração com `eventos_operacionais` (nascimento/morte/venda/mudança de categoria continuam sem tocar no cadastro de animal). Importação em lote (CSV) do rebanho atual. Motor de captura configurável/personalizável (botões, ordem, por usuário/cliente). Motor de relatórios padrão + personalizáveis. Relatório de correlação entre intervalo de ordenhas e produtividade. Produção de suínos. Validação cruzada entre o "total produzido" por animal e os 3 destinos do lançamento agregado.
