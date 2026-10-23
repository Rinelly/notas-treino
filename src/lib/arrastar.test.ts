import { describe, expect, it } from 'vitest'
import { indiceAlvo, saiuDoLugar, type Faixa } from './arrastar'

/** cinco linhas de 60px, coladas, começando em 100 */
const FAIXAS: Faixa[] = Array.from({ length: 5 }, (_, i) => ({
  topo: 100 + i * 60,
  base: 160 + i * 60,
}))

describe('indiceAlvo', () => {
  it('acha a linha sob o dedo', () => {
    expect(indiceAlvo(FAIXAS, 130, 0)).toBe(0)
    expect(indiceAlvo(FAIXAS, 250, 0)).toBe(2)
    expect(indiceAlvo(FAIXAS, 410, 0)).toBe(4)
  })

  it('acima do topo manda pro começo, abaixo do fim manda pro fim', () => {
    // é isso ou o item escapar da mão ao chegar na borda da tela
    expect(indiceAlvo(FAIXAS, 0, 3)).toBe(0)
    expect(indiceAlvo(FAIXAS, 9999, 1)).toBe(4)
  })

  it('a borda exata pertence à linha', () => {
    expect(indiceAlvo(FAIXAS, 100, 2)).toBe(0)
    expect(indiceAlvo(FAIXAS, 160, 2)).toBe(0)
  })

  it('no vão entre duas linhas, fica com a de cima', () => {
    // listas com espaço entre os cartões têm esses buracos
    const comVao: Faixa[] = [
      { topo: 0, base: 50 },
      { topo: 60, base: 110 },
    ]
    expect(indiceAlvo(comVao, 55, 1)).toBe(0)
  })

  it('lista vazia não mexe em nada', () => {
    expect(indiceAlvo([], 300, 2)).toBe(2)
  })

  it('linhas de alturas diferentes (uma aberta) continuam certas', () => {
    const abertaNoMeio: Faixa[] = [
      { topo: 0, base: 60 },
      { topo: 60, base: 300 },
      { topo: 300, base: 360 },
    ]
    expect(indiceAlvo(abertaNoMeio, 200, 0)).toBe(1)
    expect(indiceAlvo(abertaNoMeio, 320, 0)).toBe(2)
  })
})

describe('saiuDoLugar', () => {
  it('tremida de dedo não conta', () => {
    expect(saiuDoLugar(2, 3)).toBe(false)
    expect(saiuDoLugar(0, 0)).toBe(false)
  })

  it('rolagem conta, pra qualquer lado', () => {
    expect(saiuDoLugar(0, 20)).toBe(true)
    expect(saiuDoLugar(0, -20)).toBe(true)
    expect(saiuDoLugar(-20, 0)).toBe(true)
  })

  it('dá pra afrouxar ou apertar a tolerância', () => {
    expect(saiuDoLugar(10, 0, 20)).toBe(false)
    expect(saiuDoLugar(3, 0, 2)).toBe(true)
  })
})
