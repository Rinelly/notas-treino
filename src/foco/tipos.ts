export type TipoTarefa = 'trabalho' | 'estudo'

export interface Config {
  metaHoras: number
  focoMin: number
  curtaMin: number
  longaMin: number
  longaCada: number
  som: boolean
  ultimoTipo: TipoTarefa
  /** dia do mês em que a mensalidade da academia vence (1-31), ou null */
  academiaDia: number | null
}

export interface Dia {
  chave: string // "2026-08-19"
  seg: number // total de segundos de foco
  segTrabalho: number
  segEstudo: number
  pomodoros: number
  nota: string
}

export interface Tarefa {
  id: string
  nome: string
  tipo: TipoTarefa
  feita: boolean
  pomodoros: number
  data: string | null
  /** veio de um dia anterior sem ter sido concluída */
  herdada?: boolean
}

export const CONFIG_PADRAO: Config = {
  metaHoras: 6,
  focoMin: 25,
  curtaMin: 5,
  longaMin: 15,
  longaCada: 4,
  som: true,
  ultimoTipo: 'estudo',
  academiaDia: null,
}

export function diaVazio(chave: string): Dia {
  return { chave, seg: 0, segTrabalho: 0, segEstudo: 0, pomodoros: 0, nota: '' }
}

export function tipoSeguro(t: unknown): TipoTarefa {
  return t === 'trabalho' ? 'trabalho' : 'estudo'
}
