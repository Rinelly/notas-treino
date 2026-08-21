/* =========================================================
   tema.ts — claro, escuro ou o que o sistema mandar

   Três estados de propósito. "Sistema" não é o mesmo que
   "escuro": quem deixa o celular trocar sozinho ao anoitecer
   quer que o app troque junto, e forçar um dos dois tira isso.

   Quem escreve no <html> na abertura é o script inline do
   index.html — se esperasse o React, a tela piscaria clara
   antes de escurecer.
   ========================================================= */

export type Tema = 'sistema' | 'claro' | 'escuro'

const CHAVE = 'app.tema'

export function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE)
    return t === 'claro' || t === 'escuro' ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function aplicarTema(t: Tema) {
  const raiz = document.documentElement
  if (t === 'sistema') raiz.removeAttribute('data-tema')
  else raiz.setAttribute('data-tema', t)

  try {
    if (t === 'sistema') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, t)
  } catch {
    /* modo privado: vale só nesta sessão */
  }
}

/** o que está pintado na tela agora, já resolvendo o "sistema" */
export function temaEfetivo(t: Tema): 'claro' | 'escuro' {
  if (t !== 'sistema') return t
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

/** ciclo do botão: segue o sistema → claro → escuro → segue o sistema */
export function proximoTema(t: Tema): Tema {
  return t === 'sistema' ? 'claro' : t === 'claro' ? 'escuro' : 'sistema'
}

export const rotuloTema: Record<Tema, string> = {
  sistema: 'Tema: segue o sistema',
  claro: 'Tema: claro',
  escuro: 'Tema: escuro',
}
