import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import BotaoTema from './BotaoTema'
import s from './Nav.module.scss'

const abas = [
  { para: '/', rotulo: 'Hoje' },
  { para: '/foco', rotulo: 'Foco' },
  { para: '/treinos', rotulo: 'Treinos' },
]

export default function Nav() {
  const { sair } = useAuth()

  return (
    <nav className={s.barra}>
      <span className={s.marca}>Rinelly</span>

      {abas.map((a) => (
        <NavLink
          key={a.para}
          to={a.para}
          end={a.para === '/'}
          className={({ isActive }) => `${s.link} ${isActive ? s.ativo : ''}`}
        >
          {a.rotulo}
        </NavLink>
      ))}

      <span className={s.espaco} />

      <BotaoTema />

      <button type="button" className={s.sair} onClick={() => void sair()}>
        Sair
      </button>
    </nav>
  )
}
