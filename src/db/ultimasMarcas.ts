/* =========================================================
   ultimasMarcas — a carga da última vez, por exercício

   A tela do treino mostra, em cada exercício, o que foi feito
   da última vez. Antes isso era uma consulta POR exercício
   dentro de um Promise.all: oito exercícios, oito idas ao
   servidor, no wi-fi da academia.

   Agora vem tudo numa consulta e a escolha é feita aqui —
   o que também deixa a regra testável.
   ========================================================= */

export interface LinhaComSessao {
  sessao_id: number
  exercicio_id: string
  carga: number | string | null
  reps_feitas: number | null
  sessoes: { data: string } | null
}

export interface Marca {
  carga?: number
  repsFeitas?: number
}

/**
 * Para cada exercício, a marca da sessão mais recente que não
 * seja a de agora. Empate de data desempata pelo sessao_id maior
 * (a sessão criada depois).
 */
export function ultimasMarcas(
  linhas: LinhaComSessao[],
  sessaoAtualId?: number,
): Map<string, Marca> {
  const melhor = new Map<string, LinhaComSessao>()

  for (const l of linhas) {
    if (!l.sessoes) continue
    if (l.sessao_id === sessaoAtualId) continue
    if (l.carga == null && l.reps_feitas == null) continue

    const atual = melhor.get(l.exercicio_id)
    if (!atual) {
      melhor.set(l.exercicio_id, l)
      continue
    }

    const dataNova = l.sessoes.data ?? ''
    const dataAtual = atual.sessoes?.data ?? ''
    const maisNova =
      dataNova > dataAtual ||
      (dataNova === dataAtual && l.sessao_id > atual.sessao_id)

    if (maisNova) melhor.set(l.exercicio_id, l)
  }

  const saida = new Map<string, Marca>()
  for (const [id, l] of melhor) {
    saida.set(id, {
      // numeric volta como string do Postgres em alguns casos
      carga: l.carga == null ? undefined : Number(l.carga),
      repsFeitas: l.reps_feitas ?? undefined,
    })
  }
  return saida
}
