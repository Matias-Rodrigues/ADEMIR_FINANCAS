# Captura Assistida por Voz — Produção de Leite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender o lançamento de produção de leite para aceitar áudio opcional de observações — números continuam sempre digitados, o áudio só gera texto de contexto, processado de forma síncrona e nunca bloqueante — conforme `docs/superpowers/specs/2026-07-08-captura-voz-producao-leite-design.md`.

**Architecture:** `alter table` em `producao_leite` (3 colunas novas + novo valor de `origem`) + bucket privado no Supabase Storage com RLS por propriedade. Frontend ganha o primeiro client component do projeto (gravação via `MediaRecorder`, inevitável — API só existe no navegador), mas o formulário continua um `<form>` HTML nativo (o componente só popula um `<input type="file">` oculto via `DataTransfer`, então a submissão em si continua sendo um POST nativo, sem fetch/JS na submissão). Backend chama Groq (transcrição) e Claude API (síntese das observações) de forma síncrona dentro da mesma requisição, com fallback silencioso — qualquer falha no processamento do áudio nunca impede salvar os números.

**Tech Stack:** Postgres/Supabase local + pgTAP (backend); Next.js (App Router) + TypeScript (frontend); `groq-sdk` e `@anthropic-ai/sdk` (novas dependências).

## Global Constraints

- Nenhuma migration histórica já aplicada é editada diretamente — toda mudança usa `alter table`/`create policy` numa migration nova.
- Testes em pgTAP via `npx supabase test db` (raiz do repositório), todo teste dentro de `begin; ... rollback;`.
- Números (litros comercial/descarte/consumo) são sempre digitados e nunca dependem de IA nesta fatia — a extração de números por voz fica fora de escopo.
- Qualquer falha no processamento do áudio (upload, Groq, Claude, ou chaves de API ausentes) é capturada e **nunca** impede salvar os 3 valores numéricos — degrada silenciosamente para `origem = 'manual'`, `observacoes`/`transcricao`/`audio_paths` nulos, e um aviso não-bloqueante (`?aviso=audio_falhou`) é adicionado ao redirect de sucesso.
- Sem tabela nova — só colunas novas em `producao_leite` e o bucket de Storage.
- Sem tela de revisão/pendências.
- Sem suíte de testes automatizados de frontend — verificação via `npm run build` / `npx tsc --noEmit` + `curl` com cookie jar.
- O Supabase local precisa estar rodando; comandos do Supabase CLI rodam na raiz do repositório, comandos `npm`/`npx` do frontend rodam dentro de `web/`.

### Fixtures de teste

Reutiliza a propriedade seedada (`00000000-0000-0000-0000-000000000001`) e a unidade de negócio "Gado leiteiro" (`00000000-0000-0000-0000-000000000002`, `tipo = 'leite'`). Admin de teste: `admin.producao@ademir.local` / `senha-admin-123` (se a fixture não existir no ambiente local, recrie via Admin API: `POST /auth/v1/admin/users` + insert em `public.usuarios` com `propriedade_id=00000000-0000-0000-0000-000000000001`, `papel=admin`).

---

### Task 1: Schema — colunas de captura de áudio + bucket de Storage

**Files:**
- Create: `supabase/migrations/20260708160000_producao_leite_captura_audio.sql`
- Create: `supabase/tests/database/33_producao_leite_captura_audio.sql`

**Interfaces:**
- Consumes: `public.producao_leite` (já existente), `public.usuario_propriedade_id()`.
- Produces: colunas `observacoes`, `transcricao`, `audio_paths` em `producao_leite`; valor `'app_audio'` aceito em `origem`; bucket `capturas-audio` com policies de isolamento por propriedade — consumidos pela Task 4.

- [ ] **Step 1: Escrever o teste (falhando)**

`supabase/tests/database/33_producao_leite_captura_audio.sql`:

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

select has_column('public', 'producao_leite', 'observacoes', 'coluna observacoes deve existir');
select has_column('public', 'producao_leite', 'transcricao', 'coluna transcricao deve existir');
select has_column('public', 'producao_leite', 'audio_paths', 'coluna audio_paths deve existir');

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
set local role authenticated;

insert into public.producao_leite
  (propriedade_id, unidade_negocio_id, data, litros_comercial, litros_descarte, litros_consumo, criado_por, origem, observacoes, transcricao, audio_paths)
values
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-08', 1000, 10, 6, '33333333-3333-3333-3333-333333333333', 'app_audio', 'Vaca 12 mancando', 'a vaca doze ta mancando hoje', array['11111111-1111-1111-1111-111111111111/66666666-6666-6666-6666-666666666666/2026-07-08-1.webm']);

select is(
  (select origem from public.producao_leite where data = '2026-07-08'),
  'app_audio',
  'origem app_audio deve ser aceita'
);

select throws_ok(
  $$insert into public.producao_leite
    (propriedade_id, unidade_negocio_id, data, litros_comercial, litros_descarte, litros_consumo, criado_por, origem)
    values ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-07-09', 100, 0, 0, '33333333-3333-3333-3333-333333333333', 'origem_invalida')$$,
  'new row for relation "producao_leite" violates check constraint "producao_leite_origem_check"',
  'origem fora da lista continua rejeitada'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Da raiz do repositório:

```bash
npx supabase test db
```

Expected: falha em `has_column` (as 3 colunas ainda não existem).

- [ ] **Step 3: Criar a migration**

`supabase/migrations/20260708160000_producao_leite_captura_audio.sql`:

```sql
alter table public.producao_leite
  add column observacoes text,
  add column transcricao text,
  add column audio_paths text[];

alter table public.producao_leite drop constraint producao_leite_origem_check;
alter table public.producao_leite add constraint producao_leite_origem_check
  check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual', 'app_audio'));

insert into storage.buckets (id, name, public) values ('capturas-audio', 'capturas-audio', false);

create policy "upload de audio da propria propriedade"
  on storage.objects for insert
  with check (
    bucket_id = 'capturas-audio'
    and (storage.foldername(name))[1] = (public.usuario_propriedade_id())::text
  );

create policy "leitura de audio da propria propriedade"
  on storage.objects for select
  using (
    bucket_id = 'capturas-audio'
    and (storage.foldername(name))[1] = (public.usuario_propriedade_id())::text
  );
```

**Atenção:** o nome da constraint (`producao_leite_origem_check`) é o gerado automaticamente pelo Postgres para um `check` inline sem nome explícito na criação da tabela (`<tabela>_<coluna>_check`) — já confirmado nesse padrão em outras tabelas do projeto (ex: `lancamentos_financeiros_negocio_valor_check`). Se o `drop constraint` falhar por nome incorreto, rode `\d producao_leite` no psql local para confirmar o nome real antes de ajustar.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx supabase test db
```

Expected: os 5 testes de `33_producao_leite_captura_audio.sql` passam (e todos os anteriores continuam passando).

- [ ] **Step 5: Regenerar os tipos TypeScript**

```bash
cd web
npx supabase gen types typescript --local > lib/supabase/database.types.ts 2>/dev/null
cd ..
```

Confirme que a primeira linha do arquivo é `export type Json = ...`, e rode `npx tsc --noEmit` (dentro de `web/`) para confirmar que o arquivo é válido. Desta vez o arquivo DEVE mudar (colunas novas em `producao_leite`) — confirme com `git diff web/lib/supabase/database.types.ts` que `observacoes`, `transcricao`, `audio_paths` aparecem no tipo `producao_leite`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260708160000_producao_leite_captura_audio.sql supabase/tests/database/33_producao_leite_captura_audio.sql web/lib/supabase/database.types.ts
git commit -m "feat: adiciona colunas de captura de audio e bucket de storage a producao de leite"
```

---

### Task 2: Dependências + helper de processamento de áudio (Groq + Claude)

**Files:**
- Modify: `web/package.json` (adicionar `groq-sdk` e `@anthropic-ai/sdk`)
- Modify: `web/.env.example` (adicionar `GROQ_API_KEY=` e `ANTHROPIC_API_KEY=`)
- Create: `web/lib/producao/captura-audio.ts`

**Interfaces:**
- Consumes: `SupabaseClient<Database>` (`@supabase/supabase-js` + `@/lib/supabase/database.types`), variáveis de ambiente `GROQ_API_KEY`/`ANTHROPIC_API_KEY`.
- Produces: `processarCapturaAudio(supabase, arquivos, propriedadeId, unidadeNegocioId, data): Promise<ResultadoCapturaAudio>` e o tipo `ResultadoCapturaAudio` — consumidos pela Task 4.

- [ ] **Step 1: Instalar as dependências**

```bash
cd web
npm install groq-sdk @anthropic-ai/sdk
cd ..
```

- [ ] **Step 2: Adicionar as variáveis de ambiente ao exemplo**

Editar `web/.env.example`, adicionando ao final:

```
GROQ_API_KEY=
ANTHROPIC_API_KEY=
```

(Estas chaves precisam ser preenchidas com valores reais em `web/.env.local` pelo usuário — fora do escopo desta task, que só documenta a variável esperada.)

- [ ] **Step 3: Criar `web/lib/producao/captura-audio.ts`**

```ts
import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type ResultadoCapturaAudio = {
  audioPaths: string[]
  transcricao: string
  observacoes: string
} | null

export async function processarCapturaAudio(
  supabase: SupabaseClient<Database>,
  arquivos: File[],
  propriedadeId: string,
  unidadeNegocioId: string,
  data: string
): Promise<ResultadoCapturaAudio> {
  const groqApiKey = process.env.GROQ_API_KEY
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!groqApiKey || !anthropicApiKey || arquivos.length === 0) {
    return null
  }

  try {
    const audioPaths: string[] = []
    const groq = new Groq({ apiKey: groqApiKey })
    const transcricoes: string[] = []

    for (let indice = 0; indice < arquivos.length; indice++) {
      const arquivo = arquivos[indice]
      const extensao = arquivo.type.includes('mp4') ? 'mp4' : 'webm'
      const path = `${propriedadeId}/${unidadeNegocioId}/${data}-${Date.now()}-${indice}.${extensao}`

      const { error: erroUpload } = await supabase.storage
        .from('capturas-audio')
        .upload(path, arquivo, { contentType: arquivo.type })

      if (erroUpload) {
        throw new Error(`falha no upload do audio ${indice}: ${erroUpload.message}`)
      }

      audioPaths.push(path)

      const transcricao = await groq.audio.transcriptions.create({
        file: arquivo,
        model: 'whisper-large-v3',
        language: 'pt',
      })

      transcricoes.push(transcricao.text)
    }

    const transcricaoCompleta = transcricoes.join('\n')

    const anthropic = new Anthropic({ apiKey: anthropicApiKey })
    const mensagem = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Limpe e sintetize em português estas observações faladas por um produtor rural durante uma visita à propriedade, mantendo os fatos e removendo repetições/hesitações. Responda só com o texto sintetizado, sem introdução. Texto bruto: """${transcricaoCompleta}"""`,
        },
      ],
    })

    const primeiroBloco = mensagem.content[0]
    const observacoes = primeiroBloco.type === 'text' ? primeiroBloco.text : transcricaoCompleta

    return { audioPaths, transcricao: transcricaoCompleta, observacoes }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Verificar build**

```bash
cd web && npx tsc --noEmit && cd ..
```

Não é necessário `npm run build` completo nesta task (o arquivo ainda não é consumido por nenhuma página/rota) — só `tsc --noEmit` para confirmar que o módulo compila.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/.env.example web/lib/producao/captura-audio.ts
git commit -m "feat: adiciona dependencias e helper de processamento de audio (groq+claude)"
```

---

### Task 3: Frontend — componente de gravação de áudio

**Files:**
- Create: `web/app/dashboard/producao/leite/gravador-audio.tsx`
- Modify: `web/app/dashboard/producao/leite/page.tsx`

**Interfaces:**
- Produces: componente `GravadorAudio` (client component, sem props) — renderiza um `<input type="file" name="audio" multiple>` oculto que o formulário da página já existente passa a enviar junto.

- [ ] **Step 1: Criar `web/app/dashboard/producao/leite/gravador-audio.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type Clipe = {
  id: string
  blob: Blob
  url: string
}

export function GravadorAudio() {
  const [clipes, setClipes] = useState<Clipe[]>([])
  const [gravando, setGravando] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function sincronizarInput(novosClipes: Clipe[]) {
    if (!inputRef.current) return
    const dataTransfer = new DataTransfer()
    novosClipes.forEach((clipe, indice) => {
      const extensao = clipe.blob.type.includes('mp4') ? 'mp4' : 'webm'
      dataTransfer.items.add(
        new File([clipe.blob], `observacao-${indice}.${extensao}`, { type: clipe.blob.type })
      )
    })
    inputRef.current.files = dataTransfer.files
  }

  async function iniciarGravacao() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    chunksRef.current = []

    mediaRecorder.ondataavailable = (evento) => {
      if (evento.data.size > 0) {
        chunksRef.current.push(evento.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
      const novoClipe: Clipe = { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) }
      setClipes((atuais) => {
        const atualizados = [...atuais, novoClipe]
        sincronizarInput(atualizados)
        return atualizados
      })
      stream.getTracks().forEach((track) => track.stop())
    }

    mediaRecorder.start()
    mediaRecorderRef.current = mediaRecorder
    setGravando(true)
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop()
    setGravando(false)
  }

  function excluirClipe(id: string) {
    setClipes((atuais) => {
      const atualizados = atuais.filter((clipe) => clipe.id !== id)
      sincronizarInput(atualizados)
      return atualizados
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} type="file" name="audio" multiple accept="audio/*" className="hidden" />
      <Button type="button" variant="outline" onClick={gravando ? pararGravacao : iniciarGravacao}>
        {gravando ? 'Parar gravação' : 'Gravar observação'}
      </Button>
      {clipes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {clipes.map((clipe, indice) => (
            <li
              key={clipe.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-input p-2 text-sm"
            >
              <span>Observação {indice + 1}</span>
              <audio controls src={clipe.url} className="h-8" />
              <Button type="button" variant="ghost" onClick={() => excluirClipe(clipe.id)}>
                Excluir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Editar `web/app/dashboard/producao/leite/page.tsx`**

Adicionar o import no topo do arquivo (junto aos outros imports):

```tsx
import { GravadorAudio } from './gravador-audio'
```

Alterar a tag do `<form>` (linha `<form method="POST" action="/api/producao/leite" className="flex flex-col gap-4">`) para incluir `encType`:

```tsx
          <form
            method="POST"
            action="/api/producao/leite"
            encType="multipart/form-data"
            className="flex flex-col gap-4"
          >
```

Inserir `<GravadorAudio />` dentro do formulário, logo antes do `<Button type="submit">`:

```tsx
            <GravadorAudio />
            <Button type="submit">{lancamentoExistente ? 'Salvar alterações' : 'Lançar'}</Button>
```

- [ ] **Step 3: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 4: Verificar via curl que o input de áudio está presente na página renderizada**

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "--- input de audio deve estar presente na pagina ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/leite | grep -o 'name="audio"'

echo "--- encType multipart deve estar presente ---"
curl -s -b cookies-admin.txt http://localhost:3000/dashboard/producao/leite | grep -o 'enctype="multipart/form-data"'

kill $DEV_PID
```

Expected: ambos os `grep` imprimem a linha encontrada (confirma que o input de áudio e o `enctype` estão na página renderizada). A gravação de fato (via `MediaRecorder`) só pode ser verificada num navegador real com microfone — não é possível simular via curl; isso fica como verificação manual complementar fora desta task.

- [ ] **Step 5: Commit**

```bash
git add web/app/dashboard/producao/leite/gravador-audio.tsx web/app/dashboard/producao/leite/page.tsx
git commit -m "feat: adiciona gravacao de audio de observacao a producao de leite"
```

---

### Task 4: Backend — processar áudio na rota, fallback e aviso não-bloqueante

**Files:**
- Modify: `web/lib/erros-formulario.ts` (adicionar `mensagemAviso` + código `audio_falhou`)
- Modify: `web/app/api/producao/leite/route.ts`
- Modify: `web/app/dashboard/producao/leite/page.tsx` (exibir o aviso)

**Interfaces:**
- Consumes: `processarCapturaAudio` (Task 2), `GravadorAudio` (Task 3, já envia `formData.getAll('audio')`).

- [ ] **Step 1: Editar `web/lib/erros-formulario.ts`**

Adicionar, junto ao dicionário `MENSAGENS` já existente (mesmo arquivo), um segundo dicionário e função para avisos não-bloqueantes:

```ts
const AVISOS: Record<string, string> = {
  audio_falhou: 'Número salvos, mas não conseguimos processar o áudio. Tente gravar de novo mais tarde.',
}

export function mensagemAviso(codigo: string | undefined): string | null {
  if (!codigo) {
    return null
  }
  return AVISOS[codigo] ?? null
}
```

- [ ] **Step 2: Editar `web/app/api/producao/leite/route.ts`**

Adicionar o import no topo:

```ts
import { processarCapturaAudio } from '@/lib/producao/captura-audio'
```

Logo após a leitura dos campos já existentes (`litrosConsumo`), adicionar a leitura dos arquivos de áudio:

```ts
  const arquivosAudio = formData
    .getAll('audio')
    .filter((valor): valor is File => valor instanceof File && valor.size > 0)
```

Depois de resolver `unidadeNegocioId` (bloco `if (!unidadeNegocioId) { ... }`) e antes do insert, processar o áudio:

```ts
  const resultadoAudio = await processarCapturaAudio(
    supabase,
    arquivosAudio,
    usuarioAtual.propriedade_id,
    unidadeNegocioId,
    data
  )

  const audioFalhou = arquivosAudio.length > 0 && resultadoAudio === null
```

Alterar o payload do `insert` para incluir os campos condicionais:

```ts
  const { error: erroInsert } = await supabase.from('producao_leite').insert({
    propriedade_id: usuarioAtual.propriedade_id,
    unidade_negocio_id: unidadeNegocioId,
    data,
    litros_comercial: litrosComercial,
    litros_descarte: litrosDescarte,
    litros_consumo: litrosConsumo,
    criado_por: usuarioAtual.id,
    origem: resultadoAudio ? 'app_audio' : 'manual',
    observacoes: resultadoAudio?.observacoes ?? null,
    transcricao: resultadoAudio?.transcricao ?? null,
    audio_paths: resultadoAudio?.audioPaths ?? null,
  })
```

E o payload do `update` (dentro do bloco de tratamento de `23505`):

```ts
    const { error: erroUpdate } = await supabase
      .from('producao_leite')
      .update({
        litros_comercial: litrosComercial,
        litros_descarte: litrosDescarte,
        litros_consumo: litrosConsumo,
        ...(resultadoAudio
          ? {
              origem: 'app_audio',
              observacoes: resultadoAudio.observacoes,
              transcricao: resultadoAudio.transcricao,
              audio_paths: resultadoAudio.audioPaths,
            }
          : {}),
      })
      .eq('unidade_negocio_id', unidadeNegocioId)
      .eq('data', data)
```

Por fim, alterar o redirect final de sucesso para incluir o aviso quando aplicável:

```ts
  const urlSucesso = audioFalhou
    ? `/dashboard/producao/leite?aviso=audio_falhou`
    : '/dashboard/producao/leite'

  return NextResponse.redirect(new URL(urlSucesso, request.url), { status: 303 })
```

- [ ] **Step 3: Editar `web/app/dashboard/producao/leite/page.tsx`** para exibir o aviso

Adicionar o import:

```tsx
import { mensagemErro, mensagemAviso } from '@/lib/erros-formulario'
```

Atualizar a assinatura de `searchParams` para incluir `aviso`:

```tsx
  searchParams,
}: {
  searchParams: Promise<{ data?: string; error?: string; aviso?: string }>
}) {
```

Atualizar a desestruturação e adicionar a leitura do aviso:

```tsx
  const { data: dataParam, error, aviso } = await searchParams
  const mensagem = mensagemErro(error)
  const mensagemDeAviso = mensagemAviso(aviso)
```

Adicionar a renderização do aviso logo abaixo da renderização de `mensagem` já existente:

```tsx
          {mensagem && <p className="mb-4 text-sm text-destructive">{mensagem}</p>}
          {mensagemDeAviso && <p className="mb-4 text-sm text-amber-600">{mensagemDeAviso}</p>}
```

- [ ] **Step 4: Verificar build**

```bash
cd web && npm run build && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Verificar via curl (números salvos + fallback quando o áudio falha)**

Sem `GROQ_API_KEY`/`ANTHROPIC_API_KEY` reais configuradas no ambiente local, `processarCapturaAudio` sempre retorna `null` (guarda de chaves ausentes) — isso já exercita exatamente o caminho de fallback que esta task precisa provar. Teste enviando um arquivo qualquer como "áudio":

```bash
(cd web && npm run dev) &
DEV_PID=$!
sleep 5

curl -s -c cookies-admin.txt -X POST http://localhost:3000/api/auth/login \
  --data-urlencode "email=admin.producao@ademir.local" \
  --data-urlencode "password=senha-admin-123" -o /dev/null

echo "conteudo de audio de teste" > /tmp/audio-teste.webm

echo "--- lancamento com audio (chaves ausentes) deve salvar os numeros e avisar sobre o audio ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/leite \
  -F "data=2026-07-08" \
  -F "litros_comercial=1000" \
  -F "litros_descarte=10" \
  -F "litros_consumo=6" \
  -F "audio=@/tmp/audio-teste.webm;type=audio/webm" | grep -i location

echo "--- lancamento sem audio continua funcionando normalmente ---"
curl -s -i -b cookies-admin.txt -X POST http://localhost:3000/api/producao/leite \
  -F "data=2026-07-09" \
  -F "litros_comercial=900" \
  -F "litros_descarte=5" \
  -F "litros_consumo=4" | grep -i location

rm /tmp/audio-teste.webm
kill $DEV_PID
```

Expected: primeiro bloco mostra `location: /dashboard/producao/leite?aviso=audio_falhou`; segundo bloco mostra `location: /dashboard/producao/leite` (sem aviso, comportamento inalterado quando não há áudio).

**Nota para verificação manual (fora desta task):** confirmar a transcrição/síntese de fato funcionando exige `GROQ_API_KEY`/`ANTHROPIC_API_KEY` reais em `web/.env.local` e testar num navegador com microfone — gravar um áudio real, enviar, e conferir que `producao_leite.observacoes`/`transcricao`/`audio_paths` foram preenchidos e `origem = 'app_audio'`.

- [ ] **Step 6: Commit**

```bash
git add web/lib/erros-formulario.ts web/app/api/producao/leite/route.ts web/app/dashboard/producao/leite/page.tsx
git commit -m "feat: processa audio de observacao na rota de producao de leite com fallback"
```
