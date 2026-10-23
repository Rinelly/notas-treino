import { fmtDescanso, fmtPreset, PRESETS } from '../foco/descanso'
import type { useDescanso } from '../foco/useDescanso'
import s from './BarraDescanso.module.scss'

/* =========================================================
   BarraDescanso — fica colada embaixo na tela do treino

   Parada: as opções de tempo, pra escolher e começar num toque.
   Rodando: o número grande, +30s e pular.

   Não segura a tela acesa de propósito — o contrário do pomodoro.
   Aqui o celular vai pro bolso, e quem avisa é o som e a vibração.

   O cronômetro vem de fora (a tela do treino é dona dele) porque
   tocar no descanso de um exercício precisa começar ESTA barra, e
   não um segundo cronômetro escondido.
   ========================================================= */

export default function BarraDescanso({
  d,
  aoComecar,
}: {
  d: ReturnType<typeof useDescanso>
  /** avisa quem começou: um descanso iniciado aqui não é de exercício nenhum */
  aoComecar?: () => void
}) {

  if (!d.rodando) {
    return (
      <div className={s.barra}>
        <span className={s.rotulo}>Descanso</span>
        <div className={s.opcoes}>
          {PRESETS.map((segs) => (
            <button
              key={segs}
              type="button"
              className={segs === d.segundos ? `${s.opcao} ${s.escolhida}` : s.opcao}
              onClick={() => {
                aoComecar?.()
                d.setSegundos(segs)
                d.comecar(segs)
              }}
            >
              {fmtPreset(segs)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={s.principal}
          onClick={() => {
            aoComecar?.()
            d.comecar()
          }}
        >
          Descansar
        </button>
      </div>
    )
  }

  return (
    <div className={`${s.barra} ${d.terminou ? s.acabou : ''}`}>
      <div
        className={s.progresso}
        style={{ width: `${d.progresso * 100}%` }}
        aria-hidden="true"
      />
      <span className={s.relogio}>{fmtDescanso(d.falta)}</span>
      <span className={s.estado}>{d.terminou ? 'Bora!' : 'descansando'}</span>
      <div className={s.acoes}>
        <button type="button" className={s.secundario} onClick={d.mais30}>
          +30s
        </button>
        <button type="button" className={s.principal} onClick={d.parar}>
          {d.terminou ? 'Pronto' : 'Pular'}
        </button>
      </div>
    </div>
  )
}
