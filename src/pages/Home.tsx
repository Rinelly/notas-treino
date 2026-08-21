import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getOrCriarSessaoEm,
  getOrCriarSessaoHoje,
  getRotinas,
  hoje,
  proximoTreino,
  sessoesDoDia,
  ultimaSessaoComProgresso,
} from '../db/queries'
import type { Rotina, Sessao } from '../types'
import FrequencyCalendar from '../components/FrequencyCalendar'
import styles from './Home.module.scss'

function dataAmigavel(data: string) {
  if (data === hoje()) return 'Hoje'

  const ontem = new Date()
  ontem.setDate(ontem.getDate() - 1)
  if (data === ontem.toISOString().slice(0, 10)) return 'Ontem'

  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

interface UltimoTreino {
  sessao: Sessao
  rotina: Rotina
  feitos: number
  total: number
}

type DiaAberto = {
  data: string
  existentes: { sessao: Sessao; rotina: Rotina }[]
}

export default function Home() {
  const navigate = useNavigate()
  const [rotinas, setRotinas] = useState<Rotina[]>([])
  const [proximaId, setProximaId] = useState<number | null>(null)
  const [ultimoTreino, setUltimoTreino] = useState<UltimoTreino | null>(null)
  const [diaAberto, setDiaAberto] = useState<DiaAberto | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    // getRotinas já vem na ordem do rodízio, com a letra
    getRotinas().then(setRotinas)
    proximoTreino().then((p) => setProximaId(p.rotina?.id ?? null))
    ultimaSessaoComProgresso().then(setUltimoTreino)
  }, [])

  async function abrirRotina(rotinaId: number) {
    const sessao = await getOrCriarSessaoHoje(rotinaId)
    navigate(`/sessao/${sessao.id}`)
  }

  const escolherDia = useCallback(async (data: string) => {
    setErro(null)
    setOcupado(true)
    try {
      setDiaAberto({ data, existentes: await sessoesDoDia(data) })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }, [])

  /** registra (ou reabre) o treino escolhido naquele dia */
  async function registrarNoDia(rotinaId: number) {
    if (!diaAberto) return
    setOcupado(true)
    setErro(null)
    try {
      const sessao = await getOrCriarSessaoEm(rotinaId, diaAberto.data)
      navigate(`/sessao/${sessao.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setOcupado(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1>Treinos</h1>

      {ultimoTreino && (
        <button
          type="button"
          className={styles.ultimoTreino}
          onClick={() => navigate(`/sessao/${ultimoTreino.sessao.id}`)}
        >
          <span className={styles.ultimoTreinoLabel}>Último treino</span>
          <span className={styles.ultimoTreinoNome}>{ultimoTreino.rotina.nome}</span>
          <span className={styles.ultimoTreinoMeta}>
            {dataAmigavel(ultimoTreino.sessao.data)} · {ultimoTreino.feitos}/{ultimoTreino.total} concluídos
          </span>
        </button>
      )}

      <FrequencyCalendar aoEscolherDia={(d) => void escolherDia(d)} />

      {diaAberto && (
        <div className={styles.painelDia}>
          <div className={styles.painelTopo}>
            <span className={styles.painelData}>{dataAmigavel(diaAberto.data)}</span>
            <button
              type="button"
              className={styles.fechar}
              onClick={() => setDiaAberto(null)}
            >
              fechar
            </button>
          </div>

          {diaAberto.existentes.length > 0 && (
            <ul className={styles.listaDia}>
              {diaAberto.existentes.map(({ sessao, rotina }) => (
                <li key={sessao.id}>
                  <button
                    type="button"
                    className={styles.opcaoDia}
                    onClick={() => navigate(`/sessao/${sessao.id}`)}
                  >
                    Treino {rotina.letra} · {rotina.nome}
                    {sessao.finalizada && <span className={styles.seloFeito}>✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className={styles.painelDica}>
            {diaAberto.existentes.length > 0
              ? 'Registrar outro treino nesse dia:'
              : 'Nenhum treino registrado nesse dia. Qual foi?'}
          </p>

          <ul className={styles.listaDia}>
            {rotinas
              .filter((r) => !diaAberto.existentes.some((e) => e.rotina.id === r.id))
              .map((rotina) => (
                <li key={rotina.id}>
                  <button
                    type="button"
                    className={styles.opcaoDia}
                    disabled={ocupado}
                    onClick={() => void registrarNoDia(rotina.id!)}
                  >
                    Treino {rotina.letra} · {rotina.nome}
                  </button>
                </li>
              ))}
          </ul>

          {erro && <div className={styles.erro}>{erro}</div>}
        </div>
      )}

      <ul className={styles.lista}>
        {rotinas.map((rotina) => (
          <li key={rotina.id}>
            <button
              type="button"
              onClick={() => abrirRotina(rotina.id!)}
              className={rotina.id === proximaId ? `${styles.item} ${styles.hoje}` : styles.item}
            >
              <div className={styles.itemDia}>
                Treino {rotina.letra}
                {rotina.id === proximaId && <span className={styles.selo}>atual</span>}
              </div>
              <div className={styles.itemNome}>{rotina.nome}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
