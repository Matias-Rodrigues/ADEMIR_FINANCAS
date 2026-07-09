# Motor de Captura Configurável — Produção de Leite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o papel `dev` configure, por usuário, a ordem dos 3 campos numéricos (litros comercial/descarte/consumo) e o estilo de interação na tela `/dashboard/producao/leite`, conforme `docs/superpowers/specs/2026-07-09-motor-captura-configuravel-leite-design.md`.

**Architecture:** Segunda aplicação do motor de captura configurável (a primeira foi em `/leite/por-animal`). Duas tabelas novas e dedicadas (`configuracoes_captura_leite`, `ordem_captura_leite`), mesmo padrão de RLS "dev-only-write" já usado nas tabelas irmãs de `por-animal`. Diferente daquela fatia, aqui `campo` é um enum fechado de 3 valores (não uma FK para uma tabela de itens), já que a tela tem um conjunto fixo e conhecido de campos, não uma lista variável. Tela de administração nova e análoga (`/dashboard/admin/captura-leite`), mesmo fluxo de seletores em cascata. O gravador de áudio permanece sempre fixo, fora da configuração.

**Tech Stack:** Postgres/Supabase local + pgTAP (backend); Next.js (App Router) + TypeScript + shadcn/ui (frontend, fundação já pronta).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Toda mutação de frontend é Route Handler HTML puro (`method="POST"`), sem JavaScript no cliente. "Tocar para revelar" usa `<details>`/`<summary>`, nunca `'use client'`.
- Só o papel `dev` (checagem estrita via `ehDev()`, já existente em `web/lib/auth/current-usuario.ts`) acessa a tela e a rota de administração desta fatia.
- Configuração é por `usuario_id`, não por `propriedade_id`.
- Ausência de configuração para um usuário = comportamento padrão atual (ordem comercial→descarte→consumo, todos os campos visíveis) — nunca um erro.
- O gravador de áudio (`GravadorAudio`) permanece sempre no mesmo lugar (após os campos numéricos, antes do botão de submit), independente da configuração — não participa da ordem nem do estilo de interação.
- Toda mutação valida que `usuario_id` pertence à `propriedade_id` informada **antes** de gravar qualquer coisa (validação completa primeiro, escrita depois).
- Sem coluna de índice redundante: não criar um índice explícito em `usuario_id` na tabela cujo `unique` já é de coluna única (lição da fatia anterior — `configuracoes_captura_animal_usuario_id_idx` era duplicado do índice implícito do `unique(usuario_id)`).
- Sem suíte de testes automatizados de frontend — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- O Supabase local precisa estar rodando; comandos do Supabase CLI rodam na raiz do repositório, comandos `npm`/`npx` do frontend rodam dentro de `web/`.

### Fixtures de teste

Reutiliza a propriedade seedada (`00000000-0000-0000-0000-000000000001`), o admin de teste `admin.producao@ademir.local` / `senha-admin-123`, e um usuário com `papel='dev'` (ex: `dev.teste@ademir.local` / `senha-dev-123`) — ambos já usados na fatia anterior deste mesmo motor, recrie via Admin API se não existirem no ambiente local.

---

### Task 1: Schema — tabelas `configuracoes_captura_leite` e `ordem_captura_leite`

**Files:**
- Create: `supabase/migrations/20260709175000_motor_captura_configuravel_leite.sql`
- Create: `supabase/tests/database/39_motor_captura_configuravel_leite.sql`

**Interfaces:**
- Consumes: `public.propriedades`, `public.usuarios`, `public.usuario_eh_dev()`.
- Produces: tabelas `public.configuracoes_captura_leite` (`id`, `propriedade_id`, `usuario_id`, `estilo_interacao`, `criado_por`, `created_at`) e `public.ordem_captura_leite` (`id`, `propriedade_id`, `usuario_id`, `campo`, `posicao`, `created_at`) — consumidas pelas Tasks 2 e 3.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/39_motor_captura_configuravel_leite.sql`:

```sql
begin;
select plan(8);

insert into public.propriedades (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Propriedade Ademir'),
  ('77777777-7777-7777-7777-777777777777', 'Propriedade Cliente B');

insert into public.propriedade_modulos_contratados (propriedade_id, modulo, ativo) values
  ('11111111-1111-1111-1111-111111111111', 'producao', true),
  ('77777777-7777-7777-7777-777777777777', 'producao', true);

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'admin@teste.com'),
  ('88888888-8888-8888-8888-888888888888', 'dev@teste.com'),
  ('99999999-9999-9999-9999-999999999999', 'membro1@teste.com'),
  ('66666666-6666-6666-6666-666666666666', 'membro2@teste.com');

insert into public.usuarios (id, propriedade_id, papel) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'dev'),
  ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', 'membro_familia'),
  ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'membro_familia');

select has_table('public', 'configuracoes_captura_leite', 'tabela configuracoes_captura_leite deve existir');
select has_table('public', 'ordem_captura_leite', 'tabela ordem_captura_leite deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.configuracoes_captura_leite (propriedade_id, usuario_id, estilo_interacao, criado_por)
values ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'tocar_para_revelar', '88888888-8888-8888-8888-888888888888');

select is(
  (select count(*)::int from public.configuracoes_captura_leite),
  1,
  'dev deve conseguir configurar captura de leite para usuario de propriedade que nao e a sua'
);

insert into public.ordem_captura_leite (propriedade_id, usuario_id, campo, posicao)
values ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'litros_descarte', 1);

select is(
  (select count(*)::int from public.ordem_captura_leite),
  1,
  'dev deve conseguir definir ordem de campo de captura de leite para usuario de propriedade que nao e a sua'
);

select throws_ok(
  $$insert into public.configuracoes_captura_leite (propriedade_id, usuario_id, estilo_interacao, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'invalido', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "configuracoes_captura_leite" violates check constraint "configuracoes_captura_leite_estilo_interacao_check"',
  'estilo_interacao fora da lista deve ser rejeitado'
);

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select throws_ok(
  $$insert into public.configuracoes_captura_leite (propriedade_id, usuario_id, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333')$$,
  'new row violates row-level security policy for table "configuracoes_captura_leite"',
  'admin (nao-dev) nao deve conseguir configurar propria captura de leite'
);

select set_config('request.jwt.claims', json_build_object('sub', '99999999-9999-9999-9999-999999999999')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.configuracoes_captura_leite),
  1,
  'usuario dono da configuracao deve conseguir ve-la (SELECT propria)'
);

select set_config('request.jwt.claims', json_build_object('sub', '66666666-6666-6666-6666-666666666666')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.configuracoes_captura_leite),
  0,
  'outro usuario da mesma propriedade nao deve ver configuracao alheia'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx supabase test db
```

Expected: falha em `has_table` (as tabelas ainda não existem).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260709175000_motor_captura_configuravel_leite.sql`:

```sql
create table public.configuracoes_captura_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  estilo_interacao text not null default 'todos_visiveis'
    check (estilo_interacao in ('todos_visiveis', 'tocar_para_revelar')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (usuario_id)
);

alter table public.configuracoes_captura_leite enable row level security;

create index configuracoes_captura_leite_propriedade_id_idx on public.configuracoes_captura_leite(propriedade_id);

create policy "ver propria configuracao de captura de leite ou dev ve qualquer uma"
  on public.configuracoes_captura_leite for select
  using (usuario_id = auth.uid() or public.usuario_eh_dev());

create policy "somente dev gerencia configuracao de captura de leite"
  on public.configuracoes_captura_leite for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());

create table public.ordem_captura_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  campo text not null check (campo in ('litros_comercial', 'litros_descarte', 'litros_consumo')),
  posicao integer not null check (posicao > 0),
  created_at timestamptz not null default now(),
  unique (usuario_id, campo)
);

alter table public.ordem_captura_leite enable row level security;

create index ordem_captura_leite_propriedade_id_idx on public.ordem_captura_leite(propriedade_id);
create index ordem_captura_leite_usuario_id_idx on public.ordem_captura_leite(usuario_id);

create policy "ver propria ordem de captura de leite ou dev ve qualquer uma"
  on public.ordem_captura_leite for select
  using (usuario_id = auth.uid() or public.usuario_eh_dev());

create policy "somente dev gerencia ordem de captura de leite"
  on public.ordem_captura_leite for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 8 testes de `39_motor_captura_configuravel_leite.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts 2>/dev/null
cd ..
```

**Atenção:** use `2>/dev/null`. Confirme que a primeira linha é `export type Json = ...` e rode `npx tsc --noEmit` dentro de `web/`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260709175000_motor_captura_configuravel_leite.sql supabase/tests/database/39_motor_captura_configuravel_leite.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona tabelas do motor de captura configuravel para leite"
```

---

### Task 2: Backend e tela de administração (papel dev)

**Files:**
- Create: `web/app/api/admin/captura-leite/route.ts`
- Create: `web/app/dashboard/admin/captura-leite/page.tsx`
- Modify: `web/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `ehDev` (já existentes, `web/lib/auth/current-usuario.ts`); tabelas `configuracoes_captura_leite`, `ordem_captura_leite` (Task 1).

- [ ] **Step 1: Criar `web/app/api/admin/captura-leite/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

const ESTILOS_VALIDOS = ['todos_visiveis', 'tocar_para_revelar']
const CAMPOS_VALIDOS = ['litros_comercial', 'litros_descarte', 'litros_consumo']

export async function POST(request: Request) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  }

  if (!ehDev(usuarioAtual)) {
    return NextResponse.redirect(new URL('/dashboard?error=nao_autorizado', request.url), {
      status: 303,
    })
  }

  const formData = await request.formData()
  const propriedadeId = String(formData.get('propriedade_id') ?? '')
  const usuarioId = String(formData.get('usuario_id') ?? '')
  const estiloInteracao = String(formData.get('estilo_interacao') ?? '')

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/admin/captura-leite?propriedade_id=${propriedadeId}&usuario_id=${usuarioId}&error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  if (!ESTILOS_VALIDOS.includes(estiloInteracao)) {
    return redirecionarComErro('dados_invalidos')
  }

  const posicoesForm = CAMPOS_VALIDOS.map((campo) => ({
    campo,
    posicaoTexto: String(formData.get(`posicao_${campo}`) ?? '').trim(),
  }))

  for (const { posicaoTexto } of posicoesForm) {
    if (posicaoTexto === '') {
      continue
    }
    const posicao = Number(posicaoTexto)
    if (Number.isNaN(posicao) || posicao <= 0 || !Number.isInteger(posicao)) {
      return redirecionarComErro('posicao_invalida')
    }
  }

  const supabase = await createClient()

  const { data: usuarioAlvo } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', usuarioId)
    .eq('propriedade_id', propriedadeId)
    .maybeSingle()

  if (!usuarioAlvo) {
    return redirecionarComErro('usuario_invalido')
  }

  const { error: erroInsertConfig } = await supabase.from('configuracoes_captura_leite').insert({
    propriedade_id: propriedadeId,
    usuario_id: usuarioId,
    estilo_interacao: estiloInteracao,
    criado_por: usuarioAtual.id,
  })

  if (erroInsertConfig) {
    if (erroInsertConfig.code !== '23505') {
      return redirecionarComErro('erro_inesperado')
    }

    const { error: erroUpdateConfig } = await supabase
      .from('configuracoes_captura_leite')
      .update({ estilo_interacao: estiloInteracao })
      .eq('usuario_id', usuarioId)

    if (erroUpdateConfig) {
      return redirecionarComErro('erro_inesperado')
    }
  }

  let algumaPosicaoFalhou = false

  for (const { campo, posicaoTexto } of posicoesForm) {
    if (posicaoTexto === '') {
      continue
    }

    const posicao = Number(posicaoTexto)

    const { error: erroInsertPosicao } = await supabase.from('ordem_captura_leite').insert({
      propriedade_id: propriedadeId,
      usuario_id: usuarioId,
      campo,
      posicao,
    })

    if (erroInsertPosicao) {
      if (erroInsertPosicao.code !== '23505') {
        algumaPosicaoFalhou = true
        continue
      }

      const { error: erroUpdatePosicao } = await supabase
        .from('ordem_captura_leite')
        .update({ posicao })
        .eq('usuario_id', usuarioId)
        .eq('campo', campo)

      if (erroUpdatePosicao) {
        algumaPosicaoFalhou = true
      }
    }
  }

  if (algumaPosicaoFalhou) {
    return redirecionarComErro('erro_inesperado')
  }

  return NextResponse.redirect(
    new URL(
      `/dashboard/admin/captura-leite?propriedade_id=${propriedadeId}&usuario_id=${usuarioId}`,
      request.url
    ),
    { status: 303 }
  )
}
```

- [ ] **Step 2: Criar `web/app/dashboard/admin/captura-leite/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehDev } from '@/lib/auth/current-usuario'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { redirect } from 'next/navigation'

const CAMPOS = [
  { valor: 'litros_comercial', rotulo: 'Litros comercial' },
  { valor: 'litros_descarte', rotulo: 'Litros descarte' },
  { valor: 'litros_consumo', rotulo: 'Litros consumo' },
] as const

export default async function CapturaLeiteAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ propriedade_id?: string; usuario_id?: string; error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  if (!ehDev(usuarioAtual)) {
    redirect('/dashboard')
  }

  const { propriedade_id: propriedadeId, usuario_id: usuarioId, error } = await searchParams
  const mensagem = mensagemErro(error)

  const supabase = await createClient()

  const { data: propriedades } = await supabase.from('propriedades').select('id, nome').order('nome')

  const { data: usuariosDaPropriedade } = propriedadeId
    ? await supabase
        .from('usuarios')
        .select('id, papel, pessoas_fisicas(nome)')
        .eq('propriedade_id', propriedadeId)
        .order('created_at')
    : { data: [] }

  const { data: configuracaoAtual } = usuarioId
    ? await supabase
        .from('configuracoes_captura_leite')
        .select('estilo_interacao')
        .eq('usuario_id', usuarioId)
        .maybeSingle()
    : { data: null }

  const { data: ordemAtual } = usuarioId
    ? await supabase.from('ordem_captura_leite').select('campo, posicao').eq('usuario_id', usuarioId)
    : { data: [] }

  const posicaoPorCampo = new Map((ordemAtual ?? []).map((linha) => [linha.campo, linha.posicao]))

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">Motor de captura configurável — Produção de leite</h1>

      {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

      <Card>
        <CardHeader>
          <CardTitle>1. Propriedade</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET" className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="propriedade_id">Propriedade</Label>
              <Select id="propriedade_id" name="propriedade_id" defaultValue={propriedadeId ?? ''}>
                <option value="" disabled>
                  Selecione a propriedade
                </option>
                {(propriedades ?? []).map((propriedade) => (
                  <option key={propriedade.id} value={propriedade.id}>
                    {propriedade.nome}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline">
              Escolher
            </Button>
          </form>
        </CardContent>
      </Card>

      {propriedadeId && (
        <Card>
          <CardHeader>
            <CardTitle>2. Usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="GET" className="flex items-end gap-2">
              <input type="hidden" name="propriedade_id" value={propriedadeId} />
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="usuario_id">Usuário</Label>
                <Select id="usuario_id" name="usuario_id" defaultValue={usuarioId ?? ''}>
                  <option value="" disabled>
                    Selecione o usuário
                  </option>
                  {(usuariosDaPropriedade ?? []).map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.pessoas_fisicas?.nome ?? usuario.papel} ({usuario.papel})
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="outline">
                Escolher
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {propriedadeId && usuarioId && (
        <Card>
          <CardHeader>
            <CardTitle>3. Configuração de captura</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="POST" action="/api/admin/captura-leite" className="flex flex-col gap-4">
              <input type="hidden" name="propriedade_id" value={propriedadeId} />
              <input type="hidden" name="usuario_id" value={usuarioId} />

              <div className="flex flex-col gap-2">
                <Label htmlFor="estilo_interacao">Estilo de interação</Label>
                <Select
                  id="estilo_interacao"
                  name="estilo_interacao"
                  defaultValue={configuracaoAtual?.estilo_interacao ?? 'todos_visiveis'}
                >
                  <option value="todos_visiveis">Todos os campos visíveis</option>
                  <option value="tocar_para_revelar">Tocar para revelar</option>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Ordem dos campos (posição)</Label>
                {CAMPOS.map((campo) => (
                  <div key={campo.valor} className="flex items-center gap-2">
                    <Label htmlFor={`posicao_${campo.valor}`} className="flex-1">
                      {campo.rotulo}
                    </Label>
                    <Input
                      id={`posicao_${campo.valor}`}
                      name={`posicao_${campo.valor}`}
                      type="number"
                      min="1"
                      step="1"
                      className="w-20"
                      defaultValue={posicaoPorCampo.get(campo.valor) ?? ''}
                    />
                  </div>
                ))}
              </div>

              <Button type="submit">Salvar configuração</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Editar `web/app/dashboard/page.tsx`** — adicionar o link novo dentro do bloco já existente `{ehDevEstrito && (...)}`, ao lado do link para `captura-animal`:

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
  const ehDevEstrito = usuarioAtual?.papel === 'dev'
  const podeVerProducao = await temPermissao('producao', 'ver')
  const podeVerFinanceiroNegocio = await temPermissao('financeiro_negocio', 'ver')

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
        {ehDevEstrito && (
          <>
            <Link href="/dashboard/admin/captura-animal" className="underline">
              Motor de captura configurável
            </Link>
            <Link href="/dashboard/admin/captura-leite" className="underline">
              Motor de captura — Produção de leite
            </Link>
          </>
        )}
        {podeVerProducao && (
          <Link href="/dashboard/producao" className="underline">
            Produção
          </Link>
        )}
        {podeVerFinanceiroNegocio && (
          <Link href="/dashboard/financeiro-negocio" className="underline">
            Financeiro do negócio
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

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-dev.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=dev.teste@ademir.local" \
  --data-urlencode "password=senha-dev-123" -o /dev/null

echo "--- pagina de admin deve carregar (200) para o papel dev ---"
curl -s -o /dev/null -w "%{http_code}\n" -b cookies-dev.txt http://localhost:3000/dashboard/admin/captura-leite

echo "--- link deve aparecer no dashboard do dev ---"
curl -s -b cookies-dev.txt http://localhost:3000/dashboard | grep -o "Motor de captura — Produção de leite"

echo "--- usuario nao-dev deve ser bloqueado (redirect simples pra /dashboard) ---"
curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

curl -s -i -b cookies-admin.txt http://localhost:3000/dashboard/admin/captura-leite | grep -i "^location: .*/dashboard$"

ADMIN_USUARIO_ID=$(docker exec -i $(docker ps --filter "name=supabase_db" --format "{{.Names}}") \
  psql -U postgres -d postgres -tAc "select id from auth.users where email='admin.producao@ademir.local';" | tr -d '[:space:]')

echo "--- configurar tocar_para_revelar + ordem invertida para admin.producao ---"
curl -s -i -b cookies-dev.txt -X POST http://localhost:3000/api/admin/captura-leite \
  --data-urlencode "propriedade_id=00000000-0000-0000-0000-000000000001" \
  --data-urlencode "usuario_id=$ADMIN_USUARIO_ID" \
  --data-urlencode "estilo_interacao=tocar_para_revelar" \
  --data-urlencode "posicao_litros_comercial=3" \
  --data-urlencode "posicao_litros_descarte=1" \
  --data-urlencode "posicao_litros_consumo=2" | grep -i location

echo "--- pagina de admin deve refletir a configuracao salva ao recarregar ---"
curl -s -b cookies-dev.txt "http://localhost:3000/dashboard/admin/captura-leite?propriedade_id=00000000-0000-0000-0000-000000000001&usuario_id=$ADMIN_USUARIO_ID" | grep -o "tocar_para_revelar"

echo "--- limpar a configuracao de teste ---"
docker exec -i $(docker ps --filter "name=supabase_db" --format "{{.Names}}") \
  psql -U postgres -d postgres -c "delete from public.ordem_captura_leite where usuario_id='$ADMIN_USUARIO_ID'; delete from public.configuracoes_captura_leite where usuario_id='$ADMIN_USUARIO_ID';"

kill $DEV_PID
```

Expected: página de admin retorna `200` para o `dev`; dashboard do `dev` mostra o link; admin comum é redirecionado para `/dashboard` (sem parâmetro de erro); POST de configuração redireciona sem `error=`; página recarregada mostra `tocar_para_revelar` selecionado.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: adiciona tela de administracao do motor de captura configuravel para leite"
```

---

### Task 3: Aplicar configuração em `/dashboard/producao/leite`

**Files:**
- Modify: `web/app/dashboard/producao/leite/page.tsx`

**Interfaces:**
- Consumes: tabelas `configuracoes_captura_leite`, `ordem_captura_leite` (Task 1); `getUsuarioAtual`, `getUnidadeNegocioLeiteId`, `mensagemErro`, `mensagemAviso`, `GravadorAudio` (já existentes).

- [ ] **Step 1: Editar `web/app/dashboard/producao/leite/page.tsx`** para o conteúdo completo abaixo (busca a configuração do usuário logado, reordena os 3 campos, aplica estilo de interação; `GravadorAudio` permanece sempre no mesmo lugar, sem nenhuma mudança na rota `POST /api/producao/leite`):

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { mensagemErro, mensagemAviso } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { redirect } from 'next/navigation'
import { GravadorAudio } from './gravador-audio'

const CAMPOS = [
  { valor: 'litros_comercial', rotulo: 'Litros comercial' },
  { valor: 'litros_descarte', rotulo: 'Litros descarte' },
  { valor: 'litros_consumo', rotulo: 'Litros consumo' },
] as const

export default async function LancamentoLeitePage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; error?: string; aviso?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeVer = await temPermissao('producao', 'ver')
  if (!podeVer) {
    redirect('/dashboard')
  }

  const { data: dataParam, error, aviso } = await searchParams
  const mensagem = mensagemErro(error)
  const mensagemDeAviso = mensagemAviso(aviso)
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

  const { data: configuracao } = await supabase
    .from('configuracoes_captura_leite')
    .select('estilo_interacao')
    .eq('usuario_id', usuarioAtual.id)
    .maybeSingle()

  const { data: ordemConfigurada } = await supabase
    .from('ordem_captura_leite')
    .select('campo, posicao')
    .eq('usuario_id', usuarioAtual.id)

  const posicaoPorCampo = new Map(
    (ordemConfigurada ?? []).map((linha) => [linha.campo, linha.posicao])
  )

  const campos = [...CAMPOS].sort((a, b) => {
    const posicaoA = posicaoPorCampo.get(a.valor)
    const posicaoB = posicaoPorCampo.get(b.valor)

    if (posicaoA !== undefined && posicaoB !== undefined) {
      return posicaoA - posicaoB
    }
    if (posicaoA !== undefined) {
      return -1
    }
    if (posicaoB !== undefined) {
      return 1
    }
    return 0
  })

  const estiloInteracao = configuracao?.estilo_interacao ?? 'todos_visiveis'

  const valorPorCampo: Record<string, number> = {
    litros_comercial: lancamentoExistente?.litros_comercial ?? 0,
    litros_descarte: lancamentoExistente?.litros_descarte ?? 0,
    litros_consumo: lancamentoExistente?.litros_consumo ?? 0,
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Produção de leite do dia</CardTitle>
        </CardHeader>
        <CardContent>
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          {mensagemDeAviso && <p className="mb-4 text-sm text-amber-600">{mensagemDeAviso}</p>}
          <form
            method="POST"
            action="/api/producao/leite"
            encType="multipart/form-data"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" name="data" type="date" defaultValue={dataSelecionada} required />
            </div>
            {campos.map((campo) => {
              const inputCampo = (
                <Input
                  id={campo.valor}
                  name={campo.valor}
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={valorPorCampo[campo.valor]}
                  required
                />
              )

              if (estiloInteracao === 'tocar_para_revelar') {
                return (
                  <details key={campo.valor} className="rounded-lg border border-input p-3">
                    <summary className="cursor-pointer font-medium">{campo.rotulo}</summary>
                    <div className="mt-2 flex flex-col gap-2">{inputCampo}</div>
                  </details>
                )
              }

              return (
                <div key={campo.valor} className="flex flex-col gap-2">
                  <Label htmlFor={campo.valor}>{campo.rotulo}</Label>
                  {inputCampo}
                </div>
              )
            })}
            <GravadorAudio />
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

echo "--- sem configuracao: comportamento padrao (ordem comercial, descarte, consumo; sem <details>) ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/leite" -o /tmp/leite-sem-config.html
grep -c "<details" /tmp/leite-sem-config.html || echo "0 (esperado)"
grep -o "GravadorAudio\|Gravar" /tmp/leite-sem-config.html | head -1

curl -s -c cookies-dev.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=dev.teste@ademir.local" \
  --data-urlencode "password=senha-dev-123" -o /dev/null

ADMIN_USUARIO_ID=$(docker exec -i $(docker ps --filter "name=supabase_db" --format "{{.Names}}") \
  psql -U postgres -d postgres -tAc "select id from auth.users where email='admin.producao@ademir.local';" | tr -d '[:space:]')

echo "--- configurar tocar_para_revelar + ordem invertida (descarte, consumo, comercial) ---"
curl -s -b cookies-dev.txt -X POST http://localhost:3000/api/admin/captura-leite \
  --data-urlencode "propriedade_id=00000000-0000-0000-0000-000000000001" \
  --data-urlencode "usuario_id=$ADMIN_USUARIO_ID" \
  --data-urlencode "estilo_interacao=tocar_para_revelar" \
  --data-urlencode "posicao_litros_comercial=3" \
  --data-urlencode "posicao_litros_descarte=1" \
  --data-urlencode "posicao_litros_consumo=2" -o /dev/null

echo "--- com configuracao: <details> presente e ordem invertida ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/leite" -o /tmp/leite-com-config.html
grep -c "<details" /tmp/leite-com-config.html

echo "--- ordem deve ser Litros descarte, Litros consumo, Litros comercial (nessa sequencia no HTML) ---"
grep -o "Litros descarte\|Litros consumo\|Litros comercial" /tmp/leite-com-config.html

echo "--- audio (GravadorAudio) deve continuar presente mesmo com a configuracao ativa ---"
grep -o "Gravar" /tmp/leite-com-config.html | head -1

echo "--- limpar configuracao de teste ---"
docker exec -i $(docker ps --filter "name=supabase_db" --format "{{.Names}}") \
  psql -U postgres -d postgres -c "delete from public.ordem_captura_leite where usuario_id='$ADMIN_USUARIO_ID'; delete from public.configuracoes_captura_leite where usuario_id='$ADMIN_USUARIO_ID';"

kill $DEV_PID
```

Expected: antes de configurar, `grep -c "<details"` retorna `0`; depois de configurar, retorna um número maior que zero, e a sequência impressa por `grep -o` é `Litros descarte`, `Litros consumo`, `Litros comercial`, nessa ordem (confirma a reordenação — `litros_descarte` tem posição 1, `litros_consumo` posição 2, `litros_comercial` posição 3); `Gravar` aparece tanto antes quanto depois de configurar (confirma que o áudio permanece fixo, independente do estilo de interação).

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: aplica motor de captura configuravel a producao de leite agregada"
```
