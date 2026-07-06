# Telas de Administração de Usuários e Permissões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir as telas de administração de usuários e permissões do CRM Ademir Finanças — CRUD de perfis de acesso, CRUD de usuários (criação via rota server-side com service role), tela "meu plano", e o fix de feedback de erro no login — conforme `docs/superpowers/specs/2026-07-06-frontend-administracao-usuarios-design.md`.

**Architecture:** Todo formulário é HTML puro (`method="POST"`) apontando para um Route Handler, testável via `curl` com cookie jar — mesmo padrão de login/logout já aprovado. Mutações em `perfis_acesso`/`perfil_acesso_permissoes` usam o client autenticado normal (RLS já cobre). Mutações em `usuarios` que exigem *service role* (criar login, resetar senha, banir/desbanir login) ficam isoladas em `web/lib/supabase/service.ts` e só usadas nos Route Handlers sob `/api/admin/usuarios/*`, sempre validando manualmente que qualquer id recebido do formulário (pessoa física, perfil, usuário-alvo) pertence à propriedade do chamador antes de agir — necessário porque o client de service role ignora RLS. Erros de formulário seguem um padrão único: redirect com `?error=<codigo>`, página lê `searchParams` e mostra a mensagem via `web/lib/erros-formulario.ts`.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui (fundação já pronta), `@supabase/supabase-js`/`@supabase/ssr`, Node/npm já instalados. Backend Postgres/Supabase local com a RLS de `docs/superpowers/specs/2026-07-05-rls-administracao-usuarios-design.md` já mesclada.

## Global Constraints

- **Papel atribuível pela tela de criação de usuário: só `membro_familia`.** Nunca `admin`/`dev`.
- **Senha sempre definida pelo admin** (criação e reset) — sem e-mail/SMTP nesta spec.
- **Desativar usuário bane o login no Supabase Auth** (Admin API); RLS não é alterada.
- **Módulo `administracao_usuarios` nunca aparece** nas telas de perfil.
- **Lista de módulos no editor de perfil é filtrada por `propriedade_modulos_contratados.ativo = true`.**
- **Toda operação que usa o client de service role valida manualmente** que os ids recebidos do formulário (pessoa física, perfil, usuário-alvo) pertencem à `propriedade_id` do chamador — nunca confia em um valor do formulário sem checar.
- **Sem suite de testes automatizados de frontend** — verificação via `npm run build`/`lint`/`tsc --noEmit` + `curl` com cookie jar.
- Todo comando `npm`/`npx` do frontend roda dentro de `web/`; comandos do Supabase CLI rodam na raiz do repositório.
- O Supabase local precisa estar rodando (`npx supabase status`/`npx supabase start` na raiz) para qualquer verificação que dependa do banco.

### Fixtures de teste (criadas na Task 1, reutilizadas por todas as tasks seguintes)

A propriedade real já seedada (`supabase/seed.sql`) é `00000000-0000-0000-0000-000000000001` ("Propriedade Ademir"), com os 7 módulos já contratados. As tasks seguintes reutilizam dois usuários de teste, ambos criados nessa propriedade:

- **Admin de teste:** `admin.teste@ademir.local` / `senha-admin-123`, papel `admin`.
- **Membro de teste:** `membro.teste@ademir.local` / `senha-membro-123`, papel `membro_familia`, vinculado à pessoa física `10000000-0000-0000-0000-000000000001`.

Como `usuarios` não tem policy de INSERT, a inserção dessas linhas de fixture usa o endpoint REST do Supabase com a *service role key* (`http://127.0.0.1:54321/rest/v1/usuarios`), igual ao que a aplicação real vai fazer.

---

### Task 1: Helpers de sessão, navegação, e fixtures de teste

**Files:**
- Create: `web/lib/auth/current-usuario.ts`
- Create: `web/lib/erros-formulario.ts`
- Create: `web/lib/modulos.ts`
- Modify: `web/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server` (fundação já aprovada).
- Produces: `getUsuarioAtual(): Promise<UsuarioAtual | null>`, `ehAdminOuDev(usuario: UsuarioAtual | null): usuario is UsuarioAtual`, `requireAdmin(): Promise<UsuarioAtual>` (só para Server Components/páginas — usa `redirect()`, não usar em Route Handlers) de `@/lib/auth/current-usuario`; `mensagemErro(codigo)` de `@/lib/erros-formulario`; `MODULOS_NEGOCIO` de `@/lib/modulos` — usados por todas as tasks seguintes.

- [ ] **Step 1: Criar `web/lib/modulos.ts`**

```ts
export const MODULOS_NEGOCIO = [
  { valor: 'producao', rotulo: 'Produção' },
  { valor: 'financeiro_negocio', rotulo: 'Financeiro do negócio' },
  { valor: 'financeiro_familiar', rotulo: 'Financeiro familiar' },
  { valor: 'credito_obrigacoes', rotulo: 'Crédito e obrigações' },
  { valor: 'imobilizado', rotulo: 'Imobilizado' },
  { valor: 'ponto_equilibrio', rotulo: 'Ponto de equilíbrio' },
  { valor: 'fiscal', rotulo: 'Fiscal' },
] as const
```

- [ ] **Step 2: Criar `web/lib/erros-formulario.ts`**

```ts
const MENSAGENS: Record<string, string> = {
  credenciais_invalidas: 'E-mail ou senha inválidos.',
  nome_obrigatorio: 'Informe um nome.',
  dados_invalidos: 'Preencha todos os campos obrigatórios.',
  pessoa_invalida: 'Selecione uma pessoa válida.',
  perfil_invalido: 'Selecione um perfil de acesso válido.',
  senha_curta: 'A senha precisa ter pelo menos 6 caracteres.',
  email_duplicado: 'Já existe um usuário com este e-mail.',
  cpf_duplicado: 'Já existe uma pessoa cadastrada com este CPF.',
  nao_autorizado: 'Você não tem permissão para esta ação.',
  usuario_nao_encontrado: 'Usuário não encontrado.',
  erro_inesperado: 'Algo deu errado. Tente novamente.',
}

export function mensagemErro(codigo: string | undefined): string | null {
  if (!codigo) {
    return null
  }
  return MENSAGENS[codigo] ?? MENSAGENS.erro_inesperado
}
```

- [ ] **Step 3: Criar `web/lib/auth/current-usuario.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UsuarioAtual = {
  id: string
  propriedade_id: string
  papel: string
}

export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data } = await supabase
    .from('usuarios')
    .select('id, propriedade_id, papel')
    .eq('id', user.id)
    .single()

  return data
}

export function ehAdminOuDev(usuario: UsuarioAtual | null): usuario is UsuarioAtual {
  return usuario !== null && (usuario.papel === 'admin' || usuario.papel === 'dev')
}

export async function requireAdmin(): Promise<UsuarioAtual> {
  const usuario = await getUsuarioAtual()
  if (!ehAdminOuDev(usuario)) {
    redirect('/dashboard')
  }
  return usuario
}
```

- [ ] **Step 4: Editar `web/app/dashboard/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const usuarioAtual = await getUsuarioAtual()
  const ehAdminOuDev = usuarioAtual?.papel === 'admin' || usuarioAtual?.papel === 'dev'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <p>Logado como: {user.email}</p>
      <nav className="flex flex-col gap-2">
        {ehAdminOuDev && (
          <>
            <Link href="/dashboard/perfis" className="underline">
              Perfis de acesso
            </Link>
            <Link href="/dashboard/usuarios" className="underline">
              Usuários
            </Link>
          </>
        )}
        <Link href="/dashboard/meu-plano" className="underline">
          Meu plano
        </Link>
      </nav>
      <form method="POST" action="/api/auth/logout">
        <Button type="submit" variant="outline">
          Sair
        </Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Confirmar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

Expected: sucesso, sem erros.

- [ ] **Step 6: Criar as fixtures de teste**

Da raiz do repositório, com o Supabase local rodando (`npx supabase status`; `npx supabase db reset` se precisar reaplicar o seed):

```bash
npx supabase status
```

Anote `API_URL` e `SERVICE_ROLE_KEY`. Crie o admin de teste:

```bash
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.teste@ademir.local","password":"senha-admin-123","email_confirm":true}'
```

Copie o `id` retornado (`<ADMIN_ID>`) e insira a linha em `usuarios` (via REST + service role, já que não há policy de INSERT):

```bash
curl -s -X POST "http://127.0.0.1:54321/rest/v1/usuarios" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"id":"<ADMIN_ID>","propriedade_id":"00000000-0000-0000-0000-000000000001","papel":"admin"}'
```

Crie o membro de teste (auth user + pessoa física + linha em usuarios):

```bash
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"membro.teste@ademir.local","password":"senha-membro-123","email_confirm":true}'
```

Copie o `id` retornado (`<MEMBRO_ID>`):

```bash
curl -s -X POST "http://127.0.0.1:54321/rest/v1/pessoas_fisicas" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"id":"10000000-0000-0000-0000-000000000001","propriedade_id":"00000000-0000-0000-0000-000000000001","nome":"Membro Teste","cpf":"11122233344"}'

curl -s -X POST "http://127.0.0.1:54321/rest/v1/usuarios" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"id":"<MEMBRO_ID>","propriedade_id":"00000000-0000-0000-0000-000000000001","pessoa_fisica_id":"10000000-0000-0000-0000-000000000001","papel":"membro_familia"}'
```

- [ ] **Step 7: Verificar navegação condicional**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.teste@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null
echo "--- admin ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard | grep -o 'Perfis de acesso\|Usuários\|Meu plano'

curl -s -c cookies-membro.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=membro.teste@ademir.local" \
  --data-urlencode "password=senha-membro-123" -o /dev/null
echo "--- membro ---"
curl -s -b cookies-membro.txt http://localhost:3000/dashboard | grep -o 'Perfis de acesso\|Usuários\|Meu plano'

kill $DEV_PID
```

Expected: bloco "admin" lista as 3 opções; bloco "membro" lista só "Meu plano".

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat: adiciona helpers de sessao, navegacao condicional e fixtures de teste"
```

---

### Task 2: Meu plano

**Files:**
- Create: `web/app/dashboard/meu-plano/page.tsx`

**Interfaces:**
- Consumes: `createClient`, `getUsuarioAtual`, `MODULOS_NEGOCIO` (Task 1).
- Produces: página somente leitura, sem consumidores futuros.

- [ ] **Step 1: Criar `web/app/dashboard/meu-plano/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { MODULOS_NEGOCIO } from '@/lib/modulos'
import { redirect } from 'next/navigation'

export default async function MeuPlanoPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const supabase = await createClient()
  const { data: modulosContratados } = await supabase
    .from('propriedade_modulos_contratados')
    .select('modulo, ativo')
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  const contratados = new Map((modulosContratados ?? []).map((m) => [m.modulo, m.ativo]))

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">Meu plano</h1>
      <ul className="flex flex-col gap-2">
        {MODULOS_NEGOCIO.map((modulo) => {
          const ativo = contratados.get(modulo.valor) ?? false
          return (
            <li
              key={modulo.valor}
              className="flex items-center justify-between rounded-lg border border-input px-3 py-2"
            >
              <span>{modulo.rotulo}</span>
              <span className={ativo ? 'text-primary' : 'text-muted-foreground'}>
                {ativo ? 'Contratado' : 'Não contratado'}
              </span>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 3: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.teste@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

curl -s -b cookies-admin.txt http://localhost:3000/dashboard/meu-plano | grep -c "Contratado"

kill $DEV_PID
```

Expected: `7` (os 7 módulos já seedados como contratados para a propriedade de teste).

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: adiciona tela meu plano"
```

---

### Task 3: Perfis de acesso — listar e criar

**Files:**
- Create: `web/components/ui/select.tsx`
- Create: `web/app/dashboard/perfis/page.tsx`
- Create: `web/app/dashboard/perfis/novo/page.tsx`
- Create: `web/app/api/perfis/route.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `getUsuarioAtual`, `ehAdminOuDev`, `mensagemErro`, `MODULOS_NEGOCIO` (Task 1).
- Produces: `Select` (`@/components/ui/select`) — usado pelas Tasks 5 e 6.

- [ ] **Step 1: Criar `web/components/ui/select.tsx`**

Não usa o `Select` do shadcn/Radix (que depende de JavaScript para funcionar como listbox) — é um `<select>` nativo estilizado, coerente com os formulários sem JS já usados no projeto:

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export { Select }
```

- [ ] **Step 2: Criar `web/app/dashboard/perfis/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

export default async function PerfisPage() {
  const usuarioAtual = await requireAdmin()
  const supabase = await createClient()

  const { data: perfis } = await supabase
    .from('perfis_acesso')
    .select('id, nome, perfil_acesso_permissoes(modulo, pode_ver, pode_lancar)')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Perfis de acesso</h1>
        <Link href="/dashboard/perfis/novo" className={buttonVariants({ variant: 'default' })}>
          Novo perfil
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {(perfis ?? []).map((perfil) => (
          <li key={perfil.id} className="rounded-lg border border-input p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{perfil.nome}</span>
              <Link href={`/dashboard/perfis/${perfil.id}/editar`} className="text-sm underline">
                Editar
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              {perfil.perfil_acesso_permissoes.length} módulo(s) configurado(s)
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 3: Criar `web/app/dashboard/perfis/novo/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { MODULOS_NEGOCIO } from '@/lib/modulos'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function NovoPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await requireAdmin()
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: contratados } = await supabase
    .from('propriedade_modulos_contratados')
    .select('modulo')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .eq('ativo', true)

  const modulosDisponiveis = MODULOS_NEGOCIO.filter((modulo) =>
    (contratados ?? []).some((c) => c.modulo === modulo.valor)
  )

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Novo perfil de acesso</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/perfis" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome do perfil</Label>
              <Input id="nome" name="nome" required />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Módulos</span>
              {modulosDisponiveis.map((modulo) => (
                <div
                  key={modulo.valor}
                  className="flex items-center gap-4 rounded-lg border border-input p-2"
                >
                  <span className="flex-1">{modulo.rotulo}</span>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name={`ver_${modulo.valor}`} />
                    Ver
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name={`lancar_${modulo.valor}`} />
                    Lançar
                  </label>
                </div>
              ))}
            </div>
            <Button type="submit">Criar perfil</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 4: Criar `web/app/api/perfis/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { MODULOS_NEGOCIO } from '@/lib/modulos'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const nome = String(formData.get('nome') ?? '').trim()

  if (!nome) {
    return NextResponse.redirect(
      new URL('/dashboard/perfis/novo?error=nome_obrigatorio', request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const { data: perfil, error: erroPerfil } = await supabase
    .from('perfis_acesso')
    .insert({ propriedade_id: usuarioAtual.propriedade_id, nome })
    .select('id')
    .single()

  if (erroPerfil || !perfil) {
    return NextResponse.redirect(
      new URL('/dashboard/perfis/novo?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  const permissoes = MODULOS_NEGOCIO.filter(
    (modulo) => formData.get(`ver_${modulo.valor}`) || formData.get(`lancar_${modulo.valor}`)
  ).map((modulo) => ({
    perfil_acesso_id: perfil.id,
    modulo: modulo.valor,
    pode_ver: formData.get(`ver_${modulo.valor}`) !== null,
    pode_lancar: formData.get(`lancar_${modulo.valor}`) !== null,
  }))

  if (permissoes.length > 0) {
    await supabase.from('perfil_acesso_permissoes').insert(permissoes)
  }

  return NextResponse.redirect(new URL('/dashboard/perfis', request.url), { status: 303 })
}
```

- [ ] **Step 5: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 6: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.teste@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- criar perfil ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/perfis \
  --data-urlencode "nome=Perfil Financeiro" \
  --data-urlencode "ver_financeiro_negocio=on" | head -n 1

echo "--- membro nao deve conseguir acessar a pagina ---"
curl -s -c cookies-membro.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=membro.teste@ademir.local" \
  --data-urlencode "password=senha-membro-123" -o /dev/null
curl -s -i -b cookies-membro.txt http://localhost:3000/dashboard/perfis | head -n 1

kill $DEV_PID
```

Expected: primeiro bloco `HTTP/1.1 303 See Other` com `location: /dashboard/perfis`; segundo bloco `HTTP/1.1 307 Temporary Redirect` com `location: /dashboard` (membro barrado pelo `requireAdmin()`).

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: adiciona listagem e criacao de perfis de acesso"
```

---

### Task 4: Perfis de acesso — editar e excluir

**Files:**
- Create: `web/app/dashboard/perfis/[id]/editar/page.tsx`
- Create: `web/app/api/perfis/[id]/editar/route.ts`
- Create: `web/app/api/perfis/[id]/excluir/route.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `getUsuarioAtual`, `ehAdminOuDev`, `mensagemErro`, `MODULOS_NEGOCIO` (Task 1), `Select` (Task 3).

- [ ] **Step 1: Criar `web/app/dashboard/perfis/[id]/editar/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { MODULOS_NEGOCIO } from '@/lib/modulos'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notFound } from 'next/navigation'

export default async function EditarPerfilPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await requireAdmin()
  const { id } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: perfil } = await supabase
    .from('perfis_acesso')
    .select('id, nome, perfil_acesso_permissoes(modulo, pode_ver, pode_lancar)')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!perfil) {
    notFound()
  }

  const { data: contratados } = await supabase
    .from('propriedade_modulos_contratados')
    .select('modulo')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .eq('ativo', true)

  const modulosDisponiveis = MODULOS_NEGOCIO.filter((modulo) =>
    (contratados ?? []).some((c) => c.modulo === modulo.valor)
  )

  const permissoesPorModulo = new Map(perfil.perfil_acesso_permissoes.map((p) => [p.modulo, p]))

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Editar perfil de acesso</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form
            method="POST"
            action={`/api/perfis/${perfil.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome do perfil</Label>
              <Input id="nome" name="nome" defaultValue={perfil.nome} required />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Módulos</span>
              {modulosDisponiveis.map((modulo) => {
                const atual = permissoesPorModulo.get(modulo.valor)
                return (
                  <div
                    key={modulo.valor}
                    className="flex items-center gap-4 rounded-lg border border-input p-2"
                  >
                    <span className="flex-1">{modulo.rotulo}</span>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        name={`ver_${modulo.valor}`}
                        defaultChecked={atual?.pode_ver ?? false}
                      />
                      Ver
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        name={`lancar_${modulo.valor}`}
                        defaultChecked={atual?.pode_lancar ?? false}
                      />
                      Lançar
                    </label>
                  </div>
                )
              })}
            </div>
            <Button type="submit">Salvar</Button>
          </form>
          <form method="POST" action={`/api/perfis/${perfil.id}/excluir`} className="mt-4">
            <Button type="submit" variant="destructive">
              Excluir perfil
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/perfis/[id]/editar/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { MODULOS_NEGOCIO } from '@/lib/modulos'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const nome = String(formData.get('nome') ?? '').trim()

  if (!nome) {
    return NextResponse.redirect(
      new URL(`/dashboard/perfis/${id}/editar?error=nome_obrigatorio`, request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const { error: erroUpdate } = await supabase
    .from('perfis_acesso')
    .update({ nome })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    return NextResponse.redirect(
      new URL(`/dashboard/perfis/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  await supabase.from('perfil_acesso_permissoes').delete().eq('perfil_acesso_id', id)

  const permissoes = MODULOS_NEGOCIO.filter(
    (modulo) => formData.get(`ver_${modulo.valor}`) || formData.get(`lancar_${modulo.valor}`)
  ).map((modulo) => ({
    perfil_acesso_id: id,
    modulo: modulo.valor,
    pode_ver: formData.get(`ver_${modulo.valor}`) !== null,
    pode_lancar: formData.get(`lancar_${modulo.valor}`) !== null,
  }))

  if (permissoes.length > 0) {
    await supabase.from('perfil_acesso_permissoes').insert(permissoes)
  }

  return NextResponse.redirect(new URL('/dashboard/perfis', request.url), { status: 303 })
}
```

- [ ] **Step 3: Criar `web/app/api/perfis/[id]/excluir/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const supabase = await createClient()
  await supabase
    .from('perfis_acesso')
    .delete()
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  return NextResponse.redirect(new URL('/dashboard/perfis', request.url), { status: 303 })
}
```

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.teste@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

PERFIL_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/perfis | grep -o '/dashboard/perfis/[^/]*/editar' | head -n 1 | sed -E 's#/dashboard/perfis/([^/]*)/editar#\1#')
echo "PERFIL_ID=$PERFIL_ID"

echo "--- editar ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/perfis/$PERFIL_ID/editar" \
  --data-urlencode "nome=Perfil Financeiro Editado" \
  --data-urlencode "ver_financeiro_negocio=on" \
  --data-urlencode "lancar_financeiro_negocio=on" | head -n 1

echo "--- excluir ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/perfis/$PERFIL_ID/excluir" | head -n 1

kill $DEV_PID
```

Expected: ambos `HTTP/1.1 303 See Other` com `location: /dashboard/perfis`.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona edicao e exclusao de perfis de acesso"
```

---

### Task 5: Client de service role e criação de usuário

**Files:**
- Create: `web/lib/supabase/service.ts`
- Create: `web/app/dashboard/usuarios/novo/page.tsx`
- Create: `web/app/api/admin/usuarios/route.ts`

**Interfaces:**
- Consumes: `createClient`, `requireAdmin`, `getUsuarioAtual`, `ehAdminOuDev`, `mensagemErro` (Task 1), `Select` (Task 3).
- Produces: `createServiceRoleClient()` de `@/lib/supabase/service` — usada pelas Tasks 6 e 7 (resetar senha, desativar, reativar).

- [ ] **Step 1: Criar `web/lib/supabase/service.ts`**

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

- [ ] **Step 2: Criar `web/app/dashboard/usuarios/novo/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

export default async function NovoUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await requireAdmin()
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()

  const { data: pessoas } = await supabase
    .from('pessoas_fisicas')
    .select('id, nome, cpf')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  const { data: usuariosExistentes } = await supabase
    .from('usuarios')
    .select('pessoa_fisica_id')
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  const idsComUsuario = new Set((usuariosExistentes ?? []).map((u) => u.pessoa_fisica_id))
  const pessoasSemUsuario = (pessoas ?? []).filter((p) => !idsComUsuario.has(p.id))

  const { data: perfis } = await supabase
    .from('perfis_acesso')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/admin/usuarios" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Pessoa</span>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="modo" value="existente" defaultChecked />
                Pessoa já cadastrada
              </label>
              <Select name="pessoa_fisica_id" defaultValue="">
                <option value="" disabled>
                  Selecione uma pessoa
                </option>
                {pessoasSemUsuario.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome} ({pessoa.cpf})
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="modo" value="novo" />
                Pessoa nova
              </label>
              <div className="flex flex-col gap-2 pl-6">
                <Label htmlFor="nome_novo">Nome</Label>
                <Input id="nome_novo" name="nome_novo" />
                <Label htmlFor="cpf_novo">CPF</Label>
                <Input id="cpf_novo" name="cpf_novo" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha inicial</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="perfil_acesso_id">Perfil de acesso</Label>
              <Select id="perfil_acesso_id" name="perfil_acesso_id" required defaultValue="">
                <option value="" disabled>
                  Selecione um perfil
                </option>
                {(perfis ?? []).map((perfil) => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.nome}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Criar usuário</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Criar `web/app/api/admin/usuarios/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const modo = String(formData.get('modo') ?? '')
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const perfilAcessoId = String(formData.get('perfil_acesso_id') ?? '')

  if (!email || !password || password.length < 6 || !perfilAcessoId) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios/novo?error=dados_invalidos', request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()

  const { data: perfil } = await supabase
    .from('perfis_acesso')
    .select('id')
    .eq('id', perfilAcessoId)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!perfil) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios/novo?error=perfil_invalido', request.url),
      { status: 303 }
    )
  }

  let pessoaFisicaId: string

  if (modo === 'existente') {
    const pessoaFisicaIdForm = String(formData.get('pessoa_fisica_id') ?? '')
    const { data: pessoa } = await supabase
      .from('pessoas_fisicas')
      .select('id')
      .eq('id', pessoaFisicaIdForm)
      .eq('propriedade_id', usuarioAtual.propriedade_id)
      .maybeSingle()

    if (!pessoa) {
      return NextResponse.redirect(
        new URL('/dashboard/usuarios/novo?error=pessoa_invalida', request.url),
        { status: 303 }
      )
    }
    pessoaFisicaId = pessoa.id
  } else {
    const nomeNovo = String(formData.get('nome_novo') ?? '').trim()
    const cpfNovo = String(formData.get('cpf_novo') ?? '').trim()

    if (!nomeNovo || !cpfNovo) {
      return NextResponse.redirect(
        new URL('/dashboard/usuarios/novo?error=nome_obrigatorio', request.url),
        { status: 303 }
      )
    }

    const { data: pessoaNova, error: erroPessoa } = await supabase
      .from('pessoas_fisicas')
      .insert({ propriedade_id: usuarioAtual.propriedade_id, nome: nomeNovo, cpf: cpfNovo })
      .select('id')
      .single()

    if (erroPessoa || !pessoaNova) {
      return NextResponse.redirect(
        new URL('/dashboard/usuarios/novo?error=cpf_duplicado', request.url),
        { status: 303 }
      )
    }
    pessoaFisicaId = pessoaNova.id
  }

  const serviceClient = createServiceRoleClient()
  const { data: authData, error: erroAuth } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (erroAuth || !authData.user) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios/novo?error=email_duplicado', request.url),
      { status: 303 }
    )
  }

  const { error: erroUsuario } = await serviceClient.from('usuarios').insert({
    id: authData.user.id,
    propriedade_id: usuarioAtual.propriedade_id,
    pessoa_fisica_id: pessoaFisicaId,
    perfil_acesso_id: perfilAcessoId,
    papel: 'membro_familia',
    ativo: true,
  })

  if (erroUsuario) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios/novo?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/usuarios', request.url), { status: 303 })
}
```

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl (criar usuário com pessoa nova)**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.teste@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

# cria um perfil novo para este teste — a Task 4 ja deve ter excluido o perfil
# criado na Task 3 durante a sua propria verificacao, entao nao reaproveite IDs
# de tasks anteriores
curl -s -b cookies-admin.txt -X POST http://localhost:3000/api/perfis \
  --data-urlencode "nome=Perfil Task 5" \
  --data-urlencode "ver_financeiro_negocio=on" -o /dev/null

PERFIL_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/perfis | grep -o '/dashboard/perfis/[^/]*/editar' | head -n 1 | sed -E 's#/dashboard/perfis/([^/]*)/editar#\1#')

curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/admin/usuarios \
  --data-urlencode "modo=novo" \
  --data-urlencode "nome_novo=Novo Membro" \
  --data-urlencode "cpf_novo=99988877766" \
  --data-urlencode "email=novo.membro@ademir.local" \
  --data-urlencode "password=senha-novo-123" \
  --data-urlencode "perfil_acesso_id=$PERFIL_ID" | head -n 1

echo "--- login do novo usuario deve funcionar ---"
curl -s -i -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=novo.membro@ademir.local" \
  --data-urlencode "password=senha-novo-123" | head -n 1

kill $DEV_PID
```

Expected: primeiro bloco `HTTP/1.1 303 See Other` com `location: /dashboard/usuarios`; segundo bloco `HTTP/1.1 303 See Other` com `location: /dashboard` (login funcionando com a senha definida na criação).

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona client de service role e criacao de usuario"
```

---

### Task 6: Usuários — listar e trocar perfil

**Files:**
- Create: `web/app/dashboard/usuarios/page.tsx`
- Create: `web/app/dashboard/usuarios/[id]/editar/page.tsx`
- Create: `web/app/api/admin/usuarios/[id]/perfil/route.ts`

**Interfaces:**
- Consumes: `createClient`, `requireAdmin`, `getUsuarioAtual`, `ehAdminOuDev`, `mensagemErro` (Task 1), `Select` (Task 3).
- Produces: página `/dashboard/usuarios/[id]/editar` — a Task 7 adiciona os forms de resetar senha e desativar/reativar nesta mesma página.

- [ ] **Step 1: Criar `web/app/dashboard/usuarios/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

export default async function UsuariosPage() {
  const usuarioAtual = await requireAdmin()
  const supabase = await createClient()

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, papel, ativo, pessoas_fisicas(nome), perfis_acesso(nome)')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('created_at')

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Usuários</h1>
        <Link href="/dashboard/usuarios/novo" className={buttonVariants({ variant: 'default' })}>
          Novo usuário
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {(usuarios ?? []).map((usuario) => (
          <li
            key={usuario.id}
            className="flex items-center justify-between rounded-lg border border-input p-3"
          >
            <div>
              <p className="font-medium">{usuario.pessoas_fisicas?.nome ?? '(sem pessoa vinculada)'}</p>
              <p className="text-sm text-muted-foreground">
                {usuario.papel} · {usuario.perfis_acesso?.nome ?? 'sem perfil'} ·{' '}
                {usuario.ativo ? 'ativo' : 'inativo'}
              </p>
            </div>
            <Link href={`/dashboard/usuarios/${usuario.id}/editar`} className="text-sm underline">
              Gerenciar
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/dashboard/usuarios/[id]/editar/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/current-usuario'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { notFound } from 'next/navigation'

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await requireAdmin()
  const { id } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, papel, ativo, perfil_acesso_id, pessoas_fisicas(nome)')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!usuario) {
    notFound()
  }

  const { data: perfis } = await supabase
    .from('perfis_acesso')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{usuario.pessoas_fisicas?.nome ?? 'Usuário'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form
            method="POST"
            action={`/api/admin/usuarios/${usuario.id}/perfil`}
            className="flex flex-col gap-2"
          >
            <Label htmlFor="perfil_acesso_id">Perfil de acesso</Label>
            <Select
              id="perfil_acesso_id"
              name="perfil_acesso_id"
              defaultValue={usuario.perfil_acesso_id ?? ''}
            >
              <option value="">Sem perfil</option>
              {(perfis ?? []).map((perfil) => (
                <option key={perfil.id} value={perfil.id}>
                  {perfil.nome}
                </option>
              ))}
            </Select>
            <Button type="submit">Salvar perfil</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Criar `web/app/api/admin/usuarios/[id]/perfil/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const perfilAcessoIdForm = String(formData.get('perfil_acesso_id') ?? '')
  const perfilAcessoId = perfilAcessoIdForm === '' ? null : perfilAcessoIdForm

  const supabase = await createClient()

  if (perfilAcessoId) {
    const { data: perfil } = await supabase
      .from('perfis_acesso')
      .select('id')
      .eq('id', perfilAcessoId)
      .eq('propriedade_id', usuarioAtual.propriedade_id)
      .maybeSingle()

    if (!perfil) {
      return NextResponse.redirect(
        new URL(`/dashboard/usuarios/${id}/editar?error=perfil_invalido`, request.url),
        { status: 303 }
      )
    }
  }

  await supabase
    .from('usuarios')
    .update({ perfil_acesso_id: perfilAcessoId })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  return NextResponse.redirect(new URL(`/dashboard/usuarios/${id}/editar`, request.url), {
    status: 303,
  })
}
```

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.teste@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

MEMBRO_USUARIO_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/usuarios | grep -o '/dashboard/usuarios/[^/]*/editar' | head -n 1 | sed -E 's#/dashboard/usuarios/([^/]*)/editar#\1#')
echo "MEMBRO_USUARIO_ID=$MEMBRO_USUARIO_ID"

curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/admin/usuarios/$MEMBRO_USUARIO_ID/perfil" \
  --data-urlencode "perfil_acesso_id=" | head -n 1

kill $DEV_PID
```

Expected: `HTTP/1.1 303 See Other` com `location: /dashboard/usuarios/<id>/editar`.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona listagem de usuarios e troca de perfil"
```

---

### Task 7: Usuários — resetar senha e desativar/reativar

**Files:**
- Modify: `web/app/dashboard/usuarios/[id]/editar/page.tsx`
- Create: `web/app/api/admin/usuarios/[id]/resetar-senha/route.ts`
- Create: `web/app/api/admin/usuarios/[id]/desativar/route.ts`
- Create: `web/app/api/admin/usuarios/[id]/reativar/route.ts`

**Interfaces:**
- Consumes: `createClient`, `createServiceRoleClient` (Task 5), `getUsuarioAtual`, `ehAdminOuDev` (Task 1).

- [ ] **Step 1: Editar `web/app/dashboard/usuarios/[id]/editar/page.tsx`** — adicionar os imports `Input` e os dois forms novos dentro do `CardContent`, depois do form de perfil já existente:

```tsx
import { Input } from '@/components/ui/input'
```

(adicionar ao lado dos imports já existentes)

```tsx
          <form
            method="POST"
            action={`/api/admin/usuarios/${usuario.id}/resetar-senha`}
            className="flex flex-col gap-2"
          >
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
            <Button type="submit" variant="outline">
              Resetar senha
            </Button>
          </form>

          <form
            method="POST"
            action={`/api/admin/usuarios/${usuario.id}/${usuario.ativo ? 'desativar' : 'reativar'}`}
          >
            <Button type="submit" variant={usuario.ativo ? 'destructive' : 'default'}>
              {usuario.ativo ? 'Desativar usuário' : 'Reativar usuário'}
            </Button>
          </form>
```

(adicionar logo após o `</form>` de fechamento do form de "Salvar perfil", ainda dentro do `CardContent`)

- [ ] **Step 2: Criar `web/app/api/admin/usuarios/[id]/resetar-senha/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const password = String(formData.get('password') ?? '')

  if (password.length < 6) {
    return NextResponse.redirect(
      new URL(`/dashboard/usuarios/${id}/editar?error=senha_curta`, request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const { data: usuarioAlvo } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!usuarioAlvo) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios?error=usuario_nao_encontrado', request.url),
      { status: 303 }
    )
  }

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient.auth.admin.updateUserById(id, { password })

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/usuarios/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL(`/dashboard/usuarios/${id}/editar`, request.url), {
    status: 303,
  })
}
```

- [ ] **Step 3: Criar `web/app/api/admin/usuarios/[id]/desativar/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const supabase = await createClient()
  const { data: usuarioAlvo } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!usuarioAlvo) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios?error=usuario_nao_encontrado', request.url),
      { status: 303 }
    )
  }

  const serviceClient = createServiceRoleClient()
  const { error: erroBan } = await serviceClient.auth.admin.updateUserById(id, {
    ban_duration: '876000h',
  })

  if (erroBan) {
    return NextResponse.redirect(
      new URL(`/dashboard/usuarios/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  await supabase
    .from('usuarios')
    .update({ ativo: false })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  return NextResponse.redirect(new URL(`/dashboard/usuarios/${id}/editar`, request.url), {
    status: 303,
  })
}
```

- [ ] **Step 4: Criar `web/app/api/admin/usuarios/[id]/reativar/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getUsuarioAtual, ehAdminOuDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!ehAdminOuDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const supabase = await createClient()
  const { data: usuarioAlvo } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!usuarioAlvo) {
    return NextResponse.redirect(
      new URL('/dashboard/usuarios?error=usuario_nao_encontrado', request.url),
      { status: 303 }
    )
  }

  const serviceClient = createServiceRoleClient()
  const { error: erroUnban } = await serviceClient.auth.admin.updateUserById(id, {
    ban_duration: 'none',
  })

  if (erroUnban) {
    return NextResponse.redirect(
      new URL(`/dashboard/usuarios/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  await supabase
    .from('usuarios')
    .update({ ativo: true })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  return NextResponse.redirect(new URL(`/dashboard/usuarios/${id}/editar`, request.url), {
    status: 303,
  })
}
```

- [ ] **Step 5: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 6: Verificar via curl (ciclo completo: reset de senha, desativar, reativar)**

Use o `MEMBRO_USUARIO_ID` já usado na Task 6 (o usuário `membro.teste@ademir.local` da Task 1), e reaproveite o login do admin de teste.

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.teste@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

MEMBRO_USUARIO_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/usuarios | grep -o '/dashboard/usuarios/[^/]*/editar' | head -n 1 | sed -E 's#/dashboard/usuarios/([^/]*)/editar#\1#')

echo "--- resetar senha ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/admin/usuarios/$MEMBRO_USUARIO_ID/resetar-senha" \
  --data-urlencode "password=senha-membro-nova-123" | head -n 1

echo "--- login com senha antiga deve falhar ---"
curl -s -i -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=membro.teste@ademir.local" \
  --data-urlencode "password=senha-membro-123" | grep -i location

echo "--- login com senha nova deve funcionar ---"
curl -s -i -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=membro.teste@ademir.local" \
  --data-urlencode "password=senha-membro-nova-123" | grep -i location

echo "--- desativar ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/admin/usuarios/$MEMBRO_USUARIO_ID/desativar" | head -n 1

echo "--- login apos desativar deve falhar ---"
curl -s -i -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=membro.teste@ademir.local" \
  --data-urlencode "password=senha-membro-nova-123" | grep -i location

echo "--- reativar ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/admin/usuarios/$MEMBRO_USUARIO_ID/reativar" | head -n 1

echo "--- login apos reativar deve funcionar de novo ---"
curl -s -i -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=membro.teste@ademir.local" \
  --data-urlencode "password=senha-membro-nova-123" | grep -i location

kill $DEV_PID
```

Expected: reset de senha → `303`; login com senha antiga → `location: /login?error=credenciais_invalidas` (ainda usa `?error=1` até a Task 8 — trate como falha de login de qualquer forma, o que importa é não ser `/dashboard`); login com senha nova → `location: /dashboard`; desativar → `303`; login após desativar → `location: /login...` (falha, usuário banido); reativar → `303`; login após reativar → `location: /dashboard` de novo.

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: adiciona reset de senha e desativacao/reativacao de usuario"
```

---

### Task 8: Fix do login — feedback de erro

**Files:**
- Modify: `web/app/login/page.tsx`
- Modify: `web/app/api/auth/login/route.ts`

**Interfaces:**
- Consumes: `mensagemErro` (Task 1).

- [ ] **Step 1: Editar `web/app/api/auth/login/route.ts`** — trocar o código de erro genérico pelo código correto:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=credenciais_invalidas', request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 })
}
```

- [ ] **Step 2: Editar `web/app/login/page.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mensagemErro } from '@/lib/erros-formulario'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/auth/login" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit">Entrar</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 4: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -i -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.teste@ademir.local" \
  --data-urlencode "password=senha-errada" | grep -i location

curl -s "http://localhost:3000/login?error=credenciais_invalidas" | grep -o "E-mail ou senha inválidos"

kill $DEV_PID
```

Expected: primeira linha mostra `location: /login?error=credenciais_invalidas`; segunda confirma a mensagem renderizada na página.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "fix: adiciona feedback de erro na pagina de login"
```
