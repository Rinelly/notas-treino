export type CategoriaExercicio = 'aquecimento' | 'treino' | 'cardio'

export interface ExercicioRotina {
  id: string // uuid, estável mesmo se a ordem/lista mudar
  nome: string
  categoria: CategoriaExercicio
  seriesAlvo: string // ex: "4x10-12" ou "20 min"
  observacao?: string // ex: "cada perna"
}

export interface Rotina {
  id?: number
  /**
   * Vestígio de quando as rotinas eram presas ao dia da semana.
   * Não é mais usado em lugar nenhum da tela — hoje os treinos são
   * um rodízio A, B, C... A coluna continua no banco só pra não
   * precisar de migração; pode ser removida quando sobrar tempo.
   */
  diaSemana: string
  /** posição no rodízio, derivada da ordem: "A", "B", "C"... */
  letra?: string
  nome: string // ex: "Inferiores A (Quadríceps)"
  exercicios: ExercicioRotina[]
}

export interface Sessao {
  id?: number
  rotinaId: number
  data: string // ISO date (YYYY-MM-DD)
  finalizada?: boolean
}

export interface Execucao {
  id?: number
  sessaoId: number
  exercicioId: string
  concluido: boolean
  carga?: number
  repsFeitas?: number
}
