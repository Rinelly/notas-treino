import { fmtDescanso } from '../foco/descanso'
import type { useDescanso } from '../foco/useDescanso'
import s from './DescansoNoCard.module.scss'

/* =========================================================
   DescansoNoCard — o cronômetro dentro do exercício

   Mesmo cronômetro da barra de baixo, desenhado no lugar do botão
   de play: enquanto o exercício está aberto, o número fica onde a
   Rinelly já está olhando, e não no rodapé da tela.

   Quando o exercício fecha, a barra de baixo reaparece sozinha —
   o descanso não pode sumir só porque a mão encostou fora.
   ========================================================= */

export default function DescansoNoCard({
  d,
  aoParar,
}: {
  d: ReturnType<typeof useDescanso>
  aoParar: () => void
}) {
  return (
    <div className={d.terminou ? `${s.caixa} ${s.acabou}` : s.caixa}>
      <div
        className={s.progresso}
        style={{ width: `${d.progresso * 100}%` }}
        aria-hidden="true"
      />
      <span className={s.relogio}>{fmtDescanso(d.falta)}</span>
      <span className={s.estado}>{d.terminou ? 'Bora!' : 'descansando'}</span>
      <button type="button" className={s.mais} onClick={d.mais30}>
        +30s
      </button>
      <button
        type="button"
        className={s.parar}
        onClick={() => {
          d.parar()
          aoParar()
        }}
      >
        {d.terminou ? 'Pronto' : 'Pular'}
      </button>
    </div>
  )
}
