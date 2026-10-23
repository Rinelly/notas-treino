/* =========================================================
   descanso — a conta do cronômetro entre séries

   Diferença importante para o pomodoro: aqui NÃO se acumula
   tique a tique. Guarda-se o HORÁRIO em que o descanso acaba, e
   o que falta é sempre `alvo - agora`.

   Isso é de propósito: na academia o celular vai pro bolso e a
   tela apaga. Contagem por tique erraria; subtração de horário
   está certa mesmo que a aba fique congelada o descanso inteiro.
   ========================================================= */

/** as opções da barra, em segundos */
export const PRESETS = [45, 60, 90, 120, 180] as const

export const DESCANSO_PADRAO = 90

/** quanto o botão "+30s" acrescenta */
export const ACRESCIMO_MS = 30_000

/** 0:45, 1:30, 3:00 — sempre m:ss */
export function fmtDescanso(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** rótulo curto dos presets: 45s, 1min, 1min30, 3min */
export function fmtPreset(segundos: number): string {
  if (segundos < 60) return `${segundos}s`
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return s === 0 ? `${m}min` : `${m}min${s}`
}

/** quanto falta, nunca negativo. `alvo` nulo = não está descansando */
export function restante(alvo: number | null, agora: number): number {
  if (alvo == null) return 0
  return Math.max(0, alvo - agora)
}

export function acabou(alvo: number | null, agora: number): boolean {
  return alvo != null && agora >= alvo
}

/** fração já cumprida, de 0 a 1 — alimenta a barrinha de progresso */
export function progresso(
  alvo: number | null,
  duracaoMs: number,
  agora: number,
): number {
  if (alvo == null || duracaoMs <= 0) return 0
  const falta = restante(alvo, agora)
  return Math.min(1, Math.max(0, 1 - falta / duracaoMs))
}

/**
 * Lê o descanso escrito na rotina ("2–3 min", "60–90 s") e devolve
 * segundos para o cronômetro.
 *
 * Quando vem uma faixa, usa o MENOR número: é melhor a barra zerar
 * cedo e você apertar "+30s" do que ela te segurar parada achando
 * que ainda falta. O texto original continua na tela, inteiro.
 */
export function segundosDoTexto(texto: string | undefined | null): number | null {
  if (!texto) return null

  // 2–3 min / 2-3 min / 60 a 90 s — o primeiro número é o que vale
  const numero = texto.match(/\d+(?:[.,]\d+)?/)
  if (!numero) return null

  const valor = Number(numero[0].replace(',', '.'))
  if (!Number.isFinite(valor) || valor <= 0) return null

  // "min" tem que ser testado antes de "m", e "s" só vale se não
  // for o "s" de "minutos"
  const emMinutos = /\bm(in|inuto)?/i.test(texto)
  const segundos = emMinutos ? valor * 60 : valor

  return Math.round(Math.min(segundos, 60 * 60))
}
