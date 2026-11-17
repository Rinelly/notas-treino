import { supabase, uid } from '../lib/supabase'
import type { Correcao, Erro, NovaSessao, Palavra, PalavraNova, SessaoIngles } from './tipos'
import { chaveDaPalavra } from './vocabulario'

function checar<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/* ---------- palavras ---------- */

type PalavraRow = {
  id: string
  palavra: string
  significado: string
  exemplo: string
  criado_em: string
}

const COLUNAS_PALAVRA = 'id, palavra, significado, exemplo, criado_em'

const paraPalavra = (r: PalavraRow): Palavra => ({
  id: r.id,
  palavra: r.palavra,
  significado: r.significado,
  exemplo: r.exemplo,
  criadoEm: r.criado_em,
})

export async function getPalavras(): Promise<Palavra[]> {
  const rows = checar(
    await supabase
      .from('ingles_palavras')
      .select(COLUNAS_PALAVRA)
      .order('criado_em', { ascending: false }),
  ) as PalavraRow[]
  return rows.map(paraPalavra)
}

/**
 * Guarda só as que ainda não existem — quem decide é o banco, pela
 * constraint (user_id, chave). Devolve as que entraram de fato.
 */
export async function salvarPalavras(itens: PalavraNova[]): Promise<Palavra[]> {
  if (!itens.length) return []
  const user_id = await uid()
  const rows = checar(
    await supabase
      .from('ingles_palavras')
      .upsert(
        itens.map((p) => ({
          user_id,
          chave: chaveDaPalavra(p.word),
          palavra: p.word.trim(),
          significado: p.meaning ?? '',
          exemplo: p.example ?? '',
        })),
        { onConflict: 'user_id,chave', ignoreDuplicates: true },
      )
      .select(COLUNAS_PALAVRA),
  ) as PalavraRow[] | null
  return (rows ?? []).map(paraPalavra)
}

export async function apagarPalavra(id: string) {
  checar(await supabase.from('ingles_palavras').delete().eq('id', id))
}

/* ---------- erros ---------- */

type ErroRow = {
  id: string
  original: string
  correcao: string
  explicacao: string
  criado_em: string
}

const COLUNAS_ERRO = 'id, original, correcao, explicacao, criado_em'

const paraErro = (r: ErroRow): Erro => ({
  id: r.id,
  original: r.original,
  correcao: r.correcao,
  explicacao: r.explicacao,
  criadoEm: r.criado_em,
})

export async function getErros(limite = 30): Promise<Erro[]> {
  const rows = checar(
    await supabase
      .from('ingles_erros')
      .select(COLUNAS_ERRO)
      .order('criado_em', { ascending: false })
      .limit(limite),
  ) as ErroRow[]
  return rows.map(paraErro)
}

export async function salvarErros(itens: Correcao[]): Promise<Erro[]> {
  if (!itens.length) return []
  const user_id = await uid()
  const rows = checar(
    await supabase
      .from('ingles_erros')
      .insert(
        itens.map((c) => ({
          user_id,
          original: c.original,
          correcao: c.better,
          explicacao: c.explanation ?? '',
        })),
      )
      .select(COLUNAS_ERRO),
  ) as ErroRow[] | null
  return (rows ?? []).map(paraErro)
}

/* ---------- sessões ---------- */

type SessaoRow = {
  id: string
  cenario: string
  mensagens: number
  correcoes: number
  palavras: number
  duracao_seg: number
  resumo: string
  encerrada_em: string
}

const COLUNAS_SESSAO =
  'id, cenario, mensagens, correcoes, palavras, duracao_seg, resumo, encerrada_em'

const paraSessao = (r: SessaoRow): SessaoIngles => ({
  id: r.id,
  cenario: r.cenario,
  mensagens: r.mensagens,
  correcoes: r.correcoes,
  palavras: r.palavras,
  duracaoSeg: r.duracao_seg,
  resumo: r.resumo,
  encerradaEm: r.encerrada_em,
})

export async function getSessoes(limite = 30): Promise<SessaoIngles[]> {
  const rows = checar(
    await supabase
      .from('ingles_sessoes')
      .select(COLUNAS_SESSAO)
      .order('encerrada_em', { ascending: false })
      .limit(limite),
  ) as SessaoRow[]
  return rows.map(paraSessao)
}

export async function salvarSessao(s: NovaSessao): Promise<SessaoIngles> {
  const row = checar(
    await supabase
      .from('ingles_sessoes')
      .insert({
        user_id: await uid(),
        cenario: s.cenario,
        mensagens: s.mensagens,
        correcoes: s.correcoes,
        palavras: s.palavras,
        duracao_seg: s.duracaoSeg,
        resumo: s.resumo,
        iniciada_em: s.iniciadaEm,
      })
      .select(COLUNAS_SESSAO)
      .single(),
  ) as SessaoRow
  return paraSessao(row)
}

/* ---------- foco atual ---------- */

/** o que ela está estudando agora; '' quando ainda não escreveu nada */
export async function getFoco(): Promise<string> {
  const row = checar(
    await supabase.from('ingles_perfil').select('foco').maybeSingle(),
  ) as { foco: string } | null
  return row?.foco ?? ''
}

export async function salvarFoco(foco: string) {
  checar(
    await supabase.from('ingles_perfil').upsert(
      {
        user_id: await uid(),
        foco,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    ),
  )
}
