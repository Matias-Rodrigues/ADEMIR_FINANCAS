"""
Transcreve todos os áudios exportados do WhatsApp (.opus) usando a API
gratuita do Groq (Whisper Large v3 Turbo).

Pré-requisito: exportar a conversa do WhatsApp COM MÍDIA (gera um .zip com
os arquivos .opus dos áudios).

Uso:
    python transcrever_audios.py --pasta "./WhatsApp Chat - Ademir Pedro Thomas"

Saída:
    Um arquivo transcricoes.json na mesma pasta, no formato:
    { "AUDIO-2026-07-01-12-46-30.opus": "texto transcrito...", ... }

O script salva o progresso incrementalmente — se cair a conexão ou faltar
cota, é só rodar de novo que ele continua de onde parou.
"""
import os
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq

load_dotenv()


def transcrever_pasta(pasta: str, saida: str = "transcricoes.json"):
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    pasta_path = Path(pasta)

    audios = sorted(pasta_path.glob("*.opus")) + sorted(pasta_path.glob("*.ogg"))
    if not audios:
        print(f"Nenhum arquivo .opus/.ogg encontrado em {pasta}")
        print("Confira se você exportou a conversa COM MÍDIA e extraiu o .zip nessa pasta.")
        return

    caminho_saida = pasta_path / saida
    resultado = {}
    if caminho_saida.exists():
        resultado = json.loads(caminho_saida.read_text(encoding="utf-8"))
        print(f"Retomando: {len(resultado)} áudios já transcritos anteriormente.")

    pendentes = [a for a in audios if a.name not in resultado]
    print(f"Total de áudios: {len(audios)} | Pendentes: {len(pendentes)}\n")

    for i, audio in enumerate(pendentes, 1):
        print(f"[{i}/{len(pendentes)}] Transcrevendo: {audio.name}...")
        try:
            with open(audio, "rb") as f:
                transcricao = client.audio.transcriptions.create(
                    file=(audio.name, f.read()),
                    model="whisper-large-v3-turbo",
                    language="pt",
                    response_format="json",
                )
            resultado[audio.name] = transcricao.text.strip()
        except Exception as e:
            print(f"  Erro ao transcrever {audio.name}: {e}")
            resultado[audio.name] = f"[ERRO NA TRANSCRIÇÃO: {e}]"

        # Salva incrementalmente para não perder progresso
        caminho_saida.write_text(
            json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    print(f"\nConcluído. {len(resultado)} áudios transcritos em: {caminho_saida}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transcreve áudios exportados do WhatsApp")
    parser.add_argument("--pasta", required=True, help="Pasta com os arquivos .opus exportados do WhatsApp")
    args = parser.parse_args()
    transcrever_pasta(args.pasta)
