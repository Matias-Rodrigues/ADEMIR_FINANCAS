# Motor de Captura Configurável Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o papel `dev` configure, por usuário, a ordem dos animais, o estilo de interação (todos os campos visíveis vs. tocar para revelar) e a exibição de categoria na tela `/dashboard/producao/leite/por-animal`, conforme `docs/superpowers/specs/2026-07-09-motor-captura-configuravel-design.md`.

**Architecture:** Duas tabelas novas (`configuracoes_captura_animal`, `ordem_captura_animal`) com RLS restrita a escrita só pelo papel `dev` (mesmo padrão de `propriedade_modulos_contratados`) e leitura pelo próprio usuário ou `dev`. Tela de administração nova (só `dev`) com fluxo de 3 seletores em cascata (propriedade → usuário → configuração), formulários HTML puros com `GET` para navegação e `POST` para salvar. A tela `/leite/por-animal` já existente passa a consultar a configuração do usuário logado e ajustar ordem/estilo/categoria — sem configuração, comportamento idêntico ao atual. "Tocar para revelar" é implementado com `<details>`/`<summary>` nativo do HTML, sem JavaScript.

**Tech Stack:** Postgres/Supabase local + pgTAP (backend); Next.js (App Router) + TypeScript + shadcn/ui (frontend, fundação já pronta).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Toda mutação de frontend é Route Handler HTML puro (`method="POST"`), sem JavaScript no cliente. "Tocar para revelar" usa `<details>`/`<summary>`, nunca `'use client'`/estado React.
- Só o papel `dev` (checagem estrita, não `admin`) acessa a tela e a rota de administração desta fatia.
- Configuração é por `usuario_id`, não por `propriedade_id` — usuários diferentes da mesma propriedade podem ter configurações diferentes.
- Ausência de configuração para um usuário = comportamento padrão atual (ordem por brinco, todos os campos visíveis, sem categoria) — nunca um erro.
- Toda mutação valida que `usuario_id` pertence à `propriedade_id` informada, e que cada `animal_id` recebido no formulário de posições pertence à mesma `propriedade_id`, **antes** de gravar qualquer coisa (validação completa primeiro, escrita depois — não gravar parcialmente e falhar no meio).
- Sem suíte de testes automatizados de frontend — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- O Supabase local precisa estar rodando; comandos do Supabase CLI rodam na raiz do repositório, comandos `npm`/`npx` do frontend rodam dentro de `web/`.

### Fixtures de teste

Reutiliza a propriedade seedada (`00000000-0000-0000-0000-000000000001`) e o admin de teste `admin.producao@ademir.local` / `senha-admin-123` (recrie via Admin API se não existir, conforme já documentado nos planos anteriores). Esta fatia também precisa de um usuário com `papel='dev'` para testar a tela de administração — se não existir no ambiente local, crie via Admin API (`POST /auth/v1/admin/users` com um e-mail de teste, ex. `dev.teste@ademir.local`) e insira a linha em `public.usuarios` com `papel='dev'` (a propriedade de vínculo desse usuário não importa — o papel `dev` tem acesso cross-propriedade por bypass de RLS).

---

### Task 1: Schema — tabelas `configuracoes_captura_animal` e `ordem_captura_animal`

**Files:**
- Create: `supabase/migrations/20260709174000_motor_captura_configuravel.sql`
- Create: `supabase/tests/database/38_motor_captura_configuravel.sql`

**Interfaces:**
- Consumes: `public.animais`, `public.propriedades`, `public.usuarios`, `public.usuario_eh_dev()`.
- Produces: tabelas `public.configuracoes_captura_animal` (`id`, `propriedade_id`, `usuario_id`, `estilo_interacao`, `exibir_categoria`, `criado_por`, `created_at`) e `public.ordem_captura_animal` (`id`, `propriedade_id`, `usuario_id`, `animal_id`, `posicao`, `created_at`) — consumidas pelas Tasks 2 e 3.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/38_motor_captura_configuravel.sql`:

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

insert into public.unidades_negocio (id, propriedade_id, nome, tipo)
  values ('22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', 'Gado leiteiro', 'leite');

select has_table('public', 'configuracoes_captura_animal', 'tabela configuracoes_captura_animal deve existir');
select has_table('public', 'ordem_captura_animal', 'tabela ordem_captura_animal deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '88888888-8888-8888-8888-888888888888')::text, true);
set local role authenticated;

insert into public.animais (id, propriedade_id, unidade_negocio_id, brinco, sexo, categoria, criado_por) values
  ('44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', '101', 'femea', 'vaca_lactacao', '88888888-8888-8888-8888-888888888888');

insert into public.configuracoes_captura_animal (propriedade_id, usuario_id, estilo_interacao, exibir_categoria, criado_por)
values ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', 'tocar_para_revelar', true, '88888888-8888-8888-8888-888888888888');

select is(
  (select count(*)::int from public.configuracoes_captura_animal),
  1,
  'dev deve conseguir configurar captura para usuario de propriedade que nao e a sua'
);

insert into public.ordem_captura_animal (propriedade_id, usuario_id, animal_id, posicao)
values ('77777777-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999', '44444444-4444-4444-4444-444444444444', 1);

select is(
  (select count(*)::int from public.ordem_captura_animal),
  1,
  'dev deve conseguir definir ordem de captura para animal de propriedade que nao e a sua'
);

select throws_ok(
  $$insert into public.configuracoes_captura_animal (propriedade_id, usuario_id, estilo_interacao, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'invalido', '33333333-3333-3333-3333-333333333333')$$,
  'new row for relation "configuracoes_captura_animal" violates check constraint "configuracoes_captura_animal_estilo_interacao_check"',
  'estilo_interacao fora da lista deve ser rejeitado'
);

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

select throws_ok(
  $$insert into public.configuracoes_captura_animal (propriedade_id, usuario_id, criado_por)
    values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333')$$,
  'new row violates row-level security policy for table "configuracoes_captura_animal"',
  'admin (nao-dev) nao deve conseguir configurar propria captura'
);

select set_config('request.jwt.claims', json_build_object('sub', '99999999-9999-9999-9999-999999999999')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.configuracoes_captura_animal),
  1,
  'usuario dono da configuracao deve conseguir ve-la (SELECT propria)'
);

select set_config('request.jwt.claims', json_build_object('sub', '66666666-6666-6666-6666-666666666666')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.configuracoes_captura_animal),
  0,
  'outro usuario da mesma propriedade nao deve ver configuracao alheia (isolamento por usuario, nao so por propriedade)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Da raiz do repositório:

```bash
npx supabase test db
```

Expected: falha em `has_table` (as tabelas ainda não existem).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260709174000_motor_captura_configuravel.sql`:

```sql
create table public.configuracoes_captura_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  estilo_interacao text not null default 'todos_visiveis'
    check (estilo_interacao in ('todos_visiveis', 'tocar_para_revelar')),
  exibir_categoria boolean not null default false,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (usuario_id)
);

alter table public.configuracoes_captura_animal enable row level security;

create index configuracoes_captura_animal_propriedade_id_idx on public.configuracoes_captura_animal(propriedade_id);
create index configuracoes_captura_animal_usuario_id_idx on public.configuracoes_captura_animal(usuario_id);

create policy "ver propria configuracao de captura ou dev ve qualquer uma"
  on public.configuracoes_captura_animal for select
  using (usuario_id = auth.uid() or public.usuario_eh_dev());

create policy "somente dev gerencia configuracao de captura"
  on public.configuracoes_captura_animal for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());

create table public.ordem_captura_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete cascade,
  posicao integer not null check (posicao > 0),
  created_at timestamptz not null default now(),
  unique (usuario_id, animal_id)
);

alter table public.ordem_captura_animal enable row level security;

create index ordem_captura_animal_propriedade_id_idx on public.ordem_captura_animal(propriedade_id);
create index ordem_captura_animal_usuario_id_idx on public.ordem_captura_animal(usuario_id);

create policy "ver propria ordem de captura ou dev ve qualquer uma"
  on public.ordem_captura_animal for select
  using (usuario_id = auth.uid() or public.usuario_eh_dev());

create policy "somente dev gerencia ordem de captura"
  on public.ordem_captura_animal for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 8 testes de `38_motor_captura_configuravel.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts 2>/dev/null
cd ..
```

**Atenção:** use `2>/dev/null` para evitar que texto de status do CLI vaze para dentro do arquivo. Confirme que a primeira linha é `export type Json = ...` e rode `npx tsc --noEmit` dentro de `web/`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260709174000_motor_captura_configuravel.sql supabase/tests/database/38_motor_captura_configuravel.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona tabelas do motor de captura configuravel"
```

---

### Task 2: Backend e tela de administração (papel dev)

**Files:**
- Modify: `web/lib/auth/current-usuario.ts`
- Modify: `web/lib/erros-formulario.ts`
- Create: `web/app/api/admin/captura-animal/route.ts`
- Create: `web/app/dashboard/admin/captura-animal/page.tsx`
- Modify: `web/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getUsuarioAtual`, `UsuarioAtual` (já existentes); tabelas `configuracoes_captura_animal`, `ordem_captura_animal` (Task 1).
- Produces: `ehDev(usuario: UsuarioAtual | null): boolean` em `current-usuario.ts` — consumida pela Task 3 não é necessária (a Task 3 só lê as tabelas, não precisa da checagem de dev), mas é usada aqui e fica disponível para qualquer tela futura só-dev.

- [ ] **Step 1: Editar `web/lib/auth/current-usuario.ts`** — adicionar a função `ehDev`, logo abaixo de `ehAdminOuDev`:

```ts
export function ehDev(usuario: UsuarioAtual | null): usuario is UsuarioAtual {
  return usuario !== null && usuario.papel === 'dev'
}
```

- [ ] **Step 2: Editar `web/lib/erros-formulario.ts`** — adicionar os códigos que faltam ao objeto `MENSAGENS`:

```ts
  usuario_invalido: 'Selecione um usuário válido.',
  animal_invalido: 'Um ou mais animais selecionados são inválidos.',
  posicao_invalida: 'Informe uma posição válida (número inteiro maior que zero).',
```

- [ ] **Step 3: Criar `web/app/api/admin/captura-animal/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual, ehDev } from '@/lib/auth/current-usuario'
import { NextResponse } from 'next/server'

const ESTILOS_VALIDOS = ['todos_visiveis', 'tocar_para_revelar']

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
  const exibirCategoria = formData.get('exibir_categoria') !== null

  const redirecionarComErro = (codigo: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/admin/captura-animal?propriedade_id=${propriedadeId}&usuario_id=${usuarioId}&error=${codigo}`,
        request.url
      ),
      { status: 303 }
    )

  if (!ESTILOS_VALIDOS.includes(estiloInteracao)) {
    return redirecionarComErro('dados_invalidos')
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

  const { data: animaisValidos } = await supabase
    .from('animais')
    .select('id')
    .eq('propriedade_id', propriedadeId)

  const idsValidos = new Set((animaisValidos ?? []).map((animal) => animal.id))

  const posicoesForm: { animalId: string; posicaoTexto: string }[] = []
  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith('posicao_')) {
      continue
    }
    posicoesForm.push({
      animalId: chave.slice('posicao_'.length),
      posicaoTexto: String(valor).trim(),
    })
  }

  for (const { animalId } of posicoesForm) {
    if (!idsValidos.has(animalId)) {
      return redirecionarComErro('animal_invalido')
    }
  }

  for (const { posicaoTexto } of posicoesForm) {
    if (posicaoTexto === '') {
      continue
    }
    const posicao = Number(posicaoTexto)
    if (Number.isNaN(posicao) || posicao <= 0 || !Number.isInteger(posicao)) {
      return redirecionarComErro('posicao_invalida')
    }
  }

  const { error: erroInsertConfig } = await supabase.from('configuracoes_captura_animal').insert({
    propriedade_id: propriedadeId,
    usuario_id: usuarioId,
    estilo_interacao: estiloInteracao,
    exibir_categoria: exibirCategoria,
    criado_por: usuarioAtual.id,
  })

  if (erroInsertConfig) {
    if (erroInsertConfig.code !== '23505') {
      return redirecionarComErro('erro_inesperado')
    }

    const { error: erroUpdateConfig } = await supabase
      .from('configuracoes_captura_animal')
      .update({ estilo_interacao: estiloInteracao, exibir_categoria: exibirCategoria })
      .eq('usuario_id', usuarioId)

    if (erroUpdateConfig) {
      return redirecionarComErro('erro_inesperado')
    }
  }

  let algumaPosicaoFalhou = false

  for (const { animalId, posicaoTexto } of posicoesForm) {
    if (posicaoTexto === '') {
      continue
    }

    const posicao = Number(posicaoTexto)

    const { error: erroInsertPosicao } = await supabase.from('ordem_captura_animal').insert({
      propriedade_id: propriedadeId,
      usuario_id: usuarioId,
      animal_id: animalId,
      posicao,
    })

    if (erroInsertPosicao) {
      if (erroInsertPosicao.code !== '23505') {
        algumaPosicaoFalhou = true
        continue
      }

      const { error: erroUpdatePosicao } = await supabase
        .from('ordem_captura_animal')
        .update({ posicao })
        .eq('usuario_id', usuarioId)
        .eq('animal_id', animalId)

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
      `/dashboard/admin/captura-animal?propriedade_id=${propriedadeId}&usuario_id=${usuarioId}`,
      request.url
    ),
    { status: 303 }
  )
}
```

- [ ] **Step 4: Criar `web/app/dashboard/admin/captura-animal/page.tsx`**

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

export default async function CapturaAnimalAdminPage({
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

  const { data: animais } = propriedadeId
    ? await supabase
        .from('animais')
        .select('id, brinco, nome')
        .eq('propriedade_id', propriedadeId)
        .eq('categoria', 'vaca_lactacao')
        .eq('ativo', true)
        .order('brinco')
    : { data: [] }

  const { data: configuracaoAtual } = usuarioId
    ? await supabase
        .from('configuracoes_captura_animal')
        .select('estilo_interacao, exibir_categoria')
        .eq('usuario_id', usuarioId)
        .maybeSingle()
    : { data: null }

  const { data: ordemAtual } = usuarioId
    ? await supabase.from('ordem_captura_animal').select('animal_id, posicao').eq('usuario_id', usuarioId)
    : { data: [] }

  const posicaoPorAnimal = new Map((ordemAtual ?? []).map((linha) => [linha.animal_id, linha.posicao]))

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">Motor de captura configurável</h1>

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
            {(animais ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum animal ativo em lactação cadastrado para esta propriedade.
              </p>
            ) : (
              <form method="POST" action="/api/admin/captura-animal" className="flex flex-col gap-4">
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

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="exibir_categoria"
                    defaultChecked={configuracaoAtual?.exibir_categoria ?? false}
                  />
                  Exibir categoria do animal
                </label>

                <div className="flex flex-col gap-2">
                  <Label>Ordem dos animais (posição)</Label>
                  {(animais ?? []).map((animal) => (
                    <div key={animal.id} className="flex items-center gap-2">
                      <Label htmlFor={`posicao_${animal.id}`} className="flex-1">
                        {animal.brinco}
                        {animal.nome && ` · ${animal.nome}`}
                      </Label>
                      <Input
                        id={`posicao_${animal.id}`}
                        name={`posicao_${animal.id}`}
                        type="number"
                        min="1"
                        step="1"
                        className="w-20"
                        defaultValue={posicaoPorAnimal.get(animal.id) ?? ''}
                      />
                    </div>
                  ))}
                </div>

                <Button type="submit">Salvar configuração</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
```

- [ ] **Step 5: Editar `web/app/dashboard/page.tsx`** para adicionar o link, visível só para `papel === 'dev'` (estritamente, não `admin`). Substitua o bloco `{ehAdminOuDev && (...)}` para incluir o novo link condicionado separadamente:

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
          <Link href="/dashboard/admin/captura-animal" className="underline">
            Motor de captura configurável
          </Link>
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

- [ ] **Step 6: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 7: Verificar via curl**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

# Login como dev (crie a fixture antes se nao existir, conforme "Fixtures de teste")
curl -s -c cookies-dev.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=dev.teste@ademir.local" \
  --data-urlencode "password=senha-dev-123" -o /dev/null

echo "--- pagina de admin deve carregar (200) para o papel dev ---"
curl -s -o /dev/null -w "%{http_code}\n" -b cookies-dev.txt http://localhost:3000/dashboard/admin/captura-animal

echo "--- link 'Motor de captura configuravel' deve aparecer no dashboard do dev ---"
curl -s -b cookies-dev.txt http://localhost:3000/dashboard | grep -o "Motor de captura configurável"

echo "--- usuario nao-dev (admin comum) deve ser bloqueado ---"
curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

curl -s -i -b cookies-admin.txt http://localhost:3000/dashboard/admin/captura-animal | grep -i "^location: .*/dashboard$"

# Descobrir o usuario_id do admin.producao para configura-lo
ADMIN_USUARIO_ID=$(docker exec -i $(docker ps --filter "name=supabase_db" --format "{{.Names}}") \
  psql -U postgres -d postgres -tAc "select id from auth.users where email='admin.producao@ademir.local';" | tr -d '[:space:]')

echo "--- ADMIN_USUARIO_ID capturado: $ADMIN_USUARIO_ID ---"

echo "--- configurar captura para o admin.producao, como dev ---"
curl -s -i -b cookies-dev.txt -X POST http://localhost:3000/api/admin/captura-animal \
  --data-urlencode "propriedade_id=00000000-0000-0000-0000-000000000001" \
  --data-urlencode "usuario_id=$ADMIN_USUARIO_ID" \
  --data-urlencode "estilo_interacao=tocar_para_revelar" \
  --data-urlencode "exibir_categoria=on" | grep -i location

echo "--- pagina de admin deve refletir a configuracao salva ao recarregar ---"
curl -s -b cookies-dev.txt "http://localhost:3000/dashboard/admin/captura-animal?propriedade_id=00000000-0000-0000-0000-000000000001&usuario_id=$ADMIN_USUARIO_ID" | grep -o "tocar_para_revelar"

echo "--- limpar a configuracao de teste para nao afetar verificacoes futuras ---"
docker exec -i $(docker ps --filter "name=supabase_db" --format "{{.Names}}") \
  psql -U postgres -d postgres -c "delete from public.ordem_captura_animal where usuario_id='$ADMIN_USUARIO_ID'; delete from public.configuracoes_captura_animal where usuario_id='$ADMIN_USUARIO_ID';"

kill $DEV_PID
```

Expected: página de admin retorna `200` para o `dev`; dashboard do `dev` mostra o link; admin comum é redirecionado para `/dashboard` (sem parâmetro de erro, mesmo padrão de todas as outras páginas do projeto); POST de configuração redireciona sem `error=`; página recarregada mostra `tocar_para_revelar` selecionado.

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat: adiciona tela de administracao do motor de captura configuravel"
```

---

### Task 3: Aplicar configuração em `/leite/por-animal`

**Files:**
- Modify: `web/app/dashboard/producao/leite/por-animal/page.tsx`

**Interfaces:**
- Consumes: tabelas `configuracoes_captura_animal`, `ordem_captura_animal` (Task 1); `getUsuarioAtual`, `getUnidadeNegocioLeiteId`, `mensagemErro` (já existentes).

- [ ] **Step 1: Editar `web/app/dashboard/producao/leite/por-animal/page.tsx`** para o conteúdo completo abaixo (busca a configuração do usuário logado, reordena os animais, aplica estilo de interação e exibição de categoria — sem nenhuma mudança na rota `POST /api/producao/leite/por-animal`, que continua recebendo os mesmos nomes de campo `litros_<animal_id>` independente do layout):

```tsx
import { createClient } from '@/lib/supabase/server'
import { getUsuarioAtual } from '@/lib/auth/current-usuario'
import { temPermissao } from '@/lib/auth/tem-permissao'
import { getUnidadeNegocioLeiteId } from '@/lib/producao/unidade-negocio'
import { mensagemErro } from '@/lib/erros-formulario'
import { Button } from '@/components/ui/button'
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

export default async function ProducaoPorAnimalPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; ordenha?: string; error?: string }>
}) {
  const usuarioAtual = await getUsuarioAtual()
  if (!usuarioAtual) {
    redirect('/login')
  }

  const podeLancar = await temPermissao('producao', 'lancar')
  if (!podeLancar) {
    redirect('/dashboard')
  }

  const { data: dataParam, ordenha: ordenhaParam, error } = await searchParams
  const mensagem = mensagemErro(error)

  const hoje = new Date().toISOString().slice(0, 10)
  const data = dataParam || hoje
  const numeroOrdenha = Number(ordenhaParam) || 1

  const supabase = await createClient()
  const unidadeNegocioId = await getUnidadeNegocioLeiteId(supabase, usuarioAtual.propriedade_id)

  const { data: animaisBrutos } = unidadeNegocioId
    ? await supabase
        .from('animais')
        .select('id, brinco, nome, categoria')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .eq('categoria', 'vaca_lactacao')
        .eq('ativo', true)
        .order('brinco')
    : { data: [] }

  const { data: lancamentosExistentes } = unidadeNegocioId
    ? await supabase
        .from('producao_animal')
        .select('animal_id, litros')
        .eq('unidade_negocio_id', unidadeNegocioId)
        .eq('data', data)
        .eq('numero_ordenha', numeroOrdenha)
    : { data: [] }

  const litrosPorAnimal = new Map(
    (lancamentosExistentes ?? []).map((lancamento) => [lancamento.animal_id, lancamento.litros])
  )

  const { data: configuracao } = await supabase
    .from('configuracoes_captura_animal')
    .select('estilo_interacao, exibir_categoria')
    .eq('usuario_id', usuarioAtual.id)
    .maybeSingle()

  const { data: ordemConfigurada } = await supabase
    .from('ordem_captura_animal')
    .select('animal_id, posicao')
    .eq('usuario_id', usuarioAtual.id)

  const posicaoPorAnimal = new Map(
    (ordemConfigurada ?? []).map((linha) => [linha.animal_id, linha.posicao])
  )

  const animais = [...(animaisBrutos ?? [])].sort((a, b) => {
    const posicaoA = posicaoPorAnimal.get(a.id)
    const posicaoB = posicaoPorAnimal.get(b.id)

    if (posicaoA !== undefined && posicaoB !== undefined) {
      return posicaoA - posicaoB
    }
    if (posicaoA !== undefined) {
      return -1
    }
    if (posicaoB !== undefined) {
      return 1
    }
    return a.brinco.localeCompare(b.brinco)
  })

  const estiloInteracao = configuracao?.estilo_interacao ?? 'todos_visiveis'
  const exibirCategoria = configuracao?.exibir_categoria ?? false

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-lg font-medium">Produção por animal</h1>

      <form method="GET" className="flex items-end gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="data">Data</Label>
          <Input id="data" name="data" type="date" defaultValue={data} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ordenha">Ordenha</Label>
          <Select id="ordenha" name="ordenha" defaultValue={String(numeroOrdenha)} className="w-24">
            <option value="1">1ª</option>
            <option value="2">2ª</option>
            <option value="3">3ª</option>
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Carregar
        </Button>
      </form>

      {mensagem && <p className="text-sm text-destructive">{mensagem}</p>}

      {animais.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum animal ativo em lactação cadastrado para esta unidade.
        </p>
      ) : (
        <form method="POST" action="/api/producao/leite/por-animal" className="flex flex-col gap-4">
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="numero_ordenha" value={numeroOrdenha} />
          {animais.map((animal) => {
            const rotuloCategoria = CATEGORIAS.find((c) => c.valor === animal.categoria)?.rotulo
            const rotulo = (
              <>
                {animal.brinco}
                {animal.nome && ` · ${animal.nome}`}
                {exibirCategoria && rotuloCategoria && ` · ${rotuloCategoria}`}
              </>
            )
            const campo = (
              <Input
                id={`litros_${animal.id}`}
                name={`litros_${animal.id}`}
                type="number"
                step="0.01"
                min="0"
                defaultValue={litrosPorAnimal.get(animal.id) ?? ''}
              />
            )

            if (estiloInteracao === 'tocar_para_revelar') {
              return (
                <details key={animal.id} className="rounded-lg border border-input p-3">
                  <summary className="cursor-pointer font-medium">{rotulo}</summary>
                  <div className="mt-2 flex flex-col gap-2">
                    <Label htmlFor={`litros_${animal.id}`}>Litros</Label>
                    {campo}
                  </div>
                </details>
              )
            }

            return (
              <div key={animal.id} className="flex flex-col gap-2">
                <Label htmlFor={`litros_${animal.id}`}>{rotulo}</Label>
                {campo}
              </div>
            )
          })}
          <Button type="submit">Salvar lançamentos</Button>
        </form>
      )}
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

echo "--- sem configuracao: comportamento padrao (sem <details>, sem categoria) ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/leite/por-animal" -o /tmp/por-animal-sem-config.html
grep -c "<details" /tmp/por-animal-sem-config.html || echo "0 (esperado)"
grep -o "Vaca em lactação" /tmp/por-animal-sem-config.html || echo "ausente (esperado)"

curl -s -c cookies-dev.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=dev.teste@ademir.local" \
  --data-urlencode "password=senha-dev-123" -o /dev/null

ADMIN_USUARIO_ID=$(docker exec -i $(docker ps --filter "name=supabase_db" --format "{{.Names}}") \
  psql -U postgres -d postgres -tAc "select id from auth.users where email='admin.producao@ademir.local';" | tr -d '[:space:]')

echo "--- configurar tocar_para_revelar + exibir categoria para admin.producao ---"
curl -s -b cookies-dev.txt -X POST http://localhost:3000/api/admin/captura-animal \
  --data-urlencode "propriedade_id=00000000-0000-0000-0000-000000000001" \
  --data-urlencode "usuario_id=$ADMIN_USUARIO_ID" \
  --data-urlencode "estilo_interacao=tocar_para_revelar" \
  --data-urlencode "exibir_categoria=on" -o /dev/null

echo "--- com configuracao: <details> e categoria devem aparecer para admin.producao ---"
curl -s -b cookies-admin.txt "http://localhost:3000/dashboard/producao/leite/por-animal" -o /tmp/por-animal-com-config.html
grep -c "<details" /tmp/por-animal-com-config.html
grep -o "Vaca em lactação" /tmp/por-animal-com-config.html | head -1

echo "--- limpar configuracao de teste ---"
docker exec -i $(docker ps --filter "name=supabase_db" --format "{{.Names}}") \
  psql -U postgres -d postgres -c "delete from public.ordem_captura_animal where usuario_id='$ADMIN_USUARIO_ID'; delete from public.configuracoes_captura_animal where usuario_id='$ADMIN_USUARIO_ID';"

kill $DEV_PID
```

Expected: antes de configurar, `grep -c "<details"` retorna `0` e a categoria não aparece; depois de configurar, `grep -c "<details"` retorna um número maior que zero e `Vaca em lactação` aparece pelo menos uma vez.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: aplica motor de captura configuravel a producao por animal"
```
