"""Camada que conversa com o modelo de IA.

Troque de provedor mudando LLM_PROVIDER no .env:
  - gemini (padrão, tem plano gratuito)
  - claude (precisa de créditos no Claude Console)
"""

import json
import os
import time

from prompts import TUTOR_TOOL

PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
TUTOR_SCHEMA = TUTOR_TOOL["input_schema"]


class LLMError(Exception):
    pass


# ---------------------------------------------------------------- Gemini
if PROVIDER == "gemini":
    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types

    MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    def _contents(messages: list[dict]):
        # o Gemini chama o assistente de "model"
        return [
            types.Content(
                role="model" if m["role"] == "assistant" else "user",
                parts=[types.Part(text=m["content"])],
            )
            for m in messages
        ]

    # ---- quanto o modelo "pensa" antes de responder -------------------
    # Os modelos Flash atuais raciocinam por padrão, e é isso que deixa a
    # conversa lenta: vários segundos antes da primeira palavra. Para um
    # bate-papo com correções curtas, o mínimo basta.
    #
    # GEMINI_THINKING no .env: minimal (padrão), low, medium, high,
    # ou default para não mandar nada e deixar o padrão do modelo.
    #
    # Nem todo modelo aceita todos os níveis. Se o escolhido for recusado,
    # a API tenta o próximo da fila e lembra qual funcionou.
    _PEDIDO = os.getenv("GEMINI_THINKING", "minimal").strip().lower()
    _FILA = {
        "minimal": ["minimal", "low", None],
        "low": ["low", None],
        "medium": ["medium", None],
        "high": ["high", None],
    }.get(_PEDIDO, [None])
    _nivel = {"indice": 0}

    def _config(system: str, nivel: str | None, **config):
        if nivel:
            config["thinking_config"] = types.ThinkingConfig(thinking_level=nivel)
        return types.GenerateContentConfig(system_instruction=system, **config)

    def _generate(system: str, messages: list[dict], **config):
        inicio = time.perf_counter()
        try:
            while True:
                nivel = _FILA[_nivel["indice"]]
                try:
                    resposta = _client.models.generate_content(
                        model=MODEL,
                        contents=_contents(messages),
                        config=_config(system, nivel, **config),
                    )
                    break
                except genai_errors.ClientError as exc:
                    # 400 com um nível de raciocínio pedido: o modelo não aceita
                    # esse nível. Desce um degrau e tenta de novo.
                    recusou = exc.code == 400 and nivel and _nivel["indice"] < len(_FILA) - 1
                    if not recusou:
                        raise
                    _nivel["indice"] += 1
            print(
                f"[tutor] {MODEL} respondeu em {time.perf_counter() - inicio:.1f}s "
                f"(raciocínio: {nivel or 'padrão do modelo'})",
                flush=True,
            )
            return resposta
        except genai_errors.ClientError as exc:
            if "API_KEY_INVALID" in str(exc) or "API key not valid" in str(exc):
                raise LLMError(
                    "Chave do Gemini inválida. Copie a chave inteira no AI Studio, "
                    "confira GEMINI_API_KEY no .env e reinicie o servidor."
                ) from exc
            if exc.code == 429:
                raise LLMError(
                    "Limite gratuito do Gemini atingido. Espere um minuto e tente de novo."
                ) from exc
            raise LLMError(f"Gemini API error: {exc}") from exc
        except Exception as exc:
            raise LLMError(f"Gemini API error: {exc}") from exc

    def tutor_reply(system: str, messages: list[dict]) -> dict:
        response = _generate(
            system,
            messages,
            response_mime_type="application/json",
            response_json_schema=TUTOR_SCHEMA,
            max_output_tokens=2048,
        )
        try:
            data = json.loads(response.text)
        except (TypeError, json.JSONDecodeError) as exc:
            raise LLMError("O modelo devolveu uma resposta em formato inesperado.") from exc
        data.setdefault("corrections", [])
        data.setdefault("new_words", [])
        return data

    def plain_text(system: str, messages: list[dict]) -> str:
        response = _generate(system, messages, max_output_tokens=2048)
        return response.text or ""


# ---------------------------------------------------------------- Claude
elif PROVIDER == "claude":
    from anthropic import Anthropic

    MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
    _client = Anthropic()  # lê ANTHROPIC_API_KEY

    def tutor_reply(system: str, messages: list[dict]) -> dict:
        try:
            response = _client.messages.create(
                model=MODEL,
                max_tokens=1024,
                system=system,
                tools=[TUTOR_TOOL],
                tool_choice={"type": "tool", "name": "tutor_reply"},
                messages=messages,
            )
        except Exception as exc:
            raise LLMError(f"Claude API error: {exc}") from exc
        for block in response.content:
            if block.type == "tool_use":
                return block.input
        raise LLMError("O modelo devolveu uma resposta em formato inesperado.")

    def plain_text(system: str, messages: list[dict]) -> str:
        try:
            response = _client.messages.create(
                model=MODEL, max_tokens=1500, system=system, messages=messages
            )
        except Exception as exc:
            raise LLMError(f"Claude API error: {exc}") from exc
        return "".join(b.text for b in response.content if b.type == "text")

else:
    raise RuntimeError(f"LLM_PROVIDER inválido: {PROVIDER!r} (use 'gemini' ou 'claude')")
