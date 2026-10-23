/* =========================================================
   escolherTreino — qual treino o painel mostra

   Separado do acesso ao banco de propósito: a regra tem três
   casos e um ciclo (A→B→C→A), e isso é o tipo de coisa que só
   se confere com teste. Quem busca os dados é proximoTreino.
   ========================================================= */

import type { Rotina } from '../types'

export interface SessaoResumo {
  id: number
  rotina_id: number
  /** AAAA-MM-DD */
  data: string
  finalizada: boolean
}

export interface TreinoEscolhido {
  rotina: Rotina | null
  sessaoId: number | null
  feitos: number
  total: number
  finalizada: boolean
  emAndamento: boolean
}

export const SEM_TREINO: TreinoEscolhido = {
  rotina: null,
  sessaoId: null,
  feitos: 0,
  total: 0,
  finalizada: false,
  emAndamento: false,
}

/**
 * A regra, em ordem:
 *
 * 1. já existe sessão de HOJE com alguma coisa feita (ou finalizada)
 *    → mostra ELA, com o estado real. É o que impede o painel de
 *    pular pro próximo treino no mesmo dia em que você treinou.
 * 2. senão, o próximo do rodízio depois da última sessão com
 *    progresso de um dia anterior.
 * 3. senão, o primeiro da lista.
 *
 * `sessoes` precisa vir da mais recente para a mais antiga.
 */
export function escolherTreino(
  rotinas: Rotina[],
  sessoes: SessaoResumo[],
  feitosPorSessao: Map<number, number>,
  hojeStr: string,
): TreinoEscolhido {
  if (rotinas.length === 0) return SEM_TREINO

  const temAlgo = (s: SessaoResumo) =>
    s.finalizada || (feitosPorSessao.get(s.id) ?? 0) > 0

  const deHoje = sessoes.find((s) => s.data === hojeStr && temAlgo(s))
  if (deHoje) {
    const rotina = rotinas.find((r) => r.id === deHoje.rotina_id)
    if (rotina) {
      const feitos = feitosPorSessao.get(deHoje.id) ?? 0
      return {
        rotina,
        sessaoId: deHoje.id,
        feitos,
        total: rotina.exercicios.length,
        finalizada: deHoje.finalizada,
        emAndamento: !deHoje.finalizada && feitos > 0,
      }
    }
  }

  const anterior = sessoes.find((s) => s.data < hojeStr && temAlgo(s)) ?? null

  let alvo = rotinas[0]
  if (anterior) {
    const i = rotinas.findIndex((r) => r.id === anterior.rotina_id)
    if (i >= 0) alvo = rotinas[(i + 1) % rotinas.length]
  }

  // pode existir uma sessão de hoje ainda vazia (aberta e não usada):
  // reaproveita em vez de criar outra
  const sessaoVaziaHoje = sessoes.find(
    (s) => s.data === hojeStr && s.rotina_id === alvo.id,
  )

  return {
    rotina: alvo,
    sessaoId: sessaoVaziaHoje?.id ?? null,
    feitos: 0,
    total: alvo.exercicios.length,
    finalizada: false,
    emAndamento: false,
  }
}
