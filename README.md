# ADEMIR_FINANÇAS — CRM/ERP de Gestão Rural

## 🎯 Objetivo do Projeto

Sistema de CRM/ERP para gestão completa de uma propriedade rural familiar, cobrindo produção (gado leiteiro, suínos, extensível a novas fontes de renda), financeiro do negócio, financeiro familiar individual (por CPF de cada membro), obrigações de crédito e gestão fiscal — com conciliação bancária automática via Open Finance.

## 📲 Como os Dados São Capturados

O ponto central do projeto é eliminar a fricção de digitar dados em um sistema: o produtor rural registra tudo pelo canal que já usa no dia a dia.

- **Mensagens de texto no WhatsApp** (produção, gastos, ocorrências) são interpretadas pela API da Anthropic e convertidas em eventos estruturados
- **Fotos de documentos** (cupom fiscal, recibo, boleto, nota fiscal) enviadas pelo WhatsApp ou pela câmera nativa do app são processadas via Claude Vision (multimodal, sem OCR separado), com revisão rápida obrigatória antes de confirmar o lançamento
- O documento original fica anexado ao lançamento no Supabase Storage, servindo como comprovante fiscal/contábil

## 🧭 Modelagem de Dados

O sistema separa claramente o financeiro do negócio do financeiro pessoal de cada membro da família (por CPF), mantendo os dois relacionados à mesma propriedade. Entidades principais: Propriedade, Usuário (com perfil de acesso configurável), Pessoa física/Membro da família, Unidade de negócio (gado leiteiro, suínos, extensível), Evento operacional, Lançamento financeiro do negócio, Conta pessoal/familiar, Obrigação de crédito e Documento fiscal.

Rateio de custos compartilhados entre unidades sempre em valores absolutos (R$), nunca em percentuais, evitando distorções quando os custos totais mudam.

## 🛠️ Stack Técnica

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Row Level Security, Storage), com migrations em PL/pgSQL
- **IA:** Anthropic Claude API (interpretação de texto e visão multimodal), Groq (transcrição de áudio)
- **Automação:** Bot de WhatsApp, integrado ao pipeline de extração de dados
- **Integrações financeiras:** Pluggy (Open Finance/conciliação bancária), Asaas
- **Faturamento:** NFE.io (nota fiscal rural, NFP-e modelo 55)

## 📁 Estrutura do Repositório

- `web/` — aplicação Next.js (frontend e API routes)
- `supabase/` — migrations e schema do banco de dados
- `docs/` — documentação de arquitetura e especificações do projeto
- Scripts Python (`extrair_eventos.py`, `transcrever_audios.py`) — protótipos do pipeline de extração de eventos e transcrição de áudio

## 📚 Aprendizados

- Design centrado no canal do usuário: captura de dados via WhatsApp em vez de exigir uma interface nova
- Sistema de perfis de acesso flexível: o próprio administrador operacional define o que cada usuário pode ver e lançar, sem depender do time de desenvolvimento
- Orquestração de múltiplas APIs externas (transcrição, IA, conciliação bancária, faturamento fiscal) em um pipeline coeso
- Modelagem cuidadosa para separar financeiro do negócio e financeiro pessoal sem perder o vínculo com a propriedade
