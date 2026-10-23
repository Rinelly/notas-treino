import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import BotaoTema from './BotaoTema'
import s from './Nav.module.scss'

const abas = [
  { para: '/', rotulo: 'Hoje' },
  { para: '/foco', rotulo: 'Foco' },
  { para: '/treinos', rotulo: 'Treinos' },
  { para: '/medidas', rotulo: 'Medidas' },
]

export default function Nav() {
  const { sair } = useAuth()

  return (
    /* a faixa vai de ponta a ponta (fundo e borda inferior), mas o
       conteúdo dela anda no mesmo trilho das páginas — senão o
       "Rinelly" desalinha da borda dos cartões */
    <nav className={s.barra}>
      <div className={s.interno}>
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
      </div>
    </nav>
  )
}
