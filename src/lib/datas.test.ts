import { describe, expect, it } from 'vitest'
import {
  chaveData,
  dataDaChave,
  fmtHM,
  fmtRelogio,
  hojeChave,
  ultimosDias,
} from './datas'

describe('chaveData', () => {
  it('usa a data local, não UTC', () => {
    // 1º de janeiro às 22h em Maceió (UTC-3) já é dia 2 em UTC.
    // Se isso virar "2026-01-02", a hora da noite cai no dia errado —
    // foi exatamente o bug que o app antigo tinha.
    const noite = new Date(2026, 0, 1, 22, 30)
    expect(chaveData(noite)).toBe('2026-01-01')
  })

  it('preenche mês e dia com zero à esquerda', () => {
    expect(chaveData(new Date(2026, 2, 7))).toBe('2026-03-07')
  })

  it('faz a volta completa com dataDaChave', () => {
    const d = new Date(2026, 10, 30)
    expect(chaveData(dataDaChave(chaveData(d)))).toBe('2026-11-30')
  })
})

describe('hojeChave', () => {
  it('é a chave do momento em que foi chamada', () => {
    expect(hojeChave()).toBe(chaveData(new Date()))
  })
})

describe('fmtHM', () => {
  it('formata horas e minutos', () => {
    expect(fmtHM(0)).toBe('0h00')
    expect(fmtHM(60)).toBe('0h01')
    expect(fmtHM(3600)).toBe('1h00')
    expect(fmtHM(3600 * 4 + 60 * 12)).toBe('4h12')
  })

  it('não deixa o arredondamento criar "3h60"', () => {
    // 3h59m40s arredonda os minutos pra 60: tem que virar 4h00
    expect(fmtHM(3 * 3600 + 59 * 60 + 40)).toBe('4h00')
  })

  it('trata segundo negativo como zero', () => {
    expect(fmtHM(-500)).toBe('0h00')
  })
})

describe('fmtRelogio', () => {
  it('conta o tempo do bloco em mm:ss', () => {
    expect(fmtRelogio(25 * 60_000)).toBe('25:00')
    expect(fmtRelogio(61_000)).toBe('01:01')
    expect(fmtRelogio(0)).toBe('00:00')
  })

  it('nunca mostra tempo negativo', () => {
    expect(fmtRelogio(-5000)).toBe('00:00')
  })
})

describe('ultimosDias', () => {
  it('devolve n dias terminando em hoje', () => {
    const dias = ultimosDias(14)
    expect(dias).toHaveLength(14)
    expect(dias[13].chave).toBe(hojeChave())
  })

  it('vem em ordem crescente e sem buracos', () => {
    const dias = ultimosDias(5)
    for (let i = 1; i < dias.length; i++) {
      const anterior = dataDaChave(dias[i - 1].chave)
      const atual = dataDaChave(dias[i].chave)
      const diff = (atual.getTime() - anterior.getTime()) / 86_400_000
      expect(Math.round(diff)).toBe(1)
    }
  })
})
