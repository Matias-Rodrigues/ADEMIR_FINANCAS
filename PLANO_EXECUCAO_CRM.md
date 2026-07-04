# Plano de Execução — CRM ADEMIR_FINANÇAS

> Documento de handoff para o Claude Code revisar e executar a construção do
> sistema. Consolida todo o planejamento feito até aqui (arquitetura, dados
> reais coletados, integrações e prazo). Local do projeto:
> `D:\PROJETOS\ADEMIR_FINANÇAS\`

---

## 1. Objetivo do sistema

CRM/ERP de gestão rural para a propriedade do Ademir, cobrindo três frentes
de negócio: **financeiro pessoal/familiar**, **leite** (empresa 1) e
**suínos** (empresa 2). Alimentado por dados extraídos de conversas do
WhatsApp, planilhas existentes e fotos de documentos, com objetivo final de
dar visibilidade real de custo, receita e ponto de equilíbrio de cada
atividade.

**Prazo combinado com o usuário final (Ademir):** sistema concluído até o
final de julho/2026, com operação a partir de 1º de agosto/2026.

---

## 2. Papéis e modelo de negócio

| Papel | Quem | Responsabilidade |
|---|---|---|
| Desenvolvimento | Matias + Claude | Constroem e ajustam o sistema. Não operam, não alimentam dados, não fazem verificação de lançamentos. |
| Administrador operacional | Ademir | Dono/executor de todas as tarefas na propriedade. Opera o sistema no dia a dia, cria e configura novos usuários. |
| Usuários familiares | Membros da família (a definir por Ademir) | Lançam dados conforme perfil de acesso definido pelo próprio Ademir. |

**Modelo de negócio: familiar.** Sem estrutura de empresa com funcionários
terceiros — usuários operacionais são o Ademir e membros da família.

**Usuários da implantação inicial:** apenas Ademir (admin total) + conta de
desenvolvimento. Demais usuários e seus perfis de acesso são criados
posteriormente pelo próprio Ademir, através de um **construtor de permissões
flexível** (não papéis fixos pré-definidos pelo time de dev).

---

## 3. Módulos do sistema

1. **Produção** — por unidade de negócio (leite, suínos, extensível a novas)
2. **Financeiro do negócio** — fluxo de caixa consolidado por unidade
3. **Financeiro familiar** — por CPF, receitas/despesas pessoais de cada membro
4. **Crédito e obrigações** — calendário de vencimentos, alertas de parcelas
5. **Imobilizado e depreciação** — equipamentos/estruturas por unidade de negócio
6. **Ponto de equilíbrio** — custo real por litro de leite / por suíno
7. **Fiscal** — notas emitidas (NFP-e), boletos, conciliação
8. **Administração de usuários e permissões** — perfis flexíveis, geridos pelo Ademir

---

## 4. Núcleo de dados — entidades

- **Propriedade**
- **Usuário** (papel: admin / membro família; vínculo com pessoa física)
- **Perfil de acesso** (permissões configuráveis por módulo: o que cada usuário pode ver/lançar)
- **Pessoa física / Membro da família** (CPF, vínculo com a propriedade)
- **Unidade de negócio** (gado leiteiro, suínos, + extensível)
- **Evento operacional** (produção, mortalidade, insumo, venda, ocorrência sanitária)
- **Lançamento financeiro do negócio** (receita/despesa vinculada a uma unidade de negócio)
- **Conta pessoal / Lançamento financeiro familiar** (receita/despesa vinculada ao CPF de um membro específico)
- **Obrigação de crédito** (empréstimo, consórcio, linha de crédito — contrato, parcelas, vencimentos)
- **Documento fiscal** (nota fiscal emitida, boleto DDA, documento capturado por foto)
- **Imobilizado** (equipamento/estrutura: nome, valor de aquisição, data, vida útil, depreciação, unidade de negócio vinculada)
- **Lançamento de custo compartilhado** (ver regra de rateio corrigida abaixo)
- **Parceria de integração** (contrato com empresa integradora — ex: Alibem Alimentos — condições, ciclo, forma de pagamento)

---

## 5. Regra de rateio de custo compartilhado (CORRIGIDA)

**Definição:** custos compartilhados entre unidades de negócio (energia,
combustível/diesel) devem ser lançados e armazenados **em valor absoluto
(R$) por unidade de negócio, nunca em percentual**.

**Por quê:** percentual é uma fração derivada que se perde/desatualiza com o
tempo e esconde o custo real de cada atividade. Valor absoluto é auditável e
cada unidade de negócio enxerga o número real no seu próprio fluxo de caixa.

**Como funciona na prática:**
1. Um gasto compartilhado é lançado com o **valor total** (ex: conta de luz = R$ 1.000)
2. O sistema pede a **divisão em reais** entre as unidades de negócio afetadas (ex: Leite: R$ 700 / Suínos: R$ 200 / Pessoal: R$ 100)
3. A soma das partes deve sempre fechar com o valor total do gasto (validação obrigatória)
4. O percentual **pode ser usado apenas como ferramenta de sugestão** no momento do lançamento (ex: "historicamente você tem dividido ~70/20/10, confirma esses valores?"), mas o dado gravado no banco é sempre o valor em reais, nunca a fração

**Exemplo de entidade `lancamento_custo_compartilhado`:**
```
{
  "data": "2026-07-01",
  "descricao": "Conta de energia elétrica - julho",
  "valor_total": 1000.00,
  "divisao": [
    { "unidade_negocio": "gado_leiteiro", "valor": 700.00 },
    { "unidade_negocio": "suinos", "valor": 200.00 },
    { "unidade_negocio": "pessoal", "valor": 100.00 }
  ]
}
```

**Evolução futura prevista (não é MVP):** quando houver medidor de consumo
real por unidade (mencionado como possibilidade futura, sem investimento
imediato), o valor deixa de ser estimado e passa a ser calculado a partir do
consumo medido — mas o formato de armazenamento (valor absoluto por unidade)
não muda.

---

## 6. Ingestão de dados

Três fontes alimentam o núcleo:

1. **WhatsApp** — texto + áudio (transcrito via Groq Whisper) + fotos de documentos (via Claude Vision). Sem importação de histórico antigo além do que já foi extraído manualmente.
2. **Planilhas existentes** — migração para o mesmo schema. **Priorizar sempre o arquivo original (Excel) em vez de foto da planilha** — confirmado na prática: fotos de anotações manuscritas produzem extração degradada; arquivos originais e documentos impressos/estruturados produzem extração confiável.
3. **Captura de documentos por foto** — cupom fiscal, recibo, boleto, nota fiscal, e documentos recorrentes como o "Fechamento de Lote" (relatório RIPI da Alibem). Revisão rápida humana obrigatória antes de confirmar qualquer lançamento financeiro extraído por imagem.

**Ordem de prioridade de fonte por confiabilidade:** arquivo original (Excel/PDF) > documento impresso fotografado > foto de tela > foto de papel manuscrito.

---

## 7. Stack técnica e hospedagem

| Componente | Solução | Papel |
|---|---|---|
| Frontend | App PWA (HTML/JS, mobile-first) | Interface para Ademir e família, com captura de foto via câmera nativa |
| Backend/Banco | Supabase (Postgres + Auth + Storage) | Banco unificado, autenticação multiusuário, permissões via Row Level Security |
| Captura WhatsApp | Bot dedicado (Baileys), rodando 24/7 em VPS | Escuta mensagens (texto e imagem), aciona parsing via Claude, grava no Supabase |
| Parsing/Extração | Groq (transcrição de áudio) + Claude API (texto, visão, geração de eventos estruturados) | Transforma mensagens e fotos em dados estruturados |

**Requisito de hospedagem:** 100% em nuvem, acessível remotamente (celular),
não pode depender de PC ligado — Ademir e família acessam de qualquer lugar.

---

## 8. Integrações externas

| Necessidade | Fornecedor | Observação |
|---|---|---|
| Open Finance | **Pluggy** | Conecta 99%+ dos bancos brasileiros, regulado pelo Bacen |
| Boletos/cobrança | **Asaas** | API gratuita, cobra só por transação real |
| Nota fiscal | **NFP-e via NFE.io** (avaliar **Brasil NFe** como alternativa mais econômica em produção) | Propriedade vende produção agropecuária → regime específico de produtor rural, não NF-e comum nem NFS-e |

**Pré-requisitos legais (ação do Ademir/contador, não decisão técnica):**
credenciamento na SEFAZ-RS como produtor rural + certificado digital
ICP-Brasil (e-CPF ou e-CNPJ, propriedade já tem CNPJ).

**Custo para MVP:** as três plataformas têm uso gratuito na fase de
desenvolvimento/teste (Pluggy: sandbox + trial; Asaas: API 100% grátis,
paga só por transação; NFE.io: ambiente de homologação grátis). Custo real
só aparece na emissão de NFP-e em produção.

---

## 9. Dados operacionais reais (baseline da primeira extração)

**Leite:**
- Produção: ~1.016 L/dia, ~365 mil L comerciais/ano
- Preço atual: R$ 2,80/L (contrato fixo de 3 meses); pagamento antecipado — leite do dia 1-15 pago dia 20, leite do dia 15-30 pago dia 5
- Galpão novo: R$ 600 mil — dívida atual ~R$ 350 mil (consórcio ~R$ 150 mil + parcelamentos ~R$ 150-200 mil, diluído em ~10 meses)
- Estruturas antigas: totalmente pagas

**Suínos:**
- Integração com Alibem Alimentos (empresa fornece leitões, ração, assistência técnica)
- 500 suínos/lote, ciclo ~120 dias, pagamento 30 dias após carregamento
- Receita: R$ 20-24 mil/lote (~R$ 5.500-6.000/mês), preço por bonificação
- Galpão de 2017 (R$ 240 mil): totalmente quitado
- Contrato de exclusividade: não pode ter outros suínos na propriedade
- Documento recorrente: "Fechamento de Lote" (RIPI) — automatizável via foto

**Dívidas:** 6 instituições financeiras (Banco do Brasil, Banco do Sul,
Cresol, Cicred, Cicobi, Banco John Deere) — maioria com limite estourado e
parcelas atrasadas. Conta na Cresol mantida "limpa" propositalmente para
receber os recebíveis.

---

## 10. Pendências de dados (ainda não recebidas do Ademir)

- Arquivos Excel das planilhas de produção/custo (em vez de fotos)
- Lista de equipamentos com valores e datas de aquisição (módulo de imobilizado)
- Cronograma de pagamentos pendentes (consórcio + parcelamentos do galpão leiteiro)
- Contratos das parcerias (suínos com Alibem, leite se houver contrato formal)
- Histórico de produção/receita dos suínos desde o início da parceria

---

## 11. Roteiro de construção (ordem lógica de dependência)

1. Núcleo de dados — schema completo (seção 4)
2. Administração de usuários e permissões
3. Ingestão via WhatsApp (texto + áudio + imagem)
4. Regra de rateio de custo compartilhado (seção 5) — validar soma = total
5. Migração das planilhas existentes (priorizando arquivos originais)
6. Módulos de produção + financeiro do negócio + financeiro familiar
7. Imobilizado/depreciação + ponto de equilíbrio
8. Crédito e obrigações
9. Integrações externas (Open Finance, NFe, boletos)

---

## 12. Instrução para o Claude Code

Revisar este plano de execução, sinalizar inconsistências ou pontos que
precisem de decisão antes de codar, e então construir o sistema seguindo o
roteiro da seção 11 — começando pelo núcleo de dados (schema completo) antes
de qualquer interface ou integração externa.
