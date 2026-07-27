import { db } from './db'
import type { CategoriaExercicio, Execucao } from '../types'

export function hoje() {
  return new Date().toISOString().slice(0, 10)
}

export async function getOrCriarSessaoHoje(rotinaId: number) {
  const data = hoje()
  const existente = await db.sessoes.where({ rotinaId, data }).first()
  if (existente) return existente
  const id = await db.sessoes.add({ rotinaId, data })
  return { id, rotinaId, data }
}

export async function execucoesDaSessao(sessaoId: number) {
  return db.execucoes.where('sessaoId').equals(sessaoId).toArray()
}

export async function upsertExecucao(
  sessaoId: number,
  exercicioId: string,
  dados: Partial<Pick<Execucao, 'concluido' | 'carga' | 'repsFeitas'>>,
) {
  const existente = await db.execucoes
    .where('[sessaoId+exercicioId]')
    .equals([sessaoId, exercicioId])
    .first()

  if (existente?.id != null) {
    await db.execucoes.update(existente.id, dados)
  } else {
    await db.execucoes.add({
      sessaoId,
      exercicioId,
      concluido: false,
      ...dados,
    })
  }
}

export async function ultimaExecucao(
  rotinaId: number,
  exercicioId: string,
  sessaoAtualId?: number,
) {
  const sessoes = await db.sessoes.where('rotinaId').equals(rotinaId).toArray()
  const outras = sessoes.filter((s) => s.id !== sessaoAtualId)
  if (outras.length === 0) return null

  const dataPorSessaoId = new Map(outras.map((s) => [s.id!, s.data]))
  const execucoes = await db.execucoes
    .where('exercicioId')
    .equals(exercicioId)
    .filter((e) => dataPorSessaoId.has(e.sessaoId) && (e.carga != null || e.repsFeitas != null))
    .toArray()

  if (execucoes.length === 0) return null

  execucoes.sort((a, b) =>
    (dataPorSessaoId.get(b.sessaoId) ?? '').localeCompare(
      dataPorSessaoId.get(a.sessaoId) ?? '',
    ),
  )
  return execucoes[0]
}

export async function ultimaSessaoComProgresso() {
  const sessoes = await db.sessoes.orderBy('data').reverse().toArray()

  for (const sessao of sessoes) {
    const execs = await execucoesDaSessao(sessao.id!)
    const feitos = execs.filter((e) => e.concluido).length
    if (feitos === 0) continue

    const rotina = await db.rotinas.get(sessao.rotinaId)
    if (!rotina) continue

    return { sessao, rotina, feitos, total: rotina.exercicios.length }
  }

  return null
}

export async function diasTreinadosNoMes(ano: number, mesIndice0: number) {
  const prefixo = `${ano}-${String(mesIndice0 + 1).padStart(2, '0')}`
  const sessoes = await db.sessoes
    .where('data')
    .startsWith(prefixo)
    .toArray()

  const finalizados = new Set(sessoes.filter((s) => s.finalizada).map((s) => s.data))

  if (sessoes.length === 0) return { comProgresso: new Set<string>(), finalizados }

  const dataPorSessaoId = new Map(sessoes.map((s) => [s.id!, s.data]))
  const execucoes = await db.execucoes
    .where('sessaoId')
    .anyOf([...dataPorSessaoId.keys()])
    .filter((e) => e.concluido)
    .toArray()

  const comProgresso = new Set(execucoes.map((e) => dataPorSessaoId.get(e.sessaoId)!))

  return { comProgresso, finalizados }
}

export async function finalizarSessao(sessaoId: number, finalizada: boolean) {
  await db.sessoes.update(sessaoId, { finalizada })
}

export async function atualizarExercicio(
  rotinaId: number,
  exercicioId: string,
  dados: Partial<{ nome: string; seriesAlvo: string; observacao: string }>,
) {
  const rotina = await db.rotinas.get(rotinaId)
  if (!rotina) return

  const exercicios = rotina.exercicios.map((ex) =>
    ex.id === exercicioId ? { ...ex, ...dados } : ex,
  )
  await db.rotinas.update(rotinaId, { exercicios })
}

export async function adicionarExercicio(
  rotinaId: number,
  dados: { nome: string; categoria: CategoriaExercicio; seriesAlvo: string },
) {
  const rotina = await db.rotinas.get(rotinaId)
  if (!rotina) return

  const novoExercicio = { id: crypto.randomUUID(), ...dados }
  await db.rotinas.update(rotinaId, {
    exercicios: [...rotina.exercicios, novoExercicio],
  })
  return novoExercicio
}

export async function removerExercicio(rotinaId: number, exercicioId: string) {
  const rotina = await db.rotinas.get(rotinaId)
  if (!rotina) return

  const exercicios = rotina.exercicios.filter((ex) => ex.id !== exercicioId)
  await db.rotinas.update(rotinaId, { exercicios })
}
