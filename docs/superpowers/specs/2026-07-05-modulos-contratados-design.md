# Sistema de Módulos Contratados — Design

> Spec de handoff para a fase de planejamento. Construído em cima do núcleo de dados já implementado e aprovado (`docs/superpowers/plans/2026-07-04-nucleo-dados-crm.md`).

## 1. Contexto de negócio

O CRM ADEMIR_FINANÇAS deixou de ser só uma ferramenta pessoal para o Ademir: é o piloto de um produto (SaaS) que será oferecido futuramente a outros pequenos/médios produtores e pequenas empresas rurais. O Ademir serve para validar dores e necessidades reais antes de generalizar a solução.

**Modelo comercial:** módulos contratáveis — o cliente adquire a solução escolhendo quais módulos quer usar, com custo por módulo (precificação fica fora de escopo desta spec — ver seção 6). Quem controla quais módulos cada cliente vê é o **fornecedor** (Matias, papel `dev` já existente no schema), não o próprio cliente.

## 2. Objetivo desta spec

Adicionar ao schema já aprovado o conceito de **entitlement**: quais módulos uma propriedade tem contratados e ativos, aplicado tanto na visibilidade (futura UI) quanto — mais importante — como camada de segurança no próprio banco (RLS), para que um cliente não consiga acessar dados de um módulo não contratado nem contornando a interface.

Além disso, formaliza o acesso de suporte do papel `dev`: ele precisa agir como administrador de **qualquer** propriedade (não só a própria) para implantar, diagnosticar e corrigir problemas dos clientes.

## 3. Schema

### Nova tabela `propriedade_modulos_contratados`

```sql
create table public.propriedade_modulos_contratados (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  modulo text not null check (modulo in (
    'producao', 'financeiro_negocio', 'financeiro_familiar',
    'credito_obrigacoes', 'imobilizado', 'ponto_equilibrio', 'fiscal'
  )),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (propriedade_id, modulo)
);
```

**`administracao_usuarios` fica de fora deste catálogo** — é sempre ativo para toda propriedade, independente do que foi contratado (é núcleo, não um item vendável).

### Nova função `public.usuario_eh_dev()`

```sql
create or replace function public.usuario_eh_dev()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select papel = 'dev' from public.usuarios where id = auth.uid();
$$;
```

### Função `public.tem_permissao(p_modulo, p_acao)` — nova lógica

Ordem de avaliação (cada passo só é alcançado se o anterior não retornar):

1. **`dev` sempre `true`** — acesso pleno, a qualquer propriedade, incluindo módulos não contratados (necessário para suporte/diagnóstico antes mesmo de um módulo ser ativado).
2. **Gate de entitlement** — se `p_modulo <> 'administracao_usuarios'`, busca a linha em `propriedade_modulos_contratados` para a propriedade do usuário logado e aquele módulo. **Sem linha, ou `ativo = false` → retorna `false` imediatamente, inclusive para `admin`.**
3. **`admin` (dentro de módulo contratado) sempre `true`.**
4. **Demais papéis**: lógica já existente (consulta `perfil_acesso_permissoes` via `pode_ver`/`pode_lancar`, com `coalesce(..., false)`).

## 4. RLS na tabela nova

- **SELECT**: qualquer usuário autenticado da própria propriedade (`propriedade_id = usuario_propriedade_id()`) — informação de conta, não dado sensível de negócio. Cobre a futura tela "meu plano".
- **INSERT/UPDATE/DELETE**: só `dev`, cross-propriedade (`using (public.usuario_eh_dev())`, sem exigir `propriedade_id = usuario_propriedade_id()`). O admin da propriedade **não** tem policy de escrita nesta tabela — só o fornecedor decide o que está contratado.

## 5. Retrofit nas tabelas já aprovadas (acesso cross-propriedade do `dev`)

Toda tabela cuja policy hoje é:
```sql
using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao(...))
```
passa a ser:
```sql
using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao(...))
```

**Tabelas afetadas (11 tabelas de negócio + `usuarios`, 23 policies no total):**
`unidades_negocio`, `eventos_operacionais`, `lancamentos_financeiros_negocio`, `lancamentos_financeiros_familiares`, `lancamentos_custo_compartilhado`, `rateio_custo_compartilhado_itens`, `obrigacoes_credito`, `parcelas_credito`, `imobilizados`, `documentos_fiscais`, `parcerias_integracao` (SELECT + INSERT cada) e a policy de SELECT de `usuarios` (`id = auth.uid() or usuario_eh_dev()`).

Como `tem_permissao()` já retorna `true` incondicionalmente para `dev` (item 1 da seção 3), o `or usuario_eh_dev()` na parte de `propriedade_id` é o que efetivamente libera o acesso cross-propriedade — as duas mudanças trabalham juntas.

## 6. Fora de escopo (explicitamente adiado)

- **Preço/cobrança por módulo**: só o interruptor ativo/inativo é modelado agora. Catálogo de preço, faturamento e integração de pagamento (Asaas, já previsto no plano original) ficam para quando a parte comercial for de fato integrada.
- **Estados extras de módulo** (`trial`, `suspenso` por inadimplência): fica só `ativo`/`inativo` (boolean) por enquanto. Se a cobrança automática for implementada no futuro, um novo estado pode ser adicionado então.
- **Policies de `propriedades`, `pessoas_fisicas`, `perfis_acesso`, `perfil_acesso_permissoes`**: essas 4 tabelas não têm nenhuma policy hoje (RLS habilitado, sem regra — deliberado desde a Task 2/3 originais). Não criamos CRUD administrativo para elas nesta spec; isso é responsabilidade da Task 2 do roteiro geral ("administração de usuários"), que vai desenhar o fluxo completo de gestão de usuários/perfis, incluindo o acesso de suporte do `dev` a essas tabelas.
- **Recuperação de senha**: registrada como pendência da Task 2 (usuário redefine a própria senha; admin da propriedade reseta senha de um membro). Supabase Auth já oferece o mecanismo nativo (e-mail com link) — falta só desenhar o fluxo de UI. Não faz parte desta spec de módulos contratados.

## 7. Impacto nos testes já aprovados (retrofit necessário)

Como a política é **negar por padrão** (sem linha de entitlement = módulo bloqueado, mesmo para `admin`), a mudança em `tem_permissao()` quebra os 41 testes pgTAP já aprovados até que:

1. **`supabase/seed.sql`** ganhe uma entrada de entitlement para a propriedade real do Ademir, com os 7 módulos `ativo = true` (ele é o piloto usando tudo).
2. **Toda fixture de teste que autentica como `admin`** e verifica acesso a um módulo específico (praticamente todos os testes de Tasks 4-12) precise inserir uma linha correspondente em `propriedade_modulos_contratados` antes de testar o SELECT/INSERT daquele módulo.
3. **Dois testes novos dedicados** validem os dois comportamentos centrais desta spec:
   - Propriedade sem entitlement para um módulo → nem `admin` consegue ver/lançar naquele módulo.
   - Usuário com `papel = 'dev'` consegue acessar dados de uma propriedade que não é a dele (cross-propriedade), inclusive em módulo não contratado.

Esse retrofit é mecânico (mesmo padrão repetido por tabela), mas toca em todas as 12 tasks já aprovadas — o plano de implementação vai tratar isso tabela por tabela, com o mesmo rigor de revisão já usado no núcleo de dados original.
