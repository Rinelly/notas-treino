import type { ContextoDoTutor, Erro, Palavra } from './tipos'
import { chaveDaPalavra } from './vocabulario'

/* Tudo isto viaja em toda mensagem, então fica pequeno de propósito:
   mais texto é resposta mais lenta. A tutor-api corta de novo do lado dela. */
export const MAX_FOCO = 1500
const MAX_ERROS = 8
const MAX_PALAVRAS = 15

/**
 * O que o tutor recebe além da conversa: o foco atual e o que há de mais
 * recente no histórico. As listas chegam do banco da mais nova para a mais
 * antiga, então é só pegar o começo — sem repetir o mesmo erro duas vezes.
 */
export function montarContexto(foco: string, erros: Erro[], palavras: Palavra[]): ContextoDoTutor {
  const vistos = new Set<string>()
  const mistakes: ContextoDoTutor['mistakes'] = []
  for (const e of erros) {
    if (mistakes.length >= MAX_ERROS) break
    const chave = chaveDaPalavra(e.original)
    if (!chave || !e.correcao.trim() || vistos.has(chave)) continue
    vistos.add(chave)
    mistakes.push({ original: e.original.trim(), better: e.correcao.trim() })
  }

  return {
    focus: foco.trim().slice(0, MAX_FOCO),
    mistakes,
    words: palavras.slice(0, MAX_PALAVRAS).map((p) => p.palavra.trim()).filter(Boolean),
  }
}
