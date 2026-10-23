/* =========================================================
   Hoje — o painel que junta os dois lados

   É a única tela que nenhum dos apps sozinhos conseguia
   fazer: horas de foco, treino do dia e o que ficou pendente,
   tudo na mesma olhada.
   ========================================================= */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  diasTreinadosNoMes,
  getOrCriarSessaoHoje,
  proximoTreino,
  type ProximoTreino,
} from '../db/queries'
import { getConfig, getDia, getDias, getTarefasDeHoje, salvarConfig } from '../foco/queries'
import { calcularEstatisticas } from '../foco/estatisticas'
import { calcularVencimento, formatarDia } from '../lib/academia'
import { CONFIG_PADRAO, diaVazio, type Config, type Dia, type Tarefa } from '../foco/tipos'
import { dataLonga, fmtHM, haQuantoTempo, hojeChave, ultimosDias } from '../lib/datas'
import { mesMini, nomeDoMes } from '../lib/mesMini'
import { partesDoNome } from '../lib/nomeTreino'
import { useDiaAtual } from '../lib/useDiaAtual'
import s from './Hoje.module.scss'

/** quantos dias para trás a sequência e a média olham */
const JANELA = 60

function saudacao() {
  const h = new Date().getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Hoje() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO)
  const [dia, setDia] = useState<Dia>(() => diaVazio(hojeChave()))
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [treino, setTreino] = useState<ProximoTreino | null>(null)
  const [historico, setHistorico] = useState<Dia[]>([])
  const [treinosDoMes, setTreinosDoMes] = useState<Set<string>>(() => new Set())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editandoAcademia, setEditandoAcademia] = useState(false)
  const [diaDigitado, setDiaDigitado] = useState('')
  const [erroAcademia, setErroAcademia] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const agora = new Date()
      const janela = ultimosDias(JANELA)
      const [c, d, ts, tr, hist, mes] = await Promise.all([
        getConfig(),
        getDia(hojeChave()),
        getTarefasDeHoje(),
        proximoTreino(),
        getDias(janela[0].chave, janela[janela.length - 1].chave),
        diasTreinadosNoMes(agora.getFullYear(), agora.getMonth()),
      ])
      setConfig(c)
      setDia(d)
      setTarefas(ts)
      setTreino(tr)
      setHistorico(hist)
      setTreinosDoMes(mes.comProgresso)
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // o painel inteiro é "hoje": na virada ele tem que renascer
  useDiaAtual(carregar)

  async function salvarAcademia(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(diaDigitado)
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      setErroAcademia('Escolha um dia entre 1 e 31.')
      return
    }
    const nova = { ...config, academiaDia: n }
    setErroAcademia(null)
    try {
      await salvarConfig(nova)
      setConfig(nova)
      setEditandoAcademia(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErroAcademia(
        /academia_dia/.test(msg)
          ? 'Falta rodar a migração no Supabase: alter table settings add column if not exists academia_dia int;'
          : msg,
      )
    }
  }

  async function abrirTreino() {
    if (!treino?.rotina?.id) return
    const sessao = await getOrCriarSessaoHoje(treino.rotina.id)
    navigate(`/sessao/${sessao.id}`)
  }

  if (carregando) return <div className={s.page}>Carregando...</div>
  if (erro) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <div className={s.rotulo}>Não consegui carregar</div>
          <div style={{ color: 'var(--danger)', fontSize: 13 }}>{erro}</div>
        </div>
      </div>
    )
  }

  const metaSeg = config.metaHoras * 3600
  const escala = Math.max(metaSeg, dia.seg) || 1
  const bateu = dia.seg >= metaSeg
  const pendentes = tarefas.filter((t) => !t.feita)
  const feitasHoje = tarefas.filter((t) => t.feita).length

  /* O cálculo da sequência conta posição por posição, então a série
     precisa ser contínua: o banco só devolve os dias que existem, e
     um dia sem foco simplesmente não tem linha. Aqui os buracos são
     preenchidos com dias vazios — que é exatamente o que quebra a
     sequência — e hoje vem do estado, que está sempre atualizado. */
  const porChave = new Map(historico.map((d) => [d.chave, d]))
  porChave.set(dia.chave, dia)
  const serie = ultimosDias(JANELA).map(({ chave }) => porChave.get(chave) ?? diaVazio(chave))
  const stats = calcularEstatisticas(serie, metaSeg)

  const agora = new Date()
  const { casas, quantos } = mesMini(
    agora.getFullYear(),
    agora.getMonth(),
    treinosDoMes,
    hojeChave(),
  )
  const ultimaVez = haQuantoTempo(treino?.ultimaVez ?? null)

  return (
    <div className={s.page}>
      <header className={s.cabecalho}>
        <h1 className={s.saudacao}>{saudacao()}, Rinelly</h1>
        <div className={s.data}>{dataLonga(new Date())}</div>
      </header>

      {/* ---------- foco: sozinho em cima, a barra ocupa a largura toda ---------- */}
      <button type="button" className={s.card} onClick={() => navigate('/foco')}>
        <div className={s.rotulo}>Foco de hoje</div>
        <div className={s.linhaTopo}>
          <div className={s.destaque}>
            {fmtHM(dia.seg)} <small>de {fmtHM(metaSeg)}</small>
          </div>
          <div className={s.detalhe}>
            {bateu ? (
              <>Meta batida 🎉 — {dia.pomodoros} pomodoros</>
            ) : (
              <>
                Faltam {fmtHM(metaSeg - dia.seg)} · {dia.pomodoros} pomodoros
              </>
            )}
          </div>
        </div>
        <div className={s.barra}>
          <div className={`${s.fatia} ${s.trabalho}`} style={{ width: `${(dia.segTrabalho / escala) * 100}%` }} />
          <div className={`${s.fatia} ${s.estudo}`} style={{ width: `${(dia.segEstudo / escala) * 100}%` }} />
        </div>
        <div className={s.detalhe}>
          {fmtHM(dia.segTrabalho)} trabalho · {fmtHM(dia.segEstudo)} estudo
        </div>
      </button>

      {/* ---------- sequência e semana: dois números pequenos, lado a lado ---------- */}
      <div className={`${s.grade} ${s.compacta}`}>
        <button type="button" className={s.card} onClick={() => navigate('/foco')}>
          <div className={s.rotulo}>Sequência</div>
          <div className={s.destaque} style={{ fontSize: 22 }}>
            {stats.sequencia} <small>{stats.sequencia === 1 ? 'dia' : 'dias'}</small>
          </div>
          <div className={s.detalhe}>
            {stats.sequencia === 0
              ? 'Bata a meta hoje pra começar uma.'
              : bateu
                ? 'seguidos batendo a meta'
                : `seguidos até ontem — faltam ${fmtHM(metaSeg - dia.seg)} hoje`}
          </div>
        </button>

        <button type="button" className={s.card} onClick={() => navigate('/foco')}>
          <div className={s.rotulo}>Esta semana</div>
          <div className={s.destaque} style={{ fontSize: 22 }}>
            {fmtHM(stats.semana)}
          </div>
          <div className={s.detalhe}>
            {fmtHM(stats.semanaTrabalho)} trabalho · {fmtHM(stats.semanaEstudo)} estudo
          </div>
        </button>
      </div>

      {/* ---------- academia: o treino do dia e a mensalidade são a mesma ida ---------- */}
      <div className={s.grade}>
        <button type="button" className={s.card} onClick={() => void abrirTreino()}>
          <div className={s.rotulo}>Treino atual</div>
          {treino?.rotina ? (
            <>
              <div className={s.destaque} style={{ fontSize: 17, lineHeight: 1.3 }}>
                {partesDoNome(treino.rotina.nome).curto}
              </div>
              <div className={s.detalhe}>{partesDoNome(treino.rotina.nome).detalhe}</div>
              <div className={s.barra}>
                <div
                  className={`${s.fatia} ${s.feito}`}
                  style={{ width: `${treino.total ? (treino.feitos / treino.total) * 100 : 0}%` }}
                />
              </div>
              <div className={s.detalhe}>
                {treino.feitos}/{treino.total} exercícios
                {ultimaVez && ` · última vez ${ultimaVez}`}
              </div>
              <span
                className={[
                  s.selo,
                  treino.finalizada ? s.ok : treino.emAndamento ? s.andamento : s.pendente,
                ].join(' ')}
              >
                {treino.finalizada
                  ? '✓ concluído'
                  : treino.emAndamento
                    ? 'em andamento'
                    : 'não iniciado'}
              </span>
            </>
          ) : (
            <>
              <div className={s.destaque} style={{ fontSize: 17 }}>
                Sem treinos
              </div>
              <div className={s.vazio}>Nenhuma rotina cadastrada ainda.</div>
            </>
          )}
        </button>

        <div className={`${s.card} ${s.semClique}`}>
          <div className={s.linhaTopo}>
            <div className={s.rotulo}>Academia</div>
            {config.academiaDia != null && !editandoAcademia && (
              <button
                type="button"
                className={s.linkzinho}
                onClick={() => {
                  setDiaDigitado(String(config.academiaDia))
                  setEditandoAcademia(true)
                }}
              >
                alterar
              </button>
            )}
          </div>

          {editandoAcademia || config.academiaDia == null ? (
            <form className={s.formAcademia} onSubmit={(e) => void salvarAcademia(e)}>
              <label>
                Vence todo dia
                <input
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  value={diaDigitado}
                  onChange={(e) => setDiaDigitado(e.target.value)}
                  placeholder="10"
                  autoFocus={editandoAcademia}
                />
                do mês
              </label>
              <button type="submit" className={s.botaoSalvar}>
                Salvar
              </button>
              {config.academiaDia != null && (
                <button
                  type="button"
                  className={s.linkzinho}
                  onClick={() => {
                    setEditandoAcademia(false)
                    setErroAcademia(null)
                  }}
                >
                  cancelar
                </button>
              )}
            </form>
          ) : (
            (() => {
              const v = calcularVencimento(config.academiaDia)
              return (
                <>
                  <div className={s.destaque} style={{ fontSize: 17, lineHeight: 1.3 }}>
                    {formatarDia(v.data)}
                  </div>
                  <div className={s.detalhe}>mensalidade</div>
                  <span className={`${s.selo} ${s[v.nivel]}`}>{v.texto}</span>
                </>
              )
            })()
          )}

          {erroAcademia && <div className={s.erroLinha}>{erroAcademia}</div>}
        </div>
      </div>

      {/* ---------- miniatura do mês: a frequência numa olhada ---------- */}
      <button type="button" className={s.card} onClick={() => navigate('/treinos')}>
        <div className={s.linhaTopo}>
          <div className={s.rotulo}>Treinos de {nomeDoMes(agora.getMonth())}</div>
          <div className={s.contagemMes}>
            {quantos} {quantos === 1 ? 'dia' : 'dias'}
          </div>
        </div>
        <div className={s.mesMini} aria-hidden="true">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <span key={`t${i}`} className={s.casaTitulo}>
              {d}
            </span>
          ))}
          {casas.map((c, i) => (
            <span
              key={i}
              className={[
                c.dia == null ? s.casaVazia : s.casa,
                c.treinado ? s.casaFeita : '',
                c.hoje ? s.casaHoje : '',
                c.futuro ? s.casaFutura : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>
      </button>

      {/* ---------- tarefas ---------- */}
      <button type="button" className={s.card} onClick={() => navigate('/foco')}>
        <div className={s.rotulo}>
          Tarefas {pendentes.length > 0 && `· ${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}`}
        </div>

        {tarefas.length === 0 ? (
          <div className={s.vazio}>
            Nenhuma tarefa hoje. Abra o Foco pra planejar o que quer fazer.
          </div>
        ) : (
          <>
            <ul className={s.lista}>
              {pendentes.slice(0, 5).map((t) => (
                <li key={t.id} className={s.tarefa}>
                  <span
                    style={{
                      background: t.tipo === 'trabalho' ? 'var(--cor-trabalho)' : 'var(--cor-estudo)',
                    }}
                  />
                  <span className={s.nome}>{t.nome}</span>
                  {t.pomodoros > 0 && <span className={s.pomos}>{t.pomodoros} 🍅</span>}
                </li>
              ))}
            </ul>
            {(pendentes.length > 5 || feitasHoje > 0) && (
              <div className={s.detalhe}>
                {pendentes.length > 5 && `e mais ${pendentes.length - 5}. `}
                {feitasHoje > 0 && `${feitasHoje} já concluída${feitasHoje > 1 ? 's' : ''}.`}
              </div>
            )}
          </>
        )}
      </button>

      {/* ---------- anotação ---------- */}
      {dia.nota.trim() && (
        <div className={s.card}>
          <div className={s.rotulo}>Anotação de hoje</div>
          <div className={s.nota}>{dia.nota}</div>
        </div>
      )}

      <div className={s.versao}>
        versão {__VERSAO__} ·{' '}
        <button type="button" className={s.linkVersao} onClick={() => navigate('/dados')}>
          exportar
        </button>{' '}
        ·{' '}
        <button type="button" className={s.linkVersao} onClick={() => navigate('/diagnostico')}>
          diagnóstico
        </button>
      </div>
    </div>
  )
}
