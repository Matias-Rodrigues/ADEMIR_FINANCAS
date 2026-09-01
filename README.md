# ADEMIR_FINANÇAS — CRM/ERP para Gestão de Propriedade Rural

## 🎯 Objetivo do Projeto

Sistema de gestão financeira e operacional para propriedades rurais, permitindo registro de dados diretamente pelo WhatsApp, com controle rigoroso de custos compartilhados entre diferentes áreas da propriedade.

## 🛠️ Tecnologias Utilizadas

- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Frontend:** PWA
- **Automação:** Bot de WhatsApp via Baileys, rodando em VPS
- **IA:** Groq Whisper (transcrição) e Claude API (extração de dados)
- **Integrações financeiras:** Pluggy, Asaas
- **Faturamento:** NFE.io (NFP-e modelo 55)

## 📚 Aprendizados

- Rateio de custos compartilhados armazenado sempre em valores absolutos (R$), nunca em percentuais, evitando distorções
- Design centrado no canal do usuário: captura de dados via WhatsApp em vez de nova interface
- Extrator de WhatsApp generalizado como componente reutilizável na caixa de ferramentas
- Orquestração de múltiplas APIs externas (transcrição, IA, conciliação, faturamento) em um pipeline coeso
