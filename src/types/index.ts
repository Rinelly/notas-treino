export type CategoriaExercicio = 'aquecimento' | 'treino' | 'cardio'

export interface ExercicioRotina {
  id: string 
  nome: string
  categoria: CategoriaExercicio
  seriesAlvo: string 
  observacao?: string 
}

export interface Rotina {
  id?: number
  diaSemana: string
  letra?: string
  nome: string 
  exercicios: ExercicioRotina[]
}

export interface Sessao {
  id?: number
  rotinaId: number
  data: string 
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
