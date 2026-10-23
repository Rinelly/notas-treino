/* =========================================================
   pendente — o que ainda não foi pro servidor

   O app não grava mais o total do dia; grava o pedaço que
   acumulou desde a última gravação, e o Postgres soma. Isso
   existe porque o total sobrescrevia: dois aparelhos no mesmo
   dia e o último a salvar apagava o outro.

   Como a gravação é assíncrona e pode falhar, o pedaço precisa
   sobreviver ao erro — senão some hora. Daí `devolver`.
   ========================================================= */

export interface Pendente {
  seg: number
  segTrabalho: number
  segEstudo: number
  pomodoros: number
}

export const PENDENTE_ZERO: Pendente = {
  seg: 0,
  segTrabalho: 0,
  segEstudo: 0,
  pomodoros: 0,
}

export function somar(p: Pendente, patch: Partial<Pendente>): Pendente {
  return {
    seg: p.seg + (patch.seg ?? 0),
    segTrabalho: p.segTrabalho + (patch.segTrabalho ?? 0),
    segEstudo: p.segEstudo + (patch.segEstudo ?? 0),
    pomodoros: p.pomodoros + (patch.pomodoros ?? 0),
  }
}

/** nada a enviar: evita ida ao servidor à toa */
export function vazio(p: Pendente): boolean {
  return (
    p.seg === 0 && p.segTrabalho === 0 && p.segEstudo === 0 && p.pomodoros === 0
  )
}

/**
 * Soma de volta o que não conseguiu subir, junto com o que
 * chegou durante a tentativa. A ordem não importa — é soma.
 */
export function devolver(atual: Pendente, falhou: Pendente): Pendente {
  return somar(atual, falhou)
}

/** o segundo de foco vai para o balde do tipo da tarefa ativa */
export function segundosDoTipo(
  segundos: number,
  tipo: 'trabalho' | 'estudo',
): Partial<Pendente> {
  return {
    seg: segundos,
    segTrabalho: tipo === 'trabalho' ? segundos : 0,
    segEstudo: tipo === 'estudo' ? segundos : 0,
  }
}
