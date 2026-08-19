import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrCriarSessaoHoje, getRotinas, hoje, ultimaSessaoComProgresso } from '../db/queries'
import type { Rotina, Sessao } from '../types'
import FrequencyCalendar from '../components/FrequencyCalendar'
import styles from './Home.module.scss'

const ordemDias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const diasPorIndiceJs = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function diaDeHoje() {
  return diasPorIndiceJs[new Date().getDay()]
}

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
  const [ultimoTreino, setUltimoTreino] = useState<UltimoTreino | null>(null)

  useEffect(() => {
    getRotinas().then((rs) => {
      rs.sort((a, b) => ordemDias.indexOf(a.diaSemana) - ordemDias.indexOf(b.diaSemana))
      setRotinas(rs)
    })
    ultimaSessaoComProgresso().then(setUltimoTreino)
  }, [])

  async function abrirRotina(rotinaId: number) {
    const sessao = await getOrCriarSessaoHoje(rotinaId)
    navigate(`/sessao/${sessao.id}`)
  }

  const hojeSemana = diaDeHoje()

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
              className={
                rotina.diaSemana === hojeSemana ? `${styles.item} ${styles.hoje}` : styles.item
              }
            >
              <div className={styles.itemDia}>{rotina.diaSemana}</div>
              <div className={styles.itemNome}>{rotina.nome}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
