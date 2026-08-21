/* =========================================================
   Diagnóstico — onde os treinos realmente estão

   Tela de manutenção, fora do fluxo normal (/diagnostico).
   Serve pra parar de adivinhar: mostra lado a lado o que a
   nuvem tem e o que ESTE aparelho guarda no banco do navegador,
   com data por data.

   Também conserta um estrago conhecido: por um tempo, gravar a
   carga de um exercício apagava o "concluído" dele. Quem treinou
   nesse período tem a sessão e as cargas salvas, mas nenhum item
   marcado — e como o calendário só pinta o dia que tem pelo menos
   um exercício concluído, o treino some da tela mesmo existindo.
   ========================================================= */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { db } from '../db/db'
import s from './Diagnostico.module.scss'

type ExecLinha = {
  id: number
  sessao_id: number
  exercicio_id: string
  concluido: boolean
  carga: number | string | null
  reps_feitas: number | null
}

type DiaNuvem = {
  id: number
  data: string
  rotina: string
  finalizada: boolean
  registros: number
  concluidos: number
  comCarga: number
  /** tem carga/reps mas nenhum "concluído": o dia some do calendário */
  fantasma: boolean
}

type Info = {
  email: string
  nuvem: { rotinas: number; sessoes: number; execucoes: number }
  dias: DiaNuvem[]
  local: { rotinas: number; sessoes: number; execucoes: number; datas: string[] }
  recuperaveis: number
  /** ids exatos das linhas a consertar — nada de filtro esperto no servidor */
  idsParaConsertar: number[]
}

export default function Diagnostico() {
  const [info, setInfo] = useState<Info | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [consertando, setConsertando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setErro(null)
    try {
      const { data: auth } = await supabase.auth.getUser()

      const rotinas = (await supabase.from('rotinas').select('id, nome')).data ?? []
      const nomePorRotina = new Map<number, string>(
        (rotinas as { id: number; nome: string }[]).map((r) => [r.id, r.nome]),
      )

      const sessoes =
        ((
          await supabase
            .from('sessoes')
            .select('id, rotina_id, data, finalizada')
            .order('data', { ascending: false })
            .limit(60)
        ).data as { id: number; rotina_id: number; data: string; finalizada: boolean }[] | null) ??
        []

      const execs =
        sessoes.length === 0
          ? []
          : (((
              await supabase
                .from('execucoes')
                .select('id, sessao_id, exercicio_id, concluido, carga, reps_feitas')
                .in(
                  'sessao_id',
                  sessoes.map((x) => x.id),
                )
            ).data as ExecLinha[] | null) ?? [])

      const porSessao = new Map<number, ExecLinha[]>()
      for (const e of execs) {
        const lista = porSessao.get(e.sessao_id) ?? []
        lista.push(e)
        porSessao.set(e.sessao_id, lista)
      }

      const dias: DiaNuvem[] = sessoes.map((x) => {
        const lista = porSessao.get(x.id) ?? []
        const concluidos = lista.filter((e) => e.concluido).length
        const comCarga = lista.filter((e) => e.carga != null || e.reps_feitas != null).length
        return {
          id: x.id,
          data: x.data,
          rotina: nomePorRotina.get(x.rotina_id) ?? `rotina ${x.rotina_id}`,
          finalizada: x.finalizada,
          registros: lista.length,
          concluidos,
          comCarga,
          fantasma: concluidos === 0 && comCarga > 0 && !x.finalizada,
        }
      })

      const idsParaConsertar = dias
        .filter((d) => d.fantasma)
        .flatMap((d) =>
          (porSessao.get(d.id) ?? [])
            .filter((e) => !e.concluido && (e.carga != null || e.reps_feitas != null))
            .map((e) => e.id),
        )

      const totalExec = (
        await supabase.from('execucoes').select('sessao_id', { count: 'exact', head: true })
      ).count

      let local = { rotinas: 0, sessoes: 0, execucoes: 0, datas: [] as string[] }
      try {
        const [r, ss, e] = await Promise.all([
          db.rotinas.count(),
          db.sessoes.toArray(),
          db.execucoes.count(),
        ])
        local = {
          rotinas: r,
          sessoes: ss.length,
          execucoes: e,
          datas: [...new Set(ss.map((x) => x.data))].sort().reverse().slice(0, 20),
        }
      } catch {
        /* sem banco local neste aparelho */
      }

      setInfo({
        email: auth?.user?.email ?? '(sem sessão)',
        nuvem: { rotinas: rotinas.length, sessoes: sessoes.length, execucoes: totalExec ?? 0 },
        dias,
        local,
        recuperaveis: dias.filter((d) => d.fantasma).length,
        idsParaConsertar,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /**
   * Conserto: onde existe carga ou repetição registrada mas o
   * "concluído" está desmarcado, marca. Só mexe nessas linhas —
   * exercício sem nada anotado continua como está.
   */
  async function consertar() {
    if (!info) return
    setConsertando(true)
    setAviso(null)
    try {
      const ids = info.idsParaConsertar
      if (ids.length === 0) {
        setAviso('Não há nada nessa situação.')
        return
      }

      let mexidos = 0
      const LOTE = 200
      for (let i = 0; i < ids.length; i += LOTE) {
        const { data, error } = await supabase
          .from('execucoes')
          .update({ concluido: true })
          .in('id', ids.slice(i, i + LOTE))
          .select('id')
        if (error) throw new Error(error.message)
        mexidos += data?.length ?? 0
      }

      setAviso(`Pronto: ${mexidos} exercício(s) voltaram a contar como feitos.`)
      await carregar()
    } catch (e) {
      setAviso(`Não deu: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setConsertando(false)
    }
  }

  async function copiar() {
    if (!info) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(info, null, 2))
      setAviso('Diagnóstico copiado.')
    } catch {
      setAviso('Não consegui copiar — dá pra tirar print da tela.')
    }
  }

  if (erro) {
    return (
      <div className={s.page}>
        <h1 className={s.titulo}>Diagnóstico</h1>
        <div className={s.erro}>{erro}</div>
        <Link className={s.voltar} to="/">
          voltar
        </Link>
      </div>
    )
  }

  if (!info) return <div className={s.page}>Lendo os dois lados...</div>

  return (
    <div className={s.page}>
      <h1 className={s.titulo}>Diagnóstico</h1>
      <div className={s.linhaTopo}>
        <span className={s.fraco}>
          {info.email} · versão {__VERSAO__}
        </span>
        <Link className={s.voltar} to="/">
          voltar
        </Link>
      </div>

      {info.recuperaveis > 0 && (
        <div className={s.alerta}>
          <b>
            {info.recuperaveis} dia(s) com carga registrada e nenhum exercício marcado como
            feito.
          </b>{' '}
          É o efeito do bug antigo em que anotar a carga desmarcava o "concluído" — o treino
          está salvo, mas o calendário não pinta o dia porque ele conta exercícios concluídos.
          <div className={s.acoes}>
            <button
              type="button"
              className={s.botao}
              disabled={consertando}
              onClick={() => void consertar()}
            >
              {consertando ? 'Consertando...' : 'Marcar como feitos os que têm carga'}
            </button>
          </div>
        </div>
      )}

      {aviso && <div className={s.aviso}>{aviso}</div>}

      <h2 className={s.sub}>Na nuvem</h2>
      <p className={s.fraco}>
        {info.nuvem.rotinas} rotinas · {info.nuvem.sessoes} dias · {info.nuvem.execucoes}{' '}
        registros
      </p>

      <table className={s.tabela}>
        <thead>
          <tr>
            <th>data</th>
            <th>treino</th>
            <th>reg.</th>
            <th>feitos</th>
            <th>c/ carga</th>
            <th>fim</th>
          </tr>
        </thead>
        <tbody>
          {info.dias.map((d) => (
            <tr key={d.id} className={d.fantasma ? s.destacado : undefined}>
              <td>{d.data}</td>
              <td className={s.nome}>{d.rotina}</td>
              <td>{d.registros}</td>
              <td>{d.concluidos}</td>
              <td>{d.comCarga}</td>
              <td>{d.finalizada ? 'sim' : '—'}</td>
            </tr>
          ))}
          {info.dias.length === 0 && (
            <tr>
              <td colSpan={6}>nenhuma sessão na nuvem</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className={s.sub}>Neste aparelho (banco antigo do navegador)</h2>
      <p className={s.fraco}>
        {info.local.rotinas} rotinas · {info.local.sessoes} dias · {info.local.execucoes}{' '}
        registros
      </p>
      {info.local.datas.length > 0 ? (
        <p className={s.datas}>{info.local.datas.join(' · ')}</p>
      ) : (
        <p className={s.fraco}>Nada guardado localmente aqui.</p>
      )}

      <div className={s.acoes}>
        <button type="button" className={s.botaoFraco} onClick={() => void copiar()}>
          Copiar diagnóstico
        </button>
      </div>
    </div>
  )
}
