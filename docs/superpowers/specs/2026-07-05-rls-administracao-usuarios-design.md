# RLS de Administração de Usuários — Design

> Primeira das duas specs da Task 2 do roteiro geral ("administração de usuários e permissões"). Cobre só o backend (RLS); a segunda spec (frontend) constrói as telas em cima desta base.

## 1. Contexto

Quatro tabelas do núcleo de dados já existem, com RLS habilitado mas **sem nenhuma policy** (acesso negado por padrão para todo mundo, inclusive admin): `propriedades`, `pessoas_fisicas`, `perfis_acesso`, `perfil_acesso_permissoes`. Além disso, a policy de SELECT de `usuarios` (`id = auth.uid() or usuario_eh_dev()`) só deixa cada usuário ver a própria linha — nem o admin consegue listar os demais usuários da própria propriedade, o que bloqueia qualquer tela de gestão de usuários.

## 2. Objetivo desta spec

Fechar essas lacunas de RLS para viabilizar a spec seguinte (frontend de administração de usuários): CRUD de perfis de acesso, cadastro de pessoas físicas, e listagem/edição de usuários pelo admin.

## 3. Decisão de escopo: sem delegação por enquanto

`perfil_acesso_permissoes` já modela o módulo `administracao_usuarios` (com `pode_ver`/`pode_lancar`) como algo configurável por perfil — arquitetura pensada para permitir, no futuro, que um membro da família delegado também gerencie usuários/perfis. **Por decisão do usuário, essa delegação não é habilitada nesta spec**: o acesso a estas 4 tabelas é restrito a `admin` (da própria propriedade) e `dev` (cross-propriedade), via checagem direta de `papel`, não via `tem_permissao()` (que já retornaria `true` para qualquer perfil delegado). O campo `administracao_usuarios` em `perfil_acesso_permissoes` permanece no schema, sem efeito prático até uma spec futura decidir habilitar a delegação.

## 4. Nova função `usuario_eh_admin()`

Espelha `usuario_eh_dev()` já existente — `security definer` para evitar recursão de RLS ao consultar `usuarios` de dentro de uma policy sobre a própria `usuarios` ou sobre outra tabela:

```sql
create or replace function public.usuario_eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select papel = 'admin' from public.usuarios where id = auth.uid();
$$;
```

## 5. Policies por tabela

### `propriedades`

- **SELECT**: qualquer usuário autenticado da própria propriedade (`id = usuario_propriedade_id()`) ou `dev` — todo usuário precisa saber o nome da própria propriedade para a UI (ex: tela "meu plano").
- **UPDATE**: `id = usuario_propriedade_id() and usuario_eh_admin()`, ou `dev` — admin pode renomear a própria propriedade; dev cross-propriedade para suporte.
- **INSERT/DELETE**: só `dev` — criar ou remover uma propriedade é ato do fornecedor (onboarding/offboarding de cliente), mesmo padrão já usado para `propriedade_modulos_contratados`.

### `pessoas_fisicas`

- **SELECT/INSERT/UPDATE/DELETE**: `propriedade_id = usuario_propriedade_id() and usuario_eh_admin()`, ou `dev` cross-propriedade. Por decisão do usuário, membros da família não-admin não têm nenhum acesso a esta tabela por ora (nem leitura) — se uma tela futura (ex: rateio familiar) precisar mostrar nomes de membros, isso ganha uma policy adicional específica quando chegar a hora.

### `perfis_acesso`

- **SELECT/INSERT/UPDATE/DELETE**: mesma regra de `pessoas_fisicas` (`propriedade_id = usuario_propriedade_id() and usuario_eh_admin()`, ou `dev`).

### `perfil_acesso_permissoes`

- **SELECT/INSERT/UPDATE/DELETE**: mesma regra, aplicada via join — `perfil_acesso_id in (select id from perfis_acesso where propriedade_id = usuario_propriedade_id()) and usuario_eh_admin()`, ou `dev`. Mesmo padrão já usado nas tabelas-filho existentes (ex: `parcelas_credito`, `rateio_custo_compartilhado_itens`).

### `usuarios` (retrofit)

- **SELECT**: passa a ser `id = auth.uid() or usuario_eh_dev() or (propriedade_id = usuario_propriedade_id() and usuario_eh_admin())` — admin passa a ver todos os usuários da própria propriedade, além da própria linha; dev mantém acesso cross-propriedade.
- **UPDATE** (nova): `propriedade_id = usuario_propriedade_id() and usuario_eh_admin()`, ou `dev` — permite ao admin editar `ativo`, `perfil_acesso_id`, `pessoa_fisica_id` de um usuário da própria propriedade.
- **DELETE** (nova): mesma regra do UPDATE, por simetria — mas a spec de frontend deve preferir desativar (`ativo = false`) a excluir de fato um usuário, já que a tabela já tem essa coluna para isso.
- **INSERT**: **nenhuma policy criada.** Criar um usuário exige primeiro criar o login em `auth.users` via Admin API do Supabase Auth, que só funciona com a *service role key* — fora do alcance de RLS. Toda criação de usuário passa obrigatoriamente por uma rota server-side (Route Handler com service role), a ser desenhada na próxima spec; não existe (nem deve existir) caminho de INSERT direto em `usuarios` pelo navegador.

## 6. Fora de escopo (explicitamente adiado)

- Delegação de `administracao_usuarios` a perfis não-admin (seção 3).
- Visibilidade de `pessoas_fisicas`/`perfis_acesso` para membros não-admin.
- Qualquer tela de frontend — fica para a spec seguinte.
- Fluxo de criação de usuário em si (Route Handler, Admin API, vínculo com `pessoas_fisicas`/`perfis_acesso`) — também fica para a spec de frontend; esta spec só garante que o INSERT direto via RLS está corretamente bloqueado.

## 7. Impacto nos testes já aprovados

Como as 4 tabelas hoje não têm nenhuma policy, qualquer teste pgTAP que dependa de ler/escrever nelas atualmente falha (negado por padrão) ou nunca foi exercido. Esta spec deve:

1. Adicionar testes pgTAP dedicados (novo arquivo, seguindo a numeração sequencial já usada em `supabase/tests/database/`) cobrindo: admin lê/escreve dentro da própria propriedade; admin de uma propriedade **não** enxerga/edita dados de outra; dev tem acesso cross-propriedade às 4 tabelas; membro não-admin não enxerga nada nas 4 tabelas; `usuarios` SELECT agora inclui a lista completa para o admin; `usuarios` INSERT via client autenticado (mesmo como admin) falha (sem policy).
2. Confirmar que a suíte completa (57 testes atuais + os novos) segue 100% PASS.
