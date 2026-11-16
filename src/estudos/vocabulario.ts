import type { Correcao, PalavraNova } from './tipos'

/** "  Deadline " e "deadline" são a mesma palavra */
export function chaveDaPalavra(palavra: string) {
  return palavra.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Tira o que está vazio, o que se repete dentro da própria lista
 * e o que já está guardado. Fica com a primeira ocorrência.
 */
export function soAsNovas(itens: PalavraNova[], conhecidas: Iterable<string>) {
  const vistas = new Set(conhecidas)
  const saida: PalavraNova[] = []
  for (const item of itens) {
    const chave = chaveDaPalavra(item.word ?? '')
    if (!chave || vistas.has(chave)) continue
    vistas.add(chave)
    saida.push(item)
  }
  return saida
}

/* ---------- o que o English Tutor antigo deixou no navegador ----------

   A primeira versão do tutor guardava tudo no localStorage. Quando o app
   novo abre no mesmo navegador, aproveita o que estiver lá.            */

export const CHAVE_PALAVRAS_ANTIGA = 'tutor.vocabulary'
export const CHAVE_ERROS_ANTIGA = 'tutor.mistakes'

function lerLista(bruto: string | null): unknown[] {
  if (!bruto) return []
  try {
    const valor: unknown = JSON.parse(bruto)
    return Array.isArray(valor) ? valor : []
  } catch {
    return []
  }
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function lerPalavrasAntigas(bruto: string | null): PalavraNova[] {
  const saida: PalavraNova[] = []
  for (const item of lerLista(bruto)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const word = texto(o.word)
    if (!word) continue
    saida.push({ word, meaning: texto(o.meaning), example: texto(o.example) })
  }
  return soAsNovas(saida, [])
}

export function lerErrosAntigos(bruto: string | null): Correcao[] {
  const saida: Correcao[] = []
  for (const item of lerLista(bruto)) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const original = texto(o.original)
    const better = texto(o.better)
    if (!original || !better) continue
    saida.push({ original, better, explanation: texto(o.explanation) })
  }
  return saida
}
