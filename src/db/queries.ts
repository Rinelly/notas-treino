/* =========================================================
   queries.ts — acesso a dados (agora no Supabase)

   As assinaturas são as mesmas de quando isso rodava em
   cima do Dexie, então as páginas quase não mudaram.

   Convenção: o banco usa snake_case, o app usa camelCase.
   A tradução acontece só aqui, nas funções de/para.
   ========================================================= */

import { supabase, uid } from '../lib/supabase'
import type { CategoriaExercicio, Execucao, ExercicioRotina, Rotina, Sessao } from '../types'

/* ----------------------------------------------------------
   Datas

   Atenção: a versão antiga usava toISOString(), que devolve
   a data em UTC. Aqui em Maceió (UTC-3), um treino marcado
   depois das 21h caía no dia seguinte. Agora usamos a data
   local, que é a que você enxerga no relógio.
   ---------------------------------------------------------- */
export function hoje() {
  const d = new Date()
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

/* ----------------------------------------------------------
   Tradutores banco <-> app
   ---------------------------------------------------------- */
type RotinaRow = {
  id: number
  dia_semana: string
  nome: string
  exercicios: ExercicioRotina[] | null
}
type SessaoRow = { id: number; rotina_id: number; data: string; finalizada: boolean }
type ExecucaoRow = {
  id: number
  sessao_id: number
  exercicio_id: string
  concluido: boolean
  carga: number | string | null
  reps_feitas: number | null
}

function paraRotina(r: RotinaRow): Rotina {
  return { id: r.id, diaSemana: r.dia_semana, nome: r.nome, exercicios: r.exercicios ?? [] }
}
function paraSessao(s: SessaoRow): Sessao {
  return { id: s.id, rotinaId: s.rotina_id, data: s.data, finalizada: s.finalizada }
}
function paraExecucao(e: ExecucaoRow): Execucao {
  return {
    id: e.id,
    sessaoId: e.sessao_id,
    exercicioId: e.exercicio_id,
    concluido: e.concluido,
    // numeric volta como string em alguns casos — normaliza aqui
    carga: e.carga == null ? undefined : Number(e.carga),
    repsFeitas: e.reps_feitas ?? undefined,
  }
}

/** erro de rede/RLS não pode passar batido */
function checar<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/* ----------------------------------------------------------
   Rotinas
   ---------------------------------------------------------- */
export async function getRotinas(): Promise<Rotina[]> {
  const rows = checar(
    await supabase.from('rotinas').select('id, dia_semana, nome, exercicios').order('id'),
  ) as RotinaRow[] | null
  return (rows ?? []).map(paraRotina)
}

export async function getRotina(id: number): Promise<Rotina | null> {
  const row = checar(
    await supabase
      .from('rotinas')
      .select('id, dia_semana, nome, exercicios')
      .eq('id', id)
      .maybeSingle(),
  ) as RotinaRow | null
  return row ? paraRotina(row) : null
}

/* ----------------------------------------------------------
   Sessões
   ---------------------------------------------------------- */
export async function getSessao(id: number): Promise<Sessao | null> {
  const row = checar(
    await supabase
      .from('sessoes')
      .select('id, rotina_id, data, finalizada')
      .eq('id', id)
      .maybeSingle(),
  ) as SessaoRow | null
  return row ? paraSessao(row) : null
}

/**
 * Abre o treino de hoje. Se já existir sessão pra essa rotina
 * hoje, devolve a mesma — é a constraint unique (user, rotina, data)
 * que garante isso, então dois cliques rápidos não criam duplicata.
 */
export async function getOrCriarSessaoHoje(rotinaId: number): Promise<Sessao> {
  const data = hoje()

  const existente = checar(
    await supabase
      .from('sessoes')
      .select('id, rotina_id, data, finalizada')
      .eq('rotina_id', rotinaId)
      .eq('data', data)
      .maybeSingle(),
  ) as SessaoRow | null
  if (existente) return paraSessao(existente)

  const criada = checar(
    await supabase
      .from('sessoes')
      .upsert(
        { user_id: await uid(), rotina_id: rotinaId, data },
        { onConflict: 'user_id,rotina_id,data' },
      )
      .select('id, rotina_id, data, finalizada')
      .single(),
  ) as SessaoRow
  return paraSessao(criada)
}

export async function finalizarSessao(sessaoId: number, finalizada: boolean) {
  checar(await supabase.from('sessoes').update({ finalizada }).eq('id', sessaoId))
}

/* ----------------------------------------------------------
   Execuções
   ---------------------------------------------------------- */
export async function execucoesDaSessao(sessaoId: number): Promise<Execucao[]> {
  const rows = checar(
    await supabase
      .from('execucoes')
      .select('id, sessao_id, exercicio_id, concluido, carga, reps_feitas')
      .eq('sessao_id', sessaoId),
  ) as ExecucaoRow[] | null
  return (rows ?? []).map(paraExecucao)
}

export async function upsertExecucao(
  sessaoId: number,
  exercicioId: string,
  dados: Partial<Pick<Execucao, 'concluido' | 'carga' | 'repsFeitas'>>,
) {
  const patch: Record<string, unknown> = {}
  if (dados.concluido !== undefined) patch.concluido = dados.concluido
  if (dados.carga !== undefined) patch.carga = dados.carga ?? null
  if (dados.repsFeitas !== undefined) patch.reps_feitas = dados.repsFeitas ?? null

  checar(
    await supabase.from('execucoes').upsert(
      {
        user_id: await uid(),
        sessao_id: sessaoId,
        exercicio_id: exercicioId,
        concluido: false,
        ...patch,
      },
      { onConflict: 'sessao_id,exercicio_id' },
    ),
  )
}

/**
 * A última carga/reps registrada nesse exercício, em qualquer
 * sessão anterior da mesma rotina. É o que mostra o "última vez"
 * na tela do treino.
 */
export async function ultimaExecucao(
  rotinaId: number,
  exercicioId: string,
  sessaoAtualId?: number,
): Promise<Execucao | null> {
  type ComSessao = ExecucaoRow & { sessoes: { data: string; rotina_id: number } | null }

  const rows = checar(
    await supabase
      .from('execucoes')
      .select(
        'id, sessao_id, exercicio_id, concluido, carga, reps_feitas, sessoes!inner(data, rotina_id)',
      )
      .eq('exercicio_id', exercicioId)
      .eq('sessoes.rotina_id', rotinaId)
      .or('carga.not.is.null,reps_feitas.not.is.null'),
  ) as unknown as ComSessao[] | null

  const candidatas = (rows ?? []).filter((r) => r.sessao_id !== sessaoAtualId && r.sessoes)
  if (candidatas.length === 0) return null

  // mais recente primeiro, pela data da sessão
  candidatas.sort((a, b) => (b.sessoes!.data ?? '').localeCompare(a.sessoes!.data ?? ''))
  return paraExecucao(candidatas[0])
}

/* ----------------------------------------------------------
   Telas de resumo
   ---------------------------------------------------------- */
export async function ultimaSessaoComProgresso() {
  type SessaoComRotina = SessaoRow & { rotinas: RotinaRow | null }

  const sessoes = (checar(
    await supabase
      .from('sessoes')
      .select('id, rotina_id, data, finalizada, rotinas!inner(id, dia_semana, nome, exercicios)')
      .order('data', { ascending: false })
      .limit(40),
  ) as unknown as SessaoComRotina[] | null) ?? []

  if (sessoes.length === 0) return null

  const feitosPorSessao = new Map<number, number>()
  const execs = checar(
    await supabase
      .from('execucoes')
      .select('sessao_id')
      .in(
        'sessao_id',
        sessoes.map((s) => s.id),
      )
      .eq('concluido', true),
  ) as { sessao_id: number }[] | null

  for (const e of execs ?? []) {
    feitosPorSessao.set(e.sessao_id, (feitosPorSessao.get(e.sessao_id) ?? 0) + 1)
  }

  for (const s of sessoes) {
    const feitos = feitosPorSessao.get(s.id) ?? 0
    if (feitos === 0 || !s.rotinas) continue
    const rotina = paraRotina(s.rotinas)
    return { sessao: paraSessao(s), rotina, feitos, total: rotina.exercicios.length }
  }

  return null
}

export async function diasTreinadosNoMes(ano: number, mesIndice0: number) {
  const primeiro = `${ano}-${String(mesIndice0 + 1).padStart(2, '0')}-01`
  const fimMes = new Date(ano, mesIndice0 + 1, 0).getDate()
  const ultimo = `${ano}-${String(mesIndice0 + 1).padStart(2, '0')}-${String(fimMes).padStart(2, '0')}`

  const sessoes = (checar(
    await supabase
      .from('sessoes')
      .select('id, rotina_id, data, finalizada')
      .gte('data', primeiro)
      .lte('data', ultimo),
  ) as SessaoRow[] | null) ?? []

  const finalizados = new Set(sessoes.filter((s) => s.finalizada).map((s) => s.data))
  if (sessoes.length === 0) return { comProgresso: new Set<string>(), finalizados }

  const dataPorSessaoId = new Map(sessoes.map((s) => [s.id, s.data]))
  const execs = (checar(
    await supabase
      .from('execucoes')
      .select('sessao_id')
      .in('sessao_id', [...dataPorSessaoId.keys()])
      .eq('concluido', true),
  ) as { sessao_id: number }[] | null) ?? []

  const comProgresso = new Set(
    execs.map((e) => dataPorSessaoId.get(e.sessao_id)!).filter(Boolean),
  )

  return { comProgresso, finalizados }
}

/* ----------------------------------------------------------
   Edição de exercícios

   Os exercícios moram num jsonb dentro da rotina, então
   editar um deles é ler a rotina, mexer no array e gravar.
   ---------------------------------------------------------- */
export async function atualizarExercicio(
  rotinaId: number,
  exercicioId: string,
  dados: Partial<{ nome: string; seriesAlvo: string; observacao: string }>,
) {
  const rotina = await getRotina(rotinaId)
  if (!rotina) return

  const exercicios = rotina.exercicios.map((ex) =>
    ex.id === exercicioId ? { ...ex, ...dados } : ex,
  )
  checar(await supabase.from('rotinas').update({ exercicios }).eq('id', rotinaId))
}

export async function adicionarExercicio(
  rotinaId: number,
  dados: { nome: string; categoria: CategoriaExercicio; seriesAlvo: string },
) {
  const rotina = await getRotina(rotinaId)
  if (!rotina) return

  const novoExercicio: ExercicioRotina = { id: crypto.randomUUID(), ...dados }
  checar(
    await supabase
      .from('rotinas')
      .update({ exercicios: [...rotina.exercicios, novoExercicio] })
      .eq('id', rotinaId),
  )
  return novoExercicio
}

export async function removerExercicio(rotinaId: number, exercicioId: string) {
  const rotina = await getRotina(rotinaId)
  if (!rotina) return

  const exercicios = rotina.exercicios.filter((ex) => ex.id !== exercicioId)
  checar(await supabase.from('rotinas').update({ exercicios }).eq('id', rotinaId))
}

/* ----------------------------------------------------------
   Resumo pro painel "Hoje"
   ---------------------------------------------------------- */
const DIAS_JS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export interface ResumoTreinoHoje {
  rotina: Rotina | null
  sessaoId: number | null
  feitos: number
  total: number
  finalizada: boolean
}

/** o treino previsto pra hoje e o quanto dele já foi feito */
export async function resumoTreinoHoje(): Promise<ResumoTreinoHoje> {
  const rotinas = await getRotinas()
  const nomeDia = DIAS_JS[new Date().getDay()]
  const rotina = rotinas.find((r) => r.diaSemana === nomeDia) ?? null

  const vazio: ResumoTreinoHoje = { rotina, sessaoId: null, feitos: 0, total: 0, finalizada: false }
  if (!rotina?.id) return vazio

  vazio.total = rotina.exercicios.length

  // só lê: não cria sessão à toa só por abrir o painel
  const sessao = checar(
    await supabase
      .from('sessoes')
      .select('id, rotina_id, data, finalizada')
      .eq('rotina_id', rotina.id)
      .eq('data', hoje())
      .maybeSingle(),
  ) as SessaoRow | null
  if (!sessao) return vazio

  const execs = (checar(
    await supabase.from('execucoes').select('id').eq('sessao_id', sessao.id).eq('concluido', true),
  ) as { id: number }[] | null) ?? []

  return {
    rotina,
    sessaoId: sessao.id,
    feitos: execs.length,
    total: rotina.exercicios.length,
    finalizada: sessao.finalizada,
  }
}
