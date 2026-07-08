# Módulo Financeiro do Negócio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar o módulo Financeiro do Negócio — policy de UPDATE em `lancamentos_financeiros_negocio` e as 3 telas (listagem do mês, criação, edição) — conforme `docs/superpowers/specs/2026-07-08-financeiro-negocio-design.md`.

**Architecture:** `create policy` de UPDATE na tabela `lancamentos_financeiros_negocio` já existente (sem alteração de coluna). Frontend segue o padrão HTML puro já estabelecido (Route Handlers, sem JavaScript no cliente) — o par tipo/categoria é resolvido com um único `<select>` (`tipo_categoria`, valor `"receita:venda_leite"` etc.) para evitar precisar de JS para filtrar categorias por tipo.

**Tech Stack:** Postgres/Supabase local + pgTAP (backend); Next.js (App Router) + TypeScript + shadcn/ui (frontend, fundação já pronta).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente — toda mudança usa `create policy` numa migration nova.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Toda mutação de frontend é Route Handler HTML puro (`method="POST"`), sem JavaScript no cliente.
- `unidade_negocio_id` recebido de formulário é sempre validado como pertencente à propriedade do usuário antes do insert/update.
- Sem exclusão de lançamento nesta fatia — só criação e edição.
- Sem suite de testes automatizados de frontend — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- O Supabase local precisa estar rodando; comandos do Supabase CLI rodam na raiz do repositório, comandos `npm`/`npx` do frontend rodam dentro de `web/`.

### Fixtures de teste

Reutiliza a propriedade seedada (`00000000-0000-0000-0000-000000000001`, já com o módulo `financeiro_negocio` ativo em `propriedade_modulos_contratados`) e a unidade de negócio "Gado leiteiro" (`00000000-0000-0000-0000-000000000002`). Para os testes de frontend, reutiliza o admin já criado em planos anteriores: `admin.producao@ademir.local` / `senha-admin-123` (se a fixture não existir no ambiente local — o stack pode ter sido reiniciado entre sessões — recrie usando a Admin API: `POST /auth/v1/admin/users` com esse e-mail/senha, depois insira a linha em `public.usuarios` com `propriedade_id=00000000-0000-0000-0000-000000000001`, `papel=admin`). Papel `admin` ignora `perfil_acesso_permissoes` (bypass em `tem_permissao`), então nenhuma configuração extra de permissão é necessária.

---

### Task 1: Policy de UPDATE em lancamentos_financeiros_negocio

**Files:**
- Create: `supabase/migrations/20260708150000_financeiro_negocio_editar.sql`
- Create: `supabase/tests/database/32_financeiro_negocio_editar.sql`

**Interfaces:**
- Consumes: `public.lancamentos_financeiros_negocio` (já existente), `public.usuario_propriedade_id()`, `public.usuario_eh_dev()`, `public.tem_permissao(modulo text, acao text)`.
- Produces: policy de UPDATE em `lancamentos_financeiros_negocio` — consumida pela Task 5.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/32_financeiro_negocio_editar.sql`:

```sql
begin;
select plan(2);

insert into public.propriedades (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir');
insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo)
values ('11111111-1111-1111-1111-111111111111', 'financeiro_negocio', true);
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'ademir@teste.com');
insert into public.usuarios (id, propriedade_id, papel)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin');
insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Gado leiteiro', 'leite');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.lancamentos_financeiros_negocio
  (id, propriedade_id, unidade_negocio_id, tipo, valor, data, descricao, categoria, criado_por)
values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'receita', 2842.80, '2026-07-05', 'Venda de leite', 'venda_leite', '33333333-3333-3333-3333-333333333333');

update public.lancamentos_financeiros_negocio
  set valor = 3000.00, descricao = 'Venda de leite (corrigido)'
  where id = '77777777-7777-7777-7777-777777777777';

select is(
  (select valor from public.lancamentos_financeiros_negocio where id = '77777777-7777-7777-7777-777777777777'),
  3000.00,
  'admin deve conseguir editar um lancamento ja registrado (policy de UPDATE)'
);

select throws_ok(
  $$update public.lancamentos_financeiros_negocio set valor = -100 where id = '77777777-7777-7777-7777-777777777777'$$,
  'new row for relation "lancamentos_financeiros_negocio" violates check constraint "lancamentos_financeiros_negocio_valor_check"',
  'valor negativo deve ser rejeitado tambem na edicao'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Da raiz do repositório:

```bash
npx supabase test db
```

Expected: falha no primeiro `is()` (o `update` não tem efeito porque ainda não existe policy de UPDATE — a tabela mantém `valor = 2842.80`).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260708150000_financeiro_negocio_editar.sql`:

```sql
create policy "editar lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 2 testes de `32_financeiro_negocio_editar.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts 2>/dev/null
cd ..
```

**Atenção:** use `2>/dev/null` para evitar que mensagens de status do CLI vazem para dentro do arquivo. Depois de gerar, confirme que a **primeira linha** do arquivo é `export type Json = ...` (não texto de status), e rode `npx tsc --noEmit` para confirmar que o arquivo é TypeScript válido. Como esta migration não muda colunas, o diff deste arquivo deve ser vazio ou mínimo — não é erro se `git status` não mostrar mudança nele.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260708150000_financeiro_negocio_editar.sql supabase/tests/database/32_financeiro_negocio_editar.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona permissao de edicao a lancamentos financeiros do negocio"
```

---

### Task 2: Categorias compartilhadas (tipo + categoria)

**Files:**
- Create: `web/lib/financeiro-negocio/categorias.ts`

**Interfaces:**
- Produces: `CATEGORIAS_POR_TIPO` (const), `categoriaValida(tipo: string, categoria: string): boolean`, `rotuloCategoria(categoria: string): string` — consumidos pelas Tasks 3, 4 e 5.

- [ ] **Step 1: Criar `web/lib/financeiro-negocio/categorias.ts`**

```ts
export const CATEGORIAS_POR_TIPO = {
  receita: [
    { valor: 'venda_leite', rotulo: 'Venda de leite' },
    { valor: 'venda_suino', rotulo: 'Venda de suínos' },
    { valor: 'outras_receitas', rotulo: 'Outras receitas' },
  ],
  despesa: [
    { valor: 'racao', rotulo: 'Ração' },
    { valor: 'insumo', rotulo: 'Insumo' },
    { valor: 'veterinario', rotulo: 'Veterinário' },
    { valor: 'combustivel', rotulo: 'Combustível' },
    { valor: 'energia', rotulo: 'Energia' },
    { valor: 'manutencao', rotulo: 'Manutenção' },
    { valor: 'mao_de_obra', rotulo: 'Mão de obra' },
    { valor: 'outras_despesas', rotulo: 'Outras despesas' },
  ],
} as const

export function categoriaValida(tipo: string, categoria: string): boolean {
  if (tipo !== 'receita' && tipo !== 'despesa') {
    return false
  }
  return CATEGORIAS_POR_TIPO[tipo].some((item) => item.valor === categoria)
}

export function rotuloCategoria(categoria: string): string {
  const todas = [...CATEGORIAS_POR_TIPO.receita, ...CATEGORIAS_POR_TIPO.despesa]
  return todas.find((item) => item.valor === categoria)?.rotulo ?? categoria
}
```

- [ ] **Step 2: Verificar build**

```bash
cd web && npx tsc --noEmit && cd ..
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/financeiro-negocio/categorias.ts
git commit -m "feat: adiciona categorias compartilhadas do financeiro do negocio"
```

---

### Task 3: Listagem do mês (financeiro do negócio)

**Files:**
- Create: `web/app/dashboard/financeiro-negocio/page.tsx`
- Modify: `web/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient` (já existentes); `rotuloCategoria` (Task 2).

- [ ] **Step 1: Criar `web/app/dashboard/financeiro-negocio/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { rotuloCategoria } from '@/lib/financeiro-negocio/categorias'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Lancamento = {
  id: string
  tipo: string
  categoria: string
  valor: number
  data: string
  descricao: string | null
}

function GrupoUnidade({ nome, lancamentos }: { nome: string; lancamentos: Lancamento[] }) {
  const totalReceita = lancamentos
    .filter((lancamento) => lancamento.tipo === 'receita')
    .reduce((soma, lancamento) => soma + lancamento.valor, 0)
  const totalDespesa = lancamentos
    .filter((lancamento) => lancamento.tipo === 'despesa')
    .reduce((soma, lancamento) => soma + lancamento.valor, 0)

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{nome}</h2>
      <ul className="flex flex-col gap-2">
        {lancamentos.map((lancamento) => (
          <li
            key={lancamento.id}
            className="flex items-center justify-between rounded-lg border border-input p-3 text-sm"
          >
            <div>
              <p className="font-medium">{rotuloCategoria(lancamento.categoria)}</p>
              <p className="text-muted-foreground">
                {lancamento.data}
                {lancamento.descricao && ` · ${lancamento.descricao}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={lancamento.tipo === 'receita' ? 'text-green-600' : 'text-destructive'}>
                {lancamento.tipo === 'receita' ? '+' : '−'} R$ {lancamento.valor.toFixed(2)}
              </span>
              <Link href={`/dashboard/financeiro-negocio/${lancamento.id}/editar`} className="text-sm underline">
                Editar
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium">
        Receita: R$ {totalReceita.toFixed(2)} · Despesa: R$ {totalDespesa.toFixed(2)} · Saldo: R${' '}
        {(totalReceita - totalDespesa).toFixed(2)}
      </p>
    </div>
  )
}

export default async function FinanceiroNegocioPage() {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('financeiro_negocio', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const agora = new Date()
  const primeiroDia = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
  const ultimoDia = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)

  const supabase = await createClient()
  const { data: unidades } = await supabase
    .from('unidades_negocio')
    .select('id, nome')
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .order('nome')

  const { data: lancamentos } = await supabase
    .from('lancamentos_financeiros_negocio')
    .select('id, tipo, categoria, valor, data, descricao, unidade_negocio_id')
    .gte('data', primeiroDia)
    .lte('data', ultimoDia)
    .order('data', { ascending: false })

  const lancamentosPorUnidade = new Map<string, Lancamento[]>()
  for (const lancamento of lancamentos ?? []) {
    const grupo = lancamentosPorUnidade.get(lancamento.unidade_negocio_id) ?? []
    grupo.push(lancamento)
    lancamentosPorUnidade.set(lancamento.unidade_negocio_id, grupo)
  }

  const totalReceitaGeral = (lancamentos ?? [])
    .filter((lancamento) => lancamento.tipo === 'receita')
    .reduce((soma, lancamento) => soma + lancamento.valor, 0)
  const totalDespesaGeral = (lancamentos ?? [])
    .filter((lancamento) => lancamento.tipo === 'despesa')
    .reduce((soma, lancamento) => soma + lancamento.valor, 0)

  const gruposComLancamentos = (unidades ?? []).filter(
    (unidade) => (lancamentosPorUnidade.get(unidade.id)?.length ?? 0) > 0
  )

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Financeiro do negócio</h1>
        <Link href="/dashboard/financeiro-negocio/novo" className={buttonVariants({ variant: 'default' })}>
          Novo lançamento
        </Link>
      </div>

      <p className="text-base font-semibold">
        Saldo do mês: R$ {(totalReceitaGeral - totalDespesaGeral).toFixed(2)}
      </p>

      {gruposComLancamentos.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês ainda.</p>
      )}

      {gruposComLancamentos.map((unidade) => (
        <GrupoUnidade
          key={unidade.id}
          nome={unidade.nome}
          lancamentos={lancamentosPorUnidade.get(unidade.id) ?? []}
        />
      ))}
    </main>
  )
}
```

- [ ] **Step 2: Adicionar link no dashboard principal**

Em `web/app/dashboard/page.tsx`, adicionar a busca de permissão e o link, seguindo o mesmo padrão já usado para "Produção":

```tsx
  const podeVerProducao = await temPermissao('producao', 'ver')
  const podeVerFinanceiroNegocio = await temPermissao('financeiro_negocio', 'ver')
```

(adicionar a segunda linha logo abaixo da primeira) e, no `<nav>`, logo após o bloco `{podeVerProducao && (...)}`:

```tsx
        {podeVerFinanceiroNegocio && (
          <Link href="/dashboard/financeiro-negocio" className="underline">
            Financeiro do negócio
          </Link>
        )}
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

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- pagina de financeiro do negocio deve carregar ---"
curl -s -i -b cookies-admin.txt http://localhost:3000/dashboard/financeiro-negocio | head -n 1

echo "--- link deve aparecer no dashboard ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard | grep -o "Financeiro do neg.cio"

kill $DEV_PID
```

Expected: primeiro bloco `HTTP/1.1 200 OK`; segundo bloco imprime a linha do link.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: adiciona listagem de financeiro do negocio"
```

---

### Task 4: Criação de lançamento

**Files:**
- Create: `web/app/dashboard/financeiro-negocio/novo/page.tsx`
- Create: `web/app/api/financeiro-negocio/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro` (`@/lib/erros-formulario`), `Select` (`@/components/ui/select`); `CATEGORIAS_POR_TIPO`, `categoriaValida` (Task 2).

- [ ] **Step 1: Criar `web/app/dashboard/financeiro-negocio/novo/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { CATEGORIAS_POR_TIPO } from '@/lib/financeiro-negocio/categorias'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { redirect } from 'next/navigation'

export default async function NovoLancamentoFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeLancar = await temPermissao('financeiro_negocio', 'lancar')
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
          <CardTitle>Novo lançamento</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form method="POST" action="/api/financeiro-negocio" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo_categoria">Tipo e categoria</Label>
              <Select id="tipo_categoria" name="tipo_categoria" required defaultValue="">
                <option value="" disabled>
                  Selecione o tipo e a categoria
                </option>
                <optgroup label="Receita">
                  {CATEGORIAS_POR_TIPO.receita.map((categoria) => (
                    <option key={categoria.valor} value={`receita:${categoria.valor}`}>
                      {categoria.rotulo}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Despesa">
                  {CATEGORIAS_POR_TIPO.despesa.map((categoria) => (
                    <option key={categoria.valor} value={`despesa:${categoria.valor}`}>
                      {categoria.rotulo}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unidade_negocio_id">Unidade de negócio</Label>
              <Select id="unidade_negocio_id" name="unidade_negocio_id" required defaultValue="">
                <option value="" disabled>
                  Selecione a unidade de negócio
                </option>
                {(unidades ?? []).map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input id="valor" name="valor" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" name="descricao" />
            </div>
            <Button type="submit">Lançar</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/financeiro-negocio/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { categoriaValida } from '@/lib/financeiro-negocio/categorias'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('financeiro_negocio', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const tipoCategoria = String(formData.get('tipo_categoria') ?? '')
  const [tipo, categoria] = tipoCategoria.split(':')
  const unidadeNegocioId = String(formData.get('unidade_negocio_id') ?? '')
  const valor = Number(formData.get('valor'))
  const data = String(formData.get('data') ?? '')
  const descricaoForm = String(formData.get('descricao') ?? '').trim()
  const descricao = descricaoForm === '' ? null : descricaoForm

  if (!categoriaValida(tipo, categoria) || !unidadeNegocioId) {
    return NextResponse.redirect(
      new URL('/dashboard/financeiro-negocio/novo?error=dados_invalidos', request.url),
      { status: 303 }
    )
  }

  if (!data || Number.isNaN(Date.parse(data))) {
    return NextResponse.redirect(
      new URL('/dashboard/financeiro-negocio/novo?error=data_invalida', request.url),
      { status: 303 }
    )
  }

  if (Number.isNaN(valor) || valor <= 0) {
    return NextResponse.redirect(
      new URL('/dashboard/financeiro-negocio/novo?error=valores_invalidos', request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()

  const { data: unidadeNegocio } = await supabase
    .from('unidades_negocio')
    .select('id')
    .eq('id', unidadeNegocioId)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!unidadeNegocio) {
    return NextResponse.redirect(
      new URL('/dashboard/financeiro-negocio/novo?error=unidade_negocio_invalida', request.url),
      { status: 303 }
    )
  }

  const { error: erroInsert } = await supabase.from('lancamentos_financeiros_negocio').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    tipo,
    categoria,
    valor,
    data,
    descricao,
    criado_por: usuarioAtual.id,
  })

  if (erroInsert) {
    return NextResponse.redirect(
      new URL('/dashboard/financeiro-negocio/novo?error=erro_inesperado', request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL('/dashboard/financeiro-negocio', request.url), { status: 303 })
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

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

HOJE=$(date +%F)

echo "--- criar lancamento valido ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/financeiro-negocio \
  --data-urlencode "tipo_categoria=receita:venda_leite" \
  --data-urlencode "unidade_negocio_id=00000000-0000-0000-0000-000000000002" \
  --data-urlencode "valor=2842.80" \
  --data-urlencode "data=$HOJE" \
  --data-urlencode "descricao=Venda de leite lote 1" | head -n 1

echo "--- valor zero deve ser rejeitado ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/financeiro-negocio \
  --data-urlencode "tipo_categoria=despesa:racao" \
  --data-urlencode "unidade_negocio_id=00000000-0000-0000-0000-000000000002" \
  --data-urlencode "valor=0" \
  --data-urlencode "data=$HOJE" | grep -i location

echo "--- listagem deve mostrar o lancamento criado ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard/financeiro-negocio | grep -o "Venda de leite lote 1"

kill $DEV_PID
```

Expected: primeiro bloco `HTTP/1.1 303 See Other` com `location: /dashboard/financeiro-negocio`; segundo bloco `location: /dashboard/financeiro-negocio/novo?error=valores_invalidos`; terceiro bloco imprime `Venda de leite lote 1`.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: adiciona lancamento de financeiro do negocio"
```

---

### Task 5: Edição de lançamento

**Files:**
- Create: `web/app/dashboard/financeiro-negocio/[id]/editar/page.tsx`
- Create: `web/app/api/financeiro-negocio/[id]/editar/route.ts`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `temPermissao`, `createClient`, `mensagemErro`, `Select`, `CATEGORIAS_POR_TIPO`, `categoriaValida` (Tasks 2, 4).

- [ ] **Step 1: Criar `web/app/dashboard/financeiro-negocio/[id]/editar/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { mensagemErro } from '@/lib/erros-formulario'
import { CATEGORIAS_POR_TIPO } from '@/lib/financeiro-negocio/categorias'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { notFound, redirect } from 'next/navigation'

export default async function EditarLancamentoFinanceiroPage({
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

  const podeLancar = await temPermissao('financeiro_negocio', 'lancar')
  if (!podeLancar) {
    redirect('/dashboard')
  }

  const { id } = await params
  const { error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()
  const { data: lancamento } = await supabase
    .from('lancamentos_financeiros_negocio')
    .select('id, tipo, categoria, valor, data, descricao, unidade_negocio_id')
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!lancamento) {
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
          <CardTitle>Editar lançamento</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          <form
            method="POST"
            action={`/api/financeiro-negocio/${lancamento.id}/editar`}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo_categoria">Tipo e categoria</Label>
              <Select
                id="tipo_categoria"
                name="tipo_categoria"
                required
                defaultValue={`${lancamento.tipo}:${lancamento.categoria}`}
              >
                <optgroup label="Receita">
                  {CATEGORIAS_POR_TIPO.receita.map((categoria) => (
                    <option key={categoria.valor} value={`receita:${categoria.valor}`}>
                      {categoria.rotulo}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Despesa">
                  {CATEGORIAS_POR_TIPO.despesa.map((categoria) => (
                    <option key={categoria.valor} value={`despesa:${categoria.valor}`}>
                      {categoria.rotulo}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unidade_negocio_id">Unidade de negócio</Label>
              <Select
                id="unidade_negocio_id"
                name="unidade_negocio_id"
                required
                defaultValue={lancamento.unidade_negocio_id}
              >
                {(unidades ?? []).map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                name="valor"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={lancamento.valor}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={lancamento.data} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input id="descricao" name="descricao" defaultValue={lancamento.descricao ?? ''} />
            </div>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Criar `web/app/api/financeiro-negocio/[id]/editar/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { categoriaValida } from '@/lib/financeiro-negocio/categorias'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  const podeLancar = await temPermissao('financeiro_negocio', 'lancar')
  if (!podeLancar) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const tipoCategoria = String(formData.get('tipo_categoria') ?? '')
  const [tipo, categoria] = tipoCategoria.split(':')
  const unidadeNegocioId = String(formData.get('unidade_negocio_id') ?? '')
  const valor = Number(formData.get('valor'))
  const data = String(formData.get('data') ?? '')
  const descricaoForm = String(formData.get('descricao') ?? '').trim()
  const descricao = descricaoForm === '' ? null : descricaoForm

  if (!categoriaValida(tipo, categoria) || !unidadeNegocioId) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=dados_invalidos`, request.url),
      { status: 303 }
    )
  }

  if (!data || Number.isNaN(Date.parse(data))) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=data_invalida`, request.url),
      { status: 303 }
    )
  }

  if (Number.isNaN(valor) || valor <= 0) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=valores_invalidos`, request.url),
      { status: 303 }
    )
  }

  const supabase = await createClient()

  const { data: unidadeNegocio } = await supabase
    .from('unidades_negocio')
    .select('id')
    .eq('id', unidadeNegocioId)
    .eq('propriedade_id', usuarioAtual.propriedade_id)
    .maybeSingle()

  if (!unidadeNegocio) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=unidade_negocio_invalida`, request.url),
      { status: 303 }
    )
  }

  const { error: erroUpdate } = await supabase
    .from('lancamentos_financeiros_negocio')
    .update({
      tipo,
      categoria,
      unidade_negocio_id: unidadeNegocioId,
      valor,
      data,
      descricao,
    })
    .eq('id', id)
    .eq('propriedade_id', usuarioAtual.propriedade_id)

  if (erroUpdate) {
    return NextResponse.redirect(
      new URL(`/dashboard/financeiro-negocio/${id}/editar?error=erro_inesperado`, request.url),
      { status: 303 }
    )
  }

  return NextResponse.redirect(new URL(`/dashboard/financeiro-negocio/${id}/editar`, request.url), {
    status: 303,
  })
}
```

- [ ] **Step 3: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 4: Verificar via curl (criar e depois editar)**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

HOJE=$(date +%F)

curl -s -b cookies-admin.txt -X POST http://localhost:3000/api/financeiro-negocio \
  --data-urlencode "tipo_categoria=receita:venda_leite" \
  --data-urlencode "unidade_negocio_id=00000000-0000-0000-0000-000000000002" \
  --data-urlencode "valor=1000.00" \
  --data-urlencode "data=$HOJE" \
  --data-urlencode "descricao=Lancamento original" -o /dev/null

LANCAMENTO_ID=$(curl -s -b cookies-admin.txt http://localhost:3000/dashboard/financeiro-negocio | grep -o '/dashboard/financeiro-negocio/[^/"]*/editar' | head -n 1 | sed -E 's#/dashboard/financeiro-negocio/([^/]*)/editar#\1#')
echo "LANCAMENTO_ID=$LANCAMENTO_ID"

echo "--- editar ---"
curl -s -i -b cookies-admin.txt -X POST "http://localhost:3000/api/financeiro-negocio/$LANCAMENTO_ID/editar" \
  --data-urlencode "tipo_categoria=despesa:racao" \
  --data-urlencode "unidade_negocio_id=00000000-0000-0000-0000-000000000002" \
  --data-urlencode "valor=500.00" \
  --data-urlencode "data=$HOJE" \
  --data-urlencode "descricao=Racao comprada em julho" | head -n 1

echo "--- listagem deve mostrar o lancamento editado ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard/financeiro-negocio | grep -o "Racao comprada em julho"

kill $DEV_PID
```

Expected: bloco de edição `HTTP/1.1 303 See Other`; último bloco imprime `Racao comprada em julho`.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat: adiciona edicao de lancamento financeiro do negocio"
```
