import { describe, expect, it } from 'vitest'
import { mesMini, nomeDoMes } from './mesMini'

describe('mesMini', () => {
  it('põe buracos antes do dia 1 pra primeira semana alinhar', () => {
    // 1 de outubro de 2026 é uma quinta — 4 casas em branco antes
    const { casas } = mesMini(2026, 9, new Set(), '2026-10-23')
    expect(casas.slice(0, 4).every((c) => c.dia == null)).toBe(true)
    expect(casas[4].dia).toBe(1)
    expect(casas[4].data).toBe('2026-10-01')
  })

  it('tem uma casa por dia do mês, e fevereiro bissexto tem 29', () => {
    const out = mesMini(2026, 9, new Set(), '2026-10-23')
    expect(out.casas.filter((c) => c.dia != null)).toHaveLength(31)

    const fev = mesMini(2028, 1, new Set(), '2028-02-10')
    expect(fev.casas.filter((c) => c.dia != null)).toHaveLength(29)
  })

  it('marca os dias treinados e conta quantos foram', () => {
    const feitos = new Set(['2026-10-01', '2026-10-05', '2026-10-23'])
    const { casas, quantos } = mesMini(2026, 9, feitos, '2026-10-23')
    expect(quantos).toBe(3)
    expect(casas.find((c) => c.dia === 5)?.treinado).toBe(true)
    expect(casas.find((c) => c.dia === 6)?.treinado).toBe(false)
  })

  it('ignora treino de outro mês que esteja no conjunto', () => {
    const feitos = new Set(['2026-09-30', '2026-11-01', '2026-10-02'])
    expect(mesMini(2026, 9, feitos, '2026-10-23').quantos).toBe(1)
  })

  it('separa hoje do que ainda não chegou', () => {
    const { casas } = mesMini(2026, 9, new Set(), '2026-10-23')
    const dia = (n: number) => casas.find((c) => c.dia === n)!
    expect(dia(23).hoje).toBe(true)
    expect(dia(23).futuro).toBe(false)
    expect(dia(22).futuro).toBe(false)
    expect(dia(24).futuro).toBe(true)
    expect(casas.filter((c) => c.futuro)).toHaveLength(8) // 24 a 31
  })

  it('num mês já vencido, nada é futuro', () => {
    const { casas } = mesMini(2026, 8, new Set(), '2026-10-23')
    expect(casas.some((c) => c.futuro)).toBe(false)
  })

  it('casas em branco nunca contam como dia', () => {
    const { casas } = mesMini(2026, 9, new Set(), '2026-10-23')
    for (const c of casas.filter((x) => x.dia == null)) {
      expect(c.treinado).toBe(false)
      expect(c.hoje).toBe(false)
      expect(c.futuro).toBe(false)
    }
  })
})

describe('nomeDoMes', () => {
  it('devolve o nome em português, base 0', () => {
    expect(nomeDoMes(0)).toBe('janeiro')
    expect(nomeDoMes(9)).toBe('outubro')
    expect(nomeDoMes(11)).toBe('dezembro')
  })
})
