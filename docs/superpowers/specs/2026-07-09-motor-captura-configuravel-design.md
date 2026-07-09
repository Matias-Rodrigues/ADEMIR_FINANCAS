# Motor de Captura Configurável — Design

> Fatia inicial da ideia registrada em `projeto-ademir-financas-app-celular-voz` (personalização da forma de captura de dados no app celular). Aplica-se, nesta primeira fatia, só à tela de lançamento de produção de leite por animal por ordenha (`/dashboard/producao/leite/por-animal`). Configuração é por usuário, feita exclusivamente pelo fornecedor (papel `dev`) na implantação — não é um recurso self-service para o cliente.

## 1. Contexto

A tela `/dashboard/producao/leite/por-animal` já existe: lista os animais ativos em lactação de uma unidade, ordenados por brinco, com um campo de litros por animal, todos visíveis ao mesmo tempo. A ideia original de "motor de captura configurável" pedia botões que abrem o campo ao tocar, mostrando informações do animal junto — mas o produto já estabeleceu (ver `projeto-ademir-financas-visao-produto`) que quem controla o que cada cliente vê é o fornecedor, não o cliente. Esta fatia aplica esse mesmo princípio à granularidade de captura: o fornecedor configura, por usuário, como a tela se comporta.

Até aqui, todo o frontend do projeto é HTML puro sem JavaScript no cliente, com uma única exceção justificada (gravação de áudio, que depende de API do navegador). Esta fatia introduz um segundo padrão de interatividade — "tocar para revelar um campo" — resolvido com `<details>`/`<summary>` nativo do HTML, preservando a convenção de zero JS.

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Só a tela `/dashboard/producao/leite/por-animal`** nesta fatia — outras telas de captura (lançamento agregado, produção de suínos quando existir) ficam para o futuro.
- **Configuração por usuário, não por propriedade** — dentro da mesma propriedade, usuários diferentes podem ter configurações diferentes.
- **Só o papel `dev` (fornecedor) configura** — nem o admin da propriedade nem o próprio usuário ajustam isso; é uma decisão de implantação, não um recurso self-service.
- **Três dimensões configuráveis:** ordem de exibição dos animais (por posição numérica, não drag-and-drop); estilo de interação (todos os campos visíveis, como hoje, ou tocar no nome para revelar o campo); exibir ou não a categoria do animal junto ao brinco/nome.
- **Categoria é a única informação de contexto configurável nesta fatia** — outras informações (última pesagem, última vacina) ficam fora de escopo, mesmo tendo sido cogitadas.
- **Sem configuração = comportamento padrão atual** — ordem por brinco, todos os campos visíveis, sem categoria. Nenhum usuário existente é afetado até o `dev` configurar algo para ele.
- **Tocar para revelar implementado com `<details>`/`<summary>` nativo**, não com JavaScript — mantém a convenção de zero JS do projeto.
- **Fora de escopo, registrado para o futuro:** configuração pelo admin da propriedade ou pelo próprio usuário; aplicar o motor a outras telas; informações de contexto além de categoria; reordenação por arrastar-e-soltar; qualquer sincronia automática quando um animal novo entra no rebanho (cai no fim da lista por padrão).

## 3. Modelo de dados

```sql
create table public.configuracoes_captura_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  estilo_interacao text not null default 'todos_visiveis'
    check (estilo_interacao in ('todos_visiveis', 'tocar_para_revelar')),
  exibir_categoria boolean not null default false,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (usuario_id)
);

create table public.ordem_captura_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete cascade,
  posicao integer not null check (posicao > 0),
  created_at timestamptz not null default now(),
  unique (usuario_id, animal_id)
);
```

- RLS segue o padrão já usado em `propriedade_modulos_contratados` (primeira tabela do projeto com esse padrão dev-only-write): policy de SELECT (`usuario_id = auth.uid() or usuario_eh_dev()`) + uma única policy `for all` restrita a `usuario_eh_dev()` para insert/update/delete. Nenhuma outra role escreve nessas tabelas, nem mesmo `admin`.
- Ausência de linha em qualquer uma das duas tabelas para um usuário = comportamento padrão (não é erro, não bloqueia a tela por-animal).
- `posicao` não é globalmente única — só reflete ordem desejada; animais sem entrada em `ordem_captura_animal` aparecem depois dos configurados, ordenados por brinco.

## 4. Frontend

**Tela de administração nova** (`web/app/dashboard/admin/captura-animal/page.tsx`, visível só quando `papel === 'dev'`):
- Seletor de propriedade (form `GET`, `<select>` com todas as propriedades — primeira tela do projeto onde o `dev` navega entre propriedades de clientes diferentes).
- Seletor de usuário dentro da propriedade escolhida (form `GET`).
- Formulário de configuração (`POST`) para o usuário escolhido: `estilo_interacao` (`<select>`), `exibir_categoria` (checkbox), e uma lista dos animais ativos em lactação da propriedade, cada um com um `<input type="number">` de posição (pré-preenchido com a configuração existente, se houver).
- Link novo em `web/app/dashboard/page.tsx`, condicionado estritamente a `papel === 'dev'` (novo helper `ehDev()` em `web/lib/auth/current-usuario.ts`, ao lado do `ehAdminOuDev()` já existente — não reaproveita esse último, pois aqui `admin` não deve ter acesso).

**Tela `/dashboard/producao/leite/por-animal`** (já existente, adaptada):
- Busca a configuração do usuário logado nas duas tabelas novas; ausência de linha = comportamento padrão já descrito.
- Animais ordenados pela `posicao` configurada (quando existir), com os não configurados no fim, ordenados por brinco.
- Quando `exibir_categoria = true`, mostra o rótulo da categoria (mesmo mapeamento já usado em outras telas do projeto) junto ao brinco/nome.
- Quando `estilo_interacao = 'tocar_para_revelar'`, cada campo de litros fica dentro de `<details><summary>{brinco}</summary>{campo}</details>` em vez de sempre visível.

## 5. Backend

- `POST /api/admin/captura-animal` (novo): recebe `propriedade_id`, `usuario_id`, `estilo_interacao`, `exibir_categoria`, e as posições por animal (`posicao_<animal_id>` por campo, mesmo padrão já usado no lançamento em lote de produção por animal). Protegido por checagem estrita `ehDev()`. Valida que `usuario_id` pertence a `propriedade_id`, e que cada `animal_id` recebido pertence à mesma `propriedade_id`, antes de gravar. Grava/atualiza `configuracoes_captura_animal` (insert-então-update) e as linhas de `ordem_captura_animal` correspondentes às posições preenchidas (posições em branco são ignoradas, não geram linha).
- `web/lib/auth/current-usuario.ts` ganha `ehDev(usuario: UsuarioAtual | null): boolean`.

## 6. Testes

**pgTAP:**
- Tabelas `configuracoes_captura_animal` e `ordem_captura_animal` existem com as colunas esperadas.
- RLS: usuário comum vê a própria configuração, não vê a de outro usuário; usuário comum não consegue inserir/editar/excluir em nenhuma das duas tabelas (nem a própria linha); `dev` consegue gravar para qualquer usuário de qualquer propriedade.
- Check `estilo_interacao` rejeita valor fora da lista (`todos_visiveis`/`tocar_para_revelar`); check `posicao > 0` rejeita zero/negativo.
- Unicidade: uma configuração por `usuario_id`; uma posição por (`usuario_id`, `animal_id`).

**Frontend:** sem suíte automatizada (convenção já estabelecida) — build + `tsc` limpos, e verificação manual via `curl`: acesso negado à tela/rota de admin para usuário não-`dev`; configurar um usuário (posições + estilo + categoria) como `dev`; confirmar que `/leite/por-animal` reflete a ordem/estilo/categoria configurados quando logado como aquele usuário; confirmar que outro usuário sem configuração continua vendo o comportamento padrão (ordem por brinco, todos visíveis, sem categoria).

## 7. Fora de escopo

Configuração pelo admin da propriedade ou pelo próprio usuário (self-service). Aplicar o motor a outras telas de captura (lançamento agregado de leite, produção de suínos). Informações de contexto além de categoria (última pesagem, última vacina, etc.). Reordenação por arrastar-e-soltar. Sincronia automática de posição quando um animal novo é cadastrado. Qualquer notificação/lembrete relacionado à configuração.
