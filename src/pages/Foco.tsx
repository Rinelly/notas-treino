import { useEffect, useRef, useState } from 'react'
import { useFoco } from '../foco/useFoco'
import { useTimer } from '../foco/useTimer'
import type { TipoTarefa } from '../foco/tipos'
import { fmtHM, fmtRelogio, dataCurta, hojeChave } from '../lib/datas'
import s from './Foco.module.scss'

const ALTURA_BARRA = 76 // precisa bater com .pilha no CSS
const ALTURA_ROTULO = 20

export default function Foco() {
  const f = useFoco()
  const [novaTarefa, setNovaTarefa] = useState('')
  const [tipoNovo, setTipoNovo] = useState<TipoTarefa>('estudo')
  const [statusNota, setStatusNota] = useState('salvo automaticamente')
  const timerNota = useRef<ReturnType<typeof setTimeout> | null>(null)

  const t = useTimer(f.config, {
    aoAcumular: f.acumularSegundos,
    aoConcluir: (eraFoco) => {
      if (eraFoco) f.concluirPomodoro()
    },
  })

  // o seletor de tipo acompanha a preferência salva
  useEffect(() => {
    setTipoNovo(f.config.ultimoTipo)
  }, [f.config.ultimoTipo])

  // título da aba vira o cronômetro
  useEffect(() => {
    const rotulo = t.modo === 'foco' ? 'Foco' : t.modo === 'curta' ? 'Pausa curta' : 'Pausa longa'
    document.title = (t.rodando ? fmtRelogio(t.restanteMs) + ' · ' : '') + rotulo
    return () => {
      document.title = 'Notas de Treino'
    }
  }, [t.modo, t.rodando, t.restanteMs])

  // pede permissão de notificação no primeiro "Começar"
  const pediuRef = useRef(false)
  function comecar() {
    if (!pediuRef.current) {
      pediuRef.current = true
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          void Notification.requestPermission()
        }
      } catch {
        /* opcional */
      }
    }
    t.alternar()
  }

  // atalhos: espaço começa/pausa, R reinicia
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()
        t.alternar()
      }
      if (e.key === 'r' || e.key === 'R') t.reiniciar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [t])

  if (f.carregando) return <div className={s.page}>Carregando...</div>
  if (f.erro) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <h2 className={s.titulo}>Não consegui carregar o Foco</h2>
          <p style={{ color: 'var(--danger)', fontSize: 13 }}>{f.erro}</p>
          <button type="button" className={s.principal} onClick={() => void f.recarregar()}>
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }

  const { hoje, config, estatisticas: est } = f
  const metaSeg = config.metaHoras * 3600
  const escala = Math.max(metaSeg, hoje.seg) || 1
  const bateu = hoje.seg >= metaSeg

  const maxGrafico = Math.max(est.metaSeg, ...est.dias.map((d) => d.seg)) * 1.12 || 1
  const chaveHoje = hojeChave()

  return (
    <div className={s.page}>
      {/* ---------- meta ---------- */}
      <section className={s.card}>
        <h2 className={s.titulo}>Meta de hoje</h2>

        <div className={s.metaTopo}>
          <div className={s.metaNumero}>
            {fmtHM(hoje.seg)} <small>de {fmtHM(metaSeg)}</small>
          </div>
          <div className={s.metaFalta}>
            {bateu ? (
              <>
                <b>meta batida</b> 🎉 {hoje.seg > metaSeg && `+${fmtHM(hoje.seg - metaSeg)}`}
              </>
            ) : (
              <>
                faltam <b>{fmtHM(metaSeg - hoje.seg)}</b>
              </>
            )}
          </div>
        </div>

        <div className={`${s.barra} ${bateu ? s.batida : ''}`}>
          <div className={`${s.fatia} ${s.trabalho}`} style={{ width: `${(hoje.segTrabalho / escala) * 100}%` }} />
          <div className={`${s.fatia} ${s.estudo}`} style={{ width: `${(hoje.segEstudo / escala) * 100}%` }} />
        </div>

        <div className={s.rodape}>
          <label>
            Meta diária
            <input
              type="number"
              min={1}
              max={16}
              step={0.5}
              value={config.metaHoras}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (v > 0 && v <= 16) f.mudarConfig({ metaHoras: v })
              }}
            />
            h
          </label>

          <span className={s.legenda}>
            <span className={`${s.chip} ${s.trabalho}`}>trabalho {fmtHM(hoje.segTrabalho)}</span>
            <span className={`${s.chip} ${s.estudo}`}>estudo {fmtHM(hoje.segEstudo)}</span>
          </span>

          <span>
            {hoje.pomodoros} {hoje.pomodoros === 1 ? 'pomodoro' : 'pomodoros'}
          </span>
        </div>
      </section>

      <div className={s.dupla}>
        {/* ---------- timer ---------- */}
        <section className={s.card}>
          <div className={s.modos}>
            {(['foco', 'curta', 'longa'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`${s.modo} ${t.modo === m ? s.ativo : ''}`}
                onClick={() => t.definirModo(m)}
              >
                {m === 'foco' ? 'Foco' : m === 'curta' ? 'Pausa curta' : 'Pausa longa'}
              </button>
            ))}
          </div>

          <div className={s.relogio}>{fmtRelogio(t.restanteMs)}</div>

          <div className={s.subRelogio}>
            {t.modo !== 'foco' ? (
              <>
                Pausa — este tempo <b>não</b> conta na meta
              </>
            ) : f.tarefaAtiva ? (
              <>
                Trabalhando em <b>{f.tarefaAtiva.nome}</b>{' '}
                <span className={`${s.etiqueta} ${s[f.tipoAtual]}`}>{f.tipoAtual}</span>
              </>
            ) : (
              <>
                Sem tarefa ativa — vai contar como{' '}
                <span className={`${s.etiqueta} ${s[f.tipoAtual]}`}>{f.tipoAtual}</span>
              </>
            )}
          </div>

          <div className={s.controles}>
            <button type="button" className={s.principal} onClick={comecar}>
              {t.rodando ? 'Pausar' : t.novo ? 'Começar' : 'Continuar'}
            </button>
            <button type="button" className={s.secundario} onClick={t.reiniciar}>
              Reiniciar
            </button>
            <button type="button" className={s.secundario} onClick={t.pular}>
              Pular →
            </button>
          </div>

          <div className={s.pontos}>
            {Array.from({ length: config.longaCada }, (_, i) => (
              <span key={i} className={`${s.ponto} ${i < t.ciclo ? s.aceso : ''}`} />
            ))}
            <span style={{ marginLeft: 8 }}>até a pausa longa</span>
          </div>
        </section>

        {/* ---------- tarefas ---------- */}
        <section className={s.card}>
          <h2 className={s.titulo}>Tarefas de hoje</h2>

          <div className={s.adicionar}>
            <input
              type="text"
              maxLength={120}
              placeholder="No que você vai trabalhar?"
              value={novaTarefa}
              onChange={(e) => setNovaTarefa(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  f.adicionarTarefa(novaTarefa, tipoNovo)
                  setNovaTarefa('')
                }
              }}
            />
            <select value={tipoNovo} onChange={(e) => setTipoNovo(e.target.value as TipoTarefa)}>
              <option value="estudo">estudo</option>
              <option value="trabalho">trabalho</option>
            </select>
            <button
              type="button"
              title="Adicionar"
              onClick={() => {
                f.adicionarTarefa(novaTarefa, tipoNovo)
                setNovaTarefa('')
              }}
            >
              +
            </button>
          </div>

          {f.tarefas.length === 0 ? (
            <div className={s.vazio}>
              Nenhuma tarefa ainda.
              <br />
              Adicione o que quer fazer hoje e clique no nome pra deixar ativa.
            </div>
          ) : (
            <ul className={s.lista}>
              {f.tarefas.map((tar) => (
                <li
                  key={tar.id}
                  className={[
                    s.tarefa,
                    tar.feita ? s.feita : '',
                    tar.id === f.tarefaAtivaId ? s.ativa : '',
                    tar.herdada && !tar.feita ? s.herdada : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    className={s.marcar}
                    title="Concluir"
                    onClick={() => f.alternarFeita(tar.id)}
                  >
                    {tar.feita ? '✓' : ''}
                  </button>
                  <span
                    className={s.nome}
                    title="Clique pra marcar como tarefa ativa"
                    onClick={() => f.ativarTarefa(tar.id)}
                  >
                    {tar.nome}
                  </span>
                  <button
                    type="button"
                    className={`${s.etiqueta} ${s[tar.tipo]}`}
                    title="Trocar entre trabalho e estudo"
                    onClick={() => f.alternarTipo(tar.id)}
                  >
                    {tar.tipo}
                  </button>
                  <span className={s.pomos}>{tar.pomodoros} 🍅</span>
                  <button
                    type="button"
                    className={s.remover}
                    title="Remover"
                    onClick={() => f.removerTarefa(tar.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- anotações ---------- */}
      <section className={s.card}>
        <h2 className={s.titulo}>Anotações de hoje</h2>
        <textarea
          className={s.nota}
          rows={3}
          placeholder="O que você estudou, onde travou, o que fazer amanhã..."
          value={hoje.nota}
          onChange={(e) => {
            f.mudarNota(e.target.value)
            setStatusNota('salvando...')
            if (timerNota.current) clearTimeout(timerNota.current)
            timerNota.current = setTimeout(() => setStatusNota('salvo automaticamente'), 900)
          }}
        />
        <div className={s.notaRodape}>{statusNota}</div>
      </section>

      {/* ---------- histórico ---------- */}
      <section className={s.card}>
        <h2 className={s.titulo}>Últimos 14 dias</h2>

        <div className={s.numeros}>
          <div className={s.numero}>
            <div className={s.v}>{fmtHM(est.semana)}</div>
            <div className={s.k}>esta semana</div>
            {est.semana > 0 && (
              <div className={s.split}>
                {fmtHM(est.semanaTrabalho)} trabalho · {fmtHM(est.semanaEstudo)} estudo
              </div>
            )}
          </div>
          <div className={s.numero}>
            <div className={s.v}>{fmtHM(est.media)}</div>
            <div className={s.k}>média por dia ativo</div>
          </div>
          <div className={s.numero}>
            <div className={s.v}>{est.sequencia}</div>
            <div className={s.k}>dias seguidos na meta</div>
          </div>
        </div>

        <div className={s.grafico}>
          {est.dias.map((d) => {
            const altura = Math.max(2, (d.seg / maxGrafico) * ALTURA_BARRA)
            const pctTrabalho = d.seg ? (d.segTrabalho / d.seg) * 100 : 0
            return (
              <div
                key={d.chave}
                className={[
                  s.coluna,
                  d.seg >= est.metaSeg && d.seg > 0 ? s.bateu : '',
                  d.chave === chaveHoje ? s.hoje : '',
                ].join(' ')}
                title={`${dataCurta(d.data)}: ${fmtHM(d.segTrabalho)} trabalho, ${fmtHM(d.segEstudo)} estudo`}
              >
                <span className={s.pilha}>
                  {d.seg >= 60 && <span className={s.valor}>{fmtHM(d.seg)}</span>}
                  <span className={s.barraDia} style={{ height: `${altura.toFixed(1)}px` }}>
                    <i className={s.trabalho} style={{ height: `${pctTrabalho.toFixed(1)}%` }} />
                    <i className={s.estudo} style={{ height: `${(100 - pctTrabalho).toFixed(1)}%` }} />
                  </span>
                </span>
                <span className={`${s.rotulo} ${d.nota ? s.comNota : ''}`}>{dataCurta(d.data)}</span>
              </div>
            )
          })}
          <div
            className={s.linhaMeta}
            style={{ bottom: `${(ALTURA_ROTULO + (est.metaSeg / maxGrafico) * ALTURA_BARRA).toFixed(1)}px` }}
          />
        </div>

        <div className={s.notaGrafico}>
          <i /> linha da meta ({fmtHM(est.metaSeg)})
          <span className={`${s.chip} ${s.trabalho}`}>trabalho</span>
          <span className={`${s.chip} ${s.estudo}`}>estudo</span>
        </div>
      </section>
    </div>
  )
}
