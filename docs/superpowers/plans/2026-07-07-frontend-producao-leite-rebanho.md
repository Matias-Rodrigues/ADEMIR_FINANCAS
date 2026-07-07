# Telas de Produção de Leite e Rebanho Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir as 3 telas do módulo de Produção — lançamento diário de leite, movimentação de rebanho, e relatório mensal — conforme `docs/superpowers/specs/2026-07-07-frontend-producao-leite-rebanho-design.md`, sobre o schema já aprovado em `docs/superpowers/specs/2026-07-07-producao-leite-rebanho-design.md`.

**Architecture:** Mesmo padrão já usado no módulo de administração de usuários — Route Handlers HTML puro (`method="POST"` + redirect `?error=<codigo>`), testável via `curl` com cookie jar, sem JavaScript. Novidade: primeiro módulo onde o acesso depende de `tem_permissao()` do banco (não só `papel`), via um novo helper `web/lib/auth/tem-permissao.ts`.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui (fundação já pronta), `@supabase/supabase-js`/`@supabase/ssr`.

## Global Constraints

- **Toda mutação é Route Handler HTML puro** (`method="POST"`), sem JavaScript no cliente — formulário de movimentação de rebanho mostra todos os campos sempre, sem esconder/mostrar dinamicamente.
- **Sem suite de testes automatizados de frontend** — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- **Toda query filtra `unidades_negocio.tipo = 'leite'`** — nunca assume "a única/primeira unidade", mesmo havendo hoje só uma. Isso exclui suínos corretamente por construção.
- **`categoria_origem` só é gravado quando `tipo = 'mudanca_categoria'`** — os demais tipos ignoram esse campo mesmo se vier preenchido no formulário.
- **Sem edição de movimentações de rebanho já lançadas** — diferente do lançamento de leite, que aceita edição via upsert.
- Todo comando `npm`/`npx` do frontend roda dentro de `web/`; comandos do Supabase CLI rodam na raiz do repositório.
- O Supabase local precisa estar rodando (`npx supabase status` na raiz).

### Fixtures de teste (criadas na Task 1, reutilizadas por todas as tasks seguintes)

A propriedade seedada (`supabase/seed.sql`) é `00000000-0000-0000-0000-000000000001` ("Propriedade Ademir"), com o módulo `producao` já contratado e a unidade de negócio "Gado leiteiro" já seedada (`00000000-0000-0000-0000-000000000002`, `tipo = 'leite'`). A Task 1 cria um usuário admin de teste: `admin.producao@ademir.local` / `senha-admin-123`, papel `admin`.

---

### Task 1: Tipos, helper de permissão, navegação e fixtures

**Files:**
- Modify: `web/lib/supabase/database.types.ts` (regenerado)
- Create: `web/lib/auth/tem-permissao.ts`
- Create: `web/lib/producao/unidade-negocio.ts`
- Create: `web/app/dashboard/producao/page.tsx`
- Modify: `web/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`, `getUsuarioAtual` de `@/lib/auth/current-usuario` (já existentes).
- Produces: `temPermissao(modulo: string, acao: 'ver' | 'lancar'): Promise<boolean>` de `@/lib/auth/tem-permissao` — usada por todas as tasks seguintes; `getUnidadeNegocioLeiteId(supabase, propriedadeId: string): Promise<string | null>` de `@/lib/producao/unidade-negocio` — usada pelas Tasks 2, 3 e 4.

- [ ] **Step 1: Criar o admin de teste**

Da raiz do repositório, com o Supabase local rodando:

```bash
npx supabase status
```

Anote `API_URL` e `SERVICE_ROLE_KEY`. Crie o admin de teste:

```bash
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.producao@ademir.local","password":"senha-admin-123","email_confirm":true}'
```

Copie o `id` retornado (`<ADMIN_ID>`) e insira a linha em `usuarios`:

```bash
curl -s -X POST "http://127.0.0.1:54321/rest/v1/usuarios" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"id":"<ADMIN_ID>","propriedade_id":"00000000-0000-0000-0000-000000000001","papel":"admin"}'
```

- [ ] **Step 2: Regenerar os tipos TypeScript do schema**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts
cd ..
```

Expected: `web/lib/supabase/database.types.ts` passa a incluir `producao_leite` na seção `Tables`, e `eventos_operacionais` passa a incluir as colunas `categoria_animal`/`categoria_origem` e os novos valores de `tipo_evento`.

- [ ] **Step 3: Criar `web/lib/auth/tem-permissao.ts`**

```ts
import { createClient } from '@/lib/supabase/server'

export async function temPermissao(modulo: string, acao: 'ver' | 'lancar'): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('tem_permissao', { p_modulo: modulo, p_acao: acao })
  return data === true
}
```

- [ ] **Step 4: Criar `web/lib/producao/unidade-negocio.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export async function getUnidadeNegocioLeiteId(
  supabase: SupabaseClient<Database>,
  propriedadeId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('unidades_negocio')
    .select('id')
    .eq('propriedade_id', propriedadeId)
    .eq('tipo', 'leite')
    .maybeSingle()

  return data?.id ?? null
}
```

- [ ] **Step 5: Criar `web/app/dashboard/producao/page.tsx`**

```tsx
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { buttonVariants } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ProducaoPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">Produção</h1>
      <nav className="flex flex-col gap-2">
        <Link href="/dashboard/producao/leite" className={buttonVariants({ variant: 'default' })}>
          Lançar produção do dia
        </Link>
        <Link href="/dashboard/producao/relatorio" className={buttonVariants({ variant: 'outline' })}>
          Relatório mensal
        </Link>
        <Link href="/dashboard/producao/rebanho" className={buttonVariants({ variant: 'outline' })}>
          Movimentar rebanho
        </Link>
      </nav>
    </main>
  )
}
```

- [ ] **Step 6: Editar `web/app/dashboard/page.tsx`** — adicionar o link "Produção", visível por `temPermissao` em vez de `papel`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
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
  const podeVerProducao = await temPermissao('producao', 'ver')

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
        {podeVerProducao && (
          <Link href="/dashboard/producao" className="underline">
            Produção
          </Link>
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

- [ ] **Step 7: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

Expected: sucesso, sem erros.

- [ ] **Step 8: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- dashboard deve mostrar link Producao ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard | grep -o "Produção"

echo "--- pagina indice deve carregar ---"
curl -s -i -b cookies-admin.txt http://localhost:3000/dashboard/producao | head -n 1

kill $DEV_PID
```

Expected: primeiro bloco imprime `Produção`; segundo bloco `HTTP/1.1 200 OK`.

- [ ] **Step 9: Commit**

```bash
git add web/
git commit -m "feat: adiciona navegacao e helper de permissao do modulo producao"
```

---

### Task 2: Lançamento diário de leite

**Files:**
- Modify: `web/lib/erros-formulario.ts`
- Create: `web/app/dashboard/producao/leite/page.tsx`
- Create: `web/app/api/producao/leite/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `createClient` (já existentes), `temPermissao` (Task 1), `getUnidadeNegocioLeiteId` (Task 1), `mensagemErro` (já existente, Task 1 do plano anterior).

- [ ] **Step 1: Editar `web/lib/erros-formulario.ts`** — adicionar os novos códigos de erro:

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
  data_invalida: 'Informe uma data válida.',
  valores_invalidos: 'Os valores informados não podem ser negativos.',
  unidade_negocio_nao_encontrada: 'Nenhuma unidade de negócio de leite cadastrada para esta propriedade.',
  categoria_origem_invalida: 'Selecione uma categoria de origem diferente da categoria de destino.',
  quantidade_invalida: 'Informe uma quantidade maior que zero.',
  erro_inesperado: 'Algo deu errado. Tente novamente.',
}

export function mensagemErro(codigo: string | undefined): string | null {
  if (!codigo) {
    return null
  }
  return MENSAGENS[codigo] ?? MENSAGENS.erro_inesperado
}
```

- [ ] **Step 2: Criar `web/app/dashboard/producao/leite/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { redirect } from 'next/navigation'

export default async function LancamentoLeitePage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const { data: dataParam, error } = await searchParams
  const mensagem = mensagemErro(error)
  const dataSelecionada = dataParam ?? new Date().toISOString().slice(0, 10)

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const { data: lancamentoExistente } = unidadeNegocioId
    ? await supabase
        .from('producao_leite')
        .select('litros_comercial, litros_descarte, litros_consumo')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .eq('data', dataSelecionada)
        .maybeSingle()
    : { data: null }

  const { data: ultimosLancamentos } = unidadeNegocioId
    ? await supabase
        .from('producao_leite')
        .select('data, litros_comercial, litros_descarte, litros_consumo')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .order('data', { ascending: false })
        .limit(7)
    : { data: [] }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Produção de leite do dia</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/producao/leite" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={dataSelecionada} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="litros_comercial">Litros comercial</Label>
              <Input
                id="litros_comercial"
                name="litros_comercial"
                type="number"
                step="0.01"
                min="0"
                defaultValue={lancamentoExistente?.litros_comercial ?? 0}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="litros_descarte">Litros descarte</Label>
              <Input
                id="litros_descarte"
                name="litros_descarte"
                type="number"
                step="0.01"
                min="0"
                defaultValue={lancamentoExistente?.litros_descarte ?? 0}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="litros_consumo">Litros consumo</Label>
              <Input
                id="litros_consumo"
                name="litros_consumo"
                type="number"
                step="0.01"
                min="0"
                defaultValue={lancamentoExistente?.litros_consumo ?? 0}
                required
              />
            </div>
            <Button type="submit">{lancamentoExistente ? 'Salvar alterações' : 'Lançar'}</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Últimos lançamentos</h2>
        <ul className="flex flex-col gap-2">
          {(ultimosLancamentos ?? []).map((lancamento) => (
            <li
              key={lancamento.data}
              className="flex items-center justify-between rounded-lg border border-input p-3 text-sm"
            >
              <span>{lancamento.data}</span>
              <span className="text-muted-foreground">
                {lancamento.litros_comercial + lancamento.litros_descarte + lancamento.litros_consumo} L
              </span>
              <a href={`/dashboard/producao/leite?data=${lancamento.data}`} className="underline">
                Editar
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Criar `web/app/api/producao/leite/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const data = String(formData.get('data') ?? '')
  const litrosComercial = Number(formData.get('litros_comercial'))
  const litrosDescarte = Number(formData.get('litros_descarte'))
  const litrosConsumo = Number(formData.get('litros_consumo'))

  if (!data || Number.isNaN(Date.parse(data))) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/leite?error=data_invalida`, request.url),
      { status: 303 }
    )
  }

  if (
    Number.isNaN(litrosComercial) ||
    Number.isNaN(litrosDescarte) ||
    Number.isNaN(litrosConsumo) ||
    litrosComercial < 0 ||
    litrosDescarte < 0 ||
    litrosConsumo < 0
  ) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/leite?data=${data}&error=valores_invalidos`, request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  if (!unidadeNegocioId) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/leite?error=unidade_negocio_nao_encontrada`, request.url),
      { status: 303 }
    )
  }

  const { error: erroUpsert } = await supabase.from('producao_leite').upsert(
    {
      propriedade_id: usuarioAtual.propriedade_id,
      unidade_negocio_id: unidadeNegocioId,
      data,
      litros_comercial: litrosComercial,
      litros_descarte: litrosDescarte,
      litros_consumo: litrosConsumo,
      criado_por: usuarioAtual.id,
      origem: 'manual',
    },
    { onConflict: 'unidade_negocio_id,data' }
  )

  if (erroUpsert) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/leite?data=${data}&error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/producao/leite', request.url), { status: 303 })
}
```

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl (lançar e depois editar o mesmo dia)**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- lancar producao de 2026-07-01 ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/leite \
  --data-urlencode "data=2026-07-01" \
  --data-urlencode "litros_comercial=965.6" \
  --data-urlencode "litros_descarte=15" \
  --data-urlencode "litros_consumo=10" | head -n 1

echo "--- editar o mesmo dia (upsert) ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/leite \
  --data-urlencode "data=2026-07-01" \
  --data-urlencode "litros_comercial=1000" \
  --data-urlencode "litros_descarte=15" \
  --data-urlencode "litros_consumo=10" | head -n 1

echo "--- valor negativo deve ser rejeitado ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/leite \
  --data-urlencode "data=2026-07-02" \
  --data-urlencode "litros_comercial=-5" \
  --data-urlencode "litros_descarte=0" \
  --data-urlencode "litros_consumo=0" | grep -i location

echo "--- pagina deve mostrar o valor editado ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/leite?data=2026-07-01" | grep -o 'value="1000"'

kill $DEV_PID
```

Expected: primeiros dois blocos `HTTP/1.1 303 See Other` com `location: /dashboard/producao/leite`; terceiro bloco `location: /dashboard/producao/leite?data=2026-07-02&error=valores_invalidos`; quarto bloco imprime `value="1000"`.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona lancamento diario de producao de leite"
```

---

### Task 3: Movimentação de rebanho

**Files:**
- Create: `web/app/dashboard/producao/rebanho/page.tsx`
- Create: `web/app/api/producao/rebanho/movimentacao/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `createClient`, `temPermissao`, `getUnidadeNegocioLeiteId`, `mensagemErro`, `Select` (`@/components/ui/select`, já existente).

- [ ] **Step 1: Criar `web/app/dashboard/producao/rebanho/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { redirect } from 'next/navigation'

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vaca em lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vaca de descarte' },
  { valor: 'vaca_seca', rotulo: 'Vaca seca' },
  { valor: 'novilha_coberta', rotulo: 'Novilha coberta' },
  { valor: 'novilha_recria', rotulo: 'Novilha em recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneira em aleitamento' },
] as const

const TIPOS = [
  { valor: 'nascimento', rotulo: 'Nascimento' },
  { valor: 'mortalidade', rotulo: 'Morte' },
  { valor: 'mudanca_categoria', rotulo: 'Mudança de categoria' },
  { valor: 'compra_animal', rotulo: 'Compra' },
  { valor: 'venda_animal', rotulo: 'Venda' },
  { valor: 'ajuste_inventario', rotulo: 'Ajuste de inventário' },
] as const

export default async function RebanhoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const hoje = new Date().toISOString().slice(0, 10)
  const { data: composicao } = unidadeNegocioId
    ? await supabase.rpc('rebanho_composicao', {
        p_unidade_negocio_id: unidadeNegocioId,
        p_data: hoje,
      })
    : { data: [] }

  const { data: historico } = unidadeNegocioId
    ? await supabase
        .from('eventos_operacionais')
        .select('data, tipo_evento, categoria_animal, categoria_origem, quantidade')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .in('tipo_evento', [
          'nascimento',
          'mortalidade',
          'mudanca_categoria',
          'compra_animal',
          'venda_animal',
          'ajuste_inventario',
        ])
        .order('data', { ascending: false })
        .limit(10)
    : { data: [] }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Composição atual do rebanho</h2>
        <ul className="flex flex-col gap-1">
          {(composicao ?? []).map((linha) => (
            <li key={linha.categoria} className="flex justify-between text-sm">
              <span>{CATEGORIAS.find((c) => c.valor === linha.categoria)?.rotulo}</span>
              <span className="font-medium">{linha.quantidade}</span>
            </li>
          ))}
        </ul>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar movimentação</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form
            method="POST"
            action="/api/producao/rebanho/movimentacao"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo">Tipo de movimentação</Label>
              <Select id="tipo" name="tipo" required defaultValue="">
                <option value="" disabled>
                  Selecione o tipo
                </option>
                {TIPOS.map((tipo) => (
                  <option key={tipo.valor} value={tipo.valor}>
                    {tipo.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria (ou categoria de destino, se mudança)</Label>
              <Select id="categoria" name="categoria" required defaultValue="">
                <option value="" disabled>
                  Selecione a categoria
                </option>
                {CATEGORIAS.map((categoria) => (
                  <option key={categoria.valor} value={categoria.valor}>
                    {categoria.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria_origem">
                Categoria de origem (só usada em &quot;mudança de categoria&quot;)
              </Label>
              <Select id="categoria_origem" name="categoria_origem" defaultValue="">
                <option value="">Não se aplica</option>
                {CATEGORIAS.map((categoria) => (
                  <option key={categoria.valor} value={categoria.valor}>
                    {categoria.rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input id="quantidade" name="quantidade" type="number" min="1" defaultValue={1} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={hoje} required />
            </div>
            <Button type="submit">Registrar</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Últimas movimentações</h2>
        <ul className="flex flex-col gap-2">
          {(historico ?? []).map((evento, indice) => (
            <li key={indice} className="rounded-lg border border-input p-3 text-sm">
              {evento.data} · {TIPOS.find((t) => t.valor === evento.tipo_evento)?.rotulo} ·{' '}
              {evento.quantidade}x{' '}
              {CATEGORIAS.find((c) => c.valor === evento.categoria_animal)?.rotulo}
              {evento.categoria_origem &&
                ` (de ${CATEGORIAS.find((c) => c.valor === evento.categoria_origem)?.rotulo})`}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/producao/rebanho/movimentacao/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { NextResponse } from 'next/server'

const TIPOS_VALIDOS = [
  'nascimento',
  'mortalidade',
  'mudanca_categoria',
  'compra_animal',
  'venda_animal',
  'ajuste_inventario',
]

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const tipo = String(formData.get('tipo') ?? '')
  const categoria = String(formData.get('categoria') ?? '')
  const categoriaOrigemForm = String(formData.get('categoria_origem') ?? '')
  const quantidade = Number(formData.get('quantidade'))
  const data = String(formData.get('data') ?? '')

  if (!TIPOS_VALIDOS.includes(tipo) || !categoria || !data || Number.isNaN(Date.parse(data))) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=dados_invalidos', request.url),
      { status: 303 }
    )
  }

  if (Number.isNaN(quantidade) || quantidade < 1) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=quantidade_invalida', request.url),
      { status: 303 }
    )
  }

  const categoriaOrigem = tipo === 'mudanca_categoria' ? categoriaOrigemForm : null

  if (tipo === 'mudanca_categoria' && (!categoriaOrigem || categoriaOrigem === categoria)) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=categoria_origem_invalida', request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  if (!unidadeNegocioId) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=unidade_negocio_nao_encontrada', request.url),
      { status: 303 }
    )
  }

  const { error: erroInsert } = await supabase.from('eventos_operacionais').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    tipo_evento: tipo,
    data,
    quantidade,
    categoria_animal: categoria,
    categoria_origem: categoriaOrigem,
    origem: 'manual',
    criado_por: usuarioAtual.id,
  })

  if (erroInsert) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/rebanho?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/producao/rebanho', request.url), {
    status: 303,
  })
}
```

- [ ] **Step 3: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 4: Verificar via curl (ajuste de inventário, depois mudança de categoria)**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- ajuste de inventario inicial ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/rebanho/movimentacao \
  --data-urlencode "tipo=ajuste_inventario" \
  --data-urlencode "categoria=vaca_lactacao" \
  --data-urlencode "quantidade=38" \
  --data-urlencode "data=2026-07-01" | head -n 1

echo "--- mudanca de categoria valida ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/rebanho/movimentacao \
  --data-urlencode "tipo=mudanca_categoria" \
  --data-urlencode "categoria=vaca_lactacao" \
  --data-urlencode "categoria_origem=novilha_recria" \
  --data-urlencode "quantidade=2" \
  --data-urlencode "data=2026-07-10" | head -n 1

echo "--- mudanca de categoria com origem igual ao destino deve falhar ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/rebanho/movimentacao \
  --data-urlencode "tipo=mudanca_categoria" \
  --data-urlencode "categoria=vaca_lactacao" \
  --data-urlencode "categoria_origem=vaca_lactacao" \
  --data-urlencode "quantidade=1" \
  --data-urlencode "data=2026-07-11" | grep -i location

echo "--- composicao deve refletir 40 vacas em lactacao ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/rebanho | grep -A 1 "Vaca em lactação"

kill $DEV_PID
```

Expected: primeiros dois blocos `HTTP/1.1 303 See Other` com `location: /dashboard/producao/rebanho`; terceiro bloco `location: /dashboard/producao/rebanho?error=categoria_origem_invalida`; quarto bloco mostra `40` (38 do ajuste + 2 da mudança).

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: adiciona movimentacao de rebanho"
```

---

### Task 4: Relatório mensal

**Files:**
- Create: `web/app/dashboard/producao/relatorio/page.tsx`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `createClient`, `temPermissao`, `getUnidadeNegocioLeiteId` (Task 1).

- [ ] **Step 1: Criar `web/app/dashboard/producao/relatorio/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

const CATEGORIAS = [
  { valor: 'vaca_lactacao', rotulo: 'Vacas lactação' },
  { valor: 'vaca_descarte', rotulo: 'Vacas descarte' },
  { valor: 'vaca_seca', rotulo: 'Vacas secas' },
  { valor: 'novilha_coberta', rotulo: 'Novilhas cobertas' },
  { valor: 'novilha_recria', rotulo: 'Novilhas recria' },
  { valor: 'terneira_aleitamento', rotulo: 'Terneiras' },
] as const

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function ultimoDiaDoMes(ano: number, mesIndice: number): string {
  const data = new Date(Date.UTC(ano, mesIndice + 1, 0))
  return data.toISOString().slice(0, 10)
}

export default async function RelatorioProducaoPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const anoAtual = new Date().getUTCFullYear()
  const { ano: anoParam } = await searchParams
  const ano = Number(anoParam) || anoAtual

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const { data: producaoMensal } = unidadeNegocioId
    ? await supabase
        .from('producao_leite_mensal')
        .select('*')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .gte('mes', `${ano}-01-01`)
        .lte('mes', `${ano}-12-31`)
        .order('mes')
    : { data: [] }

  const composicaoPorMes = unidadeNegocioId
    ? await Promise.all(
        MESES.map(async (_, indice) => {
          const { data } = await supabase.rpc('rebanho_composicao', {
            p_unidade_negocio_id: unidadeNegocioId,
            p_data: ultimoDiaDoMes(ano, indice),
          })
          return { mes: MESES[indice], categorias: data ?? [] }
        })
      )
    : []

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-lg font-medium">Relatório de produção — {ano}</h1>

      <form method="GET" className="flex items-end gap-2">
        <Select name="ano" defaultValue={String(ano)} className="w-32">
          {[anoAtual, anoAtual - 1, anoAtual - 2, anoAtual - 3, anoAtual - 4].map((anoOpcao) => (
            <option key={anoOpcao} value={anoOpcao}>
              {anoOpcao}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Ver
        </Button>
      </form>

      <div className="overflow-x-auto">
        <h2 className="mb-2 text-sm font-medium">Produção de leite</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input text-left">
              <th className="p-2">Mês</th>
              <th className="p-2">Comercial</th>
              <th className="p-2">Descarte</th>
              <th className="p-2">Consumo</th>
              <th className="p-2">Total</th>
              <th className="p-2">Média diária</th>
              <th className="p-2">Vacas lactação</th>
              <th className="p-2">Média/vaca</th>
            </tr>
          </thead>
          <tbody>
            {(producaoMensal ?? []).map((linha) => (
              <tr key={linha.mes} className="border-b border-input">
                <td className="p-2">{MESES[new Date(linha.mes as string).getUTCMonth()]}</td>
                <td className="p-2">{linha.litros_comercial}</td>
                <td className="p-2">{linha.litros_descarte}</td>
                <td className="p-2">{linha.litros_consumo}</td>
                <td className="p-2">{linha.producao_total}</td>
                <td className="p-2">{Number(linha.media_diaria).toFixed(1)}</td>
                <td className="p-2">{linha.vacas_lactacao}</td>
                <td className="p-2">
                  {linha.media_por_vaca_lactacao_dia
                    ? Number(linha.media_por_vaca_lactacao_dia).toFixed(1)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <h2 className="mb-2 text-sm font-medium">Composição do rebanho</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input text-left">
              <th className="p-2">Mês</th>
              {CATEGORIAS.map((categoria) => (
                <th key={categoria.valor} className="p-2">
                  {categoria.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {composicaoPorMes.map((linha) => (
              <tr key={linha.mes} className="border-b border-input">
                <td className="p-2">{linha.mes}</td>
                {CATEGORIAS.map((categoria) => (
                  <td key={categoria.valor} className="p-2">
                    {linha.categorias.find((c) => c.categoria === categoria.valor)?.quantidade ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- relatorio de 2026 deve mostrar producao de julho e rebanho ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/relatorio?ano=2026" | grep -o "Julho\|Vacas lactação"

kill $DEV_PID
```

Expected: imprime `Julho` (linha de produção lançada na Task 2) e `Vacas lactação` (cabeçalho da tabela de rebanho).

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: adiciona relatorio mensal de producao"
```
