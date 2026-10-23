/* =========================================================
   estatisticas — os números do rodapé do Foco

   Fora do hook de propósito: "quantos dias seguidos bati a
   meta" tem uma sutileza (o dia de hoje ainda não acabou, então
   não pode quebrar a sequência) que só se garante com teste.
   ========================================================= */

import type { Dia } from './tipos'

export interface Estatisticas {
  metaSeg: number
  /** soma desde a segunda-feira desta semana */
  semana: number
  semanaTrabalho: number
  semanaEstudo: number
  /** média por dia em que houve algum foco */
  media: number
  /** dias seguidos batendo a meta, contando de trás pra frente */
  sequencia: number
}

/** um dia só conta como "ativo" na média se teve mais de um minuto */
const MINIMO_ATIVO = 60

/**
 * @param dias   em ordem crescente, o último é hoje
 * @param agora  injetável pra o teste não depender do dia em que roda
 */
export function calcularEstatisticas(
  dias: Dia[],
  metaSeg: number,
  agora = new Date(),
): Estatisticas {
  const chaveHoje = dias.length ? dias[dias.length - 1].chave : ''

  // getDay() é 0=domingo; aqui a semana começa na segunda
  const desdeSegunda = (agora.getDay() + 6) % 7
  const daSemana = dias.slice(-(desdeSegunda + 1))

  const ativos = dias.filter((d) => d.seg > MINIMO_ATIVO)
  const media = ativos.length
    ? ativos.reduce((a, d) => a + d.seg, 0) / ativos.length
    : 0

  let sequencia = 0
  for (let i = dias.length - 1; i >= 0; i--) {
    if (metaSeg > 0 && dias[i].seg >= metaSeg) {
      sequencia++
    } else if (dias[i].chave === chaveHoje) {
      // o dia ainda não acabou: não bateu AINDA, não quebrou
      continue
    } else {
      break
    }
  }

  return {
    metaSeg,
    semana: daSemana.reduce((a, d) => a + d.seg, 0),
    semanaTrabalho: daSemana.reduce((a, d) => a + d.segTrabalho, 0),
    semanaEstudo: daSemana.reduce((a, d) => a + d.segEstudo, 0),
    media,
    sequencia,
  }
}
