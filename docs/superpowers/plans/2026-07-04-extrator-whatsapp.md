# Extrator de Conversas WhatsApp — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicação GUI (tkinter) que processa uma pasta de exportação do WhatsApp e gera um arquivo Markdown consolidado com texto, áudios transcritos, imagens descritas e PDFs extraídos.

**Architecture:** Módulos independentes por tipo de mídia (`audio.py`, `imagem.py`, `documento.py`) orquestrados pelo `extrator.py`, com cache incremental em JSON. A GUI (`app.py`) roda o orquestrador em thread separada e exibe progresso em tempo real.

**Tech Stack:** Python 3.10+, tkinter (built-in), tkinterdnd2, anthropic SDK, groq SDK, pypdf, python-dotenv, pytest

## Global Constraints

- Pasta de destino: `D:\FERRAMENTAS\extrator_whatsapp\`
- Python 3.10+
- Variáveis de API via `.env` (nunca hardcoded): `GROQ_API_KEY`, `ANTHROPIC_API_KEY`
- Nenhuma lógica de domínio de negócio no código
- Processamento retomável: itens já processados não são reprocessados
- Erro por item de mídia registrado como `[ERRO: motivo]` sem interromper os demais
- Modelos: `whisper-large-v3-turbo` (Groq), `claude-haiku-4-5-20251001` (imagens e resumo)
- Arquivo de saída gerado na mesma pasta da exportação do WhatsApp

---

## Mapa de arquivos

```
D:\FERRAMENTAS\extrator_whatsapp\
├── app.py              # GUI tkinter — janela principal, drag-and-drop, thread
├── extrator.py         # Orquestrador: coordena todos os módulos, monta o Markdown
├── parser.py           # Parseia .txt do WhatsApp → lista de mensagens estruturadas
├── audio.py            # Transcreve .opus/.ogg via Groq
├── imagem.py           # Descreve imagens via Claude Vision
├── documento.py        # Extrai texto de PDFs via pypdf
├── consolidador.py     # Monta a linha do tempo cronológica em texto
├── resumo.py           # Gera resumo executivo via Claude
├── cache.py            # Lê/salva progresso incremental em _cache_extrator.json
├── tests/
│   ├── conftest.py
│   ├── test_cache.py
│   ├── test_parser.py
│   ├── test_audio.py
│   ├── test_imagem.py
│   ├── test_documento.py
│   ├── test_consolidador.py
│   ├── test_resumo.py
│   └── test_extrator.py
├── .env.example
├── requirements.txt
└── README.md
```

---

## Task 1: Setup do projeto

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\requirements.txt`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\.env.example`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\tests\conftest.py`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\pytest.ini`

**Interfaces:**
- Produces: ambiente Python pronto com dependências instaladas e pytest configurado

- [ ] **Step 1: Criar a pasta da ferramenta**

```powershell
New-Item -ItemType Directory -Force "D:\FERRAMENTAS\extrator_whatsapp\tests"
```

- [ ] **Step 2: Criar `requirements.txt`**

```
anthropic
groq
pypdf
python-dotenv
tkinterdnd2
pytest
pytest-mock
```

- [ ] **Step 3: Criar `.env.example`**

```
GROQ_API_KEY=gsk_sua_chave_aqui
ANTHROPIC_API_KEY=sk-ant-sua_chave_aqui
```

- [ ] **Step 4: Criar `pytest.ini`**

```ini
[pytest]
testpaths = tests
```

- [ ] **Step 5: Criar `tests/conftest.py`**

```python
import pytest
from pathlib import Path


@pytest.fixture
def tmp_pasta(tmp_path):
    return tmp_path
```

- [ ] **Step 6: Instalar dependências**

```powershell
cd D:\FERRAMENTAS\extrator_whatsapp
pip install -r requirements.txt
```

Saída esperada: todas as dependências instaladas sem erro.

- [ ] **Step 7: Verificar que pytest funciona**

```powershell
pytest --collect-only
```

Saída esperada: `no tests ran` (sem erros).

- [ ] **Step 8: Commit**

```powershell
cd D:\FERRAMENTAS\extrator_whatsapp
git init
git add requirements.txt .env.example pytest.ini tests/conftest.py
git commit -m "chore: setup inicial do projeto"
```

---

## Task 2: `cache.py` — Progresso incremental

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\cache.py`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\tests\test_cache.py`

**Interfaces:**
- Produces:
  - `Cache(pasta: Path)` — instancia e carrega cache existente
  - `cache.get(tipo: str, arquivo: str) -> str | None`
  - `cache.set(tipo: str, arquivo: str, valor: str) -> None` — salva imediatamente

- [ ] **Step 1: Escrever os testes**

```python
# tests/test_cache.py
import pytest
from pathlib import Path
from cache import Cache


def test_retorna_none_para_item_ausente(tmp_pasta):
    c = Cache(tmp_pasta)
    assert c.get("audios", "AUDIO-001.opus") is None


def test_salva_e_recupera_item(tmp_pasta):
    c = Cache(tmp_pasta)
    c.set("audios", "AUDIO-001.opus", "texto transcrito")
    assert c.get("audios", "AUDIO-001.opus") == "texto transcrito"


def test_persiste_em_disco(tmp_pasta):
    c1 = Cache(tmp_pasta)
    c1.set("imagens", "IMG-001.jpg", "descrição da imagem")

    c2 = Cache(tmp_pasta)
    assert c2.get("imagens", "IMG-001.jpg") == "descrição da imagem"


def test_arquivo_cache_criado_na_pasta(tmp_pasta):
    c = Cache(tmp_pasta)
    c.set("audios", "x.opus", "y")
    assert (tmp_pasta / "_cache_extrator.json").exists()


def test_categorias_independentes(tmp_pasta):
    c = Cache(tmp_pasta)
    c.set("audios", "arquivo.opus", "audio")
    c.set("imagens", "arquivo.opus", "imagem")
    assert c.get("audios", "arquivo.opus") == "audio"
    assert c.get("imagens", "arquivo.opus") == "imagem"
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```powershell
pytest tests/test_cache.py -v
```

Saída esperada: `ModuleNotFoundError: No module named 'cache'`

- [ ] **Step 3: Implementar `cache.py`**

```python
import json
from pathlib import Path

ARQUIVO_CACHE = "_cache_extrator.json"
TIPOS_VALIDOS = {"audios", "imagens", "documentos"}


class Cache:
    def __init__(self, pasta: Path):
        self._caminho = pasta / ARQUIVO_CACHE
        self._dados: dict[str, dict[str, str]] = {t: {} for t in TIPOS_VALIDOS}
        if self._caminho.exists():
            carregado = json.loads(self._caminho.read_text(encoding="utf-8"))
            for tipo in TIPOS_VALIDOS:
                self._dados[tipo] = carregado.get(tipo, {})

    def get(self, tipo: str, arquivo: str) -> str | None:
        return self._dados.get(tipo, {}).get(arquivo)

    def set(self, tipo: str, arquivo: str, valor: str) -> None:
        self._dados.setdefault(tipo, {})[arquivo] = valor
        self._caminho.write_text(
            json.dumps(self._dados, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
```

- [ ] **Step 4: Rodar os testes e verificar que passam**

```powershell
pytest tests/test_cache.py -v
```

Saída esperada: `5 passed`

- [ ] **Step 5: Commit**

```powershell
git add cache.py tests/test_cache.py
git commit -m "feat: cache incremental de progresso"
```

---

## Task 3: `parser.py` — Parseia o .txt do WhatsApp

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\parser.py`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\tests\test_parser.py`

**Interfaces:**
- Produces:
  - `parsear(arquivo_txt: Path) -> list[dict]`
  - Cada dict: `{"datetime": "2026-07-01 09:15", "remetente": str, "tipo": str, "conteudo": str | None, "arquivo": str | None}`
  - `tipo` em: `"texto"`, `"audio"`, `"imagem"`, `"documento"`, `"midia_omitida"`, `"outro"`

- [ ] **Step 1: Criar arquivo de conversa de teste**

```python
# tests/test_parser.py
import pytest
from pathlib import Path
from parser import parsear

CONVERSA_ANDROID = """\
23/06/2026, 09:00 - Pedro Thomas: Bom dia
23/06/2026, 09:01 - Ademir: bom dia
23/06/2026, 09:02 - Ademir: AUDIO-2026-06-23-09-02-00.opus (arquivo anexado)
23/06/2026, 09:03 - Ademir: IMG-2026-06-23-09-03-00.jpg (arquivo anexado)
23/06/2026, 09:04 - Ademir: relatorio.pdf (arquivo anexado)
23/06/2026, 09:05 - Ademir: <Mídia omitida>
23/06/2026, 09:06 - Ademir: mensagem longa
que continua aqui
"""


@pytest.fixture
def txt_android(tmp_path):
    f = tmp_path / "WhatsApp Chat - Ademir.txt"
    f.write_text(CONVERSA_ANDROID, encoding="utf-8")
    return f


def test_parseia_mensagem_texto(txt_android):
    msgs = parsear(txt_android)
    assert msgs[0]["remetente"] == "Pedro Thomas"
    assert msgs[0]["tipo"] == "texto"
    assert msgs[0]["conteudo"] == "Bom dia"
    assert msgs[0]["datetime"] == "2026-06-23 09:00"


def test_parseia_audio(txt_android):
    msgs = parsear(txt_android)
    audio = next(m for m in msgs if m["tipo"] == "audio")
    assert audio["arquivo"] == "AUDIO-2026-06-23-09-02-00.opus"
    assert audio["conteudo"] is None


def test_parseia_imagem(txt_android):
    msgs = parsear(txt_android)
    img = next(m for m in msgs if m["tipo"] == "imagem")
    assert img["arquivo"] == "IMG-2026-06-23-09-03-00.jpg"


def test_parseia_documento(txt_android):
    msgs = parsear(txt_android)
    doc = next(m for m in msgs if m["tipo"] == "documento")
    assert doc["arquivo"] == "relatorio.pdf"


def test_parseia_midia_omitida(txt_android):
    msgs = parsear(txt_android)
    omitida = next(m for m in msgs if m["tipo"] == "midia_omitida")
    assert omitida is not None


def test_mensagem_multilinha_agrupada(txt_android):
    msgs = parsear(txt_android)
    longa = next(m for m in msgs if "mensagem longa" in (m["conteudo"] or ""))
    assert "que continua aqui" in longa["conteudo"]


def test_quantidade_total_mensagens(txt_android):
    msgs = parsear(txt_android)
    assert len(msgs) == 7
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```powershell
pytest tests/test_parser.py -v
```

Saída esperada: `ModuleNotFoundError: No module named 'parser'`

- [ ] **Step 3: Implementar `parser.py`**

```python
import re
from pathlib import Path
from datetime import datetime

# DD/MM/YYYY[,] HH:MM[:SS] - Remetente: Conteúdo
_PATTERN_ANDROID = re.compile(
    r"^(\d{2}/\d{2}/\d{2,4}),?\s+(\d{2}:\d{2})(?::\d{2})?\s+-\s+([^:]+):\s(.+)$"
)
# [DD/MM/YY, HH:MM:SS] Remetente: Conteúdo
_PATTERN_IOS = re.compile(
    r"^\[(\d{2}/\d{2}/\d{2,4}),\s+(\d{2}:\d{2}(?::\d{2})?)\]\s+([^:]+):\s(.+)$"
)
_AUDIO_EXT = {".opus", ".ogg", ".m4a", ".mp3"}
_IMAGEM_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_DOC_EXT = {".pdf"}
_MIDIA_OMITIDA = {"<Mídia omitida>", "<Media omitted>"}
_SUFIXO_ANEXO = re.compile(r"\s*\(arquivo anexado\)|\s*\(file attached\)", re.IGNORECASE)


def _normalizar_data(data_str: str, hora_str: str) -> str:
    hora = hora_str[:5]  # HH:MM
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            dt = datetime.strptime(data_str, fmt)
            return f"{dt.strftime('%Y-%m-%d')} {hora}"
        except ValueError:
            continue
    return f"{data_str} {hora}"


def _classificar(conteudo: str) -> tuple[str, str | None, str | None]:
    if conteudo in _MIDIA_OMITIDA:
        return "midia_omitida", None, None
    nome = _SUFIXO_ANEXO.sub("", conteudo).strip()
    ext = Path(nome).suffix.lower()
    if ext in _AUDIO_EXT:
        return "audio", None, nome
    if ext in _IMAGEM_EXT:
        return "imagem", None, nome
    if ext in _DOC_EXT:
        return "documento", None, nome
    return "texto", conteudo, None


def parsear(arquivo_txt: Path) -> list[dict]:
    texto = arquivo_txt.read_text(encoding="utf-8", errors="ignore")
    linhas = texto.splitlines()
    mensagens: list[dict] = []

    for linha in linhas:
        m = _PATTERN_ANDROID.match(linha) or _PATTERN_IOS.match(linha)
        if m:
            data, hora, remetente, conteudo = m.group(1), m.group(2), m.group(3), m.group(4)
            tipo, texto_msg, arquivo = _classificar(conteudo)
            mensagens.append({
                "datetime": _normalizar_data(data, hora),
                "remetente": remetente.strip(),
                "tipo": tipo,
                "conteudo": texto_msg,
                "arquivo": arquivo,
            })
        elif mensagens and linha.strip():
            # Linha de continuação de mensagem anterior
            if mensagens[-1]["tipo"] == "texto" and mensagens[-1]["conteudo"] is not None:
                mensagens[-1]["conteudo"] += "\n" + linha

    return mensagens
```

- [ ] **Step 4: Rodar os testes e verificar que passam**

```powershell
pytest tests/test_parser.py -v
```

Saída esperada: `7 passed`

- [ ] **Step 5: Commit**

```powershell
git add parser.py tests/test_parser.py
git commit -m "feat: parser do .txt exportado do WhatsApp"
```

---

## Task 4: `audio.py` — Transcrição de áudio via Groq

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\audio.py`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\tests\test_audio.py`

**Interfaces:**
- Consumes: `groq.Groq` client
- Produces: `transcrever(arquivo: Path, client: groq.Groq) -> str`
  - Retorna o texto transcrito, ou levanta `Exception` em caso de falha

- [ ] **Step 1: Escrever os testes**

```python
# tests/test_audio.py
import pytest
from pathlib import Path
from unittest.mock import MagicMock, mock_open, patch
from audio import transcrever


def test_retorna_texto_transcrito(tmp_path):
    arquivo = tmp_path / "AUDIO-001.opus"
    arquivo.write_bytes(b"fake audio data")

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create.return_value = MagicMock(text="  olá mundo  ")

    resultado = transcrever(arquivo, mock_client)

    assert resultado == "olá mundo"


def test_chama_api_com_parametros_corretos(tmp_path):
    arquivo = tmp_path / "AUDIO-001.opus"
    arquivo.write_bytes(b"fake audio data")

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create.return_value = MagicMock(text="texto")

    transcrever(arquivo, mock_client)

    call_kwargs = mock_client.audio.transcriptions.create.call_args[1]
    assert call_kwargs["model"] == "whisper-large-v3-turbo"
    assert call_kwargs["language"] == "pt"
    assert call_kwargs["response_format"] == "json"


def test_propaga_excecao_em_falha(tmp_path):
    arquivo = tmp_path / "AUDIO-001.opus"
    arquivo.write_bytes(b"fake audio data")

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create.side_effect = Exception("API error")

    with pytest.raises(Exception, match="API error"):
        transcrever(arquivo, mock_client)
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```powershell
pytest tests/test_audio.py -v
```

Saída esperada: `ModuleNotFoundError: No module named 'audio'`

- [ ] **Step 3: Implementar `audio.py`**

```python
from pathlib import Path
from groq import Groq

MODELO = "whisper-large-v3-turbo"


def transcrever(arquivo: Path, client: Groq) -> str:
    with open(arquivo, "rb") as f:
        resposta = client.audio.transcriptions.create(
            file=(arquivo.name, f.read()),
            model=MODELO,
            language="pt",
            response_format="json",
        )
    return resposta.text.strip()
```

- [ ] **Step 4: Rodar os testes e verificar que passam**

```powershell
pytest tests/test_audio.py -v
```

Saída esperada: `3 passed`

- [ ] **Step 5: Commit**

```powershell
git add audio.py tests/test_audio.py
git commit -m "feat: transcrição de áudio via Groq"
```

---

## Task 5: `imagem.py` — Descrição de imagens via Claude Vision

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\imagem.py`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\tests\test_imagem.py`

**Interfaces:**
- Consumes: `anthropic.Anthropic` client
- Produces: `descrever(arquivo: Path, client: anthropic.Anthropic) -> str`
  - Retorna descrição/texto extraído da imagem, ou levanta `Exception`

- [ ] **Step 1: Escrever os testes**

```python
# tests/test_imagem.py
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from imagem import descrever

EXTENSOES_VALIDAS = [".jpg", ".jpeg", ".png", ".webp"]


@pytest.mark.parametrize("ext", EXTENSOES_VALIDAS)
def test_aceita_extensoes_validas(tmp_path, ext):
    arquivo = tmp_path / f"foto{ext}"
    arquivo.write_bytes(b"\xff\xd8\xff")  # bytes mínimos JPEG

    mock_content = MagicMock()
    mock_content.text = "Imagem de uma fazenda."
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(content=[mock_content])

    resultado = descrever(arquivo, mock_client)
    assert resultado == "Imagem de uma fazenda."


def test_envia_imagem_em_base64(tmp_path):
    arquivo = tmp_path / "foto.jpg"
    arquivo.write_bytes(b"\xff\xd8\xff")

    mock_content = MagicMock()
    mock_content.text = "descrição"
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(content=[mock_content])

    descrever(arquivo, mock_client)

    call_kwargs = mock_client.messages.create.call_args[1]
    msgs = call_kwargs["messages"]
    conteudo = msgs[0]["content"]
    tipos = [c["type"] for c in conteudo]
    assert "image" in tipos


def test_propaga_excecao_em_falha(tmp_path):
    arquivo = tmp_path / "foto.jpg"
    arquivo.write_bytes(b"\xff\xd8\xff")

    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("Vision error")

    with pytest.raises(Exception, match="Vision error"):
        descrever(arquivo, mock_client)
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```powershell
pytest tests/test_imagem.py -v
```

Saída esperada: `ModuleNotFoundError: No module named 'imagem'`

- [ ] **Step 3: Implementar `imagem.py`**

```python
import base64
from pathlib import Path
import anthropic

MODELO = "claude-haiku-4-5-20251001"
_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}
_PROMPT = (
    "Descreva o conteúdo desta imagem de forma objetiva. "
    "Se for um documento fotografado (cupom fiscal, boleto, nota fiscal, recibo, "
    "captura de tela com texto), extraia os dados e o texto relevantes. "
    "Seja direto e conciso."
)


def descrever(arquivo: Path, client: anthropic.Anthropic) -> str:
    dados = arquivo.read_bytes()
    b64 = base64.standard_b64encode(dados).decode("utf-8")
    media_type = _MEDIA_TYPES.get(arquivo.suffix.lower(), "image/jpeg")

    resposta = client.messages.create(
        model=MODELO,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": _PROMPT},
                ],
            }
        ],
    )
    return resposta.content[0].text.strip()
```

- [ ] **Step 4: Rodar os testes e verificar que passam**

```powershell
pytest tests/test_imagem.py -v
```

Saída esperada: `5 passed`

- [ ] **Step 5: Commit**

```powershell
git add imagem.py tests/test_imagem.py
git commit -m "feat: descrição de imagens via Claude Vision"
```

---

## Task 6: `documento.py` — Extração de texto de PDFs

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\documento.py`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\tests\test_documento.py`

**Interfaces:**
- Produces: `extrair_texto(arquivo: Path) -> str`
  - Retorna o texto extraído do PDF, ou levanta `Exception`

- [ ] **Step 1: Escrever os testes**

```python
# tests/test_documento.py
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from documento import extrair_texto


def test_extrai_texto_de_pdf(tmp_path):
    arquivo = tmp_path / "doc.pdf"
    arquivo.write_bytes(b"%PDF-1.4 fake")

    mock_reader = MagicMock()
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Texto extraído do PDF"
    mock_reader.pages = [mock_page]

    with patch("documento.PdfReader", return_value=mock_reader):
        resultado = extrair_texto(arquivo)

    assert resultado == "Texto extraído do PDF"


def test_concatena_multiplas_paginas(tmp_path):
    arquivo = tmp_path / "doc.pdf"
    arquivo.write_bytes(b"%PDF-1.4 fake")

    mock_reader = MagicMock()
    pagina1 = MagicMock()
    pagina1.extract_text.return_value = "Página 1"
    pagina2 = MagicMock()
    pagina2.extract_text.return_value = "Página 2"
    mock_reader.pages = [pagina1, pagina2]

    with patch("documento.PdfReader", return_value=mock_reader):
        resultado = extrair_texto(arquivo)

    assert "Página 1" in resultado
    assert "Página 2" in resultado


def test_pagina_sem_texto_ignorada(tmp_path):
    arquivo = tmp_path / "doc.pdf"
    arquivo.write_bytes(b"%PDF-1.4 fake")

    mock_reader = MagicMock()
    pagina1 = MagicMock()
    pagina1.extract_text.return_value = None
    pagina2 = MagicMock()
    pagina2.extract_text.return_value = "Conteúdo"
    mock_reader.pages = [pagina1, pagina2]

    with patch("documento.PdfReader", return_value=mock_reader):
        resultado = extrair_texto(arquivo)

    assert resultado == "Conteúdo"
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```powershell
pytest tests/test_documento.py -v
```

Saída esperada: `ModuleNotFoundError: No module named 'documento'`

- [ ] **Step 3: Implementar `documento.py`**

```python
from pathlib import Path
from pypdf import PdfReader


def extrair_texto(arquivo: Path) -> str:
    reader = PdfReader(str(arquivo))
    partes = []
    for pagina in reader.pages:
        texto = pagina.extract_text()
        if texto:
            partes.append(texto.strip())
    return "\n\n".join(partes)
```

- [ ] **Step 4: Rodar os testes e verificar que passam**

```powershell
pytest tests/test_documento.py -v
```

Saída esperada: `3 passed`

- [ ] **Step 5: Commit**

```powershell
git add documento.py tests/test_documento.py
git commit -m "feat: extração de texto de PDFs"
```

---

## Task 7: `consolidador.py` — Linha do tempo em Markdown

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\consolidador.py`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\tests\test_consolidador.py`

**Interfaces:**
- Consumes:
  - `mensagens: list[dict]` — saída de `parsear()` de `parser.py`
  - `cache: Cache` — instância de `Cache` de `cache.py`
- Produces: `consolidar(mensagens: list[dict], cache: Cache) -> str`
  - Retorna a seção "Linha do tempo consolidada" como string Markdown

- [ ] **Step 1: Escrever os testes**

```python
# tests/test_consolidador.py
import pytest
from pathlib import Path
from unittest.mock import MagicMock
from consolidador import consolidar


def _cache_mock(dados: dict):
    cache = MagicMock()
    def _get(tipo, arquivo):
        return dados.get(tipo, {}).get(arquivo)
    cache.get.side_effect = _get
    return cache


def test_formata_mensagem_texto():
    mensagens = [{"datetime": "2026-07-01 09:00", "remetente": "Ademir",
                  "tipo": "texto", "conteudo": "Bom dia", "arquivo": None}]
    resultado = consolidar(mensagens, _cache_mock({}))
    assert "2026-07-01 09:00 — Ademir: Bom dia" in resultado


def test_insere_transcricao_de_audio():
    mensagens = [{"datetime": "2026-07-01 09:01", "remetente": "Ademir",
                  "tipo": "audio", "conteudo": None, "arquivo": "AUDIO-001.opus"}]
    cache = _cache_mock({"audios": {"AUDIO-001.opus": "texto do áudio"}})
    resultado = consolidar(mensagens, cache)
    assert "[ÁUDIO TRANSCRITO] texto do áudio" in resultado


def test_insere_descricao_de_imagem():
    mensagens = [{"datetime": "2026-07-01 09:02", "remetente": "Ademir",
                  "tipo": "imagem", "conteudo": None, "arquivo": "IMG-001.jpg"}]
    cache = _cache_mock({"imagens": {"IMG-001.jpg": "foto de vacas"}})
    resultado = consolidar(mensagens, cache)
    assert "[IMAGEM] foto de vacas" in resultado


def test_insere_texto_de_documento():
    mensagens = [{"datetime": "2026-07-01 09:03", "remetente": "Ademir",
                  "tipo": "documento", "conteudo": None, "arquivo": "doc.pdf"}]
    cache = _cache_mock({"documentos": {"doc.pdf": "conteúdo do PDF"}})
    resultado = consolidar(mensagens, cache)
    assert "[DOCUMENTO] conteúdo do PDF" in resultado


def test_audio_sem_cache_mostra_placeholder():
    mensagens = [{"datetime": "2026-07-01 09:01", "remetente": "Ademir",
                  "tipo": "audio", "conteudo": None, "arquivo": "AUDIO-001.opus"}]
    resultado = consolidar(mensagens, _cache_mock({}))
    assert "[ÁUDIO] AUDIO-001.opus" in resultado


def test_midia_omitida():
    mensagens = [{"datetime": "2026-07-01 09:04", "remetente": "Ademir",
                  "tipo": "midia_omitida", "conteudo": None, "arquivo": None}]
    resultado = consolidar(mensagens, _cache_mock({}))
    assert "[MÍDIA OMITIDA]" in resultado


def test_ordem_cronologica_preservada():
    mensagens = [
        {"datetime": "2026-07-01 09:00", "remetente": "A", "tipo": "texto",
         "conteudo": "primeira", "arquivo": None},
        {"datetime": "2026-07-01 09:01", "remetente": "B", "tipo": "texto",
         "conteudo": "segunda", "arquivo": None},
    ]
    resultado = consolidar(mensagens, _cache_mock({}))
    assert resultado.index("primeira") < resultado.index("segunda")
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```powershell
pytest tests/test_consolidador.py -v
```

Saída esperada: `ModuleNotFoundError: No module named 'consolidador'`

- [ ] **Step 3: Implementar `consolidador.py`**

```python
from cache import Cache

_TIPO_CACHE = {"audio": "audios", "imagem": "imagens", "documento": "documentos"}
_PREFIXO = {"audio": "ÁUDIO TRANSCRITO", "imagem": "IMAGEM", "documento": "DOCUMENTO"}
_PLACEHOLDER = {"audio": "ÁUDIO", "imagem": "IMAGEM", "documento": "DOCUMENTO"}


def consolidar(mensagens: list[dict], cache: Cache) -> str:
    linhas = []
    for msg in mensagens:
        dt = msg["datetime"]
        rem = msg["remetente"]
        tipo = msg["tipo"]

        if tipo == "texto":
            linhas.append(f"{dt} — {rem}: {msg['conteudo']}")
        elif tipo == "midia_omitida":
            linhas.append(f"{dt} — {rem}: [MÍDIA OMITIDA]")
        elif tipo in _TIPO_CACHE:
            arquivo = msg["arquivo"]
            valor = cache.get(_TIPO_CACHE[tipo], arquivo)
            if valor:
                prefixo = _PREFIXO[tipo]
                linhas.append(f"{dt} — {rem}: [{prefixo}] {valor}")
            else:
                ph = _PLACEHOLDER[tipo]
                linhas.append(f"{dt} — {rem}: [{ph}] {arquivo}")

    return "\n".join(linhas)
```

- [ ] **Step 4: Rodar os testes e verificar que passam**

```powershell
pytest tests/test_consolidador.py -v
```

Saída esperada: `7 passed`

- [ ] **Step 5: Commit**

```powershell
git add consolidador.py tests/test_consolidador.py
git commit -m "feat: consolidação cronológica da conversa"
```

---

## Task 8: `resumo.py` — Resumo executivo via Claude

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\resumo.py`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\tests\test_resumo.py`

**Interfaces:**
- Consumes: `anthropic.Anthropic` client
- Produces: `gerar_resumo(linha_do_tempo: str, client: anthropic.Anthropic) -> str`
  - Retorna o resumo executivo como string

- [ ] **Step 1: Escrever os testes**

```python
# tests/test_resumo.py
import pytest
from unittest.mock import MagicMock
from resumo import gerar_resumo


def test_retorna_texto_do_resumo():
    mock_content = MagicMock()
    mock_content.text = "  Resumo da conversa.  "
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(content=[mock_content])

    resultado = gerar_resumo("linha do tempo...", mock_client)

    assert resultado == "Resumo da conversa."


def test_envia_linha_do_tempo_para_api():
    mock_content = MagicMock()
    mock_content.text = "resumo"
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(content=[mock_content])

    gerar_resumo("conteúdo da conversa", mock_client)

    call_kwargs = mock_client.messages.create.call_args[1]
    msgs = call_kwargs["messages"]
    assert "conteúdo da conversa" in msgs[0]["content"]


def test_propaga_excecao_em_falha():
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = Exception("API error")

    with pytest.raises(Exception, match="API error"):
        gerar_resumo("texto", mock_client)
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```powershell
pytest tests/test_resumo.py -v
```

Saída esperada: `ModuleNotFoundError: No module named 'resumo'`

- [ ] **Step 3: Implementar `resumo.py`**

```python
import anthropic

MODELO = "claude-haiku-4-5-20251001"
_SISTEMA = (
    "Você é um assistente que produz resumos executivos claros e objetivos. "
    "Sua tarefa é resumir uma conversa do WhatsApp em 3 a 5 parágrafos. "
    "Use apenas as informações presentes na conversa — não invente nada. "
    "Foque nos temas principais, decisões tomadas e informações relevantes."
)


def gerar_resumo(linha_do_tempo: str, client: anthropic.Anthropic) -> str:
    resposta = client.messages.create(
        model=MODELO,
        max_tokens=2048,
        system=_SISTEMA,
        messages=[{"role": "user", "content": linha_do_tempo}],
    )
    return resposta.content[0].text.strip()
```

- [ ] **Step 4: Rodar os testes e verificar que passam**

```powershell
pytest tests/test_resumo.py -v
```

Saída esperada: `3 passed`

- [ ] **Step 5: Commit**

```powershell
git add resumo.py tests/test_resumo.py
git commit -m "feat: geração de resumo executivo via Claude"
```

---

## Task 9: `extrator.py` — Orquestrador principal

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\extrator.py`
- Create: `D:\FERRAMENTAS\extrator_whatsapp\tests\test_extrator.py`

**Interfaces:**
- Consumes: todos os módulos anteriores
- Produces: `extrair(pasta: Path, callback=None) -> Path`
  - `callback(mensagem: str, atual: int, total: int)` — chamado a cada item processado
  - Retorna o `Path` do arquivo Markdown gerado

- [ ] **Step 1: Escrever o teste de integração (com mocks de API)**

```python
# tests/test_extrator.py
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from extrator import extrair

CONVERSA = """\
23/06/2026, 09:00 - Pedro: Bom dia
23/06/2026, 09:01 - Ademir: produção boa hoje
23/06/2026, 09:02 - Ademir: AUDIO-2026-06-23-09-02-00.opus (arquivo anexado)
"""


@pytest.fixture
def pasta_exportacao(tmp_path, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    (tmp_path / "WhatsApp Chat - Ademir.txt").write_text(CONVERSA, encoding="utf-8")
    (tmp_path / "AUDIO-2026-06-23-09-02-00.opus").write_bytes(b"fake audio")
    return tmp_path


def test_gera_arquivo_markdown(pasta_exportacao):
    with (
        patch("extrator.Groq") as MockGroq,
        patch("extrator.anthropic.Anthropic") as MockAnthropic,
        patch("extrator.transcrever", return_value="texto do áudio"),
        patch("extrator.gerar_resumo", return_value="Resumo da conversa."),
    ):
        saida = extrair(pasta_exportacao)

    assert saida.exists()
    assert saida.suffix == ".md"


def test_markdown_contem_secoes_obrigatorias(pasta_exportacao):
    with (
        patch("extrator.Groq"),
        patch("extrator.anthropic.Anthropic"),
        patch("extrator.transcrever", return_value="texto do áudio"),
        patch("extrator.gerar_resumo", return_value="Resumo da conversa."),
    ):
        saida = extrair(pasta_exportacao)

    conteudo = saida.read_text(encoding="utf-8")
    assert "## Resumo executivo" in conteudo
    assert "## Linha do tempo consolidada" in conteudo
    assert "Período coberto" in conteudo
    assert "Total de mensagens" in conteudo


def test_callback_chamado_por_item(pasta_exportacao):
    chamadas = []
    def cb(msg, atual, total):
        chamadas.append((msg, atual, total))

    with (
        patch("extrator.Groq"),
        patch("extrator.anthropic.Anthropic"),
        patch("extrator.transcrever", return_value="texto"),
        patch("extrator.gerar_resumo", return_value="resumo"),
    ):
        extrair(pasta_exportacao, callback=cb)

    assert len(chamadas) > 0


def test_nome_arquivo_contem_contato(pasta_exportacao):
    with (
        patch("extrator.Groq"),
        patch("extrator.anthropic.Anthropic"),
        patch("extrator.transcrever", return_value="texto"),
        patch("extrator.gerar_resumo", return_value="resumo"),
    ):
        saida = extrair(pasta_exportacao)

    assert "Ademir" in saida.name
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```powershell
pytest tests/test_extrator.py -v
```

Saída esperada: `ModuleNotFoundError: No module named 'extrator'`

- [ ] **Step 3: Implementar `extrator.py`**

```python
import os
import re
from datetime import date
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from groq import Groq

from audio import transcrever
from cache import Cache
from consolidador import consolidar
from documento import extrair_texto
from imagem import descrever
from parser import parsear
from resumo import gerar_resumo

load_dotenv(Path(__file__).parent / ".env")

_AUDIO_EXT = {".opus", ".ogg", ".m4a", ".mp3"}
_IMAGEM_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_DOC_EXT = {".pdf"}


def _nome_contato(txt_path: Path) -> str:
    nome = txt_path.stem
    nome = re.sub(r"^WhatsApp\s+Chat\s*(?:with\s+|-\s*|com\s+)", "", nome, flags=re.IGNORECASE).strip()
    return re.sub(r"\s+", "_", nome) or "Contato"


def extrair(pasta: Path, callback=None) -> Path:
    groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
    anthropic_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    cache = Cache(pasta)

    txts = list(pasta.glob("*.txt"))
    if not txts:
        raise FileNotFoundError(f"Nenhum arquivo .txt encontrado em {pasta}")
    mensagens = parsear(txts[0])

    midias = [m for m in mensagens if m["tipo"] in ("audio", "imagem", "documento")]
    total = len(midias)

    for i, msg in enumerate(midias, 1):
        arquivo_path = pasta / msg["arquivo"]
        tipo = msg["tipo"]

        if tipo == "audio" and cache.get("audios", msg["arquivo"]) is None:
            if callback:
                callback(f"Transcrevendo áudio {i}/{total}...", i, total)
            try:
                resultado = transcrever(arquivo_path, groq_client)
                cache.set("audios", msg["arquivo"], resultado)
            except Exception as e:
                cache.set("audios", msg["arquivo"], f"[ERRO: {e}]")

        elif tipo == "imagem" and cache.get("imagens", msg["arquivo"]) is None:
            if callback:
                callback(f"Descrevendo imagem {i}/{total}...", i, total)
            try:
                resultado = descrever(arquivo_path, anthropic_client)
                cache.set("imagens", msg["arquivo"], resultado)
            except Exception as e:
                cache.set("imagens", msg["arquivo"], f"[ERRO: {e}]")

        elif tipo == "documento" and cache.get("documentos", msg["arquivo"]) is None:
            if callback:
                callback(f"Lendo documento {i}/{total}...", i, total)
            try:
                resultado = extrair_texto(arquivo_path)
                cache.set("documentos", msg["arquivo"], resultado)
            except Exception as e:
                cache.set("documentos", msg["arquivo"], f"[ERRO: {e}]")

    if callback:
        callback("Montando linha do tempo...", total, total)
    linha_do_tempo = consolidar(mensagens, cache)

    if callback:
        callback("Gerando resumo executivo...", total, total)
    resumo_txt = gerar_resumo(linha_do_tempo, anthropic_client)

    datas = [m["datetime"][:10] for m in mensagens if m["datetime"]]
    data_inicial = min(datas) if datas else ""
    data_final = max(datas) if datas else ""
    n_audio = sum(1 for m in midias if m["tipo"] == "audio")
    n_imagem = sum(1 for m in midias if m["tipo"] == "imagem")
    n_doc = sum(1 for m in midias if m["tipo"] == "documento")
    contato = _nome_contato(txts[0])

    markdown = f"""\
# Contexto extraído — Conversa com {contato.replace("_", " ")}

**Período coberto:** {data_inicial} a {data_final}
**Gerado em:** {date.today().isoformat()}
**Total de mensagens:** {len(mensagens)} | **Áudios transcritos:** {n_audio} | **Imagens processadas:** {n_imagem} | **Documentos lidos:** {n_doc}

## Resumo executivo

{resumo_txt}

## Linha do tempo consolidada

{linha_do_tempo}
"""

    nome_saida = f"CONTEXTO_{contato}_{date.today().isoformat()}.md"
    caminho_saida = pasta / nome_saida
    caminho_saida.write_text(markdown, encoding="utf-8")
    return caminho_saida
```

- [ ] **Step 4: Rodar os testes e verificar que passam**

```powershell
pytest tests/test_extrator.py -v
```

Saída esperada: `4 passed`

- [ ] **Step 5: Rodar todos os testes para garantir nada quebrou**

```powershell
pytest -v
```

Saída esperada: todos os testes passando.

- [ ] **Step 6: Commit**

```powershell
git add extrator.py tests/test_extrator.py
git commit -m "feat: orquestrador principal de extração"
```

---

## Task 10: `app.py` — Interface gráfica

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\app.py`

**Interfaces:**
- Consumes: `extrator.extrair(pasta: Path, callback) -> Path`
- Produces: janela tkinter executável com `python app.py`
- Teste: manual (GUI não é testada automaticamente)

- [ ] **Step 1: Implementar `app.py`**

```python
import queue
import re
import threading
import tkinter as tk
import os
import subprocess
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from tkinterdnd2 import DND_FILES, TkinterDnD

import extrator as ext


def _normalizar_caminho(valor: str) -> Path:
    valor = valor.strip()
    if valor.startswith("{") and valor.endswith("}"):
        valor = valor[1:-1]
    return Path(valor)


class App(TkinterDnD.Tk):
    def __init__(self):
        super().__init__()
        self.title("Extrator de Conversas WhatsApp")
        self.resizable(False, False)
        self._pasta: Path | None = None
        self._fila: queue.Queue = queue.Queue()
        self._construir_ui()

    def _construir_ui(self):
        frame = tk.Frame(self, padx=20, pady=20)
        frame.pack(fill="both", expand=True)

        tk.Label(frame, text="Extrator de Conversas WhatsApp",
                 font=("Helvetica", 14, "bold")).pack(pady=(0, 16))

        # Área de drop
        self._drop_area = tk.Label(
            frame,
            text="Arraste a pasta exportada aqui\nou clique em Selecionar Pasta",
            relief="dashed", bd=2, width=50, height=6,
            fg="#555", cursor="hand2",
        )
        self._drop_area.pack(pady=(0, 10))
        self._drop_area.drop_target_register(DND_FILES)
        self._drop_area.dnd_bind("<<Drop>>", self._on_drop)
        self._drop_area.bind("<Button-1>", lambda _: self._selecionar_pasta())

        # Label com caminho selecionado
        self._label_pasta = tk.Label(frame, text="Nenhuma pasta selecionada",
                                     fg="#888", wraplength=400)
        self._label_pasta.pack(pady=(0, 12))

        # Barra de progresso
        self._progresso = ttk.Progressbar(frame, mode="indeterminate", length=400)
        self._progresso.pack(pady=(0, 6))

        # Status
        self._label_status = tk.Label(frame, text="", fg="#333")
        self._label_status.pack(pady=(0, 12))

        # Botão Extrair
        self._btn_extrair = tk.Button(
            frame, text="Extrair", command=self._iniciar_extracao,
            state="disabled", width=20, height=2,
            bg="#25d366", fg="white", font=("Helvetica", 11, "bold"),
        )
        self._btn_extrair.pack()

    def _selecionar_pasta(self):
        pasta = filedialog.askdirectory(title="Selecione a pasta exportada do WhatsApp")
        if pasta:
            self._definir_pasta(Path(pasta))

    def _on_drop(self, event):
        self._definir_pasta(_normalizar_caminho(event.data))

    def _definir_pasta(self, pasta: Path):
        self._pasta = pasta
        nome = pasta.name if len(pasta.name) <= 50 else "..." + pasta.name[-47:]
        self._label_pasta.config(text=str(pasta), fg="#222")
        self._drop_area.config(text=f"📁 {nome}", fg="#25d366")
        self._btn_extrair.config(state="normal")

    def _iniciar_extracao(self):
        if not self._pasta:
            return
        self._btn_extrair.config(state="disabled")
        self._progresso.start(10)
        self._label_status.config(text="Iniciando...")
        threading.Thread(target=self._worker, daemon=True).start()
        self.after(100, self._verificar_fila)

    def _worker(self):
        def callback(msg, atual, total):
            self._fila.put(("status", msg))

        try:
            caminho = ext.extrair(self._pasta, callback=callback)
            self._fila.put(("ok", caminho))
        except Exception as e:
            self._fila.put(("erro", str(e)))

    def _verificar_fila(self):
        try:
            while True:
                tipo, dado = self._fila.get_nowait()
                if tipo == "status":
                    self._label_status.config(text=dado)
                elif tipo == "ok":
                    self._progresso.stop()
                    self._label_status.config(text="Concluído!", fg="green")
                    self._btn_extrair.config(state="normal")
                    if messagebox.askyesno(
                        "Concluído",
                        f"Arquivo gerado:\n{dado}\n\nDeseja abrir o arquivo?"
                    ):
                        os.startfile(dado)
                    return
                elif tipo == "erro":
                    self._progresso.stop()
                    self._label_status.config(text="Erro durante o processamento.", fg="red")
                    self._btn_extrair.config(state="normal")
                    messagebox.showerror("Erro", dado)
                    return
        except queue.Empty:
            pass
        self.after(100, self._verificar_fila)


if __name__ == "__main__":
    app = App()
    app.mainloop()
```

- [ ] **Step 2: Testar manualmente**

```powershell
cd D:\FERRAMENTAS\extrator_whatsapp
python app.py
```

Verificar:
- Janela abre sem erro
- Campo de drop aceita arrastar uma pasta
- Botão "Selecionar Pasta" abre o diálogo de pasta
- Após selecionar pasta, botão "Extrair" fica ativo
- (Para testar o fluxo completo, use uma pasta real de exportação do WhatsApp com `.env` configurado)

- [ ] **Step 3: Commit**

```powershell
git add app.py
git commit -m "feat: interface gráfica com drag-and-drop"
```

---

## Task 11: `README.md` e `.env` — Documentação de uso

**Files:**
- Create: `D:\FERRAMENTAS\extrator_whatsapp\README.md`

**Interfaces:**
- Produces: instruções de setup e uso para o usuário final

- [ ] **Step 1: Criar `README.md`**

```markdown
# Extrator de Conversas WhatsApp

Converte uma exportação do WhatsApp (texto + áudios + imagens + PDFs) num
arquivo Markdown consolidado com tudo transcrito e organizado.

## Configuração inicial (uma vez)

### 1. Instalar dependências

```
pip install -r requirements.txt
```

### 2. Criar o arquivo `.env`

Copie `.env.example` para `.env` e preencha suas chaves:

```
GROQ_API_KEY=gsk_...         # console.groq.com (gratuito)
ANTHROPIC_API_KEY=sk-ant-... # console.anthropic.com (pago por uso, volume baixo)
```

## Como usar

```
python app.py
```

1. Exporte a conversa do WhatsApp **com mídia** (gera um `.zip`)
2. Extraia o `.zip` numa pasta
3. Arraste essa pasta para a janela, ou clique em "Selecionar Pasta"
4. Clique em "Extrair"
5. O arquivo `CONTEXTO_Contato_YYYY-MM-DD.md` será gerado na mesma pasta
```

- [ ] **Step 2: Commit final**

```powershell
git add README.md
git commit -m "docs: README com instruções de uso"
```

---

## Verificação final

- [ ] Rodar todos os testes:

```powershell
pytest -v
```

Saída esperada: todos os testes passando.

- [ ] Verificar estrutura de arquivos:

```powershell
Get-ChildItem D:\FERRAMENTAS\extrator_whatsapp -Name
```

Deve listar: `app.py`, `extrator.py`, `parser.py`, `audio.py`, `imagem.py`, `documento.py`, `consolidador.py`, `resumo.py`, `cache.py`, `tests/`, `requirements.txt`, `.env.example`, `README.md`
