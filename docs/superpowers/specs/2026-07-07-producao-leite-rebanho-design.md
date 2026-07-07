# Produção de Leite e Rebanho — Design

> Cobre só o modelo de dados (schema + funções) do módulo `producao`, para a atividade leiteira. Uma spec futura de frontend constrói as telas em cima desta base — mesmo padrão usado em RLS de administração de usuários → frontend de administração de usuários.

## 1. Contexto

A propriedade tem duas unidades de negócio (`unidades_negocio`): "Gado leiteiro" e "Suínos". O módulo `producao` já existe como entitlement (`propriedade_modulos_contratados`) e já tem uma tabela genérica, `eventos_operacionais` (`tipo_evento` em `producao`, `mortalidade`, `insumo`, `venda`, `ocorrencia_sanitaria`), desenhada para ser genérica entre atividades — os campos `quantidade`/`unidade_medida`/`descricao` não assumem nada específico de leite ou de suínos.

Uma planilha real (modelo SENAR, preenchida por Ademir Thomas, Nova Candelária — arquivo `Leitec.Thomas 2023-2.xlsx`) revela a estrutura de dados que a atividade leiteira realmente precisa: produção diária de leite por destino (comercial/descarte/consumo) e composição mensal do rebanho por categoria (vacas em lactação, descarte, secas, novilhas cobertas, novilhas em recria, terneiras em aleitamento). As abas de Receita/Custo/Silagem/Qualidade/Metas/Pesagem de Terneiras da mesma planilha ficam fora desta spec (ver Seção 5).

## 2. Objetivo desta spec

Modelar produção diária de leite e movimentação de rebanho de forma que:
- reflita o hábito real do Ademir (lançamento diário, sistema agrega para relatórios mensais);
- não force a atividade leiteira inteira dentro do formato genérico de `eventos_operacionais`, mas também não crie um silo que não generaliza para quando a Produção de suínos for modelada.

## 3. Decisões de escopo (via brainstorming com o usuário)

- **Só Produção, não Imobilizado.** A planilha também tem abas de depreciação de bens — tratadas como spec separada (módulo `imobilizado` já tem tabela própria, só precisa de ajustes).
- **Receita e Custo ficam fora.** Já têm lugar no módulo `financeiro_negocio` (tabela `lancamentos_financeiros_negocio` já existe) — não duplicados aqui.
- **Qualidade do leite (CCS, CBT, gordura, proteína) e Pesagem de Terneiras ficam fora desta primeira iteração** — complexidade adicional (esta última exigiria cadastro de animal individual) adiada para uma spec futura.
- **Granularidade: lançamento diário, sistema agrega.** O Ademir informa a produção de leite dia a dia (compatível com integração futura via WhatsApp); médias e totais mensais são sempre calculados, nunca digitados diretamente.
- **Rebanho é reconstruído a partir de eventos de movimentação**, não snapshot manual — nascimento, morte, mudança de categoria, compra, venda. Escolhido em vez de contagem manual mensal porque gera histórico de causa e reaproveita o precedente já existente (`mortalidade` já é um `tipo_evento` de `eventos_operacionais`).
- **Destinos do leite sempre separados no lançamento diário** (comercial/descarte/consumo), não só um total — replica a granularidade real da planilha desde o primeiro dia.

## 4. Modelo de dados

### 4.1 `producao_leite` (tabela nova, dedicada)

Alta frequência (lançamento diário) e forma sempre fixa — não se beneficia da genericidade de `eventos_operacionais`; pelo contrário, forçar 3 lançamentos genéricos por dia (um por destino) tornaria a agregação mensal desnecessariamente complexa.

```sql
create table public.producao_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  data date not null,
  litros_comercial numeric(10,2) not null default 0 check (litros_comercial >= 0),
  litros_descarte numeric(10,2) not null default 0 check (litros_descarte >= 0),
  litros_consumo numeric(10,2) not null default 0 check (litros_consumo >= 0),
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (unidade_negocio_id, data)
);

alter table public.producao_leite enable row level security;

create index producao_leite_propriedade_id_idx on public.producao_leite(propriedade_id);
create index producao_leite_unidade_negocio_id_idx on public.producao_leite(unidade_negocio_id);

create policy "ver producao de leite"
  on public.producao_leite for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar producao de leite"
  on public.producao_leite for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
```

- `unique (unidade_negocio_id, data)`: só um lançamento por dia por unidade de negócio — evita duplicidade; a tela trata a violação como "editar o existente", não criar outro.
- `litros_*` com `default 0`, nunca `null` — nem todo dia tem descarte/consumo; zero é neutro para soma mensal sem tratamento especial.
- Sem coluna de total/média — sempre calculado (view da Seção 4.3), nunca armazenado.
- RLS segue exatamente o padrão de `eventos_operacionais`/`imobilizados`: `tem_permissao('producao', 'ver'/'lancar')`.

### 4.2 Movimentação de rebanho (extensão de `eventos_operacionais`)

Eventos irregulares (não diários, não sempre no mesmo formato) — encaixam no papel que `eventos_operacionais` já cumpre para `mortalidade`, e generalizam para qualquer atividade baseada em animais (inclusive suínos, no futuro).

```sql
alter table public.eventos_operacionais
  drop constraint eventos_operacionais_tipo_evento_check,
  add constraint eventos_operacionais_tipo_evento_check
    check (tipo_evento in (
      'producao', 'mortalidade', 'insumo', 'venda', 'ocorrencia_sanitaria',
      'nascimento', 'mudanca_categoria', 'compra_animal', 'venda_animal', 'ajuste_inventario'
    ));

alter table public.eventos_operacionais
  add column categoria_animal text check (categoria_animal in (
    'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
    'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
  )),
  add column categoria_origem text check (categoria_origem in (
    'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
    'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
  ));
```

Uso dos campos por `tipo_evento` (os já existentes — `producao`, `insumo`, `venda`, `ocorrencia_sanitaria` — continuam sem usar `categoria_animal`/`categoria_origem`, permanecem `null`):

| tipo_evento | categoria_animal | categoria_origem | quantidade |
|---|---|---|---|
| `nascimento` | categoria de destino (sempre `terneira_aleitamento`) | — | nº de animais nascidos |
| `mortalidade` | categoria do animal que morreu | — | nº de animais |
| `mudanca_categoria` | categoria de destino | categoria de origem | nº de animais que mudaram |
| `compra_animal` | categoria do animal comprado | — | nº de animais |
| `venda_animal` | categoria do animal vendido | — | nº de animais |
| `ajuste_inventario` | categoria ajustada | — | contagem correta (valor absoluto, não delta) |

**Ponto de partida (`ajuste_inventario`):** o rebanho já existe hoje, não começa do zero. Ao habilitar o módulo, o admin lança um `ajuste_inventario` por categoria (6 linhas) com a contagem atual, datado do dia da ativação. O mesmo tipo de evento serve para corrigir divergências futuras entre contagem física e sistema.

**Validação (Route Handler, não banco):** `mudanca_categoria` exige `categoria_origem != categoria_animal`; `quantidade` sempre inteiro positivo. A composição **não é impedida de ficar negativa** no banco (exigiria trigger consultando o estado agregado a cada insert — complexidade desproporcional); uma composição negativa é sinal de erro de digitação, visível no relatório, tratado como aviso na tela, não bloqueio.

### 4.3 Reconstrução da composição do rebanho

```sql
create or replace function public.rebanho_composicao(p_unidade_negocio_id uuid, p_data date)
returns table (categoria text, quantidade bigint)
language sql
stable
as $$
  -- para cada categoria: soma o ajuste_inventario mais recente até p_data
  -- com os deltas de nascimento (+), mortalidade (-), mudanca_categoria (+/-),
  -- compra_animal (+), venda_animal (-) ocorridos depois daquele ajuste e até p_data
$$;
```

(pseudocódigo da lógica na assinatura — a query exata de reconstrução, com `lateral`/`distinct on` por categoria, é detalhada no plano de implementação, não nesta spec de design.)

Analogia: como um extrato bancário — não se guarda o saldo de cada dia, guardam-se os lançamentos, e soma-se sob demanda a partir do último saldo conhecido.

### 4.4 Relatório mensal (view)

`public.producao_leite_mensal` (ou nome equivalente, definido no plano) agrega `producao_leite` por mês (soma dos 3 destinos, produção total, média diária) e cruza com `rebanho_composicao()` no último dia do mês para calcular litros por vaca em lactação e litros por total de vacas — replicando as colunas de média já existentes na planilha. A tela de rebanho mensal (equivalente à aba "Rebanho") não precisa de view própria — é `rebanho_composicao()` chamada para o último dia de cada mês do ano selecionado.

## 5. Fora de escopo (explicitamente adiado)

- Qualidade do leite (CCS, CBT, gordura, proteína, ESD) — dado mensal simples, candidato a spec futura de baixo custo.
- Pesagem de terneiras — exige cadastro de animal individual (identidade, nascimento, mãe/pai), escopo maior.
- Metas de desempenho (planejado vs. realizado) — provavelmente uma feature de comparação sobre os dados já modelados aqui, não uma tabela nova; avaliar quando os dados acima já estiverem em produção.
- Silagem (custo de produção por safra/cultura) — é dado de custo, pertence ao módulo `financeiro_negocio`, fora desta spec.
- Módulo Imobilizado (depreciação de benfeitorias/máquinas) — spec própria; a tabela `imobilizados` já existe, precisa de ajuste (ex: coluna `valor_residual`, hoje ausente) fora do escopo aqui.
- Produção de suínos — o desenho de `eventos_operacionais` estendido para rebanho foi pensado para generalizar, mas os campos específicos de suínos (categorias de animal, eventos próprios da atividade) ficam para quando essa unidade de negócio for modelada.
