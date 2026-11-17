import { supabase } from '../lib/supabase'
import type { Cenario, ContextoDoTutor, Mensagem, RespostaTutor } from './tipos'

/* Onde mora o tutor (a pasta tutor-api, em FastAPI).

   No computador não precisa configurar nada: o Vite repassa /api para
   http://localhost:8000 (veja vite.config.ts).

   Publicado, o app precisa saber o endereço da API:
   VITE_TUTOR_API_URL=https://sua-api.exemplo.com                       */
const BASE = ((import.meta.env.VITE_TUTOR_API_URL as string | undefined) ?? '')
  .trim()
  .replace(/\/+$/, '')

/** falso quando o app está publicado e ninguém disse onde está a API */
export const tutorConfigurado = import.meta.env.DEV || Boolean(BASE)

const FORA_DO_AR =
  'Não consegui falar com o tutor. Confira se a tutor-api está rodando (uvicorn main:app --reload --port 8000).'

async function post<T>(caminho: string, corpo: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  let res: Response
  try {
    res = await fetch(`${BASE}/api${caminho}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(corpo),
    })
  } catch {
    throw new Error(FORA_DO_AR)
  }

  if (!res.ok) {
    const detalhe = (await res.json().catch(() => null)) as { detail?: unknown } | null
    if (typeof detalhe?.detail === 'string') throw new Error(detalhe.detail)
    // sem "detail" não foi a API que respondeu: foi o proxy avisando que ela caiu
    throw new Error(res.status >= 500 ? FORA_DO_AR : `Erro ${res.status}`)
  }

  try {
    return (await res.json()) as T
  } catch {
    throw new Error(FORA_DO_AR)
  }
}

const paraApi = (mensagens: Mensagem[]) =>
  mensagens.map((m) => ({ role: m.papel, content: m.texto }))

export function enviarConversa(mensagens: Mensagem[], cenario: Cenario, contexto?: ContextoDoTutor) {
  return post<RespostaTutor>('/chat', {
    messages: paraApi(mensagens),
    scenario: cenario,
    context: contexto,
  })
}

export async function pedirResumo(mensagens: Mensagem[], cenario: Cenario, contexto?: ContextoDoTutor) {
  const r = await post<{ summary: string }>('/summary', {
    messages: paraApi(mensagens),
    scenario: cenario,
    context: contexto,
  })
  return r.summary
}

/** a fala do tutor em português; só é pedida quando alguém toca em "Traduzir" */
export async function traduzir(texto: string) {
  const r = await post<{ translation: string }>('/translate', { text: texto })
  return r.translation
}
