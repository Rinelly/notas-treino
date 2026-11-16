import os
from typing import Literal

from dotenv import load_dotenv

load_dotenv()  # precisa vir antes de importar llm e auth, que leem o .env

from fastapi import Depends, FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

import auth  # noqa: E402
import llm  # noqa: E402
from prompts import SCENARIOS, SUMMARY_PROMPT, SYSTEM_PROMPT  # noqa: E402

# de onde o app pode chamar esta API. Em produção, some o endereço do app
# publicado: CORS_ORIGINS=http://localhost:5173,https://seu-app.vercel.app
ORIGENS = [
    o.strip().rstrip("/")
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

app = FastAPI(title="English Tutor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    scenario: str = "free"


def build_system(scenario: str) -> str:
    return f"{SYSTEM_PROMPT}\nCURRENT SCENARIO: {SCENARIOS.get(scenario, SCENARIOS['free'])}"


def merge_roles(messages: list[dict]) -> list[dict]:
    """Junta mensagens seguidas do mesmo papel (as APIs esperam alternância)."""
    merged: list[dict] = []
    for m in messages:
        if merged and merged[-1]["role"] == m["role"]:
            merged[-1]["content"] += "\n\n" + m["content"]
        else:
            merged.append(dict(m))
    return merged


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "provider": llm.PROVIDER,
        "model": llm.MODEL,
        "login_obrigatorio": auth.LIGADA,
    }


@app.post("/api/chat")
def chat(req: ChatRequest, _usuario: str | None = Depends(auth.exigir_usuario)):
    if not req.messages:
        raise HTTPException(400, "messages is empty")
    messages = merge_roles([m.model_dump() for m in req.messages])
    try:
        return llm.tutor_reply(build_system(req.scenario), messages)
    except llm.LLMError as exc:
        raise HTTPException(502, str(exc)) from exc


@app.post("/api/summary")
def summary(req: ChatRequest, _usuario: str | None = Depends(auth.exigir_usuario)):
    if not req.messages:
        raise HTTPException(400, "messages is empty")
    messages = [m.model_dump() for m in req.messages]
    messages.append({"role": "user", "content": SUMMARY_PROMPT})
    try:
        text = llm.plain_text(build_system(req.scenario), merge_roles(messages))
    except llm.LLMError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {"summary": text}
