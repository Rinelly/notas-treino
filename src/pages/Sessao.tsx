import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db/db'
import {
  adicionarExercicio,
  atualizarExercicio,
  execucoesDaSessao,
  finalizarSessao,
  removerExercicio,
  ultimaExecucao,
  upsertExecucao,
} from '../db/queries'
import type { CategoriaExercicio, Execucao, ExercicioRotina, Rotina, Sessao as SessaoType } from '../types'
import styles from './Sessao.module.scss'

const rotuloCategoria: Record<CategoriaExercicio, string> = {
  aquecimento: 'Aquecimento',
  treino: 'Treino',
  cardio: 'Cardio',
}

interface UltimaMarca {
  carga?: number
  repsFeitas?: number
}

export default function Sessao() {
  const { sessaoId } = useParams()
  const id = Number(sessaoId)

  const [sessao, setSessao] = useState<SessaoType | null>(null)
  const [rotina, setRotina] = useState<Rotina | null>(null)
  const [execucoes, setExecucoes] = useState<Map<string, Execucao>>(new Map())
  const [ultimasMarcas, setUltimasMarcas] = useState<Map<string, UltimaMarca>>(new Map())
  const [editando, setEditando] = useState(false)

  const [novoNome, setNovoNome] = useState('')
  const [novoSeriesAlvo, setNovoSeriesAlvo] = useState('')
  const [novaCategoria, setNovaCategoria] = useState<CategoriaExercicio>('treino')

  useEffect(() => {
    carregar()
  }, [id])

  async function carregar() {
    const s = await db.sessoes.get(id)
    if (!s) return
    setSessao(s)

    const r = await db.rotinas.get(s.rotinaId)
    if (!r) return
    setRotina(r)

    const execs = await execucoesDaSessao(id)
    setExecucoes(new Map(execs.map((e) => [e.exercicioId, e])))

    const marcas = new Map<string, UltimaMarca>()
    await Promise.all(
      r.exercicios.map(async (ex) => {
        if (ex.categoria !== 'treino') return
        const ultima = await ultimaExecucao(s.rotinaId, ex.id, s.id)
        if (ultima) marcas.set(ex.id, { carga: ultima.carga, repsFeitas: ultima.repsFeitas })
      }),
    )
    setUltimasMarcas(marcas)
  }

  async function toggleConcluido(exercicioId: string) {
    if (!sessao) return
    const atual = execucoes.get(exercicioId)
    const concluido = !atual?.concluido
    await upsertExecucao(sessao.id!, exercicioId, { concluido })
    setExecucoes((prev) =>
      new Map(prev).set(exercicioId, {
        ...atual,
        sessaoId: sessao.id!,
        exercicioId,
        concluido,
      }),
    )
  }

  async function definirCampoExecucao(
    exercicioId: string,
    dados: Partial<Pick<Execucao, 'carga' | 'repsFeitas'>>,
  ) {
    if (!sessao) return
    await upsertExecucao(sessao.id!, exercicioId, dados)
    setExecucoes((prev) => {
      const atual = prev.get(exercicioId)
      return new Map(prev).set(exercicioId, {
        concluido: atual?.concluido ?? false,
        sessaoId: sessao.id!,
        exercicioId,
        carga: atual?.carga,
        repsFeitas: atual?.repsFeitas,
        ...dados,
      })
    })
  }

  function editarCampoLocal(exercicioId: string, campo: keyof ExercicioRotina, valor: string) {
    setRotina((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercicios: prev.exercicios.map((ex) =>
          ex.id === exercicioId ? { ...ex, [campo]: valor } : ex,
        ),
      }
    })
  }

  async function salvarCampo(exercicioId: string, campo: 'nome' | 'seriesAlvo' | 'observacao', valor: string) {
    if (!rotina?.id) return
    await atualizarExercicio(rotina.id, exercicioId, { [campo]: valor })
  }

  async function remover(exercicioId: string) {
    if (!rotina?.id) return
    await removerExercicio(rotina.id, exercicioId)
    setRotina((prev) =>
      prev ? { ...prev, exercicios: prev.exercicios.filter((ex) => ex.id !== exercicioId) } : prev,
    )
  }

  async function toggleFinalizar() {
    if (!sessao?.id) return
    const finalizada = !sessao.finalizada
    await finalizarSessao(sessao.id, finalizada)
    setSessao((prev) => (prev ? { ...prev, finalizada } : prev))
  }

  async function adicionar() {
    if (!rotina?.id || !novoNome.trim() || !novoSeriesAlvo.trim()) return
    const criado = await adicionarExercicio(rotina.id, {
      nome: novoNome.trim(),
      categoria: novaCategoria,
      seriesAlvo: novoSeriesAlvo.trim(),
    })
    if (criado) {
      setRotina((prev) => (prev ? { ...prev, exercicios: [...prev.exercicios, criado] } : prev))
    }
    setNovoNome('')
    setNovoSeriesAlvo('')
  }

  if (!rotina || !sessao) return null

  const total = rotina.exercicios.length
  const feitos = [...execucoes.values()].filter((e) => e.concluido).length

  return (
    <div className={styles.page}>
      <div className={styles.topo}>
        <Link to="/" className={styles.voltar}>
          ← Voltar
        </Link>
        <button type="button" className={styles.editarBtn} onClick={() => setEditando((v) => !v)}>
          {editando ? 'Concluir edição' : 'Editar'}
        </button>
      </div>
      <h1>{rotina.nome}</h1>
      <div className={styles.progresso}>
        {feitos}/{total} concluídos
      </div>

      <ul className={styles.lista}>
        {rotina.exercicios.map((ex, idx) => {
          const anterior = rotina.exercicios[idx - 1]
          const mostrarCategoria = !anterior || anterior.categoria !== ex.categoria

          const execucao = execucoes.get(ex.id)
          const concluido = execucao?.concluido ?? false
          const ultima = ultimasMarcas.get(ex.id)

          return (
            <Fragment key={ex.id}>
              {mostrarCategoria && (
                <li className={styles.categoria}>{rotuloCategoria[ex.categoria]}</li>
              )}
              <li className={concluido && !editando ? `${styles.item} ${styles.concluido}` : styles.item}>
                {editando ? (
                  <div className={styles.editRow}>
                    <div className={styles.editFields}>
                      <input
                        type="text"
                        value={ex.nome}
                        onChange={(e) => editarCampoLocal(ex.id, 'nome', e.target.value)}
                        onBlur={(e) => salvarCampo(ex.id, 'nome', e.target.value)}
                        className={styles.editNome}
                      />
                      <div className={styles.editLinha}>
                        <input
                          type="text"
                          value={ex.seriesAlvo}
                          placeholder="séries x reps"
                          onChange={(e) => editarCampoLocal(ex.id, 'seriesAlvo', e.target.value)}
                          onBlur={(e) => salvarCampo(ex.id, 'seriesAlvo', e.target.value)}
                          className={styles.editSeries}
                        />
                        <input
                          type="text"
                          value={ex.observacao ?? ''}
                          placeholder="observação"
                          onChange={(e) => editarCampoLocal(ex.id, 'observacao', e.target.value)}
                          onBlur={(e) => salvarCampo(ex.id, 'observacao', e.target.value)}
                          className={styles.editObs}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.remover}
                      onClick={() => remover(ex.id)}
                      aria-label="Remover exercício"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.check}
                      onClick={() => toggleConcluido(ex.id)}
                      aria-label={concluido ? 'Marcar como não feito' : 'Marcar como feito'}
                    >
                      {concluido ? '✓' : ''}
                    </button>
                    <div className={styles.info}>
                      <div className={styles.nome}>{ex.nome}</div>
                      <div className={styles.meta}>
                        {ex.seriesAlvo}
                        {ex.observacao ? ` · ${ex.observacao}` : ''}
                      </div>
                    </div>
                    {ex.categoria === 'treino' && (
                      <div className={styles.marcas}>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder={ultima?.repsFeitas != null ? `${ultima.repsFeitas}` : 'reps'}
                          defaultValue={execucao?.repsFeitas ?? ''}
                          onBlur={(e) => {
                            const valor = Number(e.target.value)
                            if (e.target.value && !Number.isNaN(valor)) {
                              definirCampoExecucao(ex.id, { repsFeitas: valor })
                            }
                          }}
                          className={styles.repsInput}
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder={ultima?.carga != null ? `${ultima.carga}kg` : 'kg'}
                          defaultValue={execucao?.carga ?? ''}
                          onBlur={(e) => {
                            const valor = Number(e.target.value)
                            if (e.target.value && !Number.isNaN(valor)) {
                              definirCampoExecucao(ex.id, { carga: valor })
                            }
                          }}
                          className={styles.cargaInput}
                        />
                      </div>
                    )}
                  </>
                )}
              </li>
            </Fragment>
          )
        })}
      </ul>

      {!editando && (
        <button
          type="button"
          className={sessao.finalizada ? `${styles.finalizarBtn} ${styles.finalizado}` : styles.finalizarBtn}
          onClick={toggleFinalizar}
        >
          {sessao.finalizada ? '✓ Treino concluído' : 'Finalizar treino'}
        </button>
      )}

      {editando && (
        <div className={styles.addForm}>
          <div className={styles.addLinha}>
            <select
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value as CategoriaExercicio)}
              className={styles.addCategoria}
            >
              <option value="treino">Treino</option>
              <option value="aquecimento">Aquecimento</option>
              <option value="cardio">Cardio</option>
            </select>
            <input
              type="text"
              placeholder="Nome do exercício"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className={styles.addNome}
            />
          </div>
          <div className={styles.addLinha}>
            <input
              type="text"
              placeholder="séries x reps"
              value={novoSeriesAlvo}
              onChange={(e) => setNovoSeriesAlvo(e.target.value)}
              className={styles.addSeries}
            />
            <button type="button" onClick={adicionar} className={styles.addBtn}>
              + Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
