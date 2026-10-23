/* =========================================================
   useDiaAtual — avisa quando vira o dia com o app aberto

   Sem isso, `hojeChave()` era lido uma vez na montagem e nunca
   mais: quem estuda das 23h à 1h tinha as duas horas lançadas
   no dia anterior, e o painel seguia mostrando a data de ontem.

   Dois gatilhos, porque um só não basta: o relógio para a virada
   enquanto a aba está viva, e o visibilitychange para quando o
   aparelho dormiu e o relógio não disparou.
   ========================================================= */

import { useEffect, useRef, useState } from 'react'
import { hojeChave } from './datas'

/** quanto falta até a próxima meia-noite local, em ms */
export function msAteProximaMeiaNoite(agora: Date = new Date()): number {
  const meiaNoite = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate() + 1,
    0,
    0,
    0,
    0,
  )
  return meiaNoite.getTime() - agora.getTime()
}

/**
 * Devolve a chave do dia de hoje, trocando sozinha na virada.
 * `aoVirar` roda antes da troca, para fechar o dia que acabou.
 */
export function useDiaAtual(aoVirar?: () => void): string {
  const [dia, setDia] = useState(hojeChave)
  const diaRef = useRef(dia)
  const aoVirarRef = useRef(aoVirar)

  useEffect(() => {
    diaRef.current = dia
  }, [dia])
  useEffect(() => {
    aoVirarRef.current = aoVirar
  }, [aoVirar])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const conferir = () => {
      const agora = hojeChave()
      if (agora !== diaRef.current) {
        aoVirarRef.current?.()
        diaRef.current = agora
        setDia(agora)
      }
    }

    const agendar = () => {
      // um segundo de folga: setTimeout costuma acordar um tiquinho
      // antes da hora, e aí a chave ainda seria a de ontem
      timer = setTimeout(() => {
        conferir()
        agendar()
      }, msAteProximaMeiaNoite() + 1000)
    }

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') conferir()
    }

    agendar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [])

  return dia
}
