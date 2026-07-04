# ADEMIR_FINANÇAS — CRM de Gestão Rural
## Documento de Contexto e Arquitetura

> Salvar em: `D:\PROJETOS\ADEMIR_FINANÇAS\ADEMIR_CRM_ARQUITETURA.md`
> Este documento é a base de decisão do projeto — deve ser atualizado a cada sessão relevante e serve de handoff para futuras sessões de IA ou colaboradores.

---

## 1. Visão geral

Sistema de CRM/ERP para gestão de uma propriedade rural, cobrindo:
- Produção (gado leiteiro, suínos, extensível a novas fontes de renda)
- Financeiro do negócio (custos, receitas, fluxo de caixa)
- Financeiro familiar (por CPF, receitas/despesas pessoais de cada membro)
- Crédito e obrigações (empréstimos, linhas de crédito, consórcios)
- Fiscal (notas fiscais emitidas, boletos DDA)
- Open Finance (conciliação bancária automática — propriedade já opera com CNPJ próprio)

**Modelo de negócio do projeto: familiar.** Não há estrutura de empresa com funcionários terceiros — os usuários operacionais são o Ademir (dono/executor) e membros da família.

---

## 2. Papéis e responsabilidades

| Papel | Quem | Responsabilidade |
|---|---|---|
| **Desenvolvimento** | Matias + Claude | Desenvolvem, ajustam demandas, aprimoram a solução. **Não operam o sistema** — não alimentam dados, não fazem verificação de lançamentos. |
| **Administrador operacional** | Ademir | Dono e executor de todas as tarefas na propriedade. Atua como admin do sistema no dia a dia: cria novos usuários, define perfis de acesso, gerencia permissões — de forma autônoma, sem depender do time de desenvolvimento. |
| **Usuários familiares** | Membros da família (a definir quais e quantos) | Lançam dados operacionais e/ou financeiros pessoais, conforme perfil de acesso definido pelo Ademir. |

**Implicação técnica:** o sistema precisa de uma tela de **administração de usuários** (criar usuário, definir perfil/permissões, desativar acesso) operável pelo próprio Ademir — não pode ser algo que exija intervenção manual no banco de dados pelo time de dev.

**Usuários criados na implantação inicial:**
- **Ademir** — usuário administrador com permissões totais
- **Conta de desenvolvimento** (Matias/Claude) — acesso técnico, para ajustes e suporte, sem se envolver na alimentação/operação diária
- **Demais usuários** (outros membros da família) — não são criados agora. Serão definidos e criados pelo próprio Ademir, quando ele decidir, através da tela de administração de usuários.

**Implicação de design:** os perfis de acesso não devem ser papéis fixos pré-definidos pelo time de dev (ex.: "operador", "financeiro"). O sistema precisa de um **construtor de permissões flexível**, onde o Ademir define, para cada novo usuário que ele criar, o que essa pessoa pode ver e lançar (por módulo: produção, financeiro do negócio, financeiro pessoal/familiar, crédito, fiscal). As regras exatas de cada perfil serão decididas por ele no momento da criação, não fixadas antecipadamente pelo time de desenvolvimento.

---

## 3. Arquitetura de ingestão de dados

Três fontes alimentam o mesmo núcleo de dados:

1. **WhatsApp** (contato específico — hoje reporta produção, gastos, ocorrências)
   - Mensagens de texto → parser via Claude → eventos estruturados
   - Fotos de documentos (cupom fiscal, recibo, boleto, nota fiscal) enviadas no mesmo canal → roteadas para o pipeline de extração visual
   - **Sem importação de histórico antigo** — o contato de captura é um número novo; a captura começa a partir de agora, com as conversas atuais em diante. Não há necessidade de migrar mensagens antigas.
2. **Planilhas existentes** (Excel/Google Sheets) → migração pontual para o mesmo schema, preservando histórico
3. **Captura de documentos por foto** (nova fonte)
   - Via WhatsApp (mesmo bot, detecta anexo de imagem) OU via câmera nativa no App PWA
   - Extração via Claude Vision (multimodal — não precisa de OCR separado): identifica tipo de documento (cupom, recibo, boleto, NF), extrai valor, data, emissor, itens
   - **Revisão rápida obrigatória** antes de confirmar o lançamento (extração visual pode errar valores — revisão humana é o controle de qualidade)
   - Documento original fica anexado ao lançamento (Supabase Storage) — serve de comprovante fiscal/contábil

---

## 4. Núcleo de dados — entidades principais

- **Propriedade**
- **Usuário** (papel: admin / membro família; vínculo com pessoa física)
- **Perfil de acesso** (define o que cada usuário pode ver/lançar)
- **Pessoa física / Membro da família** (CPF, vínculo com a propriedade)
- **Unidade de negócio** (gado leiteiro, suínos, + extensível)
- **Evento operacional** (produção, mortalidade, insumo, venda, ocorrência sanitária)
- **Lançamento financeiro do negócio** (receita/despesa vinculada a uma unidade de negócio)
- **Conta pessoal / Lançamento financeiro familiar** (receita/despesa vinculada ao CPF de um membro específico, não ao negócio)
- **Obrigação de crédito** (empréstimo, consórcio, linha de crédito — contrato, parcelas, vencimentos)
- **Documento fiscal** (nota fiscal emitida, boleto DDA, documento capturado por foto)

**Ponto importante:** o financeiro do negócio e o financeiro familiar (por CPF) são entidades **separadas mas relacionadas** — cada membro da família tem sua conta pessoal, mas o sistema deve permitir visão consolidada de "quanto a propriedade gera" vs "quanto cada pessoa recebe/gasta".

---

## 5. Módulos de gestão

- **Produção** — por unidade de negócio, indicadores e custos
- **Financeiro do negócio** — fluxo de caixa consolidado por unidade
- **Financeiro familiar** — por CPF, receitas/despesas pessoais de cada membro
- **Crédito e obrigações** — calendário de vencimentos, alertas de parcelas
- **Fiscal** — notas emitidas, boletos, conciliação
- **Administração de usuários e permissões** — Ademir gerencia quem acessa o quê

---

## 6. Integrações externas

Não existe uma única plataforma que cubra bem as três necessidades para um produtor rural — são três integrações distintas:

| Necessidade | Fornecedor recomendado | Observação |
|---|---|---|
| **Open Finance** (extrato bancário automático) | **Pluggy** | Referência de mercado, conecta 99%+ dos bancos brasileiros via API única, regulado pelo Bacen, funciona para PJ. Extrato chega padronizado e categorizado. |
| **Boletos e cobrança (DDA)** | **Asaas** | API gratuita de integrar (cobra só por transação), gera boleto/PIX, avisa automaticamente via webhook quando um boleto é pago. |
| **Nota fiscal** | **NFP-e (modelo 55)** via **NFE.io** | A propriedade vende produção agropecuária (leite, suínos) — o documento correto é a **Nota Fiscal de Produtor Eletrônica (NFP-e)**, não a NF-e comum nem a NFS-e (que é o foco do Asaas). NFE.io oferece API para emissão automatizada com validação prévia. |

**Pré-requisitos legais para a NFP-e (independem da escolha de software):**
1. **Credenciamento na SEFAZ-RS** como produtor rural
2. **Certificado digital ICP-Brasil** (e-CPF ou e-CNPJ — a propriedade já tem CNPJ)

Esses dois passos são administrativos/legais (normalmente feitos com apoio do contador), não uma decisão técnica — precisam estar resolvidos antes de a automação de NFP-e poder funcionar.

---

## 7. Hospedagem e stack técnica

Requisito: acesso remoto (nuvem/celular), multiusuário com permissões — não pode depender de PC ligado.

| Componente | Solução | Papel |
|---|---|---|
| Frontend | App PWA (HTML/JS, mobile-first) | Interface para Ademir e família — inclui captura de foto via câmera nativa |
| Backend/Banco | Supabase (Postgres + Auth + Storage) | Banco unificado, autenticação multiusuário, permissões via Row Level Security, storage de documentos anexados |
| Captura WhatsApp | Bot dedicado (Baileys), rodando 24/7 em VPS | Escuta mensagens (texto e imagem), aciona parsing via Claude, grava no Supabase |
| Parsing/Extração | Claude API (texto e visão) | Transforma mensagens e fotos em dados estruturados |
| Integrações fiscais/bancárias | APIs de integradores de mercado | Open Finance, NFe, boletos — módulo posterior |

---

## 8. Roteiro de construção (ordem lógica de dependência, não prioridade de negócio)

1. Núcleo de dados — schema completo (todas as entidades da seção 4)
2. Administração de usuários e permissões (Ademir precisa disso desde o início)
3. Ingestão via WhatsApp (texto) — parser de eventos
4. Captura de documentos por foto — parser visual + revisão rápida
5. Migração das planilhas existentes
6. Módulos de produção + financeiro do negócio + financeiro familiar
7. Crédito e obrigações
8. Integrações externas (Open Finance, NFe, boletos)

---

## 9. Decisões registradas

| Decisão | Resolução |
|---|---|
| Usuários iniciais e perfis de acesso | Apenas Ademir (admin total) + conta de desenvolvimento são criadas na implantação. Demais usuários e seus perfis de acesso serão definidos e criados pelo próprio Ademir, via tela de administração de usuários (construtor de permissões flexível — ver seção 2). |
| Integrador NFe/boletos/Open Finance | Três fornecedores distintos: Pluggy (Open Finance), Asaas (boletos/cobrança), NFE.io (NFP-e) — ver seção 6. |
| Volume histórico do WhatsApp | Nenhuma importação de histórico — número novo, captura a partir de agora. |

### Próximos passos que dependem de ação fora do desenvolvimento

- Ademir (com apoio do contador) providenciar o **credenciamento na SEFAZ-RS** como produtor rural
- Emitir/regularizar o **certificado digital ICP-Brasil** (e-CPF ou e-CNPJ) vinculado ao CNPJ da propriedade
- Criar contas nas plataformas Pluggy, Asaas e NFE.io (pode ser feito em paralelo ao desenvolvimento do núcleo de dados)

### Custo para o MVP (fase de desenvolvimento e testes)

| Plataforma | Gratuito para MVP? | Quando passa a custar |
|---|---|---|
| Pluggy | Sim — sandbox liberado + trial completo de 2 semanas sem cartão | Só se o volume de contas conectadas crescer muito além de uma propriedade familiar |
| Asaas | Sim — cadastro e API 100% gratuitos, sem mensalidade | Só ao emitir boleto real (taxa pequena por transação paga) |
| NFE.io | Parcial — ambiente de homologação (testes) é gratuito | Emissão real de NFP-e com validade jurídica normalmente exige plano pago |

**Nota sobre NFE.io:** ao chegar o momento de emitir NFP-e de verdade (não apenas testar), vale comparar com a **Brasil NFe**, que oferece plano fixo (~R$ 49,90/mês, emissão ilimitada) — pode ser mais econômico que o modelo por-nota do NFE.io para o volume baixo desta propriedade. Essa comparação só precisa ser feita quando a integração de fato for para produção, não agora.

---

---

## 10. Histórico do projeto (log de sessões)

### Sessão 1 — Planejamento inicial (04/07/2026)

- Escopo inicial: automação para extrair conversas e documentos de um contato do WhatsApp e gerar contexto para tomada de decisão
- Escopo evoluído: identificado que o objetivo real é um **CRM completo de gestão rural** — produção (gado leiteiro, suínos), financeiro do negócio, financeiro familiar, crédito, fiscal
- Arquitetura de ingestão definida: WhatsApp (texto), planilhas existentes (migração), captura de documentos por foto (cupom fiscal, recibo, boleto, nota fiscal via Claude Vision)
- Arquitetura de hospedagem definida: App PWA + Supabase (banco/auth/storage) + Bot WhatsApp rodando 24/7 em nuvem — motivado pela necessidade de acesso remoto/celular
- Papéis definidos: Matias/Claude = desenvolvimento (não operam o sistema); Ademir = administrador operacional; modelo de negócio = **familiar**
- Entidade de financeiro familiar por CPF incorporada ao núcleo de dados
- Usuários iniciais definidos: apenas Ademir (admin total) + conta de desenvolvimento; demais usuários e perfis de acesso serão criados pelo próprio Ademir via construtor de permissões flexível
- Integradores externos definidos: **Pluggy** (Open Finance), **Asaas** (boletos/cobrança), **NFE.io** (NFP-e — nota fiscal de produtor rural, modelo 55), com **Brasil NFe** como alternativa mais econômica para produção
- Confirmado: sem importação de histórico do WhatsApp (número novo, captura a partir de agora)
- Confirmado: MVP das três integrações externas pode ser montado sem custo (sandbox/planos gratuitos), com custo real só ao emitir documentos fiscais em produção
- Pendências administrativas identificadas: credenciamento SEFAZ-RS como produtor rural, certificado digital ICP-Brasil (e-CPF/e-CNPJ)
- **Próximo passo combinado:** desenho detalhado do schema do banco de dados

---

*Última atualização: Sessão 1 (04/07/2026) — arquitetura completa, papéis, modelo familiar e integrações externas definidos.*
