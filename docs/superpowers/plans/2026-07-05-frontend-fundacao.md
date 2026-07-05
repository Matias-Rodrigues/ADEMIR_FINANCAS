# Fundação do Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o esqueleto/fundação do app web do CRM ADEMIR_FINANÇAS — projeto Next.js configurado, autenticação básica funcional (login/logout via Supabase Auth), proteção de rotas, tipos TypeScript gerados do schema real, e instalabilidade PWA — conforme `docs/superpowers/specs/2026-07-05-frontend-stack-design.md`. Não inclui as telas de negócio da Task 2 do roteiro geral (administração de usuários), que terá plano próprio.

**Architecture:** Projeto Next.js (App Router) + TypeScript na pasta `web/`, na raiz do repositório, ao lado de `supabase/`. Autenticação e acesso a dados usam `@supabase/ssr` com três clients dedicados (`web/lib/supabase/client.ts` para o navegador, `web/lib/supabase/server.ts` para Server Components/Route Handlers, `web/lib/supabase/middleware.ts` para o middleware) — todos falando direto com o Supabase local via RLS, sem API própria. Login e logout são Route Handlers simples (POST + redirect), o que permite verificar o fluxo inteiro via `curl` com cookie jar, sem precisar de navegador nem de framework de teste. UI usa Tailwind + shadcn/ui. Instalabilidade PWA usa as convenções nativas do Next.js (`app/manifest.ts` + ícones gerados via `next/og` em Route Handlers) — sem service worker de cache/offline.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + `@supabase/supabase-js` + `@supabase/ssr`, Node v24 / npm 11 (já instalados no ambiente). Supabase CLI local (`npx supabase`, já em uso pelo backend) fornece a instância de desenvolvimento.

## Global Constraints

- **Sem service worker / cache offline** — decisão explícita da spec (app sempre tem internet no uso real).
- **Frontend fala direto com o Supabase** via `supabase-js`/`ssr`; a única exceção prevista (Route Handler usando a *service role key* para operações administrativas, ex: criar usuário) fica para o plano da Task 2 — não é implementada aqui.
- **Sem suite de testes automatizados de frontend** — decisão explícita da spec. A rede de segurança de cada task é: `npm run build` / `npx tsc --noEmit` (TypeScript pega erro antes de rodar) + verificação via `curl` dos endpoints/páginas criados.
- Nenhuma migration ou policy já aprovada em `supabase/` é alterada por este plano — só leitura via tipos gerados (`supabase gen types`).
- O Supabase local precisa estar rodando para qualquer step de verificação que dependa do banco: `npx supabase status` (rodado da raiz do repositório) confirma; se não estiver, `npx supabase start` primeiro. Se o schema local estiver desatualizado, `npx supabase db reset` aplica todas as migrations do zero.
- Todo comando de `npm`/`npx` específico do frontend roda dentro de `web/`; comandos do Supabase CLI rodam na raiz do repositório (onde fica `supabase/config.toml`).
- Todo arquivo TypeScript criado usa tipagem explícita (nenhum `any`).

---

### Task 1: Scaffold do projeto Next.js

**Files:**
- Create: `web/` (projeto Next.js completo gerado pelo `create-next-app`)

**Interfaces:**
- Produces: projeto Next.js rodável em `web/` (App Router, TypeScript, Tailwind, ESLint) — base para todas as tasks seguintes.

- [ ] **Step 1: Rodar o scaffold**

Da raiz do repositório:

```bash
npx create-next-app@latest web --typescript --eslint --tailwind --no-src-dir --app --import-alias "@/*" --turbopack --use-npm
```

Expected: cria a pasta `web/` com `package.json`, `app/`, `tailwind.config.*` (ou CSS-based config), `tsconfig.json`, `.gitignore` próprio, e já roda `npm install` automaticamente.

- [ ] **Step 2: Confirmar que não foi criado um `.git` aninhado**

```bash
ls -la web/.git 2>/dev/null && echo "NESTED GIT FOUND" || echo "OK: sem .git aninhado"
```

Expected: `OK: sem .git aninhado`. Se aparecer "NESTED GIT FOUND", rode `rm -rf web/.git` antes de prosseguir.

- [ ] **Step 3: Verificar build**

```bash
cd web && npm run build && cd ..
```

Expected: build conclui com sucesso ("Compiled successfully").

- [ ] **Step 4: Verificar lint**

```bash
cd web && npm run lint && cd ..
```

Expected: sem erros.

- [ ] **Step 5: Verificar que o servidor de dev responde**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill $DEV_PID
```

Expected: imprime `200`.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: scaffold do projeto Next.js do frontend"
```

---

### Task 2: shadcn/ui + componentes base

**Files:**
- Create: `web/components.json`
- Modify: `web/app/globals.css`
- Create: `web/lib/utils.ts`
- Create: `web/components/ui/button.tsx`
- Create: `web/components/ui/input.tsx`
- Create: `web/components/ui/label.tsx`
- Create: `web/components/ui/card.tsx`

**Interfaces:**
- Consumes: projeto Next.js da Task 1.
- Produces: `Button`, `Input`, `Label`, `Card`/`CardHeader`/`CardTitle`/`CardContent` (import de `@/components/ui/*`) — usados pelas Tasks 5 e 6.

- [ ] **Step 1: Inicializar shadcn/ui**

```bash
cd web
npx shadcn@latest init -d
cd ..
```

Expected: cria `web/components.json`, atualiza `web/app/globals.css` (variáveis CSS de tema) e cria `web/lib/utils.ts` (helper `cn`).

- [ ] **Step 2: Adicionar os componentes base**

```bash
cd web
npx shadcn@latest add button input label card -y
cd ..
```

Expected: cria `web/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`.

- [ ] **Step 3: Verificar build**

```bash
cd web && npm run build && cd ..
```

Expected: sucesso.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: adiciona shadcn/ui e componentes base"
```

---

### Task 3: Clients Supabase (browser + server) e variáveis de ambiente

**Files:**
- Create: `web/.env.example`
- Create: `web/.env.local` (não commitado — já ignorado pelo `.gitignore` gerado pelo create-next-app)
- Create: `web/lib/supabase/client.ts`
- Create: `web/lib/supabase/server.ts`
- Create: `web/app/api/health/route.ts`
- Modify: `web/package.json` (novas dependências)

**Interfaces:**
- Consumes: nenhuma (primeira integração com Supabase).
- Produces: `createClient(): SupabaseClient` em `@/lib/supabase/client.ts` (browser); `async createClient(): Promise<SupabaseClient>` em `@/lib/supabase/server.ts` (server) — consumidos pelas Tasks 5, 6 e 7.

- [ ] **Step 1: Instalar dependências**

```bash
cd web
npm install @supabase/supabase-js @supabase/ssr
cd ..
```

- [ ] **Step 2: Confirmar Supabase local rodando e coletar URL/anon key**

Da raiz do repositório:

```bash
npx supabase status
```

Se não estiver rodando, rode `npx supabase start` primeiro. Anote os valores de `API URL` (`http://127.0.0.1:54321`) e `anon key`.

- [ ] **Step 3: Criar `web/.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4: Criar `web/.env.local`**

```bash
cp web/.env.example web/.env.local
```

Edite `web/.env.local` preenchendo `NEXT_PUBLIC_SUPABASE_ANON_KEY` com a `anon key` do Step 2 (e `SUPABASE_SERVICE_ROLE_KEY` com a `service_role key`, ainda não usada nesta task mas documentada para a Task 2 do roteiro geral).

- [ ] **Step 5: Criar `web/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6: Criar `web/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // chamado a partir de um Server Component sem permissão de escrita de cookie —
            // o middleware (Task 4) garante o refresh de sessão nesse caso.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 7: Criar rota de verificação `web/app/api/health/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { error } = await supabase.from('propriedades').select('id').limit(1)
  return NextResponse.json({ ok: !error, error: error?.message ?? null })
}
```

- [ ] **Step 8: Verificar conectividade com o Supabase local**

```bash
npx supabase db reset
(cd web && npm run dev) &
DEV_PID=$!
sleep 5
curl -s http://localhost:3000/api/health
kill $DEV_PID
```

Expected: `{"ok":true,"error":null}`.

- [ ] **Step 9: Commit**

```bash
git add web/
git commit -m "feat: adiciona clients Supabase (browser e server)"
```

---

### Task 4: Middleware — refresh de sessão e proteção de rotas

**Files:**
- Create: `web/lib/supabase/middleware.ts`
- Create: `web/middleware.ts`

**Interfaces:**
- Consumes: variáveis `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Task 3).
- Produces: proteção automática de qualquer rota sob `/dashboard` (redireciona para `/login` sem sessão) e redirecionamento de `/login` para `/dashboard` quando já autenticado — usado pelas Tasks 5 e 6.

- [ ] **Step 1: Criar `web/lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard')
  const isLoginRoute = request.nextUrl.pathname === '/login'

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}
```

- [ ] **Step 2: Criar `web/middleware.ts`**

```ts
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 3: Verificar que rota protegida redireciona sem sessão**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5
curl -s -i http://localhost:3000/dashboard | head -n 1
kill $DEV_PID
```

Expected: primeira linha `HTTP/1.1 307 Temporary Redirect` (a página `/dashboard` ainda não existe — o middleware intercepta antes da resolução de rota, então o redirect acontece mesmo assim).

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: adiciona middleware de sessao e protecao de rotas"
```

---

### Task 5: Login (página + Route Handler)

**Files:**
- Create: `web/app/login/page.tsx`
- Create: `web/app/api/auth/login/route.ts`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server` (Task 3); `Button`, `Input`, `Label`, `Card*` de `@/components/ui/*` (Task 2); proteção de `/login` do middleware (Task 4).
- Produces: fluxo de login completo, testável via `curl` — usado como base pela Task 6 (dashboard).

- [ ] **Step 1: Criar `web/app/login/page.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
        </CardHeader>
        <CardContent>
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

- [ ] **Step 2: Criar `web/app/api/auth/login/route.ts`**

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
    return NextResponse.redirect(new URL('/login?error=1', request.url), { status: 303 })
  }

  return NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 })
}
```

- [ ] **Step 3: Criar um usuário de teste no Supabase local**

Da raiz do repositório, com a `service_role key` obtida em `npx supabase status`:

```bash
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"teste.web@ademir.local","password":"senha-teste-123","email_confirm":true}'
```

Expected: JSON com o `id` do usuário criado.

- [ ] **Step 4: Verificar o login via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5
curl -s -i -c cookies-test.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=teste.web@ademir.local" \
  --data-urlencode "password=senha-teste-123" | head -n 5
kill $DEV_PID
rm -f cookies-test.txt
```

Expected: `HTTP/1.1 303 See Other` com header `location: /dashboard`.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: adiciona pagina e rota de login"
```

---

### Task 6: Dashboard protegido + logout

**Files:**
- Create: `web/app/dashboard/page.tsx`
- Create: `web/app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server` (Task 3), `Button` de `@/components/ui/button` (Task 2), usuário de teste criado na Task 5.
- Produces: ciclo completo login → acesso autenticado → logout, verificável via `curl`.

- [ ] **Step 1: Criar `web/app/dashboard/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <p>Logado como: {user.email}</p>
      <form method="POST" action="/api/auth/logout">
        <Button type="submit" variant="outline">
          Sair
        </Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/auth/logout/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
```

- [ ] **Step 3: Verificar o ciclo completo via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-test.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=teste.web@ademir.local" \
  --data-urlencode "password=senha-teste-123" -o /dev/null

echo "--- dashboard autenticado ---"
curl -s -i -b cookies-test.txt http://localhost:3000/dashboard | head -n 1

curl -s -b cookies-test.txt -c cookies-test.txt -X POST http://localhost:3000/api/auth/logout -o /dev/null

echo "--- dashboard apos logout ---"
curl -s -i -b cookies-test.txt http://localhost:3000/dashboard | head -n 1

kill $DEV_PID
rm -f cookies-test.txt
```

Expected: "dashboard autenticado" → `HTTP/1.1 200 OK`; "dashboard apos logout" → `HTTP/1.1 307 Temporary Redirect`.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: adiciona dashboard protegido e logout"
```

---

### Task 7: Tipos TypeScript gerados do schema Supabase

**Files:**
- Create: `web/lib/supabase/database.types.ts`
- Modify: `web/lib/supabase/client.ts`
- Modify: `web/lib/supabase/server.ts`

**Interfaces:**
- Consumes: schema atual do Supabase local (todas as migrations em `supabase/migrations/`).
- Produces: tipo `Database` exportado de `@/lib/supabase/database.types.ts`, usado como generic pelos dois clients — qualquer código futuro que use `createClient()` ganha autocomplete e checagem de tipos contra o schema real.

- [ ] **Step 1: Gerar os tipos**

Da raiz do repositório, com o Supabase local rodando e atualizado (`npx supabase db reset` se necessário):

```bash
npx supabase gen types typescript --local > web/lib/supabase/database.types.ts
```

Expected: arquivo criado contendo `export type Database = { ... }` com as tabelas reais (`propriedades`, `usuarios`, `propriedade_modulos_contratados`, etc.).

- [ ] **Step 2: Usar o tipo no client do navegador**

Editar `web/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Usar o tipo no client do servidor**

Editar `web/lib/supabase/server.ts` — adicionar o import e trocar `createServerClient(` por `createServerClient<Database>(` (resto do arquivo permanece igual):

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // chamado a partir de um Server Component sem permissão de escrita de cookie —
            // o middleware (Task 4) garante o refresh de sessão nesse caso.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Confirmar baseline limpa**

```bash
cd web && npx tsc --noEmit && cd ..
```

Expected: sem erros, sem output.

- [ ] **Step 5: Provar que a checagem de tipos funciona (quebrar de propósito)**

Editar temporariamente `web/app/api/health/route.ts`, trocando `.select('id')` por `.select('coluna_inexistente')`.

```bash
cd web && npx tsc --noEmit ; cd ..
```

Expected: erro de tipo mencionando `coluna_inexistente` não existir no tipo da tabela `propriedades`.

- [ ] **Step 6: Reverter a quebra de propósito**

Editar `web/app/api/health/route.ts` de volta para `.select('id')`.

```bash
cd web && npx tsc --noEmit && cd ..
```

Expected: sem erros novamente.

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: gera tipos TypeScript do schema Supabase e integra aos clients"
```

---

### Task 8: PWA instalável (manifest + ícones)

**Files:**
- Create: `web/app/manifest.ts`
- Create: `web/app/icon-192/route.tsx`
- Create: `web/app/icon-512/route.tsx`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `/manifest.webmanifest`, `/icon-192`, `/icon-512` servidos pelo Next.js, com `<link rel="manifest">` injetado automaticamente no `<head>`.

- [ ] **Step 1: Criar `web/app/icon-192/route.tsx`**

```tsx
import { ImageResponse } from 'next/og'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#16a34a',
          color: 'white',
          fontSize: 100,
          fontWeight: 700,
        }}
      >
        A
      </div>
    ),
    { width: 192, height: 192 }
  )
}
```

- [ ] **Step 2: Criar `web/app/icon-512/route.tsx`**

```tsx
import { ImageResponse } from 'next/og'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#16a34a',
          color: 'white',
          fontSize: 260,
          fontWeight: 700,
        }}
      >
        A
      </div>
    ),
    { width: 512, height: 512 }
  )
}
```

- [ ] **Step 3: Criar `web/app/manifest.ts`**

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ademir Finanças',
    short_name: 'Ademir Finanças',
    description: 'CRM de gestão da propriedade rural',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#16a34a',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

- [ ] **Step 4: Verificar**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5
curl -s -o /dev/null -w "manifest: %{http_code}\n" http://localhost:3000/manifest.webmanifest
curl -s -o /dev/null -w "icon-192: %{http_code}\n" http://localhost:3000/icon-192
curl -s -o /dev/null -w "icon-512: %{http_code}\n" http://localhost:3000/icon-512
curl -s http://localhost:3000/ | grep -o 'rel="manifest"[^>]*'
kill $DEV_PID
```

Expected: os três status `200`, e a última linha mostrando a tag `<link rel="manifest" ...>` presente no HTML da home.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: adiciona manifest e icones para instalabilidade PWA"
```

---

### Task 9: Preparação para deploy na Vercel

**Files:**
- Modify: `web/README.md`

**Interfaces:**
- Consumes: todas as tasks anteriores (documenta o resultado final).
- Produces: instruções de setup local e deploy — não gera código novo.

- [ ] **Step 1: Substituir `web/README.md`** (o conteúdo padrão gerado pelo `create-next-app`) por:

```markdown
# Ademir Finanças — Frontend

App Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, consumindo o Supabase do backend (`../supabase/`) via `@supabase/supabase-js` / `@supabase/ssr`.

## Rodando localmente

1. Suba o Supabase local (na raiz do repositório): `npx supabase start`
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` com os valores de `npx supabase status`
3. Instale as dependências: `npm install`
4. Rode: `npm run dev`

## Deploy (Vercel)

1. Crie um projeto Supabase na nuvem (supabase.com) — o projeto local via Docker não é acessível pela internet.
2. Na raiz do repositório, rode `npx supabase link --project-ref <ref-do-projeto>` e depois `npx supabase db push` para aplicar todas as migrations no projeto remoto.
3. Na Vercel, crie um novo projeto apontando para este repositório, com **Root Directory = `web`**.
4. Configure as variáveis de ambiente do projeto na Vercel (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` — URL do projeto Supabase remoto
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key do projeto remoto
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key do projeto remoto (nunca commitar, nunca usar com prefixo `NEXT_PUBLIC_`)
5. Deploy.
```

- [ ] **Step 2: Build de produção final**

```bash
cd web && npm run build && cd ..
```

Expected: sucesso, sem erros.

- [ ] **Step 3: Lint final**

```bash
cd web && npm run lint && cd ..
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "docs: adiciona instrucoes de setup e deploy do frontend"
```
