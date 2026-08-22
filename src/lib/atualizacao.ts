
import { registerSW } from 'virtual:pwa-register'

const UMA_HORA = 60 * 60 * 1000

export function ligarAtualizacaoAutomatica() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registro) {
      if (!registro) return

      const conferir = () => {
        if (navigator.onLine === false) return
        registro.update().catch(() => {})
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') conferir()
      })
      window.addEventListener('online', conferir)
      window.setInterval(conferir, UMA_HORA)
    },
  })
}
