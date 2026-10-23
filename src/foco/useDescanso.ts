/* =========================================================
   useDescanso — o cronômetro entre séries

   Guarda só DOIS horários: quando começou e quando acaba. O tique
   de 200ms existe para redesenhar o número, não para contar: se a
   aba congelar com o celular no bolso, a conta continua certa na
   volta, porque é sempre `alvo - agora`.

   Os dois horários moram no mesmo estado de propósito. Antes eram
   separados, e o "+30s" precisava mexer nos dois ao mesmo tempo —
   uma função de atualização chamando outra, o que o React pode
   executar duas vezes e somaria 60s em vez de 30s.
   ========================================================= */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apitar, liberarSom, vibrar } from '../lib/som'
import { ACRESCIMO_MS, acabou, DESCANSO_PADRAO, progresso, restante } from './descanso'

const CHAVE = 'treino.descanso.segundos'

type Corrida = { inicio: number; alvo: number }

function lerPreferencia(): number {
  try {
    const n = Number(localStorage.getItem(CHAVE))
    return Number.isFinite(n) && n > 0 ? n : DESCANSO_PADRAO
  } catch {
    return DESCANSO_PADRAO
  }
}

export function useDescanso() {
  const [segundos, setSegundosState] = useState(lerPreferencia)
  const [corrida, setCorrida] = useState<Corrida | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  const avisadoRef = useRef(false)

  const rodando = corrida != null
  const alvo = corrida?.alvo ?? null
  const duracaoMs = corrida ? corrida.alvo - corrida.inicio : 0
  const falta = restante(alvo, agora)

  /** toca, vibra e notifica — uma vez só por descanso */
  const avisar = useCallback(() => {
    if (avisadoRef.current) return
    avisadoRef.current = true
    apitar(true)
    vibrar()
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Descanso', { body: 'Hora da próxima série' })
      }
    } catch {
      /* notificação é opcional */
    }
  }, [])

  // só redesenha; quem manda na conta são os horários
  useEffect(() => {
    if (!rodando) return
    const id = setInterval(() => setAgora(Date.now()), 200)
    return () => clearInterval(id)
  }, [rodando])

  // chegou a zero
  useEffect(() => {
    if (rodando && acabou(alvo, agora)) avisar()
  }, [rodando, alvo, agora, avisar])

  // voltou do bolso: acerta o número na hora, sem esperar o tique
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') setAgora(Date.now())
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])

  const comecar = useCallback(
    (segs?: number) => {
      const duracao = (segs ?? segundos) * 1000
      liberarSom() // vem de um toque: é a hora de acordar o áudio
      avisadoRef.current = false
      const inicio = Date.now()
      setAgora(inicio)
      setCorrida({ inicio, alvo: inicio + duracao })
    },
    [segundos],
  )

  const parar = useCallback(() => {
    setCorrida(null)
    avisadoRef.current = false
  }, [])

  const mais30 = useCallback(() => {
    avisadoRef.current = false
    // se já zerou, os 30s contam a partir de agora
    setCorrida((c) =>
      c ? { inicio: c.inicio, alvo: Math.max(c.alvo, Date.now()) + ACRESCIMO_MS } : c,
    )
  }, [])

  const setSegundos = useCallback((n: number) => {
    setSegundosState(n)
    try {
      localStorage.setItem(CHAVE, String(n))
    } catch {
      /* modo privado: vale só nesta sessão */
    }
  }, [])

  return {
    segundos,
    setSegundos,
    rodando,
    falta,
    duracaoMs,
    progresso: progresso(alvo, duracaoMs, agora),
    terminou: rodando && falta === 0,
    comecar,
    parar,
    mais30,
  }
}
