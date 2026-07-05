# Stack e Estrutura do Frontend — Design

> Spec de handoff para a fase de planejamento. Desbloqueia a Task 2 do roteiro geral do CRM ("administração de usuários e permissões"), que precisa de código de aplicação e ainda não tinha stack de frontend definida.

## 1. Contexto

O plano original (`ADEMIR_CRM_ARQUITETURA.md`, `PLANO_EXECUCAO_CRM.md`) menciona apenas "App PWA (HTML/JS, mobile-first)" como frontend — uma decisão de arquitetura genérica, sem framework nem estrutura de projeto escolhidos. Até aqui, todo o trabalho implementado é só schema Postgres/Supabase (núcleo de dados + sistema de módulos contratados, ambos completos e mesclados na `main`). Nenhum código de aplicação existe.

Matias é o único desenvolvedor, iniciante em frontend, contando com apoio forte de IA. O produto é o piloto de um SaaS multi-cliente futuro, mas a Task 2 em si é escopo de um único cliente (o Ademir).

## 2. Decisões (via brainstorming com o usuário)

| Pergunta | Decisão |
|---|---|
| Framework | Sem preferência prévia → **React via Next.js** |
| Offline | App sempre vai ter internet no uso → **sem** service worker de cache/offline |
| Hospedagem | **Vercel** |
| UI/estilo | **Tailwind CSS + shadcn/ui** (kit de componentes prontos) |
| Linguagem | **TypeScript** |

## 3. Stack final

- **Next.js (App Router) + TypeScript** — deploy nativo e zero-config na Vercel, roteamento por arquivos, Route Handlers para as poucas operações que exigem servidor.
- **Tailwind CSS + shadcn/ui** — componentes de formulário, tabela, menu e modal prontos, mobile-first.
- **`@supabase/supabase-js` + `@supabase/ssr`** — acesso direto ao Postgres a partir do navegador/servidor, com sessão gerenciada nos dois lados.
- **Vercel** — deploy automático a cada push no GitHub, conectado a este mesmo repositório.

### Alternativas descartadas

- **Vite + React SPA**: mais leve, mas sem roteamento por arquivos nem deploy zero-config na Vercel, e sem lugar seguro para rodar operações que exigem a *service role key* (ex: criar usuário via Admin API do Supabase Auth, necessário na Task 2).
- **Vue/Nuxt**: curva de aprendizado similar à do React, mas ecossistema e volume de exemplos/treinamento de IA disponíveis são menores — desvantagem para quem está começando e vai depender bastante de apoio de IA durante o desenvolvimento.

## 4. Arquitetura de acesso a dados

Regra geral: **o frontend fala direto com o Supabase** via `supabase-js`. A RLS já implementada no banco (núcleo de dados + módulos contratados) decide o que cada usuário pode ver ou alterar — não existe uma API backend própria para CRUD comum.

**Exceção — Route Handlers server-side:** operações que exigem a *service role key* do Supabase (que nunca pode ser exposta ao navegador) rodam em Route Handlers do Next.js (`web/app/api/**/route.ts`). O caso concreto já identificado é a Task 2: criar um novo usuário via Admin API do Supabase Auth. Esse é o único lugar do frontend onde a service role key fica guardada (variável de ambiente server-only na Vercel).

## 5. Autenticação

- Supabase Auth (e-mail/senha).
- Sessão gerenciada com `@supabase/ssr`, compartilhada entre client e server components.
- `web/middleware.ts` protege as rotas que exigem login, redirecionando para a tela de entrada quando não há sessão válida.
- Recuperação de senha (pendência já registrada para a Task 2: usuário redefine a própria senha, admin da propriedade reseta senha de membro da família) usa o fluxo nativo do Supabase Auth (e-mail com link de redefinição) — desenho de UI fica a cargo do plano da Task 2.

## 6. PWA

- Instalável: `manifest.json` + ícones + meta tags apropriadas.
- **Sem** service worker de cache/offline, por decisão explícita (sempre há internet no uso real).
- Se um requisito de uso offline aparecer no futuro, pode ser adicionado depois sem reescrever a base do app — é uma camada adicional, não uma mudança estrutural.

## 7. Estrutura de projeto

Mesmo repositório (`D:\PROJETOS\ADEMIR_FINANÇAS`), nova pasta `web/` na raiz, ao lado de `supabase/` já existente:

```
web/
├── app/                 # rotas (App Router)
│   └── api/             # Route Handlers (operações com service role key)
├── components/          # componentes shadcn/ui + componentes próprios
├── lib/
│   └── supabase/        # clients (browser, server, middleware)
├── middleware.ts
├── package.json
└── ...
```

A Vercel aponta o "root directory" do projeto para `web/`.

## 8. Testes

Sem suite pesada de testes de frontend por enquanto. O valor real de teste automatizado já está nas policies de RLS (pgTAP, 100% coberto). No frontend, a rede de segurança é:
- TypeScript (pega erros de tipo antes de rodar, especialmente contra os tipos gerados pelo Supabase a partir do schema real).
- Verificação manual dos fluxos principais a cada task.

Revisitar essa decisão se o app crescer a ponto de regressões manuais deixarem de ser viáveis.

## 9. Fora de escopo (explicitamente adiado)

- Service worker / funcionamento offline.
- Testes automatizados de frontend (unitários ou e2e).
- Branding/white-label por cliente (multi-tenant visual) — schema já é multi-tenant-ready, mas a UI não precisa suportar temas por cliente ainda; o piloto (Ademir) usa uma identidade visual única.
- Qualquer decisão de conteúdo/fluxo específico da Task 2 (telas de gestão de usuários, permissões, "meu plano") — fica para o plano de implementação daquela task.
