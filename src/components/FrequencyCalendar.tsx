import { useEffect, useState } from 'react'
import { diasTreinadosNoMes } from '../db/queries'
import styles from './FrequencyCalendar.module.scss'

const nomesMeses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const diasSemanaAbrev = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * `aoEscolherDia` chega da tela de Treinos. Sem ela o calendário
 * continua sendo só um quadro na parede — com ela, dá pra abrir
 * (ou registrar) o treino de um dia passado, que é como se tapa
 * um buraco no histórico quando a sincronização falhou.
 */
export default function FrequencyCalendar({
  aoEscolherDia,
  recarregar = 0,
}: {
  aoEscolherDia?: (data: string) => void
  recarregar?: number
}) {
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth())
  const [comProgresso, setComProgresso] = useState<Set<string>>(new Set())
  const [finalizados, setFinalizados] = useState<Set<string>>(new Set())

  useEffect(() => {
    diasTreinadosNoMes(ano, mes).then(({ comProgresso, finalizados }) => {
      setComProgresso(comProgresso)
      setFinalizados(finalizados)
    })
  }, [ano, mes, recarregar])

  function mesAnterior() {
    if (mes === 0) {
      setMes(11)
      setAno((a) => a - 1)
    } else {
      setMes((m) => m - 1)
    }
  }

  function mesSeguinte() {
    if (mes === 11) {
      setMes(0)
      setAno((a) => a + 1)
    } else {
      setMes((m) => m + 1)
    }
  }

  const offset = new Date(ano, mes, 1).getDay()
  const totalDias = new Date(ano, mes + 1, 0).getDate()

  const celulas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ]
  while (celulas.length % 7 !== 0) celulas.push(null)

  const hojeStr = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`
  const ehMesAtual = ano === agora.getFullYear() && mes === agora.getMonth()

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <button type="button" onClick={mesAnterior} className={styles.nav} aria-label="Mês anterior">
          ‹
        </button>
        <span className={styles.titulo}>
          {nomesMeses[mes]} {ano}
        </span>
        <button type="button" onClick={mesSeguinte} className={styles.nav} aria-label="Próximo mês">
          ›
        </button>
      </div>

      <div className={styles.grid}>
        {diasSemanaAbrev.map((d, i) => (
          <div key={i} className={styles.diaSemana}>
            {d}
          </div>
        ))}
        {celulas.map((dia, i) => {
          if (dia == null) return <div key={i} className={styles.celulaVazia} />

          const dataStr = `${ano}-${pad(mes + 1)}-${pad(dia)}`
          const treinado = comProgresso.has(dataStr)
          const finalizado = finalizados.has(dataStr)
          const ehHoje = ehMesAtual && dataStr === hojeStr

          const classes = [styles.dia]
          if (treinado) classes.push(styles.treinado)
          if (ehHoje) classes.push(styles.hoje)

          // dia futuro não tem treino pra registrar
          const futuro = dataStr > hojeStr
          if (!aoEscolherDia || futuro) {
            return (
              <div key={i} className={classes.join(' ')}>
                {dia}
                {finalizado && <span className={styles.marca}>✓</span>}
              </div>
            )
          }

          classes.push(styles.clicavel)
          return (
            <button
              key={i}
              type="button"
              className={classes.join(' ')}
              onClick={() => aoEscolherDia(dataStr)}
              aria-label={`Treinos de ${dia}/${pad(mes + 1)}`}
            >
              {dia}
              {finalizado && <span className={styles.marca}>✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
