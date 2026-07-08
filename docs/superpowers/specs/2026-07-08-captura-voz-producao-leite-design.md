# Captura assistida por voz — Produção de leite — Design

> Primeira fatia de um pedido maior (app celular com voz para produção, foto para financeiro, infraestrutura offline-first). Esta fatia cobre só a produção diária de leite, com números sempre digitados e áudio opcional só para observações — as demais fatias (extração de números por voz, foto para financeiro, offline-first, suínos) ficam para specs futuras separadas.

## 1. Contexto

O usuário quer poder alimentar o sistema caminhando pela propriedade, narrando por voz. A arquitetura original do projeto (`ADEMIR_CRM_ARQUITETURA.md`) já previa o frontend como um App PWA mobile-first com captura por câmera nativa — o CRM atual (Next.js App Router + Supabase) já é esse PWA (tem `web/app/manifest.ts`), mas sem nenhuma captura de mídia ainda. A ferramenta `extrator_whatsapp` (Python, D:\FERRAMENTAS\extrator_whatsapp\) já valida o padrão Groq (transcrição) + Claude API (extração estruturada) para outro canal (WhatsApp), mas é um utilitário de desktop, não reaproveitável como código nesta stack.

A página `/dashboard/producao/leite` já existe: formulário com data + 3 números (litros comercial/descarte/consumo), grava em `producao_leite` (que já tem `unique(unidade_negocio_id, data)` e trata conflito de mesmo dia com insert-então-update).

## 2. Decisões de escopo (via brainstorming com o usuário)

- **Escopo desta fatia: só produção diária de leite.** Suínos fica para quando o módulo de produção de suínos existir; movimentação de rebanho por voz fica para uma fatia futura.
- **Números sempre digitados, nunca extraídos por voz nesta fatia.** A IA nunca tenta interpretar quantidades faladas — isso elimina a fonte de erro mais arriscada (transcrição de números). O formulário exige os 3 valores digitados exatamente como hoje.
- **Áudio é opcional e serve só para observações/contexto em texto livre** (problemas, ocorrências) — nunca bloqueia nem altera os números.
- **Processamento síncrono, na mesma requisição** — sem fila, sem Edge Function/webhook (infraestrutura que o projeto não tem hoje). Aceita-se alguns segundos de espera no envio quando há áudio anexado.
- **Sem tela de revisão/pendências nesta fatia** — como os números não dependem de IA, o lançamento é salvo diretamente; erro de transcrição nas observações se corrige depois pela edição normal do lançamento.
- **Sem tabela nova** — só 3 colunas novas em `producao_leite` (`observacoes`, `transcricao`, `audio_paths`) e um novo valor em `origem` (`'app_audio'`). Campos de proveniência por valor numérico (digitado vs sugerido por IA) ficam fora de escopo — só fariam sentido quando a extração de números por voz for construída, e essa fatia ainda não existe.
- **Falha no processamento do áudio nunca bloqueia os números** — se Groq/Claude falhar, os 3 valores digitados são salvos normalmente, com um aviso ao usuário; `observacoes`/`transcricao` ficam nulos e `origem` cai para `'manual'` mesmo que um áudio tenha sido tentado.

## 3. Modelo de dados

```sql
alter table public.producao_leite
  add column observacoes text,
  add column transcricao text,
  add column audio_paths text[];

alter table public.producao_leite drop constraint producao_leite_origem_check;
alter table public.producao_leite add constraint producao_leite_origem_check
  check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual', 'app_audio'));
```

- As 3 colunas novas são nullable — lançamentos sem áudio continuam com todas nulas, igual hoje.
- `origem = 'app_audio'` quando pelo menos um áudio foi processado com sucesso (mesmo que a extração falhe parcialmente); `origem = 'manual'` quando não houve áudio, ou quando o áudio foi tentado mas falhou completamente no processamento (ver Seção 6).
- Nenhuma tabela nova. Nenhuma mudança na `unique(unidade_negocio_id, data)` nem nas policies de RLS já existentes — o insert-então-update já em produção continua funcionando sem alteração.

## 4. Storage

Primeiro uso de Supabase Storage no projeto. Bucket privado `capturas-audio`, path `{propriedade_id}/{unidade_negocio_id}/{data}-{timestamp}-{indice}.webm` (ou extensão correspondente ao mime type recebido). Policy de Storage restringe leitura/escrita a objetos cujo primeiro segmento do path bata com `usuario_propriedade_id()` do usuário autenticado — mesmo princípio de isolamento multi-tenant já usado nas tabelas, aplicado agora a Storage.

## 5. Frontend

`web/app/dashboard/producao/leite/page.tsx` (existente) ganha um controle de gravação, client-side (`'use client'` num componente isolado, o resto da página continua server component):
- Botão "Gravar observação" inicia captura via `MediaRecorder`; "Parar" encerra um clipe
- Lista de clipes gravados nesta sessão, cada um com playback e botão de excluir antes de enviar
- Botão "Gravar outro áudio" permite múltiplos clipes na mesma sessão
- Campos de data e os 3 números continuam exatamente como hoje (formulário HTML puro funciona mesmo sem JS); a gravação é uma capacidade adicional que só existe com JS, inevitável por depender de uma API do navegador

No envio, os clipes (Blobs) são anexados ao mesmo POST via `FormData` (client-side), incluindo os campos de texto já existentes.

## 6. Backend

`POST /api/producao/leite` (rota existente) passa a ler `multipart/form-data`:
1. Valida `data` e os 3 valores numéricos exatamente como hoje (nenhuma mudança nessa parte)
2. Se houver arquivo(s) de áudio no FormData: para cada um, upload no bucket `capturas-audio`; chama Groq para transcrever cada clipe; concatena as transcrições na ordem de gravação; chama Claude API com esse texto pedindo uma síntese limpa em português para `observacoes`
3. **Qualquer falha no passo 2 (upload, Groq, ou Claude) é capturada e não interrompe o fluxo** — loga o erro, segue com `observacoes`/`transcricao`/`audio_paths` nulos, `origem = 'manual'`, e adiciona `?aviso=audio_falhou` ao redirect de sucesso (novo código, mensagem tipo "número salvos, mas não conseguimos processar o áudio — tente gravar de novo mais tarde")
4. Insert-então-update em `producao_leite` (padrão já existente, sem mudança), incluindo os campos novos quando disponíveis

Chaves novas necessárias no ambiente: `GROQ_API_KEY`, `ANTHROPIC_API_KEY` (hoje só existem variáveis do Supabase em `.env.example`).

## 7. Testes

- pgTAP: colunas novas existem e são nullable; `origem = 'app_audio'` é aceito pela constraint; `origem` fora da lista continua rejeitado.
- Sem suíte de teste de frontend neste projeto (convenção já estabelecida). Verificação: build + typecheck, e curl simulando o POST multipart com os 3 números + um arquivo de áudio de amostra pequeno (exercita upload + Groq + Claude + insert de ponta a ponta). Teste manual num navegador de celular real (gravação de fato) fica como verificação complementar, fora do que dá para automatizar via curl.

## 8. Fora de escopo

Extração de números por voz (parametrizado para o futuro — quando construído, precisa de migration própria adicionando proveniência por campo). Tela de revisão/pendências. Fila/infraestrutura offline-first. Produção de suínos. Movimentação de rebanho por voz. Captura de foto para o módulo financeiro.
