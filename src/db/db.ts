import Dexie, { type EntityTable } from 'dexie'
import type { Rotina, Sessao, Execucao } from '../types'

const db = new Dexie('notas-treino') as Dexie & {
  rotinas: EntityTable<Rotina, 'id'>
  sessoes: EntityTable<Sessao, 'id'>
  execucoes: EntityTable<Execucao, 'id'>
}

db.version(1).stores({
  exercicios: '++id, nome, grupoMuscular',
  treinos: '++id, data, nome',
  series: '++id, treinoId, exercicioId, [exercicioId+id]',
})

db.version(2).stores({
  exercicios: null,
  treinos: null,
  series: null,
  rotinas: '++id, diaSemana',
  sessoes: '++id, rotinaId, data',
  execucoes: '++id, sessaoId, exercicioIndex, [sessaoId+exercicioIndex]',
})

db.version(3)
  .stores({
    execucoes: '++id, sessaoId, exercicioId, [sessaoId+exercicioId]',
  })
  .upgrade((tx) => tx.table('execucoes').clear())

export { db }
