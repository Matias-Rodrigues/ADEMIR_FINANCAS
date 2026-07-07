# Módulo Imobilizado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar o módulo Imobilizado — schema (categoria, valor_residual, ativo, UPDATE policy, view de depreciação) e as 3 telas (listagem, criação, edição/baixa) — conforme `docs/superpowers/specs/2026-07-07-imobilizado-design.md`.

**Architecture:** `alter table` na tabela `imobilizados` já existente + view `imobilizados_depreciacao` (com `security_invoker = true` desde o início) para calcular depreciação sob demanda. Frontend segue o padrão HTML puro já estabelecido (Route Handlers, sem JavaScript).

**Tech Stack:** Postgres/Supabase local + pgTAP (backend); Next.js (App Router) + TypeScript + shadcn/ui (frontend, fundação já pronta).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente — toda mudança usa `alter table`/`create policy` numa migration nova.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Toda mutação de frontend é Route Handler HTML puro (`method="POST"`), sem JavaScript no cliente.
- Views sobre tabelas com RLS **sempre** usam `with (security_invoker = true)` — lição aprendida de um bug anterior (vazamento de dados entre propriedades numa view sem essa cláusula).
- Sem exclusão de bens — "dar baixa" é sempre um toggle de `ativo`, nunca um `delete`.
- Sem suite de testes automatizados de frontend — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- O Supabase local precisa estar rodando; comandos do Supabase CLI rodam na raiz do repositório, comandos `npm`/`npx` do frontend rodam dentro de `web/`.

### Fixtures de teste

Reutiliza a propriedade seedada (`00000000-0000-0000-0000-000000000001`) e as unidades de negócio já seedadas ("Gado leiteiro" `00000000-0000-0000-0000-000000000002`, "Suínos" `00000000-0000-0000-0000-000000000003`). Para os testes de frontend, reutiliza o admin já criado em planos anteriores: `admin.producao@ademir.local` / `senha-admin-123` (se a fixture não existir no ambiente local — o stack pode ter sido reiniciado entre sessões — recrie usando a Admin API: `POST /auth/v1/admin/users` com esse e-mail/senha, depois insira a linha em `public.usuarios` com `propriedade_id=00000000-0000-0000-0000-000000000001`, `papel=admin`).

---

### Task 1: Schema — categoria, valor_residual, ativo, UPDATE, view de depreciação

**Files:**
- Create: `supabase/migrations/20260707145000_imobilizado_depreciacao.sql`
- Create: `supabase/tests/database/31_imobilizado_depreciacao.sql`

**Interfaces:**
- Consumes: `public.imobilizados` (já existente), `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`, `public.tem_permissao(modulo text, acao text)`.
- Produces: colunas `categoria`, `valor_residual`, `ativo` em `imobilizados`; policy de UPDATE; view `public.imobilizados_depreciacao` — consumida pelas Tasks 2, 3, 4.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/31_imobilizado_depreciacao.sql`:

```sql
begin;
select plan(6);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'imobilizado', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_column('public', 'imobilizados', 'valor_residual', 'coluna valor_residual deve existir');
select has_view('public', 'imobilizados_depreciacao', 'view imobilizados_depreciacao deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.imobilizados
  (propriedade_id, unidade_negocio_id, categoria, nome, valor_aquisicao, valor_residual, data_aquisicao, vida_util_anos)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'benfeitoria', 'Sala de Ordenha', 80000, 16000, '2020-01-01', 20);

select is(
  (select depreciacao_anual from public.imobilizados_depreciacao where nome = 'Sala de Ordenha'),
  3200.00,
  'depreciacao anual deve ser (80000 - 16000) / 20 = 3200'
);

select is(
  (select round(depreciacao_mensal, 2) from public.imobilizados_depreciacao where nome = 'Sala de Ordenha'),
  266.67,
  'depreciacao mensal deve ser 3200 / 12 = 266.67'
);

update public.imobilizados set ativo = false where nome = 'Sala de Ordenha';

select is(
  (select ativo from public.imobilizados where nome = 'Sala de Ordenha'),
  false,
  'admin deve conseguir editar (dar baixa) um bem ja lancado (policy de UPDATE)'
);

select throws_ok(
  $$insert into public.imobilizados (propriedade_id, unidade_negocio_id, categoria, nome, valor_aquisicao, valor_residual, data_aquisicao, vida_util_anos)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'maquina', 'Item invalido', 1000, 2000, '2020-01-01', 10)$$,
  'new row for relation "imobilizados" violates check constraint "imobilizados_valor_residual_check"',
  'valor_residual maior que valor_aquisicao deve ser rejeitado'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Da raiz do repositório:

```bash
npx supabase test db
```

Expected: falha em `has_column` (coluna `valor_residual` não existe ainda).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260707145000_imobilizado_depreciacao.sql`:

```sql
alter table public.imobilizados
  add column categoria text not null default 'maquina' check (categoria in ('benfeitoria', 'maquina')),
  add column valor_residual numeric(12,2) not null default 0 check (valor_residual >= 0 and valor_residual < valor_aquisicao),
  add column ativo boolean not null default true;

alter table public.imobilizados alter column categoria drop default;
alter table public.imobilizados alter column valor_residual drop default;

create policy "editar imobilizados"
  on public.imobilizados for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'lancar'));

create or replace view public.imobilizados_depreciacao
  with (security_invoker = true) as
select
  id, propriedade_id, unidade_negocio_id, categoria, nome, valor_aquisicao, valor_residual,
  data_aquisicao, vida_util_anos, ativo,
  (valor_aquisicao - valor_residual) / vida_util_anos as depreciacao_anual,
  (valor_aquisicao - valor_residual) / vida_util_anos / 12 as depreciacao_mensal
from public.imobilizados;
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 6 testes de `31_imobilizado_depreciacao.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts 2>/dev/null
cd ..
```

**Atenção:** use `2>/dev/null` para evitar que mensagens de status do CLI (ex: "Connecting to db...") vazem para dentro do arquivo — isso já aconteceu numa task anterior e quebrou a build. Depois de gerar, confirme que a **primeira linha** do arquivo é `export type Json = ...` (não texto de status), e rode `npx tsc --noEmit` para confirmar que o arquivo é TypeScript válido.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260707145000_imobilizado_depreciacao.sql supabase/tests/database/31_imobilizado_depreciacao.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona categoria, valor_residual, baixa e depreciacao a imobilizados"
```

---

### Task 2: Listagem de imobilizados

**Files:**
- Create: `web/app/dashboard/imobilizado/page.tsx`

**Interfaces:**
- Consumes: `getUsuarioAtual` (`@/lib/auth/current-usuario`), `temPermissao` (`@/lib/auth/tem-permissao`), `createClient` (`@/lib/supabase/server`) — todos já existentes.

- [ ] **Step 1: Criar `web/app/dashboard/imobilizado/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Bem = {
  id: string
  categoria: string
  nome: string
  valor_aquisicao: number
  depreciacao_anual: number
  depreciacao_mensal: number
  ativo: boolean
}

function TabelaCategoria({ titulo, bens }: { titulo: string; bens: Bem[] }) {
  const totalAnual = bens
    .filter((bem) => bem.ativo)
    .reduce((soma, bem) => soma + bem.depreciacao_anual, 0)

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{titulo}</h2>
      <ul className="flex flex-col gap-2">
        {bens.map((bem) => (
          <li
            key={bem.id}
            className={`flex items-center justify-between rounded-lg border border-input p-3 text-sm ${bem.ativo ? '' : 'opacity-50'}`}
          >
            <div>
              <p className="font-medium">{bem.nome}</p>
              <p className="text-muted-foreground">
                Aquisição R$ {bem.valor_aquisicao} · Depreciação R$ {bem.depreciacao_anual.toFixed(2)}/ano
                ({bem.depreciacao_mensal.toFixed(2)}/mês)
                {!bem.ativo && ' · inativo'}
              </p>
            </div>
            <Link href={`/dashboard/imobilizado/${bem.id}/editar`} className="text-sm underline">
              Editar
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium">
        Total {titulo.toLowerCase()}: R$ {totalAnual.toFixed(2)}/ano
      </p>
    </div>
  )
}

export default async function ImobilizadoPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('imobilizado', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: bens } = await supabase
    .from('imobilizados_depreciacao')
    .select('id, categoria, nome, valor_aquisicao, depreciacao_anual, depreciacao_mensal, ativo')
    .order('nome')

  const benfeitorias = (bens ?? []).filter((bem) => bem.categoria === 'benfeitoria')
  const maquinas = (bens ?? []).filter((bem) => bem.categoria === 'maquina')
  const totalGeral = (bens ?? [])
    .filter((bem) => bem.ativo)
    .reduce((soma, bem) => soma + bem.depreciacao_anual, 0)

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Imobilizado</h1>
        <Link href="/dashboard/imobilizado/novo" className={buttonVariants({ variant: 'default' })}>
          Novo bem
        </Link>
      </div>

      <TabelaCategoria titulo="Benfeitorias" bens={benfeitorias} />
      <TabelaCategoria titulo="Máquinas e Implementos" bens={maquinas} />

      <p className="text-base font-semibold">Total geral: R$ {totalGeral.toFixed(2)}/ano</p>
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

echo "--- pagina de imobilizado deve carregar ---"
curl -s -i -b cookies-admin.txt http://localhost:3000/dashboard/imobilizado | head -n 1

kill $DEV_PID
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: adiciona listagem de imobilizados"
```

---

### Task 3: Criação de bem

**Files:**
- Create: `web/app/dashboard/imobilizado/novo/page.tsx`
- Create: `web/app/api/imobilizado/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro` (`@/lib/erros-formulario`), `Select` (`@/components/ui/select`).

- [ ] **Step 1: Editar `web/lib/erros-formulario.ts`** — adicionar o código de erro que falta:

```ts
  data_aquisicao_invalida: 'Informe uma data de aquisição válida.',
```

(inserir junto aos outros códigos já existentes no objeto `MENSAGENS`)

- [ ] **Step 2: Criar `web/app/dashboard/imobilizado/novo/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { redirect } from 'next/navigation'

export default async function NovoImobilizadoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeLancar = await temPermissao('imobilizado', 'lancar')
  if (!podeLancar) {
    redirect('/dashboard')
  }

  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: unidades } = await supabase
    .from('unidades_negocio')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Novo bem</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/imobilizado" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select id="categoria" name="categoria" required defaultValue="">
                <option value="" disabled>
                  Selecione a categoria
                </option>
                <option value="benfeitoria">Benfeitoria</option>
                <option value="maquina">Máquina/Implemento</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor_aquisicao">Valor de aquisição (R$)</Label>
              <Input id="valor_aquisicao" name="valor_aquisicao" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor_residual">Valor residual (R$)</Label>
              <Input id="valor_residual" name="valor_residual" type="number" step="0.01" min="0" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_aquisicao">Data de aquisição</Label>
              <Input id="data_aquisicao" name="data_aquisicao" type="date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vida_util_anos">Vida útil (anos)</Label>
              <Input id="vida_util_anos" name="vida_util_anos" type="number" min="1" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unidade_negocio_id">Unidade de negócio</Label>
              <Select id="unidade_negocio_id" name="unidade_negocio_id" defaultValue="">
                <option value="">Não vinculado</option>
                {(unidades ?? []).map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Criar bem</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Criar `web/app/api/imobilizado/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('imobilizado', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const categoria = String(formData.get('categoria') ?? '')
  const nome = String(formData.get('nome') ?? '').trim()
  const valorAquisicao = Number(formData.get('valor_aquisicao'))
  const valorResidual = Number(formData.get('valor_residual'))
  const dataAquisicao = String(formData.get('data_aquisicao') ?? '')
  const vidaUtilAnos = Number(formData.get('vida_util_anos'))
  const unidadeNegocioIdForm = String(formData.get('unidade_negocio_id') ?? '')
  const unidadeNegocioId = unidadeNegocioIdForm === '' ? null : unidadeNegocioIdForm

  if (!['benfeitoria', 'maquina'].includes(categoria) || !nome) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado/novo?error=dados_invalidos', request.url),
      { status: 303 }
    )
  }

  if (!dataAquisicao || Number.isNaN(Date.parse(dataAquisicao))) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado/novo?error=data_aquisicao_invalida', request.url),
      { status: 303 }
    )
  }

  const valoresValidos =
    !Number.isNaN(valorAquisicao) &&
    !Number.isNaN(valorResidual) &&
    !Number.isNaN(vidaUtilAnos) &&
    valorAquisicao > 0 &&
    valorResidual >= 0 &&
    valorResidual < valorAquisicao &&
    vidaUtilAnos > 0

  if (!valoresValidos) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado/novo?error=valores_invalidos', request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const { error: erroInsert } = await supabase.from('imobilizados').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    categoria,
    nome,
    valor_aquisicao: valorAquisicao,
    valor_residual: valorResidual,
    data_aquisicao: dataAquisicao,
    vida_util_anos: vidaUtilAnos,
  })

  if (erroInsert) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado/novo?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/imobilizado', request.url), { status: 303 })
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
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- criar bem valido ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/imobilizado \
  --data-urlencode "categoria=benfeitoria" \
  --data-urlencode "nome=Galpao de Maquinario" \
  --data-urlencode "valor_aquisicao=20000" \
  --data-urlencode "valor_residual=3000" \
  --data-urlencode "data_aquisicao=2017-03-01" \
  --data-urlencode "vida_util_anos=25" | head -n 1

echo "--- valor residual maior que aquisicao deve ser rejeitado ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/imobilizado \
  --data-urlencode "categoria=maquina" \
  --data-urlencode "nome=Item invalido" \
  --data-urlencode "valor_aquisicao=1000" \
  --data-urlencode "valor_residual=2000" \
  --data-urlencode "data_aquisicao=2020-01-01" \
  --data-urlencode "vida_util_anos=10" | grep -i location

echo "--- listagem deve mostrar o bem criado ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard/imobilizado | grep -o "Galpao de Maquinario"

kill $DEV_PID
```

Expected: primeiro bloco `HTTP/1.1 303 See Other` com `location: /dashboard/imobilizado`; segundo bloco `location: /dashboard/imobilizado/novo?error=valores_invalidos`; terceiro bloco imprime `Galpao de Maquinario`.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona criacao de bem imobilizado"
```

---

### Task 4: Edição e baixa de bem

**Files:**
- Create: `web/app/dashboard/imobilizado/[id]/editar/page.tsx`
- Create: `web/app/api/imobilizado/[id]/editar/route.ts`
- Create: `web/app/api/imobilizado/[id]/baixa/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro`, `Select` (Task 1, Task 3).

- [ ] **Step 1: Criar `web/app/dashboard/imobilizado/[id]/editar/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { notFound, redirect } from 'next/navigation'

export default async function EditarImobilizadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeLancar = await temPermissao('imobilizado', 'lancar')
  if (!podeLancar) {
    redirect('/dashboard')
  }

  const { id } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: bem } = await supabase
    .from('imobilizados')
    .select('id, categoria, nome, valor_aquisicao, valor_residual, data_aquisicao, vida_util_anos, unidade_negocio_id, ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!bem) {
    notFound()
  }

  const { data: unidades } = await supabase
    .from('unidades_negocio')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{bem.nome}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

          <form method="POST" action={`/api/imobilizado/${bem.id}/editar`} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select id="categoria" name="categoria" required defaultValue={bem.categoria}>
                <option value="benfeitoria">Benfeitoria</option>
                <option value="maquina">Máquina/Implemento</option>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" defaultValue={bem.nome} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor_aquisicao">Valor de aquisição (R$)</Label>
              <Input
                id="valor_aquisicao"
                name="valor_aquisicao"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={bem.valor_aquisicao}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor_residual">Valor residual (R$)</Label>
              <Input
                id="valor_residual"
                name="valor_residual"
                type="number"
                step="0.01"
                min="0"
                defaultValue={bem.valor_residual}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_aquisicao">Data de aquisição</Label>
              <Input id="data_aquisicao" name="data_aquisicao" type="date" defaultValue={bem.data_aquisicao} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vida_util_anos">Vida útil (anos)</Label>
              <Input
                id="vida_util_anos"
                name="vida_util_anos"
                type="number"
                min="1"
                defaultValue={bem.vida_util_anos}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unidade_negocio_id">Unidade de negócio</Label>
              <Select id="unidade_negocio_id" name="unidade_negocio_id" defaultValue={bem.unidade_negocio_id ?? ''}>
                <option value="">Não vinculado</option>
                {(unidades ?? []).map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>

          <form method="POST" action={`/api/imobilizado/${bem.id}/baixa`}>
            <Button type="submit" variant={bem.ativo ? 'destructive' : 'default'}>
              {bem.ativo ? 'Dar baixa' : 'Reativar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/imobilizado/[id]/editar/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('imobilizado', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const categoria = String(formData.get('categoria') ?? '')
  const nome = String(formData.get('nome') ?? '').trim()
  const valorAquisicao = Number(formData.get('valor_aquisicao'))
  const valorResidual = Number(formData.get('valor_residual'))
  const dataAquisicao = String(formData.get('data_aquisicao') ?? '')
  const vidaUtilAnos = Number(formData.get('vida_util_anos'))
  const unidadeNegocioIdForm = String(formData.get('unidade_negocio_id') ?? '')
  const unidadeNegocioId = unidadeNegocioIdForm === '' ? null : unidadeNegocioIdForm

  if (!['benfeitoria', 'maquina'].includes(categoria) || !nome) {
    return NextResponse.redirect(
      new URL(`/dashboard/imobilizado/${id}/editar?error=dados_invalidos`, request.url),
      { status: 303 }
    )
  }

  if (!dataAquisicao || Number.isNaN(Date.parse(dataAquisicao))) {
    return NextResponse.redirect(
      new URL(`/dashboard/imobilizado/${id}/editar?error=data_aquisicao_invalida`, request.url),
      { status: 303 }
    )
  }

  const valoresValidos =
    !Number.isNaN(valorAquisicao) &&
    !Number.isNaN(valorResidual) &&
    !Number.isNaN(vidaUtilAnos) &&
    valorAquisicao > 0 &&
    valorResidual >= 0 &&
    valorResidual < valorAquisicao &&
    vidaUtilAnos > 0

  if (!valoresValidos) {
    return NextResponse.redirect(
      new URL(`/dashboard/imobilizado/${id}/editar?error=valores_invalidos`, request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const { error: erroUpdate } = await supabase
    .from('imobilizados')
    .update({
      categoria,
      nome,
      valor_aquisicao: valorAquisicao,
      valor_residual: valorResidual,
      data_aquisicao: dataAquisicao,
      vida_util_anos: vidaUtilAnos,
      unidade_negocio_id: unidadeNegocioId,
    })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    return NextResponse.redirect(
      new URL(`/dashboard/imobilizado/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL(`/dashboard/imobilizado/${id}/editar`, request.url), {
    status: 303,
  })
}
```

- [ ] **Step 3: Criar `web/app/api/imobilizado/[id]/baixa/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('imobilizado', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const supabase = await createClient()
  const { data: bemAtual } = await supabase
    .from('imobilizados')
    .select('ativo')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!bemAtual) {
    return NextResponse.redirect(
      new URL('/dashboard/imobilizado?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  const { error: erroUpdate } = await supabase
    .from('imobilizados')
    .update({ ativo: !bemAtual.ativo })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    return NextResponse.redirect(
      new URL(`/dashboard/imobilizado/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL(`/dashboard/imobilizado/${id}/editar`, request.url), {
    status: 303,
  })
}
```

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl (editar e dar baixa/reativar)**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

BEM_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/imobilizado | grep -o '/dashboard/imobilizado/[^/]*/editar' | head -n 1 | sed -E 's#/dashboard/imobilizado/([^/]*)/editar#\1#')
echo "BEM_ID=$BEM_ID"

echo "--- editar ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/imobilizado/$BEM_ID/editar" \
  --data-urlencode "categoria=benfeitoria" \
  --data-urlencode "nome=Galpao Editado" \
  --data-urlencode "valor_aquisicao=25000" \
  --data-urlencode "valor_residual=3000" \
  --data-urlencode "data_aquisicao=2017-03-01" \
  --data-urlencode "vida_util_anos=25" | head -n 1

echo "--- dar baixa ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/imobilizado/$BEM_ID/baixa" | head -n 1

echo "--- listagem deve mostrar o bem como inativo ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard/imobilizado | grep -o "Galpao Editado.*inativo"

kill $DEV_PID
```

Expected: primeiros dois blocos `HTTP/1.1 303 See Other`; último bloco confirma que o nome editado aparece junto com "inativo" (ou uma correspondência equivalente, já que o `grep -o` captura do nome até o texto "inativo" na mesma linha renderizada).

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona edicao e baixa de bem imobilizado"
```
