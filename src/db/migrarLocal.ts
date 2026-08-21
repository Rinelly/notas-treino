/* =========================================================
   migrarLocal.ts — traz o histórico do navegador pra nuvem

   O app antigo guardava tudo no IndexedDB, que é POR NAVEGADOR:
   o histórico do computador e o do celular são dois montes
   separados, e nenhum dos dois conhece o outro.

   Por isso esta rotina JUNTA em vez de substituir.

   Regras, na ordem de importância:

   1. NADA é apagado. Nem da nuvem, nem do navegador. Se um
      treino já está na nuvem, o local é ignorado — a nuvem
      sempre ganha, porque é onde os dois aparelhos escrevem.

   2. Rotina é casada pelo NOME, não pelo id. Os ids do Dexie
      são locais e não querem dizer nada no Postgres; o nome é
      o que sobrevive à travessia.

   3. Exercício também é casado pelo nome (+ categoria, porque
      "Caminhada inclinada" aparece como aquecimento E como
      cardio no mesmo treino). Sem isso as cargas antigas
      entrariam apontando pra exercícios que não existem, e o
      treino apareceria no calendário com 0 de 8 feitos.

   4. Pode rodar quantas vezes quiser. Na segunda vez não
      acontece nada, porque tudo já vai estar lá.
   ========================================================= */

import { db } from './db'
import { supabase, uid } from '../lib/supabase'
import type { Execucao, ExercicioRotina, Rotina } from '../types'

const MARCA = 'treino.migrado.v1'

export interface ResumoLocal {
  rotinas: number
  sessoes: number
  execucoes: number
}

export interface ResultadoMigracao {
  /** rotinas que não existiam na nuvem e foram criadas */
  rotinasCriadas: number
  /** dias de treino que estavam só no navegador e voltaram */
  sessoesRecuperadas: number
  /** dias que já estavam na nuvem e foram deixados como estavam */
  sessoesJaExistiam: number
  /** cargas/repetições que estavam só no navegador e voltaram */
  execucoesRecuperadas: number
  /** registros que já estavam na nuvem e foram preservados */
  execucoesJaExistiam: number
  /** execuções que não deu pra casar com nenhum exercício da rotina */
  execucoesSemPar: number
}

/* ----------------------------------------------------------
   utilidades
   ---------------------------------------------------------- */

/** "Inferiores A (Quadríceps)" e "inferiores a (quadriceps)" viram a mesma coisa */
function norm(s: string | null | undefined) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function checar<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** quantos campos preenchidos essa execução tem — usado pra escolher a melhor */
function riqueza(e: Execucao) {
  return (e.concluido ? 1 : 0) + (e.carga != null ? 1 : 0) + (e.repsFeitas != null ? 1 : 0)
}

/**
 * De-para entre os exercícios de duas versões da mesma rotina.
 *
 * Casa por nome + categoria e consome cada par uma vez só, então
 * exercícios repetidos (o aquecimento e o cardio com o mesmo nome)
 * não roubam o lugar um do outro.
 */
function casarExercicios(locais: ExercicioRotina[], nuvem: ExercicioRotina[]) {
  const mapa = new Map<string, string>()
  const usados = new Set<number>()

  const acha = (ex: ExercicioRotina, exigirCategoria: boolean) =>
    nuvem.findIndex(
      (n, i) =>
        !usados.has(i) &&
        norm(n.nome) === norm(ex.nome) &&
        (!exigirCategoria || n.categoria === ex.categoria),
    )

  for (const ex of locais) {
    let i = acha(ex, true)
    if (i < 0) i = acha(ex, false) // categoria pode ter sido reclassificada
    if (i < 0) continue
    usados.add(i)
    mapa.set(ex.id, nuvem[i].id)
  }
  return mapa
}

/* ----------------------------------------------------------
   leitura
   ---------------------------------------------------------- */

/** o que existe hoje NESTE navegador */
export async function lerResumoLocal(): Promise<ResumoLocal> {
  try {
    const [rotinas, sessoes, execucoes] = await Promise.all([
      db.rotinas.count(),
      db.sessoes.count(),
      db.execucoes.count(),
    ])
    return { rotinas, sessoes, execucoes }
  } catch {
    // banco local nem existe neste aparelho
    return { rotinas: 0, sessoes: 0, execucoes: 0 }
  }
}

export function jaMigrou() {
  try {
    return localStorage.getItem(MARCA) === '1'
  } catch {
    return false
  }
}

export function marcarComoMigrado() {
  try {
    localStorage.setItem(MARCA, '1')
  } catch {
    /* modo privado: só não lembra, e pergunta de novo */
  }
}

/** a conta na nuvem já tem alguma rotina? */
export async function nuvemTemDados(): Promise<boolean> {
  const { count, error } = await supabase
    .from('rotinas')
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

/* ----------------------------------------------------------
   a junção
   ---------------------------------------------------------- */

type RotinaRow = { id: number; nome: string; exercicios: ExercicioRotina[] | null }
type SessaoRow = { id: number; rotina_id: number; data: string }

export async function migrarParaNuvem(): Promise<ResultadoMigracao> {
  const userId = await uid()

  const saida: ResultadoMigracao = {
    rotinasCriadas: 0,
    sessoesRecuperadas: 0,
    sessoesJaExistiam: 0,
    execucoesRecuperadas: 0,
    execucoesJaExistiam: 0,
    execucoesSemPar: 0,
  }

  const [rotinasLocais, sessoesLocais, execucoesLocais] = await Promise.all([
    db.rotinas.toArray(),
    db.sessoes.toArray(),
    db.execucoes.toArray(),
  ])

  /* ---------- rotinas: casa pelo nome, cria só o que falta ---------- */
  let rotinasNuvem = (checar(
    await supabase.from('rotinas').select('id, nome, exercicios').order('id'),
  ) as RotinaRow[] | null) ?? []

  const faltando: Rotina[] = rotinasLocais.filter(
    (r) => !rotinasNuvem.some((n) => norm(n.nome) === norm(r.nome)),
  )

  if (faltando.length) {
    const criadas = checar(
      await supabase
        .from('rotinas')
        .insert(
          faltando.map((r) => ({
            user_id: userId,
            dia_semana: r.diaSemana,
            nome: r.nome,
            exercicios: (r.exercicios ?? []) as ExercicioRotina[],
          })),
        )
        .select('id, nome, exercicios'),
    ) as RotinaRow[] | null

    rotinasNuvem = [...rotinasNuvem, ...(criadas ?? [])]
    saida.rotinasCriadas = criadas?.length ?? 0
  }

  // id local -> id na nuvem, e id de exercício local -> id na nuvem
  const deParaRotina = new Map<number, number>()
  const deParaExercicio = new Map<string, string>()

  for (const r of rotinasLocais) {
    if (r.id == null) continue
    const alvo = rotinasNuvem.find((n) => norm(n.nome) === norm(r.nome))
    if (!alvo) continue
    deParaRotina.set(r.id, alvo.id)
    for (const [de, para] of casarExercicios(r.exercicios ?? [], alvo.exercicios ?? [])) {
      deParaExercicio.set(de, para)
    }
  }

  /* ---------- sessões: insere só os dias que faltam ---------- */
  const candidatas = sessoesLocais.filter(
    (s) => s.id != null && s.rotinaId != null && deParaRotina.has(s.rotinaId) && s.data,
  )

  const chave = (rotinaNuvemId: number, data: string) => `${rotinaNuvemId}|${data}`

  // funde sessões locais repetidas (o Dexie deixava; o Postgres não)
  const unicas = new Map<string, { rotinaNuvemId: number; data: string; finalizada: boolean }>()
  for (const s of candidatas) {
    const rid = deParaRotina.get(s.rotinaId)!
    const k = chave(rid, s.data)
    const jaTem = unicas.get(k)
    if (jaTem) jaTem.finalizada = jaTem.finalizada || !!s.finalizada
    else unicas.set(k, { rotinaNuvemId: rid, data: s.data, finalizada: !!s.finalizada })
  }

  const sessoesNuvem = (checar(
    await supabase.from('sessoes').select('id, rotina_id, data'),
  ) as SessaoRow[] | null) ?? []

  const jaNaNuvem = new Set(sessoesNuvem.map((s) => chave(s.rotina_id, s.data)))
  const novas = [...unicas.entries()].filter(([k]) => !jaNaNuvem.has(k))
  saida.sessoesJaExistiam = unicas.size - novas.length

  if (novas.length) {
    const criadas = checar(
      await supabase
        .from('sessoes')
        .insert(
          novas.map(([, s]) => ({
            user_id: userId,
            rotina_id: s.rotinaNuvemId,
            data: s.data,
            finalizada: s.finalizada,
          })),
        )
        .select('id, rotina_id, data'),
    ) as SessaoRow[] | null

    sessoesNuvem.push(...(criadas ?? []))
    saida.sessoesRecuperadas = criadas?.length ?? 0
  }

  // agora toda sessão local sabe seu id na nuvem
  const idNuvemPorChave = new Map(sessoesNuvem.map((s) => [chave(s.rotina_id, s.data), s.id]))
  const deParaSessao = new Map<number, number>()
  for (const s of candidatas) {
    const id = idNuvemPorChave.get(chave(deParaRotina.get(s.rotinaId)!, s.data))
    if (id != null) deParaSessao.set(s.id!, id)
  }

  /* ---------- execuções: só as que a nuvem ainda não tem ---------- */
  const melhores = new Map<string, { sessaoId: number; exercicioId: string; e: Execucao }>()
  for (const e of execucoesLocais) {
    const sessaoId = deParaSessao.get(e.sessaoId)
    if (sessaoId == null || !e.exercicioId) continue

    const exercicioId = deParaExercicio.get(e.exercicioId)
    if (!exercicioId) {
      saida.execucoesSemPar++
      continue
    }

    const k = `${sessaoId}|${exercicioId}`
    const atual = melhores.get(k)
    if (!atual || riqueza(e) > riqueza(atual.e)) {
      melhores.set(k, { sessaoId, exercicioId, e })
    }
  }

  if (melhores.size) {
    const ids = [...new Set([...melhores.values()].map((m) => m.sessaoId))]
    const existentes = (checar(
      await supabase.from('execucoes').select('sessao_id, exercicio_id').in('sessao_id', ids),
    ) as { sessao_id: number; exercicio_id: string }[] | null) ?? []

    const jaTem = new Set(existentes.map((x) => `${x.sessao_id}|${x.exercicio_id}`))

    const linhas = [...melhores.entries()]
      .filter(([k]) => !jaTem.has(k))
      .map(([, { sessaoId, exercicioId, e }]) => ({
        user_id: userId,
        sessao_id: sessaoId,
        exercicio_id: exercicioId,
        concluido: e.concluido ?? false,
        carga: e.carga ?? null,
        reps_feitas: e.repsFeitas ?? null,
      }))

    saida.execucoesJaExistiam = melhores.size - linhas.length

    const LOTE = 500
    for (let i = 0; i < linhas.length; i += LOTE) {
      const fatia = linhas.slice(i, i + LOTE)
      // ignoreDuplicates: se alguém gravou pelo outro aparelho no meio
      // disso, o registro de lá vale — o daqui é o antigo
      checar(
        await supabase
          .from('execucoes')
          .upsert(fatia, { onConflict: 'sessao_id,exercicio_id', ignoreDuplicates: true }),
      )
      saida.execucoesRecuperadas += fatia.length
    }
  }

  marcarComoMigrado()
  return saida
}
