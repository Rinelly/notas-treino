/* =========================================================
   csv — a planilha que sai do app

   Duas decisões que parecem detalhe e não são:

   1. O separador é ponto e vírgula. O Excel em português usa a
      vírgula como separador decimal, então um CSV com vírgula
      chega lá com tudo numa coluna só. Com ponto e vírgula ele
      abre certo, e o Google Sheets detecta sozinho.

   2. O arquivo começa com BOM (﻿). Sem ele o Excel lê como
      Latin-1 e "Agachamento búlgaro" vira "bÃºlgaro".
   ========================================================= */

export const BOM = '﻿'

export interface Coluna<T> {
  cabecalho: string
  valor: (linha: T) => string | number | boolean | null | undefined
}

/** número com vírgula decimal, que é como o Excel em português espera */
export function num(n: number | null | undefined, casas = 1): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toFixed(casas).replace('.', ',')
}

/**
 * Põe aspas só quando precisa, e aspas dentro do texto viram duas.
 * Quebra de linha dentro de uma célula é válida em CSV desde que
 * a célula esteja entre aspas — é o caso das anotações do dia.
 */
export function celula(v: string | number | boolean | null | undefined, sep = ';'): string {
  if (v == null) return ''
  const t = typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v)
  if (t === '') return ''
  if (t.includes('"') || t.includes(sep) || t.includes('\n') || t.includes('\r')) {
    return `"${t.replace(/"/g, '""')}"`
  }
  return t
}

export function paraCSV<T>(linhas: T[], colunas: Coluna<T>[], sep = ';'): string {
  const cabecalho = colunas.map((c) => celula(c.cabecalho, sep)).join(sep)
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l), sep)).join(sep))
  // \r\n porque é o que o Excel espera; todo leitor de CSV aceita
  return BOM + [cabecalho, ...corpo].join('\r\n') + '\r\n'
}

/** foco-2026-10-23.csv */
export function nomeArquivo(prefixo: string, extensao: string, hoje: string): string {
  return `${prefixo}-${hoje}.${extensao}`
}
