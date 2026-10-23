import { describe, expect, it } from 'vitest'
import { avancarTimer } from './avancarTimer'

const MIN = 60_000
const BLOCO = 25 * MIN

const foco = (restanteMs: number, dtMs: number, sobraMs = 0) =>
  avancarTimer({ restanteMs, sobraMs, dtMs, ehFoco: true })

describe('andamento normal', () => {
  it('um tique de 250ms não fecha segundo nenhum', () => {
    const r = foco(BLOCO, 250)
    expect(r.segundosDeFoco).toBe(0)
    expect(r.sobraMs).toBe(250)
    expect(r.restanteMs).toBe(BLOCO - 250)
  })

  it('quatro tiques de 250ms fecham um segundo', () => {
    let sobra = 0
    let total = 0
    for (let i = 0; i < 4; i++) {
      const r = foco(BLOCO - i * 250, 250, sobra)
      sobra = r.sobraMs
      total += r.segundosDeFoco
    }
    expect(total).toBe(1)
  })

  it('não perde fração entre os passos', () => {
    // 10 passos de 1500ms = 15s, mesmo com meio segundo sobrando sempre
    let sobra = 0
    let restante = BLOCO
    let total = 0
    for (let i = 0; i < 10; i++) {
      const r = foco(restante, 1500, sobra)
      sobra = r.sobraMs
      restante = r.restanteMs
      total += r.segundosDeFoco
    }
    expect(total).toBe(15)
  })
})

describe('celular com a tela apagada — o bug que a gente veio consertar', () => {
  it('volta de 20 minutos em segundo plano creditando os 20 minutos', () => {
    const r = foco(BLOCO, 20 * MIN)
    expect(r.segundosDeFoco).toBe(20 * 60)
    expect(r.restanteMs).toBe(5 * MIN)
    expect(r.concluiu).toBe(false)
  })

  it('tela apagada o bloco inteiro: credita o bloco e conclui', () => {
    const r = foco(BLOCO, 25 * MIN)
    expect(r.segundosDeFoco).toBe(25 * 60)
    expect(r.concluiu).toBe(true)
    expect(r.restanteMs).toBe(0)
  })

  it('o teto antigo de 60s teria creditado 1 minuto em vez de 25', () => {
    const agora = foco(BLOCO, 25 * MIN).segundosDeFoco
    const antes = Math.floor(Math.min(25 * MIN, 60_000) / 1000)
    expect(antes).toBe(60)
    expect(agora).toBe(1500)
  })
})

describe('limites', () => {
  it('notebook que dormiu a noite inteira não vira oito horas de foco', () => {
    const r = foco(BLOCO, 8 * 60 * MIN)
    expect(r.segundosDeFoco).toBe(25 * 60) // no máximo o bloco
    expect(r.concluiu).toBe(true)
  })

  it('relógio andando pra trás não desconta tempo', () => {
    const r = foco(BLOCO, -5000)
    expect(r.segundosDeFoco).toBe(0)
    expect(r.restanteMs).toBe(BLOCO)
    expect(r.concluiu).toBe(false)
  })

  it('bloco que já está em zero conclui sem creditar nada', () => {
    const r = foco(0, 10 * MIN)
    expect(r.segundosDeFoco).toBe(0)
    expect(r.concluiu).toBe(true)
  })
})

describe('pausa', () => {
  it('pausa anda no relógio mas não entra na meta do dia', () => {
    const r = avancarTimer({
      restanteMs: 5 * MIN,
      sobraMs: 0,
      dtMs: 2 * MIN,
      ehFoco: false,
    })
    expect(r.segundosDeFoco).toBe(0)
    expect(r.restanteMs).toBe(3 * MIN)
  })

  it('pausa inteira em segundo plano também conclui', () => {
    const r = avancarTimer({
      restanteMs: 5 * MIN,
      sobraMs: 0,
      dtMs: 30 * MIN,
      ehFoco: false,
    })
    expect(r.concluiu).toBe(true)
    expect(r.segundosDeFoco).toBe(0)
  })
})

describe('soma de um pomodoro inteiro, passo a passo', () => {
  it('250ms de cada vez dá exatamente 25 minutos', () => {
    let restante = BLOCO
    let sobra = 0
    let total = 0
    let voltas = 0

    while (restante > 0 && voltas < 10_000) {
      const r = foco(restante, 250, sobra)
      restante = r.restanteMs
      sobra = r.sobraMs
      total += r.segundosDeFoco
      voltas++
    }

    expect(total).toBe(25 * 60)
  })
})
