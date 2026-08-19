/* =========================================================
   foco/queries.ts — acesso às tabelas do Foco

   Usa as MESMAS tabelas que o app Foco original criou
   (settings, days, tasks), no mesmo projeto Supabase.
   Ou seja: o que você registrar aqui aparece lá e vice-versa,
   até você aposentar o app antigo.
   ========================================================= */

import { supabase, uid } from '../lib/supabase'
import { hojeChave } from '../lib/datas'
import {
  CONFIG_PADRAO,
  diaVazio,
  tipoSeguro,
  type Config,
  type Dia,
  type Tarefa,
  type TipoTarefa,
} from './tipos'

function checar<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/* ----------------------------------------------------------
   Configurações
   ---------------------------------------------------------- */
type ConfigRow = {
  goal_hours: number | string
  focus_min: number
  short_min: number
  long_min: number
  long_every: number
  sound: boolean
  last_type: string | null
}

export async function getConfig(): Promise<Config> {
  const row = checar(
    await supabase
      .from('settings')
      .select('goal_hours, focus_min, short_min, long_min, long_every, sound, last_type')
      .maybeSingle(),
  ) as ConfigRow | null

  if (!row) return { ...CONFIG_PADRAO }

  return {
    metaHoras: Number(row.goal_hours) || CONFIG_PADRAO.metaHoras,
    focoMin: row.focus_min ?? CONFIG_PADRAO.focoMin,
    curtaMin: row.short_min ?? CONFIG_PADRAO.curtaMin,
    longaMin: row.long_min ?? CONFIG_PADRAO.longaMin,
    longaCada: row.long_every ?? CONFIG_PADRAO.longaCada,
    som: row.sound ?? CONFIG_PADRAO.som,
    ultimoTipo: tipoSeguro(row.last_type),
  }
}

export async function salvarConfig(c: Config) {
  checar(
    await supabase.from('settings').upsert(
      {
        user_id: await uid(),
        goal_hours: c.metaHoras,
        focus_min: c.focoMin,
        short_min: c.curtaMin,
        long_min: c.longaMin,
        long_every: c.longaCada,
        sound: c.som,
        last_type: c.ultimoTipo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    ),
  )
}

/* ----------------------------------------------------------
   Dias
   ---------------------------------------------------------- */
type DiaRow = {
  date: string
  seconds: number
  seconds_work: number
  seconds_study: number
  pomodoros: number
  note: string | null
}

const COLUNAS_DIA = 'date, seconds, seconds_work, seconds_study, pomodoros, note'

function paraDia(r: DiaRow): Dia {
  return {
    chave: r.date,
    seg: r.seconds ?? 0,
    segTrabalho: r.seconds_work ?? 0,
    segEstudo: r.seconds_study ?? 0,
    pomodoros: r.pomodoros ?? 0,
    nota: r.note ?? '',
  }
}

export async function getDia(chave: string): Promise<Dia> {
  const row = checar(
    await supabase.from('days').select(COLUNAS_DIA).eq('date', chave).maybeSingle(),
  ) as DiaRow | null
  return row ? paraDia(row) : diaVazio(chave)
}

export async function getDias(de: string, ate: string): Promise<Dia[]> {
  const rows = (checar(
    await supabase.from('days').select(COLUNAS_DIA).gte('date', de).lte('date', ate),
  ) as DiaRow[] | null) ?? []
  return rows.map(paraDia)
}

export async function salvarDia(d: Dia) {
  checar(
    await supabase.from('days').upsert(
      {
        user_id: await uid(),
        date: d.chave,
        seconds: d.seg,
        seconds_work: d.segTrabalho,
        seconds_study: d.segEstudo,
        pomodoros: d.pomodoros,
        note: d.nota,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' },
    ),
  )
}

/* ----------------------------------------------------------
   Tarefas
   ---------------------------------------------------------- */
type TarefaRow = {
  id: string
  name: string
  type: string | null
  done: boolean
  pomodoros: number
  date: string | null
}

function paraTarefa(r: TarefaRow): Tarefa {
  return {
    id: r.id,
    nome: r.name,
    tipo: tipoSeguro(r.type),
    feita: r.done,
    pomodoros: r.pomodoros ?? 0,
    data: r.date,
  }
}

/**
 * As tarefas que devem aparecer hoje.
 *
 * Regra herdada do Foco: tarefa não concluída de um dia anterior
 * "viaja" pro dia de hoje, marcada com ↩. Concluídas ficam no
 * passado.
 */
export async function getTarefasDeHoje(): Promise<Tarefa[]> {
  const hoje = hojeChave()
  const rows = (checar(
    await supabase
      .from('tasks')
      .select('id, name, type, done, pomodoros, date')
      .order('created_at', { ascending: true }),
  ) as TarefaRow[] | null) ?? []

  const todas = rows.map(paraTarefa)
  const paraAtualizar: Tarefa[] = []

  const doDia = todas.filter((t) => {
    if (!t.data) {
      t.data = hoje
      paraAtualizar.push(t)
      return true
    }
    if (t.data === hoje) return true
    if (!t.feita && t.data < hoje) {
      t.data = hoje
      t.herdada = true
      paraAtualizar.push(t)
      return true
    }
    return false
  })

  // grava a mudança de data em segundo plano; se falhar, a tela não quebra
  for (const t of paraAtualizar) void salvarTarefa(t).catch(() => {})

  return doDia
}

export async function salvarTarefa(t: Tarefa) {
  checar(
    await supabase.from('tasks').upsert(
      {
        id: t.id,
        user_id: await uid(),
        name: t.nome,
        type: t.tipo,
        done: t.feita,
        pomodoros: t.pomodoros,
        date: t.data,
      },
      { onConflict: 'id' },
    ),
  )
}

export async function apagarTarefa(id: string) {
  checar(await supabase.from('tasks').delete().eq('id', id))
}

export function novaTarefa(nome: string, tipo: TipoTarefa): Tarefa {
  return {
    id: crypto.randomUUID(),
    nome: nome.trim().slice(0, 200),
    tipo,
    feita: false,
    pomodoros: 0,
    data: hojeChave(),
  }
}
