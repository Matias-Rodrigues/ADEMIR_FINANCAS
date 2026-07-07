# Qualidade do Leite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modelar e construir a tela de lançamento mensal de qualidade do leite (CCS, CBT, gordura, proteína, ESD), conforme `docs/superpowers/specs/2026-07-07-qualidade-leite-design.md` — tabela nova, RLS, e integração como 3ª tabela na tela de relatório mensal já existente.

**Architecture:** Tabela dedicada `qualidade_leite` (um resultado por mês por unidade de negócio), mesmo padrão de `producao_leite`. Frontend: tela de lançamento com edição via insert-então-update (nunca upsert ingênuo, lição já aplicada retroativamente ao módulo de leite), e uma 3ª tabela na página `/dashboard/producao/relatorio` já existente.

**Tech Stack:** Postgres/Supabase local + pgTAP (backend); Next.js (App Router) + TypeScript + shadcn/ui (frontend, fundação já pronta).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente — toda mudança usa uma migration nova.
- Toda tabela nova segue os constraints já estabelecidos: `id uuid primary key default gen_random_uuid()`, `propriedade_id uuid not null references propriedades(id)`, `created_at timestamptz not null default now()`, RLS habilitado na mesma migration que cria a tabela.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Toda mutação de frontend é Route Handler HTML puro (`method="POST"`), sem JavaScript no cliente.
- Edição via **insert-então-update-nos-valores**, nunca `.upsert()` ingênuo — `criado_por`/`origem`/`propriedade_id` nunca são reescritos numa edição.
- Toda query filtra `unidades_negocio.tipo = 'leite'` via `getUnidadeNegocioLeiteId` (já existente).
- Sem suite de testes automatizados de frontend — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- O Supabase local precisa estar rodando; comandos do Supabase CLI rodam na raiz do repositório, comandos `npm`/`npx` do frontend rodam dentro de `web/`.

### Fixtures de teste

Reutiliza a propriedade seedada (`00000000-0000-0000-0000-000000000001`) e a unidade de negócio "Gado leiteiro" (`00000000-0000-0000-0000-000000000002`, `tipo = 'leite'`) já seedadas. Para os testes de frontend, reutiliza o admin já criado em plano anterior: `admin.producao@ademir.local` / `senha-admin-123`.

---

### Task 1: Tabela `qualidade_leite`

**Files:**
- Create: `supabase/migrations/20260707144000_qualidade_leite.sql`
- Create: `supabase/tests/database/30_qualidade_leite.sql`

**Interfaces:**
- Consumes: `public.propriedades`, `public.unidades_negocio`, `public.usuarios`, `public.usuario_propriedade_id()`, `public.tem_permissao(modulo text, acao text)` (já existentes).
- Produces: tabela `public.qualidade_leite` — consumida pela Task 2 (frontend) e Task 3 (relatório).

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/30_qualidade_leite.sql`:

```sql
begin;
select plan(5);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'producao', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select has_table('public', 'qualidade_leite', 'tabela qualidade_leite deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.qualidade_leite
  (propriedade_id, unidade_negocio_id, mes, ccs, cbt, gordura, proteina, esd, origem, criado_por)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 629, 14, 3.94, 3.42, 8.6, 'manual', '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from public.qualidade_leite),
  1,
  'resultado de qualidade deve ser inserido e visível pelo admin'
);

update public.qualidade_leite set gordura = 4.10 where mes = '2026-07-01';

select is(
  (select gordura from public.qualidade_leite where mes = '2026-07-01'),
  4.10,
  'admin deve conseguir editar um resultado ja lancado (policy de UPDATE)'
);

select throws_ok(
  $$insert into public.qualidade_leite (propriedade_id, unidade_negocio_id, mes, ccs, cbt, gordura, proteina, esd, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-08-01', 100, 10, 105, 3, 8, '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "qualidade_leite" violates check constraint "qualidade_leite_gordura_check"',
  'gordura acima de 100 deve ser rejeitada'
);

select throws_ok(
  $$insert into public.qualidade_leite (propriedade_id, unidade_negocio_id, mes, ccs, cbt, gordura, proteina, esd, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-01', 700, 15, 3.9, 3.4, 8.5, '33333333-3333-3333-3333-333333333333')$$,
  'duplicate key value violates unique constraint "qualidade_leite_unidade_negocio_id_mes_key"',
  'segundo resultado no mesmo mes/unidade deve ser rejeitado pelo unique'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Da raiz do repositório:

```bash
npx supabase test db
```

Expected: falha em `has_table` (tabela `qualidade_leite` não existe).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260707144000_qualidade_leite.sql`:

```sql
create table public.qualidade_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  mes date not null,
  ccs numeric(10,2) not null check (ccs >= 0),
  cbt numeric(10,2) not null check (cbt >= 0),
  gordura numeric(5,2) not null check (gordura >= 0 and gordura <= 100),
  proteina numeric(5,2) not null check (proteina >= 0 and proteina <= 100),
  esd numeric(5,2) not null check (esd >= 0 and esd <= 100),
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (unidade_negocio_id, mes)
);

alter table public.qualidade_leite enable row level security;

create index qualidade_leite_propriedade_id_idx on public.qualidade_leite(propriedade_id);
create index qualidade_leite_unidade_negocio_id_idx on public.qualidade_leite(unidade_negocio_id);

create policy "ver qualidade do leite"
  on public.qualidade_leite for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar qualidade do leite"
  on public.qualidade_leite for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));

create policy "editar qualidade do leite"
  on public.qualidade_leite for update
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'))
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 5 testes de `30_qualidade_leite.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts
cd ..
```

Expected: `web/lib/supabase/database.types.ts` passa a incluir `qualidade_leite` na seção `Tables`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260707144000_qualidade_leite.sql supabase/tests/database/30_qualidade_leite.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona tabela qualidade_leite"
```

---

### Task 2: Lançamento de qualidade do leite

**Files:**
- Create: `web/app/dashboard/producao/qualidade/page.tsx`
- Create: `web/app/api/producao/qualidade/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual` (`@/lib/auth/current-usuario`), `temPermissao` (`@/lib/auth/tem-permissao`), `getUnidadeNegocioLeiteId` (`@/lib/producao/unidade-negocio`), `mensagemErro` (`@/lib/erros-formulario`), `createClient` (`@/lib/supabase/server`) — todos já existentes.
- Produces: nenhuma interface nova consumida por outras tasks (Task 3 lê `qualidade_leite` diretamente via Supabase, não via este código).

- [ ] **Step 1: Criar `web/app/dashboard/producao/qualidade/page.tsx`**

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

export default async function QualidadeLeitePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const { mes: mesParam, error } = await searchParams
  const mensagem = mensagemErro(error)
  const hoje = new Date()
  const mesAtual = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`
  const mesSelecionado = mesParam ?? mesAtual

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const { data: resultadoExistente } = unidadeNegocioId
    ? await supabase
        .from('qualidade_leite')
        .select('ccs, cbt, gordura, proteina, esd')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .eq('mes', `${mesSelecionado}-01`)
        .maybeSingle()
    : { data: null }

  const { data: ultimosResultados } = unidadeNegocioId
    ? await supabase
        .from('qualidade_leite')
        .select('mes, ccs, cbt, gordura, proteina, esd')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .order('mes', { ascending: false })
        .limit(6)
    : { data: [] }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Qualidade do leite do mês</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/producao/qualidade" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mes">Mês</Label>
              <Input id="mes" name="mes" type="month" defaultValue={mesSelecionado} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ccs">CCS (x1000)</Label>
              <Input
                id="ccs"
                name="ccs"
                type="number"
                step="0.01"
                min="0"
                defaultValue={resultadoExistente?.ccs ?? ''}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cbt">CBT (x1000)</Label>
              <Input
                id="cbt"
                name="cbt"
                type="number"
                step="0.01"
                min="0"
                defaultValue={resultadoExistente?.cbt ?? ''}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gordura">Gordura (%)</Label>
              <Input
                id="gordura"
                name="gordura"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={resultadoExistente?.gordura ?? ''}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="proteina">Proteína (%)</Label>
              <Input
                id="proteina"
                name="proteina"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={resultadoExistente?.proteina ?? ''}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="esd">ESD (%)</Label>
              <Input
                id="esd"
                name="esd"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={resultadoExistente?.esd ?? ''}
                required
              />
            </div>
            <Button type="submit">{resultadoExistente ? 'Salvar alterações' : 'Lançar'}</Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Últimos resultados</h2>
        <ul className="flex flex-col gap-2">
          {(ultimosResultados ?? []).map((resultado) => (
            <li
              key={resultado.mes}
              className="flex items-center justify-between rounded-lg border border-input p-3 text-sm"
            >
              <span>{String(resultado.mes).slice(0, 7)}</span>
              <span className="text-muted-foreground">
                CCS {resultado.ccs} · CBT {resultado.cbt} · Gord {resultado.gordura}%
              </span>
              <a
                href={`/dashboard/producao/qualidade?mes=${String(resultado.mes).slice(0, 7)}`}
                className="underline"
              >
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

- [ ] **Step 2: Criar `web/app/api/producao/qualidade/route.ts`**

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
  const mesForm = String(formData.get('mes') ?? '')
  const ccs = Number(formData.get('ccs'))
  const cbt = Number(formData.get('cbt'))
  const gordura = Number(formData.get('gordura'))
  const proteina = Number(formData.get('proteina'))
  const esd = Number(formData.get('esd'))

  if (!/^\d{4}-\d{2}$/.test(mesForm)) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/qualidade?error=data_invalida', request.url),
      { status: 303 }
    )
  }

  const mes = `${mesForm}-01`

  const valoresValidos =
    !Number.isNaN(ccs) &&
    !Number.isNaN(cbt) &&
    !Number.isNaN(gordura) &&
    !Number.isNaN(proteina) &&
    !Number.isNaN(esd) &&
    ccs >= 0 &&
    cbt >= 0 &&
    gordura >= 0 &&
    gordura <= 100 &&
    proteina >= 0 &&
    proteina <= 100 &&
    esd >= 0 &&
    esd <= 100

  if (!valoresValidos) {
    return NextResponse.redirect(
      new URL(`/dashboard/producao/qualidade?mes=${mesForm}&error=valores_invalidos`, request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  if (!unidadeNegocioId) {
    return NextResponse.redirect(
      new URL('/dashboard/producao/qualidade?error=unidade_negocio_nao_encontrada', request.url),
      { status: 303 }
    )
  }

  const { error: erroInsert } = await supabase.from('qualidade_leite').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    mes,
    ccs,
    cbt,
    gordura,
    proteina,
    esd,
    criado_por: usuarioAtual.id,
    origem: 'manual',
  })

  if (erroInsert) {
    if (erroInsert.code !== '23505') {
      return NextResponse.redirect(
        new URL(`/dashboard/producao/qualidade?mes=${mesForm}&error=erro_inesperado`, request.url),
        { status: 303 }
      )
    }

    const { error: erroUpdate } = await supabase
      .from('qualidade_leite')
      .update({ ccs, cbt, gordura, proteina, esd })
      .eq('unidade_negocio_id', unidadeNegocioId)
      .eq('mes', mes)

    if (erroUpdate) {
      return NextResponse.redirect(
        new URL(`/dashboard/producao/qualidade?mes=${mesForm}&error=erro_inesperado`, request.url),
        { status: 303 }
      )
    }
  }

  return NextResponse.redirect(new URL('/dashboard/producao/qualidade', request.url), {
    status: 303,
  })
}
```

- [ ] **Step 3: Editar `web/app/dashboard/producao/page.tsx`** — adicionar o link "Qualidade do leite" à página-índice do módulo, ao lado dos 3 já existentes:

```tsx
<Link href="/dashboard/producao/qualidade" className={buttonVariants({ variant: 'outline' })}>
  Qualidade do leite
</Link>
```

(inserir dentro do `<nav>` já existente em `web/app/dashboard/producao/page.tsx`, junto aos links de "Lançar produção do dia", "Relatório mensal" e "Movimentar rebanho")

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl (lançar, editar o mesmo mês, validar range)**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- lancar qualidade de julho/2026 ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/qualidade \
  --data-urlencode "mes=2026-07" \
  --data-urlencode "ccs=629" \
  --data-urlencode "cbt=14" \
  --data-urlencode "gordura=3.94" \
  --data-urlencode "proteina=3.42" \
  --data-urlencode "esd=8.6" | head -n 1

echo "--- editar o mesmo mes ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/qualidade \
  --data-urlencode "mes=2026-07" \
  --data-urlencode "ccs=700" \
  --data-urlencode "cbt=15" \
  --data-urlencode "gordura=4.0" \
  --data-urlencode "proteina=3.5" \
  --data-urlencode "esd=8.7" | head -n 1

echo "--- gordura acima de 100 deve ser rejeitada ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/qualidade \
  --data-urlencode "mes=2026-08" \
  --data-urlencode "ccs=100" \
  --data-urlencode "cbt=10" \
  --data-urlencode "gordura=150" \
  --data-urlencode "proteina=3" \
  --data-urlencode "esd=8" | grep -i location

echo "--- pagina deve mostrar o valor editado ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/qualidade?mes=2026-07" | grep -o 'value="700"'

kill $DEV_PID
```

Expected: primeiros dois blocos `HTTP/1.1 303 See Other` com `location: /dashboard/producao/qualidade`; terceiro bloco `location: /dashboard/producao/qualidade?mes=2026-08&error=valores_invalidos`; quarto bloco imprime `value="700"`.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona lancamento de qualidade do leite"
```

---

### Task 3: Qualidade do leite no relatório mensal

**Files:**
- Modify: `web/app/dashboard/producao/relatorio/page.tsx`

**Interfaces:**
- Consumes: `getUnidadeNegocioLeiteId`, `createClient` (já usados nesta página).

- [ ] **Step 1: Editar `web/app/dashboard/producao/relatorio/page.tsx`** — adicionar a query e a 3ª tabela.

Adicionar, junto às outras queries (depois da query de `producaoMensal`):

```tsx
  const { data: qualidadeMensal } = unidadeNegocioId
    ? await supabase
        .from('qualidade_leite')
        .select('mes, ccs, cbt, gordura, proteina, esd')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .gte('mes', `${ano}-01-01`)
        .lte('mes', `${ano}-12-31`)
        .order('mes')
    : { data: [] }
```

Adicionar, depois da tabela de "Composição do rebanho" (antes do `</main>` de fechamento):

```tsx
      <div className="overflow-x-auto">
        <h2 className="mb-2 text-sm font-medium">Qualidade do leite</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input text-left">
              <th className="p-2">Mês</th>
              <th className="p-2">CCS</th>
              <th className="p-2">CBT</th>
              <th className="p-2">Gordura %</th>
              <th className="p-2">Proteína %</th>
              <th className="p-2">ESD %</th>
            </tr>
          </thead>
          <tbody>
            {(qualidadeMensal ?? []).map((linha) => (
              <tr key={linha.mes} className="border-b border-input">
                <td className="p-2">{MESES[new Date(linha.mes as string).getUTCMonth()]}</td>
                <td className="p-2">{linha.ccs}</td>
                <td className="p-2">{linha.cbt}</td>
                <td className="p-2">{linha.gordura}</td>
                <td className="p-2">{linha.proteina}</td>
                <td className="p-2">{linha.esd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

echo "--- relatorio de 2026 deve mostrar qualidade do leite lancada na Task 2 ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/relatorio?ano=2026" | grep -o "Qualidade do leite\|700"

kill $DEV_PID
```

Expected: imprime `Qualidade do leite` (título da nova tabela) e `700` (o CCS editado na Task 2).

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: adiciona qualidade do leite ao relatorio mensal"
```
