"""
Combina o texto exportado do WhatsApp (.txt) com as transcrições de áudio
(transcricoes.json, gerado pelo transcrever_audios.py) e usa o Claude para
extrair eventos estruturados da conversa (produção, financeiro, ocorrências).

Uso:
    python extrair_eventos.py --pasta "./WhatsApp Chat - Ademir Pedro Thomas"

Saída:
    eventos_extraidos.json na mesma pasta — uma lista de eventos estruturados,
    pronta para alimentar o planejamento do CRM (ou, no futuro, o núcleo de dados).
"""
import os
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
import anthropic

load_dotenv()

MODELO = "claude-sonnet-5"

PROMPT_SISTEMA = """Você é um assistente que lê conversas de WhatsApp de um funcionário/gestor \
de uma propriedade rural (gado leiteiro e suínos) reportando ao proprietário (Ademir).

Sua tarefa é extrair EVENTOS ESTRUTURADOS da conversa, no formato JSON. Cada evento deve ter:
- "data": data do evento no formato YYYY-MM-DD (use a data da mensagem na conversa)
- "tipo": um de ["producao", "mortalidade", "insumo", "venda", "ocorrencia_sanitaria", \
"financeiro_negocio", "financeiro_pessoal", "outro"]
- "unidade_negocio": um de ["gado_leiteiro", "suinos", "geral", "pessoal"]
- "valor": valor em reais mencionado (número, ou null se não houver)
- "descricao": um resumo curto e objetivo do que foi relatado
- "texto_original": o trecho original (ou transcrição) que originou esse evento

Regras:
- Ignore saudações, conversa trivial e mensagens sem conteúdo informativo relevante \
para gestão da propriedade
- Se uma mensagem contiver múltiplos eventos, separe-os em itens distintos
- Responda APENAS com um array JSON válido, sem nenhum texto antes ou depois
"""


def carregar_conversa(pasta: Path) -> str:
    txts = list(pasta.glob("*.txt"))
    if not txts:
        raise FileNotFoundError(f"Nenhum arquivo .txt encontrado em {pasta}")
    conversa = txts[0].read_text(encoding="utf-8", errors="ignore")

    transcricoes_path = pasta / "transcricoes.json"
    if transcricoes_path.exists():
        transcricoes = json.loads(transcricoes_path.read_text(encoding="utf-8"))
        for nome_arquivo, texto in transcricoes.items():
            # Substitui a referência ao arquivo de áudio pelo texto transcrito
            conversa = conversa.replace(nome_arquivo, f"{nome_arquivo} [TRANSCRIÇÃO: {texto}]")
    else:
        print("Aviso: transcricoes.json não encontrado — rode transcrever_audios.py primeiro "
              "se a conversa tiver áudios.")

    return conversa


def dividir_em_blocos(conversa: str, tamanho_bloco: int = 8000) -> list:
    linhas = conversa.split("\n")
    blocos, bloco_atual = [], ""
    for linha in linhas:
        if len(bloco_atual) + len(linha) > tamanho_bloco and bloco_atual:
            blocos.append(bloco_atual)
            bloco_atual = ""
        bloco_atual += linha + "\n"
    if bloco_atual:
        blocos.append(bloco_atual)
    return blocos


def extrair_eventos(conversa: str) -> list:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    blocos = dividir_em_blocos(conversa)
    eventos = []

    for i, bloco in enumerate(blocos, 1):
        print(f"Processando bloco {i}/{len(blocos)}...")
        resposta = client.messages.create(
            model=MODELO,
            max_tokens=4000,
            system=PROMPT_SISTEMA,
            messages=[{"role": "user", "content": bloco}],
        )
        texto_resposta = resposta.content[0].text.strip()
        try:
            eventos_bloco = json.loads(texto_resposta)
            eventos.extend(eventos_bloco)
        except json.JSONDecodeError:
            print(f"  Aviso: bloco {i} não retornou JSON válido, pulando.")
            print(f"  Resposta recebida: {texto_resposta[:200]}...")

    return eventos


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extrai eventos estruturados da conversa do WhatsApp")
    parser.add_argument("--pasta", required=True, help="Pasta com o .txt exportado e transcricoes.json")
    args = parser.parse_args()

    pasta = Path(args.pasta)
    conversa = carregar_conversa(pasta)
    print(f"Conversa carregada: {len(conversa)} caracteres.\n")

    eventos = extrair_eventos(conversa)

    saida = pasta / "eventos_extraidos.json"
    saida.write_text(json.dumps(eventos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{len(eventos)} eventos extraídos e salvos em: {saida}")
