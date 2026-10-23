import { describe, expect, it } from 'vitest'
import {
  devolver,
  PENDENTE_ZERO,
  segundosDoTipo,
  somar,
  vazio,
  type Pendente,
} from './pendente'

describe('acúmulo', () => {
  it('começa zerado', () => {
    expect(vazio(PENDENTE_ZERO)).toBe(true)
  })

  it('soma pedaço a pedaço', () => {
    let p = PENDENTE_ZERO
    p = somar(p, { seg: 10, segEstudo: 10 })
    p = somar(p, { seg: 5, segTrabalho: 5 })
    expect(p).toEqual({ seg: 15, segTrabalho: 5, segEstudo: 10, pomodoros: 0 })
  })

  it('pomodoro entra sem mexer nos segundos', () => {
    const p = somar(PENDENTE_ZERO, { pomodoros: 1 })
    expect(p.pomodoros).toBe(1)
    expect(p.seg).toBe(0)
  })

  it('não altera o objeto que recebeu', () => {
    const antes: Pendente = { ...PENDENTE_ZERO }
    somar(antes, { seg: 99 })
    expect(antes.seg).toBe(0)
  })

  it('só é vazio quando tudo é zero', () => {
    expect(vazio(somar(PENDENTE_ZERO, { pomodoros: 1 }))).toBe(false)
    expect(vazio(somar(PENDENTE_ZERO, { seg: 1 }))).toBe(false)
  })
})

describe('segundosDoTipo', () => {
  it('estudo cai no balde de estudo', () => {
    expect(segundosDoTipo(60, 'estudo')).toEqual({
      seg: 60,
      segTrabalho: 0,
      segEstudo: 60,
    })
  })

  it('trabalho cai no balde de trabalho', () => {
    expect(segundosDoTipo(60, 'trabalho')).toEqual({
      seg: 60,
      segTrabalho: 60,
      segEstudo: 0,
    })
  })

  it('a soma dos dois baldes nunca passa do total', () => {
    const t = segundosDoTipo(45, 'trabalho')
    expect((t.segTrabalho ?? 0) + (t.segEstudo ?? 0)).toBe(t.seg)
  })
})

describe('gravação que falha não perde tempo', () => {
  it('o pedaço volta pro acumulador', () => {
    // 30s acumulados, começa a gravar e zera o acumulador
    const enviando: Pendente = { seg: 30, segTrabalho: 0, segEstudo: 30, pomodoros: 0 }
    let atual = PENDENTE_ZERO

    // enquanto a gravação ia e voltava, chegaram mais 5s
    atual = somar(atual, { seg: 5, segEstudo: 5 })

    // a gravação falhou: devolve
    atual = devolver(atual, enviando)

    expect(atual.seg).toBe(35)
    expect(atual.segEstudo).toBe(35)
  })

  it('duas falhas seguidas acumulam, não sobrescrevem', () => {
    let atual = PENDENTE_ZERO
    atual = devolver(atual, { seg: 10, segTrabalho: 10, segEstudo: 0, pomodoros: 0 })
    atual = devolver(atual, { seg: 20, segTrabalho: 20, segEstudo: 0, pomodoros: 1 })
    expect(atual.seg).toBe(30)
    expect(atual.pomodoros).toBe(1)
  })
})

describe('o cenário que motivou tudo isso', () => {
  it('dois aparelhos no mesmo dia somam em vez de se apagarem', () => {
    // com totais absolutos: computador grava 7200, celular grava 3600,
    // e quem gravar por último manda. Com pedaços, o servidor soma.
    const computador: Pendente = { seg: 7200, segTrabalho: 7200, segEstudo: 0, pomodoros: 4 }
    const celular: Pendente = { seg: 3600, segTrabalho: 0, segEstudo: 3600, pomodoros: 2 }

    const noServidor = somar(somar(PENDENTE_ZERO, computador), celular)

    expect(noServidor.seg).toBe(10800) // 3 horas, não 1 nem 2
    expect(noServidor.segTrabalho).toBe(7200)
    expect(noServidor.segEstudo).toBe(3600)
    expect(noServidor.pomodoros).toBe(6)
  })
})
