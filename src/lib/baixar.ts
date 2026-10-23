/* =========================================================
   baixar — entrega um arquivo pronto ao navegador

   Não dá pra escrever em disco direto: a única forma é criar um
   link temporário para um Blob e clicar nele. O endereço criado
   fica ocupando memória até alguém soltar, daí o revoke no fim.
   ========================================================= */

export function baixar(nome: string, conteudo: string, tipo: string) {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()

  // o Safari precisa do link ainda vivo no instante do clique;
  // soltar na volta do laço de eventos é o que funciona em todos
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
