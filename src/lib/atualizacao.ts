/* =========================================================
   atualizacao.ts — manter o app sempre na versão nova

   O problema que isso resolve:
   no computador você recarrega a página o tempo todo, então o
   navegador busca o /sw.js novo e a versão nova entra sozinha.
   No celular, com o app na tela de início, a página NUNCA é
   recarregada — você só volta pra ela. Sem recarregar, ninguém
   pergunta ao servidor se saiu versão nova, e o app fica
   congelado na última que entrou.

   Aqui a gente força essa pergunta: toda vez que você volta pro
   app, quando a internet volta, e de hora em hora.

   Quando o service worker novo assume, o próprio vite-plugin-pwa
   (registerType: 'autoUpdate') recarrega a tela.
   ========================================================= */

import { registerSW } from 'virtual:pwa-register'

const UMA_HORA = 60 * 60 * 1000

export function ligarAtualizacaoAutomatica() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registro) {
      if (!registro) return

      const conferir = () => {
        // se estiver offline não adianta bater no servidor
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
