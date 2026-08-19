import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getOrCriarSessaoHoje,
  getRotinas,
  hoje,
  proximoTreino,
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

export default function Home() {
  const navigate = useNavigate()
  const [rotinas, setRotinas] = useState<Rotina[]>([])
  const [proximaId, setProximaId] = useState<number | null>(null)
  const [ultimoTreino, setUltimoTreino] = useState<UltimoTreino | null>(null)

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

      <FrequencyCalendar />

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
                {rotina.id === proximaId && <span className={styles.selo}>próximo</span>}
              </div>
              <div className={styles.itemNome}>{rotina.nome}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
