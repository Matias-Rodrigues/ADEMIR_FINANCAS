# Design — Ferramenta Genérica de Extração de Conversas do WhatsApp

**Data:** 2026-07-04
**Projeto de destino:** `D:\FERRAMENTAS\extrator_whatsapp\`
**Spec de referência:** `ESPECIFICACAO_FERRAMENTA_EXTRATOR_WHATSAPP.md`

---

## Objetivo

Aplicação com interface gráfica (GUI) que recebe a exportação de uma conversa
do WhatsApp (texto + mídia) — via seleção de pasta ou drag-and-drop — e gera
um único arquivo Markdown consolidado, com todo o conteúdo extraído, transcrito
e organizado cronologicamente. O usuário arrasta a pasta exportada para a janela
(ou usa o botão "Selecionar pasta"), clica em "Extrair" e recebe o arquivo
pronto. Nenhuma lógica de domínio de negócio deve entrar no código.

---

## Estrutura de arquivos

```
D:\FERRAMENTAS\extrator_whatsapp\
├── app.py            # Interface gráfica (tkinter) — janela principal
├── extrator.py       # Orquestrador principal (sem CLI, chamado pelo app.py)
├── parser.py         # Parseia o .txt do WhatsApp → lista de mensagens
├── audio.py          # Transcreve .opus via Groq (Whisper Large v3 Turbo)
├── imagem.py         # Descreve/extrai texto de imagens via Claude Vision
├── documento.py      # Extrai texto de PDFs (pypdf)
├── consolidador.py   # Monta a linha do tempo cronológica em Markdown
├── resumo.py         # Gera resumo executivo via Claude
├── cache.py          # Gerencia progresso incremental (JSON de cache)
├── .env.example
├── requirements.txt
└── README.md
```

---

## Fluxo de execução

```
pasta de entrada
      │
      ├─ parser.py ──→ lista de mensagens cronológicas
      │                (texto | referência de mídia)
      │
      ├─ audio.py ───→ transcrições dos .opus  (via cache)
      ├─ imagem.py ──→ descrições das imagens  (via cache)
      └─ documento.py→ texto dos PDFs          (via cache)
                │
                ▼
        consolidador.py
        (insere mídia processada na linha do tempo)
                │
                ▼
          resumo.py
        (gera resumo executivo via Claude)
                │
                ▼
        CONTEXTO_{contato}_{data}.md
```

---

## Módulos

### `parser.py`

Lê o arquivo `.txt` exportado do WhatsApp e retorna uma lista de dicionários:

```python
[
  {
    "datetime": "2026-07-01 09:15",
    "remetente": "Ademir",
    "tipo": "texto",            # "texto" | "audio" | "imagem" | "documento" | "outro"
    "conteudo": "Bom dia, produção de ontem foi 180 litros",
    "arquivo": None             # nome do arquivo de mídia, se for mídia
  },
  {
    "datetime": "2026-07-01 09:20",
    "remetente": "Ademir",
    "tipo": "audio",
    "conteudo": None,
    "arquivo": "AUDIO-2026-07-01-09-20-00.opus"
  },
  ...
]
```

Suporta os formatos de data do WhatsApp brasileiro:
- `DD/MM/YYYY HH:MM` (Android)
- `DD/MM/YY, HH:MM` (iOS)

### `cache.py`

Salva e lê `_cache_extrator.json` na pasta de entrada:

```json
{
  "audios":     { "AUDIO-2026-07-01.opus": "texto transcrito..." },
  "imagens":    { "IMG-2026-07-01.jpg": "descrição..." },
  "documentos": { "arquivo.pdf": "texto extraído..." }
}
```

Interface:
- `Cache(pasta)` — instancia e carrega cache existente
- `cache.get(tipo, arquivo)` → valor ou `None`
- `cache.set(tipo, arquivo, valor)` → salva incrementalmente

### `audio.py`

```python
def transcrever(arquivo: Path, client: Groq) -> str
```

Usa `whisper-large-v3-turbo`, `language="pt"`. Levanta exceção em caso de erro —
o orquestrador captura e registra `[ERRO NA TRANSCRIÇÃO: motivo]`.

### `imagem.py`

```python
def descrever(arquivo: Path, client: anthropic.Anthropic) -> str
```

Envia a imagem em base64 para o Claude com instrução de:
1. Descrever o conteúdo da imagem
2. Se for documento fotografado (cupom, boleto, nota fiscal, print de texto), extrair os dados/texto relevantes

Formatos suportados: `.jpg`, `.jpeg`, `.png`, `.webp`.

### `documento.py`

```python
def extrair_texto(arquivo: Path) -> str
```

Usa `pypdf` para extrair texto de PDFs. Sem dependência de API.

### `consolidador.py`

```python
def consolidar(mensagens: list, cache: Cache) -> str
```

Percorre a lista de mensagens na ordem cronológica original e produz a seção
"Linha do tempo consolidada" do Markdown final. Para cada mensagem de mídia,
busca o conteúdo processado no cache e formata conforme o tipo:

- Texto → linha direta
- Áudio → `[ÁUDIO TRANSCRITO] texto`
- Imagem → `[IMAGEM] descrição`
- Documento → `[DOCUMENTO] texto extraído`
- Mídia não processada / erro → `[ÁUDIO] nome_arquivo` / `[IMAGEM] nome_arquivo`

### `resumo.py`

```python
def gerar_resumo(linha_do_tempo: str, client: anthropic.Anthropic) -> str
```

Envia a linha do tempo consolidada para o Claude e solicita um resumo executivo
de 3-5 parágrafos, com instrução explícita de não inventar informação —
apenas sintetizar o que está na conversa.

### `app.py` (interface gráfica)

Janela tkinter com:
- Campo de texto mostrando o caminho da pasta selecionada
- Botão "Selecionar pasta" (abre diálogo de seleção de pasta)
- Área de drop (drag-and-drop de pasta)
- Barra de progresso + texto de status ("Transcrevendo áudios... 3/10")
- Botão "Extrair" (dispara o processamento em thread separada para não travar a janela)
- Ao concluir: mensagem de sucesso com o caminho do arquivo gerado e botão "Abrir arquivo"

O processamento roda em uma `threading.Thread` para manter a janela responsiva.
O `extrator.py` aceita um callback de progresso para atualizar a interface.

### `extrator.py` (orquestrador)

Responsabilidades:
1. Receber `pasta` (Path) e callback opcional de progresso
2. Instanciar clientes de API (Groq, Anthropic)
3. Chamar `parser.py` para obter lista de mensagens
4. Para cada mensagem de mídia pendente no cache: chamar o módulo correto e salvar no cache (com `try/except` por item), reportar progresso via callback
5. Chamar `consolidador.py`
6. Chamar `resumo.py`
7. Montar e salvar o Markdown final, retornar o caminho do arquivo gerado

---

## Formato de saída

Nome do arquivo: `CONTEXTO_{contato}_{YYYY-MM-DD}.md`

O nome do contato é extraído do nome do arquivo `.txt` (ex: `WhatsApp Chat - Ademir Pedro Thomas.txt` → `Ademir_Pedro_Thomas`).

```markdown
# Contexto extraído — Conversa com {contato}

**Período coberto:** {data_inicial} a {data_final}
**Gerado em:** {data_execucao}
**Total de mensagens:** N | **Áudios transcritos:** N | **Imagens processadas:** N | **Documentos lidos:** N

## Resumo executivo
{3-5 parágrafos}

## Linha do tempo consolidada
YYYY-MM-DD HH:MM — Remetente: conteúdo
YYYY-MM-DD HH:MM — Remetente: [ÁUDIO TRANSCRITO] texto
YYYY-MM-DD HH:MM — Remetente: [IMAGEM] descrição
YYYY-MM-DD HH:MM — Remetente: [DOCUMENTO] texto
...
```

---

## Tratamento de erros

- Erro por item de mídia: capturado com `try/except`, registrado como
  `[ERRO: motivo]` no cache e na saída. Processamento continua.
- Arquivo `.txt` não encontrado: erro fatal com mensagem clara.
- Chave de API ausente: erro fatal com instrução de configurar `.env`.

---

## Como usar

```bash
python app.py
```

Abre a janela. O usuário:
1. Arrasta a pasta exportada do WhatsApp para a área de drop, **ou** clica em "Selecionar pasta"
2. Clica em "Extrair"
3. Aguarda a barra de progresso completar
4. Clica em "Abrir arquivo" para ver o resultado

O arquivo gerado fica na mesma pasta da exportação do WhatsApp.

---

## Dependências (`requirements.txt`)

```
anthropic
groq
pypdf
python-dotenv
tkinterdnd2
```

`tkinter` vem embutido no Python. `tkinterdnd2` adiciona suporte a drag-and-drop nativo no Windows.

---

## Variáveis de ambiente (`.env`)

```
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Fora de escopo

- Automação em tempo real / bot WhatsApp
- Extração de eventos estruturados de domínio de negócio
- Suporte a vídeos
- Instalador (.exe empacotado) — roda via `python app.py`
