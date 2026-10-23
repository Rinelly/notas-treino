/* =========================================================
   arrastar — a conta de "em cima de qual linha está o dedo"

   Separado do hook porque é aritmética pura e é onde o arrasto
   erra: fora da lista, entre duas linhas, ou numa linha que mudou
   de altura porque abriu.
   ========================================================= */

export interface Faixa {
  topo: number
  base: number
}

/**
 * Qual linha está sob o ponto `y`.
 *
 * Fora da lista não cancela o arrasto: puxar para cima do topo é
 * "quero que vá pro começo", e para baixo do fim, "pro fim". Era
 * isso ou o item escapar da mão ao chegar na borda da tela.
 *
 * `atual` é a posição de onde ele saiu; se as faixas estiverem
 * vazias, nada muda.
 */
export function indiceAlvo(faixas: Faixa[], y: number, atual: number): number {
  if (faixas.length === 0) return atual

  if (y < faixas[0].topo) return 0
  if (y > faixas[faixas.length - 1].base) return faixas.length - 1

  for (let i = 0; i < faixas.length; i++) {
    if (y >= faixas[i].topo && y <= faixas[i].base) return i
  }

  // caiu no vão entre duas linhas: fica com a de cima
  for (let i = faixas.length - 1; i >= 0; i--) {
    if (y > faixas[i].base) return i
  }
  return atual
}

/** o dedo saiu do lugar o bastante pra isso ser rolagem, não toque parado */
export function saiuDoLugar(dx: number, dy: number, tolerancia = 8): boolean {
  return Math.abs(dx) > tolerancia || Math.abs(dy) > tolerancia
}
