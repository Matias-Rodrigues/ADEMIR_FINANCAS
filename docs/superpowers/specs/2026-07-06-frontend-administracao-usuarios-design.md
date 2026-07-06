# Telas de Administração de Usuários e Permissões — Design

> Segunda das duas specs da Task 2 do roteiro geral ("administração de usuários e permissões"). Constrói sobre a RLS já aprovada e mesclada em `docs/superpowers/specs/2026-07-05-rls-administracao-usuarios-design.md` e sobre a fundação de frontend já aprovada em `docs/superpowers/specs/2026-07-05-frontend-stack-design.md`.

## 1. Contexto

O backend já garante, via RLS: `admin` gerencia `propriedades`/`pessoas_fisicas`/`perfis_acesso`/`perfil_acesso_permissoes`/`usuarios` só da própria propriedade; `dev` tem acesso cross-propriedade; ninguém mais tem acesso a essas tabelas; `usuarios` não tem policy de INSERT (criação de usuário exige uma rota server-side com a *service role key*, fora do alcance de RLS). O frontend já tem fundação pronta: Next.js + TypeScript + Tailwind + shadcn/ui, login/logout via Route Handlers simples (POST + redirect), middleware protegendo `/dashboard`, dashboard placeholder, tipos TypeScript gerados do schema.

Esta spec cobre as telas que faltam para o admin (Ademir) de fato gerenciar perfis de acesso e usuários da própria propriedade, mais duas peças pequenas: a tela "meu plano" e o fix de feedback de erro no login (pendência já registrada na Task 5 da fundação).

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Vínculo de pessoa física:** ao criar um usuário, o admin pode escolher uma `pessoa_fisica` já cadastrada (sem login ainda) ou criar uma nova — nunca duplica.
- **Papel atribuível pela tela:** só `membro_familia`. Criar outro `admin` ou `dev` fica fora desta spec.
- **Senha inicial e reset de senha:** o admin define a senha diretamente na tela (criação e reset), sem depender de e-mail. Consequência: **"esqueci minha senha" self-service fica fora de escopo** — sem dependência de e-mail/SMTP nesta spec.
- **Desativação de usuário:** a rota server-side desativa o login diretamente no Supabase Auth (via Admin API) quando `ativo = false` é setado. Não há mudança na RLS já aprovada (nenhuma função passa a checar `ativo`).
- **Módulo `administracao_usuarios`:** fica fora da lista de checkboxes na tela de perfil (sem efeito na RLS atual — mostrar geraria confusão).
- **Lista de módulos no editor de perfil:** só os módulos que a propriedade tem contratados (`propriedade_modulos_contratados.ativo = true`).
- **Escopo de propriedade:** esta spec cobre o admin gerenciando a própria propriedade pela UI. O acesso cross-propriedade do `dev` já existe na RLS para suporte via banco/Studio; não é exercitado por nenhuma tela desta spec.

## 3. Arquitetura geral

**Padrão de mutação (idêntico ao já usado em login/logout):** todo formulário é HTML puro (`method="POST"`), sem JavaScript, apontando para um Route Handler que processa e redireciona — testável via `curl` com cookie jar, sem framework de teste.

**Padrão de erro (novo, aplicado retroativamente ao login):** quando uma mutação falha, o Route Handler redireciona para a página de origem com `?error=<codigo>` (303). A página (Server Component) lê `searchParams.error` e renderiza uma mensagem amigável correspondente. Isso fecha a pendência da Task 5 (login hoje só redireciona com `?error=1` sem mostrar nada).

**Dois tipos de escrita, dois clients:**
- **Perfis de acesso e permissões** (`perfis_acesso`, `perfil_acesso_permissoes`): a RLS já permite INSERT/UPDATE/DELETE direto para admin da própria propriedade. Os Route Handlers usam o client autenticado normal (`@/lib/supabase/server`), sem service role.
- **Usuários** (criar, resetar senha, desativar/reativar): exigem a *service role key* (criar login no Auth, banir/desbanir login, trocar senha via Admin API). Novo helper `web/lib/supabase/service.ts`:
  ```ts
  import { createClient as createSupabaseClient } from '@supabase/supabase-js'
  import type { Database } from './database.types'

  export function createServiceRoleClient() {
    return createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  ```
  **Toda rota que usa este client precisa, antes de qualquer operação privilegiada, autenticar o chamador com o client normal (`@/lib/supabase/server`), confirmar que `usuarios.papel = 'admin'` para o chamador, e usar o `propriedade_id` do **chamador** (nunca um valor vindo do formulário) em todo INSERT/validação.** Como o client de service role ignora RLS, essa validação manual é a única barreira contra um admin manipular a requisição para referenciar dados de outra propriedade — mesma checagem para `pessoa_fisica_id` e `perfil_acesso_id` recebidos do formulário: o Route Handler confirma que pertencem à propriedade do chamador antes de usá-los, senão responde com erro (redirect `?error=`).

## 4. Rotas e páginas

### Navegação

`web/app/dashboard/page.tsx` ganha links para as seções novas (só exibidos se `papel` do usuário logado for `admin`/`dev`): "Perfis de acesso", "Usuários", "Meu plano" (este último visível a todos).

### Autorização de página

`/dashboard/usuarios*` e `/dashboard/perfis*`: o Server Component busca o `papel` do usuário logado (`usuarios` via `auth.uid()`) e usa `redirect('/dashboard')` se não for `admin`/`dev` — mesmo padrão de defesa em profundidade já usado em `/dashboard`.

### Perfis de acesso

- `GET /dashboard/perfis` — lista (nome + resumo de módulos com `pode_ver`/`pode_lancar`).
- `GET /dashboard/perfis/novo` e `GET /dashboard/perfis/[id]/editar` — formulário (nome + checkboxes `pode_ver`/`pode_lancar` por módulo contratado).
- `POST /api/perfis` — cria `perfis_acesso` (propriedade do chamador) + as linhas de `perfil_acesso_permissoes` marcadas.
- `POST /api/perfis/[id]/editar` — substitui nome e as permissões (estratégia: apaga todas as linhas de `perfil_acesso_permissoes` daquele perfil e reinsere as marcadas — mais simples que diff).
- `POST /api/perfis/[id]/excluir` — exclui o perfil (usuários vinculados perdem o perfil via `on delete set null`, já existente no schema).

### Usuários

- `GET /dashboard/usuarios` — lista (nome via `pessoas_fisicas`, papel, perfil, status ativo/inativo).
- `GET /dashboard/usuarios/novo` — formulário: rádio "pessoa já cadastrada" (select com `pessoas_fisicas` da propriedade sem `usuarios.pessoa_fisica_id` correspondente) vs "pessoa nova" (nome + CPF); e-mail; senha inicial; perfil de acesso (select).
- `POST /api/admin/usuarios` — service role: valida perfil/pessoa pertencem à propriedade do chamador; cria/reaproveita `pessoas_fisicas`; cria o login (`auth.admin.createUser`, `email_confirm: true`, sem envio de e-mail); insere `usuarios` (`papel = 'membro_familia'`, `ativo = true`).
- `GET /dashboard/usuarios/[id]/editar` — trocar perfil; botões de resetar senha e ativar/desativar.
- `POST /api/admin/usuarios/[id]/perfil` — troca `perfil_acesso_id` (client normal, RLS já cobre).
- `POST /api/admin/usuarios/[id]/resetar-senha` — service role: `auth.admin.updateUserById(id, { password })`, validando que o usuário-alvo pertence à propriedade do chamador.
- `POST /api/admin/usuarios/[id]/desativar` — service role: bane o login (Admin API) e marca `ativo = false`.
- `POST /api/admin/usuarios/[id]/reativar` — service role: desfaz o banimento e marca `ativo = true`.

### Meu plano

- `GET /dashboard/meu-plano` — somente leitura, lista `propriedade_modulos_contratados` da própria propriedade (RLS já permite a qualquer usuário autenticado da propriedade). Sem mutação, sem Route Handler.

### Fix do login

`web/app/login/page.tsx` passa a receber `searchParams` e, se `error` estiver presente, mostrar "E-mail ou senha inválidos" acima do formulário.

## 5. Fora de escopo (explicitamente adiado)

- Delegação de `administracao_usuarios` a perfis não-admin.
- "Esqueci minha senha" self-service (sem e-mail/SMTP nesta spec).
- Criar um segundo `admin` ou qualquer `dev` pela UI.
- CRUD avulso de `pessoas_fisicas` fora do fluxo de criação de usuário (cadastro de membro da família só para financeiro familiar, sem login, fica para quando essa tela existir).
- Qualquer reforço de RLS checando `ativo` (a desativação age só no Supabase Auth).
- Uso do acesso cross-propriedade do `dev` através destas telas (ele já existe na RLS para suporte via banco/Studio).

## 6. Testes

Sem suite automatizada de frontend (decisão já tomada na fundação). Cada Route Handler é verificável via `curl` com cookie jar (login como admin de teste → exercitar a rota → conferir efeito no banco via `psql`/Studio ou nova consulta autenticada). `npm run build`/`lint`/`tsc --noEmit` continuam sendo a rede de segurança de compilação.
