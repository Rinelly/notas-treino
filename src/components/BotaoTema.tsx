import { useEffect, useState } from 'react'
import { aplicarTema, lerTema, proximoTema, rotuloTema, temaEfetivo, type Tema } from '../lib/tema'
import s from './BotaoTema.module.scss'

/** sol quando está claro, lua quando está escuro */
function Icone({ escuro }: { escuro: boolean }) {
  return escuro ? (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1" />
        <path d="M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5" />
      </g>
    </svg>
  )
}

export default function BotaoTema() {
  const [tema, setTema] = useState<Tema>(() => lerTema())

  // o sistema pode trocar sozinho ao anoitecer; se estamos seguindo
  // ele, o ícone tem que acompanhar
  const [, forcar] = useState(0)
  useEffect(() => {
    if (tema !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const aoTrocar = () => forcar((n) => n + 1)
    mq.addEventListener('change', aoTrocar)
    return () => mq.removeEventListener('change', aoTrocar)
  }, [tema])

  function trocar() {
    const novo = proximoTema(tema)
    aplicarTema(novo)
    setTema(novo)
  }

  const escuro = temaEfetivo(tema) === 'escuro'

  return (
    <button
      type="button"
      className={s.botao}
      onClick={trocar}
      title={rotuloTema[tema]}
      aria-label={rotuloTema[tema]}
    >
      <Icone escuro={escuro} />
      {tema === 'sistema' && <span className={s.ponto} aria-hidden="true" />}
    </button>
  )
}
