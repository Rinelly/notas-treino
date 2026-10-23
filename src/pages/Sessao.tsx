/* =========================================================
   Sessao — a tela do treino

   Não existe mais "modo de edição": tudo é editável o tempo todo,
   e cada campo grava quando você clica fora. O que protege contra
   edição sem querer é a linha fechada — ela não tem campo nenhum,
   só o nome e as séries. Um toque abre o exercício; é lá dentro
   que ficam o play do descanso, os campos e o apagar.

   Segurar o dedo na linha pega o exercício para arrastar. O toque
   longo é de propósito: toque curto abre, toque longo move, e o
   arrasto só começa se o dedo ficou parado — senão seria rolagem.
   ========================================================= */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BarraDescanso from '../components/BarraDescanso'
import { segundosDoTexto } from '../foco/descanso'
import { useDescanso } from '../foco/useDescanso'
import { vibrar } from '../lib/som'
import { indiceAlvo, saiuDoLugar, type Faixa } from '../lib/arrastar'
import { partesDoNome } from '../lib/nomeTreino'
import { moverExercicio } from '../db/exercicios'
import {
  adicionarExercicio,
  atualizarExercicio,
  execucoesDaSessao,
  finalizarSessao,
  getRotina,
  getSessao,
  marcasDaRotina,
  removerExercicio,
  renomearRotina,
  salvarOrdemExercicios,
  upsertExecucao,
} from '../db/queries'
import type { Marca } from '../db/ultimasMarcas'
import type {
  CategoriaExercicio,
  Execucao,
  ExercicioRotina,
  Rotina,
  Sessao as SessaoType,
} from '../types'
import styles from './Sessao.module.scss'

const rotuloCategoria: Record<CategoriaExercicio, string> = {
  aquecimento: 'Aquecimento',
  treino: 'Treino',
  cardio: 'Cardio',
}

/** quanto tempo o dedo precisa ficar parado pra virar arrasto */
const ESPERA_ARRASTO = 450

/** junta o apelido e a ênfase de volta num nome só */
function montarNome(curto: string, detalhe: string) {
  const c = curto.trim()
  const d = detalhe.trim()
  if (!d) return c
  return `${c} — ${d}`
}

export default function Sessao() {
  const { sessaoId } = useParams()
  const id = Number(sessaoId)

  const [sessao, setSessao] = useState<SessaoType | null>(null)
  const [rotina, setRotina] = useState<Rotina | null>(null)
  const [execucoes, setExecucoes] = useState<Map<string, Execucao>>(new Map())
  const [ultimasMarcas, setUltimasMarcas] = useState<Map<string, Marca>>(new Map())
  const [aberto, setAberto] = useState<string | null>(null)
  const [confirmandoApagar, setConfirmandoApagar] = useState<string | null>(null)
  const [erroGravacao, setErroGravacao] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)

  const descanso = useDescanso()

  const linhasRef = useRef(new Map<string, HTMLLIElement>())
  /* o clique chega depois do soltar; sem esta marca, terminar um
     arrasto em cima do resumo abriria o exercício sem querer */
  const acabouDeArrastar = useRef(false)
  const gesto = useRef<{
    x: number
    y: number
    indice: number
    timer: number | null
    moveu: boolean
    ponteiro: number
    elemento: HTMLLIElement
  } | null>(null)

  useEffect(() => {
    void carregar()
  }, [id])

  async function carregar() {
    const s = await getSessao(id)
    if (!s) return
    setSessao(s)

    const r = await getRotina(s.rotinaId)
    if (!r) return
    setRotina(r)

    const execs = await execucoesDaSessao(id)
    setExecucoes(new Map(execs.map((e) => [e.exercicioId, e])))

    setUltimasMarcas(await marcasDaRotina(s.rotinaId, s.id))
  }

  function avisarErro(e: unknown) {
    setErroGravacao(e instanceof Error ? e.message : String(e))
  }

  /* ---------------- marcar e medir ---------------- */

  async function toggleConcluido(exercicioId: string) {
    if (!sessao) return
    const atual = execucoes.get(exercicioId)
    const concluido = !atual?.concluido

    setErroGravacao(null)
    setExecucoes((prev) =>
      new Map(prev).set(exercicioId, {
        ...atual,
        sessaoId: sessao.id!,
        exercicioId,
        concluido,
      }),
    )

    try {
      await upsertExecucao(sessao.id!, exercicioId, { concluido })
    } catch (e) {
      avisarErro(e)
      setExecucoes((prev) => {
        const m = new Map(prev)
        if (atual) m.set(exercicioId, atual)
        else m.delete(exercicioId)
        return m
      })
    }
  }

  async function definirCarga(exercicioId: string, texto: string) {
    if (!sessao) return
    const valor = texto.trim() === '' ? undefined : Number(texto.replace(',', '.'))
    if (valor != null && !Number.isFinite(valor)) return

    setErroGravacao(null)
    try {
      await upsertExecucao(sessao.id!, exercicioId, { carga: valor })
    } catch (e) {
      avisarErro(e)
      return
    }
    setExecucoes((prev) => {
      const atual = prev.get(exercicioId)
      return new Map(prev).set(exercicioId, {
        concluido: atual?.concluido ?? false,
        sessaoId: sessao.id!,
        exercicioId,
        carga: valor,
      })
    })
  }

  /* ---------------- editar o exercício ---------------- */

  function editarLocal(exercicioId: string, campo: keyof ExercicioRotina, valor: string) {
    setRotina((prev) =>
      prev
        ? {
            ...prev,
            exercicios: prev.exercicios.map((ex) =>
              ex.id === exercicioId ? { ...ex, [campo]: valor } : ex,
            ),
          }
        : prev,
    )
  }

  async function salvarCampo(
    exercicioId: string,
    campo: 'nome' | 'seriesAlvo' | 'descanso' | 'observacao',
    valor: string,
  ) {
    if (!rotina?.id) return
    setErroGravacao(null)
    try {
      await atualizarExercicio(rotina.id, exercicioId, { [campo]: valor.trim() })
    } catch (e) {
      avisarErro(e)
    }
  }

  async function mudarCategoria(exercicioId: string, categoria: CategoriaExercicio) {
    if (!rotina?.id) return
    editarLocal(exercicioId, 'categoria', categoria)
    try {
      await atualizarExercicio(rotina.id, exercicioId, { categoria })
    } catch (e) {
      avisarErro(e)
    }
  }

  async function apagar(exercicioId: string) {
    if (!rotina?.id) return
    const antes = rotina.exercicios
    setRotina((prev) =>
      prev ? { ...prev, exercicios: prev.exercicios.filter((e) => e.id !== exercicioId) } : prev,
    )
    setAberto(null)
    setConfirmandoApagar(null)
    try {
      await removerExercicio(rotina.id, exercicioId)
    } catch (e) {
      avisarErro(e)
      setRotina((prev) => (prev ? { ...prev, exercicios: antes } : prev))
    }
  }

  async function adicionar(categoria: CategoriaExercicio) {
    if (!rotina?.id) return
    setErroGravacao(null)
    try {
      const criado = await adicionarExercicio(rotina.id, {
        nome: 'Novo exercício',
        categoria,
        seriesAlvo: '3 × 10',
      })
      if (!criado) return
      // relê pra lista ficar na mesma ordem que o banco gravou
      const r = await getRotina(rotina.id)
      if (r) setRotina(r)
      setAberto(criado.id)
    } catch (e) {
      avisarErro(e)
    }
  }

  /* ---------------- o nome do treino ---------------- */

  const [nomeLocal, setNomeLocal] = useState<{ curto: string; detalhe: string } | null>(null)
  const partes = nomeLocal ?? partesDoNome(rotina?.nome)

  async function salvarNome(curto: string, detalhe: string) {
    if (!rotina?.id) return
    const nome = montarNome(curto, detalhe)
    if (!nome || nome === rotina.nome) {
      setNomeLocal(null)
      return
    }
    setRotina((prev) => (prev ? { ...prev, nome } : prev))
    setNomeLocal(null)
    try {
      await renomearRotina(rotina.id, nome)
    } catch (e) {
      avisarErro(e)
    }
  }

  /* ---------------- arrastar ---------------- */

  const limparGesto = useCallback(() => {
    if (gesto.current?.timer != null) window.clearTimeout(gesto.current.timer)
    gesto.current = null
  }, [])

  /* Enquanto arrasta, a rolagem da página tem que parar. Mudar o
     `touch-action` agora não adianta — o navegador já decidiu o que
     fazer com este toque. O jeito que funciona é segurar o
     `touchmove` num ouvinte não-passivo. */
  useEffect(() => {
    if (!arrastando) return
    const segurar = (e: TouchEvent) => e.preventDefault()
    document.addEventListener('touchmove', segurar, { passive: false })
    return () => document.removeEventListener('touchmove', segurar)
  }, [arrastando])

  function aoApertar(e: React.PointerEvent<HTMLLIElement>, indice: number) {
    // toque novo: a marca do arrasto anterior já cumpriu o papel dela
    acabouDeArrastar.current = false

    // botão direito, ou toque que já nasceu num campo de texto, passa direto
    if (e.button !== 0) return
    const alvo = e.target as HTMLElement
    // campos e os controles marcados não pegam o exercício; o resumo
    // sim, que é onde o dedo naturalmente encosta
    if (alvo.closest('input, textarea, select, [data-nao-arrasta]')) return

    const inicio = {
      x: e.clientX,
      y: e.clientY,
      indice,
      timer: null as number | null,
      moveu: false,
      ponteiro: e.pointerId,
      elemento: e.currentTarget,
    }
    inicio.timer = window.setTimeout(() => {
      if (gesto.current?.moveu) return
      const ex = rotina?.exercicios[indice]
      if (!ex) return
      vibrar(30)
      // a captura só agora: feita no apertar, o navegador entrega o
      // clique ao <li> em vez de ao botão, e o toque curto parava de
      // abrir o exercício
      try {
        inicio.elemento.setPointerCapture(inicio.ponteiro)
      } catch {
        /* o ponteiro já foi embora */
      }
      setArrastando(ex.id)
      setAberto(null)
    }, ESPERA_ARRASTO)
    gesto.current = inicio
  }

  function aoMover(e: React.PointerEvent<HTMLLIElement>) {
    const g = gesto.current
    if (!g) return

    if (!arrastando) {
      // ainda esperando o toque longo: qualquer deslize é rolagem
      if (saiuDoLugar(e.clientX - g.x, e.clientY - g.y)) {
        g.moveu = true
        limparGesto()
      }
      return
    }

    if (!rotina) return
    const faixas: Faixa[] = []
    for (const ex of rotina.exercicios) {
      const el = linhasRef.current.get(ex.id)
      if (!el) return
      const r = el.getBoundingClientRect()
      faixas.push({ topo: r.top, base: r.bottom })
    }

    const atual = rotina.exercicios.findIndex((ex) => ex.id === arrastando)
    const destino = indiceAlvo(faixas, e.clientY, atual)
    if (destino === atual) return

    setRotina((prev) =>
      prev ? { ...prev, exercicios: moverExercicio(prev.exercicios, atual, destino) } : prev,
    )
  }

  async function aoSoltar() {
    const estava = arrastando
    const g = gesto.current
    if (g) {
      try {
        g.elemento.releasePointerCapture(g.ponteiro)
      } catch {
        /* nunca chegou a capturar */
      }
    }
    limparGesto()
    setArrastando(null)
    if (!estava || !rotina?.id) return
    acabouDeArrastar.current = true
    try {
      await salvarOrdemExercicios(rotina.id, rotina.exercicios)
    } catch (e) {
      avisarErro(e)
    }
  }

  /* ---------------- finalizar ---------------- */

  async function toggleFinalizar() {
    if (!sessao?.id) return
    const finalizada = !sessao.finalizada
    setErroGravacao(null)
    try {
      await finalizarSessao(sessao.id, finalizada)
    } catch (e) {
      avisarErro(e)
      return
    }
    setSessao((prev) => (prev ? { ...prev, finalizada } : prev))
  }

  if (!rotina || !sessao) return null

  const total = rotina.exercicios.length
  const feitos = [...execucoes.values()].filter((e) => e.concluido).length

  /** o "+" fica no fim de cada bloco de categoria */
  const fimDaSecao = (idx: number) =>
    idx === rotina.exercicios.length - 1 ||
    rotina.exercicios[idx + 1].categoria !== rotina.exercicios[idx].categoria

  return (
    <div className={styles.page}>
      <div className={styles.topo}>
        <Link to="/" className={styles.voltar}>
          ← Voltar
        </Link>
      </div>

      <input
        className={styles.tituloCampo}
        value={partes.curto}
        aria-label="Nome do treino"
        onChange={(e) => setNomeLocal({ curto: e.target.value, detalhe: partes.detalhe })}
        onBlur={(e) => void salvarNome(e.target.value, partes.detalhe)}
      />
      <input
        className={styles.subtituloCampo}
        value={partes.detalhe}
        placeholder="ênfase do treino"
        aria-label="Ênfase do treino"
        onChange={(e) => setNomeLocal({ curto: partes.curto, detalhe: e.target.value })}
        onBlur={(e) => void salvarNome(partes.curto, e.target.value)}
      />

      <div className={styles.progresso}>
        {feitos}/{total} concluídos
      </div>

      {erroGravacao && (
        <div className={styles.erroGravacao}>
          <b>Não consegui salvar.</b> {erroGravacao}
        </div>
      )}

      <ul className={styles.lista}>
        {rotina.exercicios.map((ex, idx) => {
          const anterior = rotina.exercicios[idx - 1]
          const mostrarCategoria = !anterior || anterior.categoria !== ex.categoria

          const execucao = execucoes.get(ex.id)
          const concluido = execucao?.concluido ?? false
          const ultima = ultimasMarcas.get(ex.id)
          const estaAberto = aberto === ex.id
          const segundos = segundosDoTexto(ex.descanso)

          const classes = [styles.item]
          if (concluido) classes.push(styles.concluido)
          if (estaAberto) classes.push(styles.itemAberto)
          if (arrastando === ex.id) classes.push(styles.itemArrastando)

          return (
            <Fragment key={ex.id}>
              {mostrarCategoria && (
                <li className={styles.categoria}>{rotuloCategoria[ex.categoria]}</li>
              )}

              <li
                className={classes.join(' ')}
                ref={(el) => {
                  if (el) linhasRef.current.set(ex.id, el)
                  else linhasRef.current.delete(ex.id)
                }}
                onPointerDown={(e) => aoApertar(e, idx)}
                onPointerMove={aoMover}
                onPointerUp={() => void aoSoltar()}
                onPointerCancel={() => void aoSoltar()}
              >
                <div className={styles.linha}>
                  <button
                    type="button"
                    className={styles.check}
                    data-nao-arrasta=""
                    onClick={() => void toggleConcluido(ex.id)}
                    aria-label={concluido ? 'Marcar como não feito' : 'Marcar como feito'}
                  >
                    {concluido ? '✓' : ''}
                  </button>

                  <button
                    type="button"
                    className={styles.resumo}
                    aria-expanded={estaAberto}
                    onClick={() => {
                      if (arrastando) return
                      if (acabouDeArrastar.current) {
                        acabouDeArrastar.current = false
                        return
                      }
                      setConfirmandoApagar(null)
                      setAberto((a) => (a === ex.id ? null : ex.id))
                    }}
                  >
                    <span className={styles.nome}>{ex.nome}</span>
                    <span className={styles.meta}>
                      {ex.seriesAlvo}
                      {ex.descanso ? ` · ${ex.descanso}` : ''}
                      {ex.observacao ? ` · ${ex.observacao}` : ''}
                    </span>
                  </button>

                  {execucao?.carga != null && (
                    <span className={styles.cargaSelo}>{execucao.carga} kg</span>
                  )}
                  <span className={styles.seta} aria-hidden="true">
                    {estaAberto ? '⌃' : '⌄'}
                  </span>
                </div>

                {estaAberto && (
                  <div className={styles.painel} data-nao-arrasta="">
                    <div className={styles.painelTopo}>
                      <button
                        type="button"
                        className={styles.play}
                        onClick={() => descanso.comecar(segundos ?? undefined)}
                      >
                        ▶ Descansar{ex.descanso ? ` ${ex.descanso}` : ''}
                      </button>

                      {ex.categoria === 'treino' && (
                        <label className={styles.campoCarga}>
                          <span>Carga</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={ultima?.carga != null ? `${ultima.carga}` : 'kg'}
                            defaultValue={execucao?.carga ?? ''}
                            onBlur={(e) => void definirCarga(ex.id, e.target.value)}
                          />
                        </label>
                      )}
                    </div>

                    <label className={styles.campo}>
                      <span>Exercício</span>
                      <input
                        type="text"
                        value={ex.nome}
                        onChange={(e) => editarLocal(ex.id, 'nome', e.target.value)}
                        onBlur={(e) => void salvarCampo(ex.id, 'nome', e.target.value)}
                      />
                    </label>

                    <div className={styles.campoLinha}>
                      <label className={styles.campo}>
                        <span>Séries × reps</span>
                        <input
                          type="text"
                          value={ex.seriesAlvo}
                          placeholder="3 × 10"
                          onChange={(e) => editarLocal(ex.id, 'seriesAlvo', e.target.value)}
                          onBlur={(e) => void salvarCampo(ex.id, 'seriesAlvo', e.target.value)}
                        />
                      </label>
                      <label className={styles.campo}>
                        <span>Descanso</span>
                        <input
                          type="text"
                          value={ex.descanso ?? ''}
                          placeholder="90 s"
                          onChange={(e) => editarLocal(ex.id, 'descanso', e.target.value)}
                          onBlur={(e) => void salvarCampo(ex.id, 'descanso', e.target.value)}
                        />
                      </label>
                    </div>

                    <div className={styles.campoLinha}>
                      <label className={styles.campo}>
                        <span>Observação</span>
                        <input
                          type="text"
                          value={ex.observacao ?? ''}
                          placeholder="dropset, bi-set..."
                          onChange={(e) => editarLocal(ex.id, 'observacao', e.target.value)}
                          onBlur={(e) => void salvarCampo(ex.id, 'observacao', e.target.value)}
                        />
                      </label>
                      <label className={styles.campo}>
                        <span>Seção</span>
                        <select
                          value={ex.categoria}
                          onChange={(e) =>
                            void mudarCategoria(ex.id, e.target.value as CategoriaExercicio)
                          }
                        >
                          <option value="aquecimento">Aquecimento</option>
                          <option value="treino">Treino</option>
                          <option value="cardio">Cardio</option>
                        </select>
                      </label>
                    </div>

                    <div className={styles.painelRodape}>
                      <span className={styles.dicaArrasto}>
                        Segure o exercício para mudar de lugar.
                      </span>
                      {confirmandoApagar === ex.id ? (
                        <span className={styles.confirmar}>
                          <button
                            type="button"
                            className={styles.apagarMesmo}
                            onClick={() => void apagar(ex.id)}
                          >
                            Apagar mesmo
                          </button>
                          <button
                            type="button"
                            className={styles.cancelar}
                            onClick={() => setConfirmandoApagar(null)}
                          >
                            cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.apagar}
                          onClick={() => setConfirmandoApagar(ex.id)}
                        >
                          Apagar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>

              {fimDaSecao(idx) && (
                <li className={styles.linhaAdicionar}>
                  <button
                    type="button"
                    className={styles.adicionar}
                    onClick={() => void adicionar(ex.categoria)}
                  >
                    + Adicionar em {rotuloCategoria[ex.categoria].toLowerCase()}
                  </button>
                </li>
              )}
            </Fragment>
          )
        })}

        {total === 0 && (
          <li className={styles.linhaAdicionar}>
            <button
              type="button"
              className={styles.adicionar}
              onClick={() => void adicionar('treino')}
            >
              + Adicionar exercício
            </button>
          </li>
        )}
      </ul>

      {!sessao.finalizada && <BarraDescanso d={descanso} />}

      <button
        type="button"
        className={
          sessao.finalizada ? `${styles.finalizarBtn} ${styles.finalizado}` : styles.finalizarBtn
        }
        onClick={() => void toggleFinalizar()}
      >
        {sessao.finalizada ? '✓ Treino concluído' : 'Finalizar treino'}
      </button>
    </div>
  )
}
