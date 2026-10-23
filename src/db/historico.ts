/* =========================================================
   historico — achata o treino em linhas de planilha

   No banco um treino é três tabelas (rotina, sessão, execução).
   Numa planilha isso tem que virar uma linha por exercício feito,
   com a data repetida — é assim que dá pra filtrar "Agachamento"
   e ver a carga subindo ao longo dos meses.

   Fora do arquivo de consultas porque a junção tem regras que
   valem teste: exercício que foi apagado da rotina depois, sessão
   de rotina que não existe mais, carga que o Postgres devolve
   como texto.
   ========================================================= */

import type { CategoriaExercicio, Execucao, Rotina, Sessao } from '../types'

export interface LinhaHistorico {
  data: string
  treino: string
  rotina: string
  exercicio: string
  categoria: CategoriaExercicio | ''
  seriesAlvo: string
  concluido: boolean
  repsFeitas: number | null
  carga: number | null
  sessaoFinalizada: boolean
}

const ORDEM: Record<string, number> = { aquecimento: 0, treino: 1, cardio: 2 }

/**
 * Uma linha por execução registrada — não por exercício da rotina.
 * Exercício que você nunca tocou não vira linha: a planilha é do
 * que aconteceu, não do que estava planejado.
 *
 * Sai em ordem de data (mais recente primeiro) e, dentro do dia,
 * na ordem em que os exercícios aparecem na rotina.
 */
export function linhasDeHistorico(
  rotinas: Rotina[],
  sessoes: Sessao[],
  execucoes: Execucao[],
): LinhaHistorico[] {
  const porRotina = new Map(rotinas.filter((r) => r.id != null).map((r) => [r.id!, r]))
  const porSessao = new Map(sessoes.filter((s) => s.id != null).map((s) => [s.id!, s]))

  const linhas: LinhaHistorico[] = []

  for (const e of execucoes) {
    const sessao = porSessao.get(e.sessaoId)
    if (!sessao) continue // execução órfã: a sessão sumiu

    const rotina = porRotina.get(sessao.rotinaId)
    const exercicio = rotina?.exercicios.find((x) => x.id === e.exercicioId)

    linhas.push({
      data: sessao.data,
      treino: rotina?.letra ?? '',
      rotina: rotina?.nome ?? '(rotina apagada)',
      // exercício removido da rotina depois: o registro continua valendo,
      // e perder a linha seria perder histórico de carga
      exercicio: exercicio?.nome ?? `(exercício removido: ${e.exercicioId})`,
      categoria: exercicio?.categoria ?? '',
      seriesAlvo: exercicio?.seriesAlvo ?? '',
      concluido: e.concluido,
      repsFeitas: e.repsFeitas ?? null,
      carga: e.carga ?? null,
      sessaoFinalizada: sessao.finalizada ?? false,
    })
  }

  return linhas.sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? 1 : -1
    const ca = ORDEM[a.categoria] ?? 9
    const cb = ORDEM[b.categoria] ?? 9
    if (ca !== cb) return ca - cb
    return a.exercicio.localeCompare(b.exercicio, 'pt-BR')
  })
}
