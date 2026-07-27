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
  diaSemana: string // ex: "Segunda"
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
