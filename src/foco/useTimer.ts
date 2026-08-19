/* =========================================================
   useTimer — o motor do pomodoro

   Regra central: SÓ o tempo em modo "foco" conta na meta.
   Pausa não conta. E parar no meio de um pomodoro não
   descarta os minutos já rodados.

   A contagem usa o relógio do sistema (deltas de Date.now),
   não o número de ticks — então continua correta se a aba
   ficar em segundo plano e o navegador segurar os timers.
   ========================================================= */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Config } from './tipos'

export type Modo = 'foco' | 'curta' | 'longa'

interface Ganchos {
  /** chamado a cada segundo inteiro de FOCO acumulado */
  aoAcumular: (segundos: number) => void
  /** chamado quando um bloco termina */
  aoConcluir: (eraFoco: boolean) => void
}

export function useTimer(config: Config, ganchos: Ganchos) {
  const [modo, setModoState] = useState<Modo>('foco')
  const [rodando, setRodando] = useState(false)
  const [restanteMs, setRestanteMs] = useState(config.focoMin * 60_000)
  const [ciclo, setCiclo] = useState(0)

  // refs pra o loop não depender de closures antigas
  const modoRef = useRef(modo)
  const rodandoRef = useRef(false)
  const restanteRef = useRef(restanteMs)
  const cicloRef = useRef(0)
  const sobraRef = useRef(0) // milissegundos abaixo de 1 segundo
  const ultimoRef = useRef(0)
  const configRef = useRef(config)
  const ganchosRef = useRef(ganchos)

  useEffect(() => {
    configRef.current = config
  }, [config])
  useEffect(() => {
    ganchosRef.current = ganchos
  }, [ganchos])

  const duracaoMs = useCallback((m: Modo) => {
    const c = configRef.current
    const min = m === 'foco' ? c.focoMin : m === 'curta' ? c.curtaMin : c.longaMin
    return min * 60_000
  }, [])

  /* a duração que está valendo agora, pra saber se o bloco foi tocado */
  const duracaoAplicadaRef = useRef(config.focoMin * 60_000)

  const definirModo = useCallback(
    (m: Modo) => {
      modoRef.current = m
      rodandoRef.current = false
      sobraRef.current = 0
      restanteRef.current = duracaoMs(m)
      duracaoAplicadaRef.current = restanteRef.current
      setModoState(m)
      setRodando(false)
      setRestanteMs(restanteRef.current)
    },
    [duracaoMs],
  )

  /* ----------------------------------------------------------
     A configuração chega do banco depois da primeira renderização
     (o app começa com os valores padrão). Quando ela chegar, ajusta
     a duração do bloco atual — mas só se ele estiver intocado, pra
     não zerar um pomodoro que já estava em andamento.
     ---------------------------------------------------------- */
  useEffect(() => {
    const nova = duracaoMs(modoRef.current)
    const intocado = !rodandoRef.current && restanteRef.current === duracaoAplicadaRef.current
    duracaoAplicadaRef.current = nova
    if (!intocado) return
    restanteRef.current = nova
    setRestanteMs(nova)
  }, [config.focoMin, config.curtaMin, config.longaMin, duracaoMs])

  /* ---------- áudio ---------- */
  const ctxRef = useRef<AudioContext | null>(null)
  const contexto = useCallback(() => {
    if (!ctxRef.current) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!C) return null
      ctxRef.current = new C()
    }
    return ctxRef.current
  }, [])

  const liberarAudio = useCallback(() => {
    const c = contexto()
    if (c && c.state === 'suspended') void c.resume().catch(() => {})
  }, [contexto])

  const apitar = useCallback(
    (agudo: boolean) => {
      if (!configRef.current.som) return
      const c = contexto()
      if (!c) return
      try {
        for (const off of [0, 0.22, 0.44]) {
          const o = c.createOscillator()
          const g = c.createGain()
          o.type = 'sine'
          o.frequency.value = agudo ? 880 : 660
          g.gain.setValueAtTime(0.0001, c.currentTime + off)
          g.gain.exponentialRampToValueAtTime(0.22, c.currentTime + off + 0.02)
          g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + off + 0.18)
          o.connect(g)
          g.connect(c.destination)
          o.start(c.currentTime + off)
          o.stop(c.currentTime + off + 0.2)
        }
      } catch {
        /* som é enfeite: nunca deve quebrar o timer */
      }
    },
    [contexto],
  )

  /* ---------- laço principal ---------- */
  useEffect(() => {
    const id = setInterval(() => {
      if (!rodandoRef.current) return

      const agora = Date.now()
      let dt = agora - ultimoRef.current
      ultimoRef.current = agora

      // aba dormindo, notebook fechado ou relógio ajustado
      if (dt < 0) dt = 0
      if (dt > 60_000) dt = 60_000

      restanteRef.current -= dt

      if (modoRef.current === 'foco') {
        sobraRef.current += dt
        if (sobraRef.current >= 1000) {
          const segs = Math.floor(sobraRef.current / 1000)
          sobraRef.current -= segs * 1000
          ganchosRef.current.aoAcumular(segs)
        }
      }

      if (restanteRef.current <= 0) {
        const eraFoco = modoRef.current === 'foco'
        rodandoRef.current = false
        restanteRef.current = 0
        setRodando(false)

        apitar(eraFoco)
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Foco', {
              body: eraFoco ? 'Pomodoro concluído — hora da pausa' : 'Pausa terminada — bora voltar',
            })
          }
        } catch {
          /* notificação é opcional */
        }

        ganchosRef.current.aoConcluir(eraFoco)

        if (eraFoco) {
          const proximo = cicloRef.current + 1
          const vaiPraLonga = proximo >= configRef.current.longaCada
          cicloRef.current = vaiPraLonga ? 0 : proximo
          setCiclo(cicloRef.current)
          definirModo(vaiPraLonga ? 'longa' : 'curta')
        } else {
          definirModo('foco')
        }
        return
      }

      setRestanteMs(restanteRef.current)
    }, 250)

    return () => clearInterval(id)
  }, [apitar, definirModo])

  /* ---------- ações ---------- */
  const alternar = useCallback(() => {
    if (rodandoRef.current) {
      rodandoRef.current = false
      setRodando(false)
      return
    }
    if (restanteRef.current <= 0) restanteRef.current = duracaoMs(modoRef.current)
    ultimoRef.current = Date.now()
    rodandoRef.current = true
    setRodando(true)
    liberarAudio()
  }, [duracaoMs, liberarAudio])

  const reiniciar = useCallback(() => {
    rodandoRef.current = false
    sobraRef.current = 0
    restanteRef.current = duracaoMs(modoRef.current)
    duracaoAplicadaRef.current = restanteRef.current
    setRodando(false)
    setRestanteMs(restanteRef.current)
  }, [duracaoMs])

  const pular = useCallback(() => {
    if (modoRef.current === 'foco') {
      definirModo(cicloRef.current + 1 >= configRef.current.longaCada ? 'longa' : 'curta')
    } else {
      definirModo('foco')
    }
  }, [definirModo])

  const novo = restanteMs === duracaoMs(modo)

  return { modo, rodando, restanteMs, ciclo, novo, alternar, reiniciar, pular, definirModo, liberarAudio }
}
