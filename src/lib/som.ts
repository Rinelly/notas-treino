/* =========================================================
   som — o apito do app

   Estava dentro do useTimer, mas agora o descanso entre séries
   também precisa apitar. Um AudioContext só, criado na primeira
   vez que alguém toca num botão: navegador não deixa criar antes
   de um gesto do usuário.
   ========================================================= */

let ctx: AudioContext | null = null

function contexto(): AudioContext | null {
  if (ctx) return ctx
  const C =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!C) return null
  try {
    ctx = new C()
  } catch {
    return null
  }
  return ctx
}

/**
 * Acorda o áudio. Precisa ser chamado dentro de um clique — no
 * iPhone o contexto nasce suspenso e só um gesto o libera.
 */
export function liberarSom() {
  const c = contexto()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}

/**
 * Três bipes curtos. `agudo` distingue "acabou o foco" de
 * "acabou a pausa" sem precisar olhar a tela.
 */
export function apitar(agudo: boolean, ligado = true) {
  if (!ligado) return
  const c = contexto()
  if (!c) return

  try {
    for (const atraso of [0, 0.22, 0.44]) {
      const osc = c.createOscillator()
      const ganho = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = agudo ? 880 : 660
      ganho.gain.setValueAtTime(0.0001, c.currentTime + atraso)
      ganho.gain.exponentialRampToValueAtTime(0.22, c.currentTime + atraso + 0.02)
      ganho.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + atraso + 0.18)
      osc.connect(ganho)
      ganho.connect(c.destination)
      osc.start(c.currentTime + atraso)
      osc.stop(c.currentTime + atraso + 0.2)
    }
  } catch {
    /* som é enfeite: nunca pode derrubar o cronômetro */
  }
}

/** vibração curta — chega no bolso, que é onde o celular está na academia */
export function vibrar(padrao: number | number[] = [120, 80, 120]) {
  try {
    navigator.vibrate?.(padrao)
  } catch {
    /* navegador sem vibração */
  }
}
