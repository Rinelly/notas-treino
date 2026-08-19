/* =========================================================
   migrarLocal.ts — leva o histórico do IndexedDB pra nuvem

   Roda uma vez. Depois disso o Dexie fica só como arquivo
   morto: nada mais escreve nele, mas os dados continuam lá
   caso algo dê errado, então nada é perdido no caminho.

   Duas coisas que o banco local permitia e o Postgres não:

   1. duas sessões da MESMA rotina no MESMO dia. No Dexie não
      havia constraint; aqui existe unique (user, rotina, data).
      Então sessões repetidas são fundidas numa só, e tudo que
      estava pendurado nelas vai junto.

   2. duas execuções do mesmo exercício na mesma sessão. Idem:
      ficam com a versão mais completa das duas.

   A migração também é idempotente: ela limpa o que estiver na
   nuvem antes de enviar. Assim, se falhar no meio, tentar de
   novo funciona em vez de duplicar tudo.
   ========================================================= */

import { db } from './db'
import { supabase, uid } from '../lib/supabase'
import type { Execucao, ExercicioRotina } from '../types'

const MARCA = 'treino.migrado.v1'

export interface ResumoLocal {
  rotinas: number
  sessoes: number
  execucoes: number
}

export interface ResultadoMigracao extends ResumoLocal {
  /** sessões repetidas (mesma rotina, mesmo dia) que viraram uma só */
  sessoesFundidas: number
  /** execuções repetidas do mesmo exercício que viraram uma só */
  execucoesFundidas: number
}

/** o que existe hoje no navegador */
export async function lerResumoLocal(): Promise<ResumoLocal> {
  try {
    const [rotinas, sessoes, execucoes] = await Promise.all([
      db.rotinas.count(),
      db.sessoes.count(),
      db.execucoes.count(),
    ])
    return { rotinas, sessoes, execucoes }
  } catch {
    // banco local nem existe nesta máquina
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

/** apaga tudo desta conta na nuvem — o cascade cuida dos filhos */
async function limparNuvem() {
  for (const tabela of ['execucoes', 'sessoes', 'rotinas'] as const) {
    const { error } = await supabase.from(tabela).delete().gte('id', 0)
    if (error) throw new Error(`limpando ${tabela}: ${error.message}`)
  }
}

/** quantos campos preenchidos essa execução tem — usado pra escolher a melhor */
function riqueza(e: Execucao) {
  return (e.concluido ? 1 : 0) + (e.carga != null ? 1 : 0) + (e.repsFeitas != null ? 1 : 0)
}

/**
 * Copia tudo pra nuvem preservando os vínculos.
 *
 * Os ids do Dexie são numéricos e locais; os do Postgres são
 * outros. Por isso guardamos um de-para a cada etapa, senão as
 * sessões apontariam pra rotinas erradas.
 */
export async function migrarParaNuvem(): Promise<ResultadoMigracao> {
  const userId = await uid()

  const [rotinasLocais, sessoesLocais, execucoesLocais] = await Promise.all([
    db.rotinas.toArray(),
    db.sessoes.toArray(),
    db.execucoes.toArray(),
  ])

  // começa do zero: torna a operação repetível sem duplicar
  await limparNuvem()

  const saida: ResultadoMigracao = {
    rotinas: 0,
    sessoes: 0,
    execucoes: 0,
    sessoesFundidas: 0,
    execucoesFundidas: 0,
  }

  /* ---------- rotinas ---------- */
  const deParaRotina = new Map<number, number>()
  if (rotinasLocais.length) {
    const { data, error } = await supabase
      .from('rotinas')
      .insert(
        rotinasLocais.map((r) => ({
          user_id: userId,
          dia_semana: r.diaSemana,
          nome: r.nome,
          exercicios: (r.exercicios ?? []) as ExercicioRotina[],
        })),
      )
      .select('id')
    if (error) throw new Error(`enviando rotinas: ${error.message}`)
    if ((data?.length ?? 0) !== rotinasLocais.length) {
      throw new Error('o banco não devolveu todas as rotinas enviadas')
    }

    // insert devolve na mesma ordem em que foi enviado
    data!.forEach((row, i) => {
      const idLocal = rotinasLocais[i]?.id
      if (idLocal != null) deParaRotina.set(idLocal, row.id)
    })
    saida.rotinas = data!.length
  }

  /* ---------- sessões (com fusão das repetidas) ---------- */
  const candidatas = sessoesLocais.filter(
    (s) => s.id != null && s.rotinaId != null && deParaRotina.has(s.rotinaId) && s.data,
  )

  // chave do que o Postgres considera duplicado
  const chave = (rotinaId: number, data: string) => `${deParaRotina.get(rotinaId)}|${data}`

  const unicas = new Map<string, { rotinaId: number; data: string; finalizada: boolean }>()
  for (const s of candidatas) {
    const k = chave(s.rotinaId, s.data)
    const jaTem = unicas.get(k)
    if (jaTem) {
      saida.sessoesFundidas++
      // se qualquer uma das repetidas estava finalizada, a fundida fica finalizada
      jaTem.finalizada = jaTem.finalizada || !!s.finalizada
    } else {
      unicas.set(k, { rotinaId: s.rotinaId, data: s.data, finalizada: !!s.finalizada })
    }
  }

  const listaUnicas = [...unicas.entries()]
  const chaveParaNovoId = new Map<string, number>()

  if (listaUnicas.length) {
    const { data, error } = await supabase
      .from('sessoes')
      .insert(
        listaUnicas.map(([, s]) => ({
          user_id: userId,
          rotina_id: deParaRotina.get(s.rotinaId)!,
          data: s.data,
          finalizada: s.finalizada,
        })),
      )
      .select('id')
    if (error) throw new Error(`enviando sessões: ${error.message}`)
    if ((data?.length ?? 0) !== listaUnicas.length) {
      throw new Error('o banco não devolveu todas as sessões enviadas')
    }

    data!.forEach((row, i) => chaveParaNovoId.set(listaUnicas[i][0], row.id))
    saida.sessoes = data!.length
  }

  // toda sessão local — inclusive as repetidas — aponta pro id novo
  const deParaSessao = new Map<number, number>()
  for (const s of candidatas) {
    const novo = chaveParaNovoId.get(chave(s.rotinaId, s.data))
    if (novo != null) deParaSessao.set(s.id!, novo)
  }

  /* ---------- execuções (com fusão das repetidas) ---------- */
  const melhores = new Map<string, { sessaoId: number; exercicioId: string; e: Execucao }>()
  for (const e of execucoesLocais) {
    const novaSessao = deParaSessao.get(e.sessaoId)
    if (novaSessao == null || !e.exercicioId) continue

    const k = `${novaSessao}|${e.exercicioId}`
    const atual = melhores.get(k)
    if (!atual) {
      melhores.set(k, { sessaoId: novaSessao, exercicioId: e.exercicioId, e })
      continue
    }
    saida.execucoesFundidas++
    // fica a mais completa das duas
    if (riqueza(e) > riqueza(atual.e)) {
      melhores.set(k, { sessaoId: novaSessao, exercicioId: e.exercicioId, e })
    }
  }

  const linhas = [...melhores.values()].map(({ sessaoId, exercicioId, e }) => ({
    user_id: userId,
    sessao_id: sessaoId,
    exercicio_id: exercicioId,
    concluido: e.concluido ?? false,
    carga: e.carga ?? null,
    reps_feitas: e.repsFeitas ?? null,
  }))

  const LOTE = 500
  for (let i = 0; i < linhas.length; i += LOTE) {
    const fatia = linhas.slice(i, i + LOTE)
    const { error } = await supabase
      .from('execucoes')
      .upsert(fatia, { onConflict: 'sessao_id,exercicio_id' })
    if (error) throw new Error(`enviando execuções: ${error.message}`)
    saida.execucoes += fatia.length
  }

  marcarComoMigrado()
  return saida
}
