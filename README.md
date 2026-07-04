# Extrator de conversas do WhatsApp — ADEMIR_FINANÇAS

Ferramenta de duas etapas para transformar a conversa do WhatsApp com o Ademir
(texto + áudios) em eventos estruturados, usados para alimentar o
planejamento do CRM de gestão rural.

**Fase atual do projeto:** extração para complementar o planejamento — este
script ainda roda manualmente, sob demanda. Não é a automação 24/7 prevista
na arquitetura final (isso vem depois, quando o núcleo de dados existir).

---

## Como funciona

1. **`transcrever_audios.py`** — lê os arquivos de áudio (`.opus`) exportados
   do WhatsApp e transcreve cada um usando o Groq (Whisper Large v3 Turbo).
   Salva o resultado em `transcricoes.json`.
2. **`extrair_eventos.py`** — lê o `.txt` da conversa exportada, insere as
   transcrições no lugar das referências de áudio, e manda tudo para o Claude
   extrair eventos estruturados (produção, financeiro, ocorrências). Salva o
   resultado em `eventos_extraidos.json`.

---

## Passo a passo

### 1. Exportar a conversa do WhatsApp

No WhatsApp, abra a conversa com o Ademir → menu → **Exportar conversa** →
escolha **"Incluir mídia"** (dessa vez precisa da mídia, para pegar os áudios).
Isso gera um `.zip`. Extraia esse `.zip` numa pasta, por exemplo:

```
D:\PROJETOS\ADEMIR_FINANÇAS\whatsapp_export\
```

Essa pasta vai conter um arquivo `.txt` (o texto da conversa) e vários
arquivos `.opus` (os áudios).

### 2. Instalar as dependências

```bash
pip install -r requirements.txt
```

### 3. Conseguir as chaves de API (ambas têm nível gratuito)

**Groq (transcrição):**
1. Acesse [console.groq.com](https://console.groq.com)
2. Crie uma conta gratuita (não pede cartão de crédito)
3. Vá em "API Keys" e gere uma chave
4. Nível gratuito: 2.000 transcrições/dia — muito acima do que essa conversa gera

**Anthropic (extração dos eventos):**
1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. Crie uma conta e gere uma chave de API
3. Esse uso é pago por token, mas o volume aqui é baixíssimo (poucos centavos)

### 4. Configurar as chaves

Copie `.env.example` para `.env` e preencha com suas chaves:

```bash
cp .env.example .env
```

```
GROQ_API_KEY=gsk_sua_chave_aqui
ANTHROPIC_API_KEY=sk-ant-sua_chave_aqui
```

### 5. Rodar a transcrição dos áudios

```bash
python transcrever_audios.py --pasta "D:\PROJETOS\ADEMIR_FINANÇAS\whatsapp_export"
```

Isso vai gerar `transcricoes.json` dentro da mesma pasta. Se cair a conexão
no meio, é só rodar de novo — ele continua de onde parou.

### 6. Rodar a extração de eventos

```bash
python extrair_eventos.py --pasta "D:\PROJETOS\ADEMIR_FINANÇAS\whatsapp_export"
```

Isso vai gerar `eventos_extraidos.json` — uma lista de eventos como:

```json
[
  {
    "data": "2026-07-01",
    "tipo": "producao",
    "unidade_negocio": "gado_leiteiro",
    "valor": null,
    "descricao": "Ordenha do dia produziu 180 litros",
    "texto_original": "hoje deu 180 litros de leite"
  },
  {
    "data": "2026-07-01",
    "tipo": "insumo",
    "unidade_negocio": "suinos",
    "valor": 340.00,
    "descricao": "Compra de ração para os suínos",
    "texto_original": "gastei 340 na ração dos porco"
  }
]
```

---

## O que fazer com o resultado

Esse `eventos_extraidos.json` é o material bruto que vai:
- Confirmar (ou ajustar) o schema de entidades já desenhado no
  `ADEMIR_CRM_ARQUITETURA.md` (seção 4)
- Revelar terminologia real, frequência de eventos e tipos de valor que
  aparecem na prática — informação que refina o desenho antes de construir
  o banco de dados de verdade

---

## Limitações conhecidas desta versão manual

- Roda sob demanda, não captura mensagens em tempo real (isso é o Bot
  WhatsApp 24/7 da arquitetura final — fase posterior)
- Sem revisão humana automática dos eventos extraídos — nesta fase, é
  esperado revisar o `eventos_extraidos.json` manualmente antes de usar
  como base de decisão
- Não lida ainda com fotos de documentos (cupons, boletos, notas) — isso
  é o módulo de captura de foto via Claude Vision, também de fase posterior
