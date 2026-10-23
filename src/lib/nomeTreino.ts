/* =========================================================
   nomeTreino — separa o apelido da descrição

   As rotinas se chamam "Inferiores A — quadríceps e glúteos". O
   pedaço antes do travessão é como a Rinelly chama o treino, e é
   ele que tem que aparecer grande; o resto é explicação.

   Isso substituiu a letra automática (A, B, C...) que o app
   mostrava antes: "Treino C" dizia menos do que "Inferiores B",
   e ainda brigava com o "A" que já estava no nome.
   ========================================================= */

/** travessão, meia-risca ou hífen, sempre cercado de espaço */
const SEPARADOR = /\s[—–-]\s/

export interface PartesDoNome {
  /** o apelido: "Inferiores A" */
  curto: string
  /** a explicação, sem o travessão: "quadríceps e glúteos" */
  detalhe: string
}

export function partesDoNome(nome: string | undefined | null): PartesDoNome {
  const limpo = (nome ?? '').trim()
  if (!limpo) return { curto: '', detalhe: '' }

  const corte = limpo.search(SEPARADOR)
  if (corte < 0) return { curto: limpo, detalhe: '' }

  return {
    curto: limpo.slice(0, corte).trim(),
    // slice(corte + 3) pularia errado se o separador tivesse outro
    // tamanho; melhor cortar pelo que a busca encontrou
    detalhe: limpo.slice(corte).replace(SEPARADOR, '').trim(),
  }
}

export function nomeCurto(nome: string | undefined | null): string {
  return partesDoNome(nome).curto
}
