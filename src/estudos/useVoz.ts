import { useCallback, useEffect, useRef, useState } from 'react'

// Tipagem mínima da Web Speech API (nem todo navegador expõe os tipos)
interface EventoDeResultado {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}
interface Reconhecedor {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: EventoDeResultado) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void
  stop: () => void
}
type CriaReconhecedor = new () => Reconhecedor

function acharReconhecedor(): CriaReconhecedor | undefined {
  const w = window as unknown as Record<string, CriaReconhecedor | undefined>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const ERROS_DO_MICROFONE: Record<string, string> = {
  'not-allowed': 'o navegador bloqueou o microfone. Libere o acesso nas permissões do site.',
  'service-not-allowed': 'o navegador bloqueou o reconhecimento de voz.',
  'audio-capture': 'nenhum microfone encontrado.',
  network: 'o reconhecimento de voz precisa de internet.',
}

/** Fala -> texto, em inglês. Funciona melhor no Chrome e no Edge. */
export function useEscuta(aoTerminar: (texto: string) => void) {
  const [ouvindo, setOuvindo] = useState(false)
  const [parcial, setParcial] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const recRef = useRef<Reconhecedor | null>(null)
  const finalRef = useRef('')

  const aoTerminarRef = useRef(aoTerminar)
  useEffect(() => {
    aoTerminarRef.current = aoTerminar
  }, [aoTerminar])

  const suportado = Boolean(acharReconhecedor())

  const comecar = useCallback(() => {
    const Cria = acharReconhecedor()
    if (!Cria) return
    const rec = new Cria()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = true
    finalRef.current = ''
    setErro(null)

    rec.onresult = (e) => {
      let provisorio = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalRef.current += r[0].transcript + ' '
        else provisorio += r[0].transcript
      }
      setParcial((finalRef.current + provisorio).trim())
    }
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      setErro(ERROS_DO_MICROFONE[e.error] ?? e.error)
    }
    rec.onend = () => {
      setOuvindo(false)
      setParcial('')
      const texto = finalRef.current.trim()
      if (texto) aoTerminarRef.current(texto)
    }

    recRef.current = rec
    try {
      rec.start()
      setOuvindo(true)
    } catch {
      setErro('não consegui ligar o microfone.')
    }
  }, [])

  /** para de ouvir e entrega o que foi falado */
  const parar = useCallback(() => recRef.current?.stop(), [])

  /** para de ouvir e joga fora o que foi falado */
  const cancelar = useCallback(() => {
    finalRef.current = ''
    recRef.current?.stop()
  }, [])

  useEffect(
    () => () => {
      finalRef.current = ''
      recRef.current?.stop()
    },
    [],
  )

  return { suportado, ouvindo, parcial, erro, comecar, parar, cancelar }
}

/** Texto -> fala, com uma voz em inglês. */
export function useFala() {
  const [voz, setVoz] = useState<SpeechSynthesisVoice | null>(null)
  const suportado = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    if (!suportado) return
    const escolher = () => {
      const vozes = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
      setVoz(
        vozes.find((v) => v.lang === 'en-US' && /natural|google|samantha/i.test(v.name)) ??
          vozes.find((v) => v.lang === 'en-US') ??
          vozes[0] ??
          null,
      )
    }
    escolher()
    speechSynthesis.addEventListener('voiceschanged', escolher)
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', escolher)
      speechSynthesis.cancel()
    }
  }, [suportado])

  const falar = useCallback(
    (texto: string, velocidade = 0.95) => {
      if (!suportado) return
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(texto)
      u.lang = 'en-US'
      u.rate = velocidade
      if (voz) u.voice = voz
      speechSynthesis.speak(u)
    },
    [suportado, voz],
  )

  const calar = useCallback(() => {
    if (suportado) speechSynthesis.cancel()
  }, [suportado])

  return { suportado, falar, calar }
}
