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
/** A, B, C... a partir da posição no rodízio */
export function letraDoTreino(indice: number) {
  return String.fromCharCode(65 + (indice % 26))
}

/** as rotinas na ordem do rodízio, já com a letra */
export async function getRotinas(): Promise<Rotina[]> {
  const rows = checar(
    await supabase.from('rotinas').select('id, dia_semana, nome, exercicios').order('id'),
  ) as RotinaRow[] | null
  return (rows ?? []).map((r, i) => ({ ...paraRotina(r), letra: letraDoTreino(i) }))
}

/**
 * Busca pela lista inteira em vez de uma linha só, porque a letra
 * do treino vem da posição no rodízio — sozinha, a linha não sabe
 * se é o A ou o D. São 5 rotinas: o custo é irrelevante.
 */
export async function getRotina(id: number): Promise<Rotina | null> {
  const rotinas = await getRotinas()
  return rotinas.find((r) => r.id === id) ?? null
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
  return getOrCriarSessaoEm(rotinaId, hoje())
}

/** as sessões que existem num dia qualquer, com a rotina junto */
export async function sessoesDoDia(data: string): Promise<{ sessao: Sessao; rotina: Rotina }[]> {
  const rows = (checar(
    await supabase.from('sessoes').select('id, rotina_id, data, finalizada').eq('data', data),
  ) as SessaoRow[] | null) ?? []
  if (rows.length === 0) return []

  const rotinas = await getRotinas()
  return rows
    .map((r) => {
      const rotina = rotinas.find((x) => x.id === r.rotina_id)
      return rotina ? { sessao: paraSessao(r), rotina } : null
    })
    .filter((x): x is { sessao: Sessao; rotina: Rotina } => x !== null)
}

/**
 * A mesma coisa, mas pra qualquer data.
 *
 * Existe porque sincronização falha: se um treino não chegou ao
 * banco no dia, sem isso não há como registrá-lo depois — e o
 * histórico fica com um buraco pra sempre.
 */
export async function getOrCriarSessaoEm(rotinaId: number, data: string): Promise<Sessao> {
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

/**
 * Grava só os campos informados de uma execução.
 *
 * Aqui NÃO dá pra usar upsert. O upsert do PostgREST monta a linha
 * inteira: as colunas que você não manda voltam pro padrão. Então
 * marcar "concluído" apagaria a carga, e digitar a carga desmarcaria
 * o "concluído".
 *
 * O caminho certo é tentar o UPDATE primeiro e só inserir se não
 * existir linha ainda.
 */
export async function upsertExecucao(
  sessaoId: number,
  exercicioId: string,
  dados: Partial<Pick<Execucao, 'concluido' | 'carga' | 'repsFeitas'>>,
) {
  const patch: Record<string, unknown> = {}
  if (dados.concluido !== undefined) patch.concluido = dados.concluido
  if (dados.carga !== undefined) patch.carga = dados.carga ?? null
  if (dados.repsFeitas !== undefined) patch.reps_feitas = dados.repsFeitas ?? null
  if (Object.keys(patch).length === 0) return

  // 1) já existe? então só altera o que mudou
  const alteradas = checar(
    await supabase
      .from('execucoes')
      .update(patch)
      .eq('sessao_id', sessaoId)
      .eq('exercicio_id', exercicioId)
      .select('id'),
  ) as { id: number }[] | null

  if (alteradas && alteradas.length > 0) return

  // 2) primeira vez nesse exercício: cria a linha
  const res = await supabase.from('execucoes').insert({
    user_id: await uid(),
    sessao_id: sessaoId,
    exercicio_id: exercicioId,
    concluido: false,
    carga: null,
    reps_feitas: null,
    ...patch,
  })

  // corrida: dois cliques quase juntos podem inserir ao mesmo tempo.
  // se o outro ganhou, o UPDATE resolve.
  if (res.error) {
    if (res.error.code === '23505') {
      checar(
        await supabase
          .from('execucoes')
          .update(patch)
          .eq('sessao_id', sessaoId)
          .eq('exercicio_id', exercicioId),
      )
      return
    }
    throw new Error(res.error.message)
  }
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
   Qual treino mostrar no painel

   A regra, em ordem:
   1. já tem sessão de HOJE com alguma coisa feita (ou finalizada)
      -> mostra ELA, com o estado real. O treino de hoje continua
         sendo o de hoje mesmo depois de concluído; só vira o
         próximo amanhã.
   2. senão, olha a última sessão com progresso de dias anteriores
      e mostra o SEGUINTE na sequência, voltando pro A no fim
   3. nunca treinou -> Treino A

   O item 2 trata uma sessão de dia anterior como encerrada mesmo
   sem "Finalizar treino", pra não ficar travada num treino que
   você começou e largou.
   ---------------------------------------------------------- */

export interface ProximoTreino {
  rotina: Rotina | null
  sessaoId: number | null
  feitos: number
  total: number
  finalizada: boolean
  /** começou hoje mas ainda não finalizou */
  emAndamento: boolean
}

export async function proximoTreino(): Promise<ProximoTreino> {
  const vazio: ProximoTreino = {
    rotina: null, sessaoId: null, feitos: 0, total: 0, finalizada: false, emAndamento: false,
  }

  const rotinas = await getRotinas()
  if (rotinas.length === 0) return vazio

  // sessões recentes, da mais nova pra mais antiga
  const sessoes = (checar(
    await supabase
      .from('sessoes')
      .select('id, rotina_id, data, finalizada')
      .order('data', { ascending: false })
      .order('id', { ascending: false })
      .limit(40),
  ) as SessaoRow[] | null) ?? []

  // quantos exercícios concluídos por sessão
  const feitosPorSessao = new Map<number, number>()
  if (sessoes.length) {
    const execs = (checar(
      await supabase
        .from('execucoes')
        .select('sessao_id')
        .in('sessao_id', sessoes.map((s) => s.id))
        .eq('concluido', true),
    ) as { sessao_id: number }[] | null) ?? []
    for (const e of execs) {
      feitosPorSessao.set(e.sessao_id, (feitosPorSessao.get(e.sessao_id) ?? 0) + 1)
    }
  }

  const temAlgo = (s: SessaoRow) => s.finalizada || (feitosPorSessao.get(s.id) ?? 0) > 0

  /* 1. o treino de hoje, se já houve algum movimento nele */
  const hojeStr = hoje()
  const deHoje = sessoes.find((s) => s.data === hojeStr && temAlgo(s))
  if (deHoje) {
    const rotina = rotinas.find((r) => r.id === deHoje.rotina_id)
    if (rotina) {
      const feitos = feitosPorSessao.get(deHoje.id) ?? 0
      return {
        rotina,
        sessaoId: deHoje.id,
        feitos,
        total: rotina.exercicios.length,
        finalizada: deHoje.finalizada,
        emAndamento: !deHoje.finalizada && feitos > 0,
      }
    }
  }

  /* 2. senão, o seguinte ao último treino de dias anteriores */
  const anterior = sessoes.find((s) => s.data < hojeStr && temAlgo(s)) ?? null

  let alvo = rotinas[0]
  if (anterior) {
    const i = rotinas.findIndex((r) => r.id === anterior.rotina_id)
    if (i >= 0) alvo = rotinas[(i + 1) % rotinas.length]
  }

  // pode existir sessão de hoje ainda sem nada marcado
  const sessaoVaziaHoje = sessoes.find((s) => s.data === hojeStr && s.rotina_id === alvo.id)

  return {
    rotina: alvo,
    sessaoId: sessaoVaziaHoje?.id ?? null,
    feitos: 0,
    total: alvo.exercicios.length,
    finalizada: false,
    emAndamento: false,
  }
}
