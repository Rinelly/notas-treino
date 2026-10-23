/* =========================================================
   avancarTimer — um passo do cronômetro

   Por que isso é uma função separada: o laço do cronômetro mede
   tempo REAL (diferença de Date.now()), não contagem de tiques.
   Isso está certo — mas o navegador do celular congela o
   setInterval quando a tela apaga, e quando volta chega um único
   passo com o intervalo inteiro.

   A versão antiga cortava esse passo em 60 segundos. Resultado:
   bloquear o celular durante um pomodoro de 25 minutos creditava
   1 minuto. Aqui o corte é o tempo que o bloco ainda tem — o
   bloco pode terminar de uma vez, mas nunca credita mais do que
   ele vale.
   ========================================================= */

export interface EstadoPasso {
  /** quanto falta do bloco atual, em ms */
  restanteMs: number
  /** milissegundos que ainda não fecharam um segundo cheio */
  sobraMs: number
  /** quanto tempo real passou desde o último passo */
  dtMs: number
  /** blocos de pausa não contam na meta do dia */
  ehFoco: boolean
}

export interface ResultadoPasso {
  restanteMs: number
  sobraMs: number
  /** segundos inteiros para somar no dia */
  segundosDeFoco: number
  /** o bloco acabou neste passo */
  concluiu: boolean
}

export function avancarTimer({
  restanteMs,
  sobraMs,
  dtMs,
  ehFoco,
}: EstadoPasso): ResultadoPasso {
  // relógio do sistema andou pra trás (fuso, acerto de hora)
  let dt = dtMs < 0 ? 0 : dtMs

  // nunca creditar mais do que o bloco ainda tem: é o que impede
  // uma noite de notebook dormindo virar oito horas de foco
  if (dt > restanteMs) dt = restanteMs

  let sobra = sobraMs
  let segundosDeFoco = 0
  if (ehFoco) {
    sobra += dt
    segundosDeFoco = Math.floor(sobra / 1000)
    sobra -= segundosDeFoco * 1000
  }

  const restante = restanteMs - dt
  const concluiu = restante <= 0

  return {
    restanteMs: concluiu ? 0 : restante,
    sobraMs: concluiu ? 0 : sobra,
    segundosDeFoco,
    concluiu,
  }
}
