/* =========================================================
   medidasQueries — ida e volta das medidas com o Supabase

   Sobre o upsert: o PostgREST SUBSTITUI a linha inteira, e coluna
   que não vai no corpo volta ao default (null, aqui). Isso já
   causou perda de dado neste app uma vez. Aqui é o comportamento
   certo justamente porque o formulário sempre carrega o dia
   inteiro antes de salvar — o que está em branco na tela é o que
   deve ficar em branco no banco.
   ========================================================= */

import { supabase, uid } from '../lib/supabase'
import { medidaVazia, type Medida } from '../lib/medidas'

type MedidaRow = {
  id: number
  data: string
  peso: number | string | null
  gordura: number | string | null
  cintura: number | string | null
  quadril: number | string | null
  peito: number | string | null
  braco: number | string | null
  coxa: number | string | null
  panturrilha: number | string | null
  nota: string | null
}

const COLUNAS =
  'id, data, peso, gordura, cintura, quadril, peito, braco, coxa, panturrilha, nota'

function checar<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** o Postgres devolve numeric como texto: '67.20' precisa virar 67.2 */
function n(v: number | string | null): number | null {
  if (v == null || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function paraMedida(r: MedidaRow): Medida {
  return {
    id: r.id,
    data: r.data,
    peso: n(r.peso),
    gordura: n(r.gordura),
    cintura: n(r.cintura),
    quadril: n(r.quadril),
    peito: n(r.peito),
    braco: n(r.braco),
    coxa: n(r.coxa),
    panturrilha: n(r.panturrilha),
    nota: r.nota ?? '',
  }
}

/** da mais recente para a mais antiga, que é como tudo aqui espera */
export async function getMedidas(): Promise<Medida[]> {
  const rows =
    ((checar(
      await supabase.from('medidas').select(COLUNAS).order('data', { ascending: false }),
    ) as MedidaRow[] | null) ?? [])
  return rows.map(paraMedida)
}

export async function getMedidaDoDia(data: string): Promise<Medida> {
  const row = checar(
    await supabase.from('medidas').select(COLUNAS).eq('data', data).maybeSingle(),
  ) as MedidaRow | null
  return row ? paraMedida(row) : medidaVazia(data)
}

export async function salvarMedida(m: Medida): Promise<Medida> {
  const row = checar(
    await supabase
      .from('medidas')
      .upsert(
        {
          user_id: await uid(),
          data: m.data,
          peso: m.peso,
          gordura: m.gordura,
          cintura: m.cintura,
          quadril: m.quadril,
          peito: m.peito,
          braco: m.braco,
          coxa: m.coxa,
          panturrilha: m.panturrilha,
          nota: m.nota.trim() || null,
        },
        { onConflict: 'user_id,data' },
      )
      .select(COLUNAS)
      .single(),
  ) as MedidaRow
  return paraMedida(row)
}

export async function apagarMedida(data: string) {
  checar(await supabase.from('medidas').delete().eq('data', data))
}
