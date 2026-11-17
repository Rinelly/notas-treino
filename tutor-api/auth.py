"""Quem pode usar o tutor.

Rodando só no seu computador, ninguém de fora alcança a API e a checagem
fica desligada. Publicada na internet é outra história: sem isto, qualquer
pessoa com o endereço gastaria a sua cota do Gemini.

Para ligar, preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no .env (as
mesmas do app). Aí toda chamada precisa trazer o token de quem está logado
no app, e a API pergunta ao Supabase se ele é válido.

ALLOWED_EMAILS é opcional: como o app deixa criar conta, liste aqui os
e-mails que podem conversar com o tutor (separados por vírgula).
"""

import json
import os
import time
import urllib.error
import urllib.request

from fastapi import Header, HTTPException

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
ALLOWED_EMAILS = {
    e.strip().lower() for e in os.getenv("ALLOWED_EMAILS", "").split(",") if e.strip()
}

LIGADA = bool(SUPABASE_URL and SUPABASE_KEY)

# token -> (validade do cache, e-mail). Evita ir ao Supabase a cada mensagem.
_cache: dict[str, tuple[float, str]] = {}
_CACHE_SEG = 300


def _email_do_token(token: str) -> str:
    agora = time.time()
    salvo = _cache.get(token)
    if salvo and salvo[0] > agora:
        return salvo[1]

    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_KEY},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            dados = json.load(res)
    except urllib.error.HTTPError as exc:
        raise HTTPException(401, "Sessão expirada. Entre de novo no app.") from exc
    except Exception as exc:
        raise HTTPException(503, "Não consegui confirmar o login no Supabase.") from exc

    email = str(dados.get("email") or "").lower()
    if len(_cache) > 200:
        _cache.clear()
    _cache[token] = (agora + _CACHE_SEG, email)
    return email


def exigir_usuario(authorization: str | None = Header(default=None)) -> str | None:
    """Dependência do FastAPI: devolve o e-mail de quem chamou, ou barra."""
    if not LIGADA:
        return None

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Faça login no app para usar o tutor.")

    email = _email_do_token(authorization[7:].strip())
    if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
        raise HTTPException(403, "Esta conta não tem acesso ao tutor.")
    return email
