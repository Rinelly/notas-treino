import { supabase, uid } from '../lib/supabase'
import type { CategoriaExercicio, ExercicioRotina, Rotina } from '../types'

function ex(
  nome: string,
  categoria: CategoriaExercicio,
  seriesAlvo: string,
  observacao?: string,
): ExercicioRotina {
  return { id: crypto.randomUUID(), nome, categoria, seriesAlvo, observacao }
}

const rotinas: Omit<Rotina, 'id'>[] = [
  {
    diaSemana: 'Segunda',
    nome: 'Inferiores A (Quadríceps)',
    exercicios: [
      ex('Caminhada inclinada', 'aquecimento', '10 min'),
      ex('Agachamento livre ou Smith', 'treino', '4x10-12'),
      ex('Leg Press 45°', 'treino', '4x12-15'),
      ex('Cadeira Extensora', 'treino', '3x15-20'),
      ex('Afundo com halteres', 'treino', '3x12', 'cada perna'),
      ex('Panturrilha em pé', 'treino', '4x15-20'),
      ex('Abdominal infra', 'treino', '3x15'),
      ex('Caminhada inclinada', 'cardio', '20 min'),
    ],
  },
  {
    diaSemana: 'Terça',
    nome: 'Superiores A (ênfase em costas)',
    exercicios: [
      ex('Puxada alta', 'treino', '4x10-12'),
      ex('Remada baixa', 'treino', '4x10-12'),
      ex('Supino máquina', 'treino', '3x10-12'),
      ex('Desenvolvimento com halteres', 'treino', '3x12'),
      ex('Elevação lateral', 'treino', '3x15'),
      ex('Rosca direta', 'treino', '3x12-15'),
      ex('Tríceps corda', 'treino', '3x12-15'),
    ],
  },
  {
    diaSemana: 'Quarta',
    nome: 'Inferiores B (Posterior e Glúteos)',
    exercicios: [
      ex('Stiff', 'treino', '4x10-12'),
      ex('Mesa flexora', 'treino', '4x12-15'),
      ex('Cadeira flexora', 'treino', '3x15'),
      ex('Hip Thrust', 'treino', '4x12'),
      ex('Abdução máquina', 'treino', '3x20'),
      ex('Panturrilha sentada', 'treino', '4x20'),
      ex('Escada', 'cardio', '25 min'),
    ],
  },
  {
    diaSemana: 'Quinta',
    nome: 'Superiores B (ênfase em ombros e peito)',
    exercicios: [
      ex('Elevação lateral', 'treino', '3x15'),
      ex('Rosca martelo', 'treino', '3x12-15'),
      ex('Tríceps francês', 'treino', '3x12-15'),
      ex('Face Pull', 'treino', '3x15'),
      ex('Desenvolvimento máquina', 'treino', '3x10-12'),
      ex('Supino inclinado máquina ou halteres', 'treino', '3x10-12'),
      ex('Pulldown ou puxada fechada', 'treino', '3x12'),
      ex('Remada unilateral', 'treino', '3x10-12'),
    ],
  },
  {
    diaSemana: 'Sexta',
    nome: 'Inferiores C (Glúteos + Metabólico)',
    exercicios: [
      ex('Agachamento sumô', 'treino', '4x12'),
      ex('Bulgarian Split Squat', 'treino', '3x12'),
      ex('Hip Thrust', 'treino', '4x10'),
      ex('Cadeira abdutora', 'treino', '3x20'),
      ex('Cadeira adutora', 'treino', '3x20'),
      ex('Panturrilha', 'treino', '4x20'),
      ex('Caminhada leve', 'cardio', '20 min'),
    ],
  },
]

/** as rotinas padrão, expostas pra quem precisar (migração, testes) */
export { rotinas as rotinasPadrao }

/**
 * Cria as rotinas padrão só se a conta ainda não tiver nenhuma.
 * Roda uma vez, no primeiro login. Se você já migrou seus dados
 * do navegador, isto não faz nada.
 */
export async function seedRotinas() {
  const { count, error } = await supabase
    .from('rotinas')
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  if ((count ?? 0) > 0) return

  const userId = await uid()
  const { error: erroInsert } = await supabase.from('rotinas').insert(
    rotinas.map((r) => ({
      user_id: userId,
      dia_semana: r.diaSemana,
      nome: r.nome,
      exercicios: r.exercicios,
    })),
  )
  if (erroInsert) throw new Error(erroInsert.message)
}
