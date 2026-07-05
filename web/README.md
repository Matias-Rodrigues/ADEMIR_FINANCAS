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
