import { describe, expect, it } from 'vitest'
import { msAteProximaMeiaNoite } from './useDiaAtual'

const MIN = 60_000
const HORA = 60 * MIN

describe('msAteProximaMeiaNoite', () => {
  it('à meia-noite em ponto, falta o dia inteiro', () => {
    expect(msAteProximaMeiaNoite(new Date(2026, 9, 23, 0, 0, 0))).toBe(24 * HORA)
  })

  it('às 23h falta uma hora', () => {
    expect(msAteProximaMeiaNoite(new Date(2026, 9, 23, 23, 0, 0))).toBe(HORA)
  })

  it('um minuto antes, falta um minuto', () => {
    expect(msAteProximaMeiaNoite(new Date(2026, 9, 23, 23, 59, 0))).toBe(MIN)
  })

  it('é sempre positivo — nunca agenda no passado', () => {
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 17, 59]) {
        const falta = msAteProximaMeiaNoite(new Date(2026, 9, 23, h, m, 30))
        expect(falta).toBeGreaterThan(0)
      }
    }
  })

  it('atravessa a virada do mês', () => {
    const falta = msAteProximaMeiaNoite(new Date(2026, 9, 31, 22, 0, 0))
    expect(falta).toBe(2 * HORA)
  })

  it('atravessa a virada do ano', () => {
    const falta = msAteProximaMeiaNoite(new Date(2026, 11, 31, 23, 30, 0))
    expect(falta).toBe(30 * MIN)
  })

  it('cai exatamente na meia-noite seguinte', () => {
    const agora = new Date(2026, 9, 23, 18, 42, 13, 500)
    const alvo = new Date(agora.getTime() + msAteProximaMeiaNoite(agora))
    expect(alvo.getDate()).toBe(24)
    expect(alvo.getHours()).toBe(0)
    expect(alvo.getMinutes()).toBe(0)
    expect(alvo.getSeconds()).toBe(0)
    expect(alvo.getMilliseconds()).toBe(0)
  })
})
