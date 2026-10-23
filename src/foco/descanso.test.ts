import { describe, expect, it } from 'vitest'
import {
  acabou,
  ACRESCIMO_MS,
  fmtDescanso,
  fmtPreset,
  progresso,
  restante,
  segundosDoTexto,
} from './descanso'

const AGORA = 1_700_000_000_000

describe('fmtDescanso', () => {
  it('mostra sempre m:ss', () => {
    expect(fmtDescanso(45_000)).toBe('0:45')
    expect(fmtDescanso(90_000)).toBe('1:30')
    expect(fmtDescanso(180_000)).toBe('3:00')
    expect(fmtDescanso(0)).toBe('0:00')
  })

  it('arredonda para cima: 59,2s ainda é 1:00', () => {
    // arredondar para baixo faria o relógio pular de 1:00 pra 0:59
    // no primeiro décimo de segundo
    expect(fmtDescanso(59_200)).toBe('1:00')
  })

  it('tempo negativo vira zero', () => {
    expect(fmtDescanso(-5000)).toBe('0:00')
  })
})

describe('fmtPreset', () => {
  it('abaixo de um minuto, em segundos', () => {
    expect(fmtPreset(45)).toBe('45s')
  })

  it('minutos redondos, sem o zero', () => {
    expect(fmtPreset(60)).toBe('1min')
    expect(fmtPreset(180)).toBe('3min')
  })

  it('minuto quebrado mostra o resto', () => {
    expect(fmtPreset(90)).toBe('1min30')
  })
})

describe('restante — a conta que sobrevive à tela apagada', () => {
  it('sem descanso rolando, é zero', () => {
    expect(restante(null, AGORA)).toBe(0)
  })

  it('devolve a diferença até o alvo', () => {
    expect(restante(AGORA + 90_000, AGORA)).toBe(90_000)
  })

  it('nunca fica negativo depois do prazo', () => {
    expect(restante(AGORA - 10_000, AGORA)).toBe(0)
  })

  it('acerta mesmo que a aba fique congelada o descanso inteiro', () => {
    // guardamos o alvo ao iniciar; o celular foi pro bolso por 2 minutos
    const alvo = AGORA + 90_000
    const aoVoltar = AGORA + 120_000
    expect(restante(alvo, aoVoltar)).toBe(0)
    expect(acabou(alvo, aoVoltar)).toBe(true)
  })

  it('metade do caminho é metade do tempo, sem depender de tique nenhum', () => {
    const alvo = AGORA + 90_000
    expect(restante(alvo, AGORA + 45_000)).toBe(45_000)
  })
})

describe('acabou', () => {
  it('é falso enquanto falta tempo', () => {
    expect(acabou(AGORA + 1, AGORA)).toBe(false)
  })

  it('é verdade no instante exato', () => {
    expect(acabou(AGORA, AGORA)).toBe(true)
  })

  it('sem descanso rolando, nunca acabou', () => {
    expect(acabou(null, AGORA)).toBe(false)
  })
})

describe('progresso', () => {
  it('começa em zero e termina em um', () => {
    const alvo = AGORA + 90_000
    expect(progresso(alvo, 90_000, AGORA)).toBe(0)
    expect(progresso(alvo, 90_000, AGORA + 90_000)).toBe(1)
  })

  it('na metade, meio', () => {
    const alvo = AGORA + 90_000
    expect(progresso(alvo, 90_000, AGORA + 45_000)).toBeCloseTo(0.5)
  })

  it('não passa de um mesmo muito depois do prazo', () => {
    expect(progresso(AGORA - 60_000, 90_000, AGORA)).toBe(1)
  })

  it('sem descanso, zero', () => {
    expect(progresso(null, 90_000, AGORA)).toBe(0)
  })
})

describe('+30s', () => {
  it('empurra o alvo meio minuto pra frente', () => {
    const alvo = AGORA + 10_000
    const novo = alvo + ACRESCIMO_MS
    expect(restante(novo, AGORA)).toBe(40_000)
  })

  it('funciona até depois do descanso ter acabado', () => {
    // apertou +30s quando já estava em 0:00
    const alvo = AGORA
    const novo = Math.max(alvo, AGORA) + ACRESCIMO_MS
    expect(restante(novo, AGORA)).toBe(30_000)
  })

  it('a barrinha volta pra trás em vez de ficar cheia', () => {
    // o hook guarda início e alvo; a duração é a diferença entre eles,
    // então esticar o alvo esticou a barra toda — não some o progresso
    const inicio = AGORA
    const alvo = AGORA + 90_000
    const agora = AGORA + 80_000

    expect(progresso(alvo, alvo - inicio, agora)).toBeCloseTo(80 / 90)

    const esticado = Math.max(alvo, agora) + ACRESCIMO_MS
    expect(progresso(esticado, esticado - inicio, agora)).toBeCloseTo(80 / 120)
  })
})

describe('segundosDoTexto — o descanso escrito na rotina', () => {
  it('minutos viram segundos', () => {
    expect(segundosDoTexto('2 min')).toBe(120)
    expect(segundosDoTexto('10 minutos')).toBe(600)
  })

  it('segundos passam direto', () => {
    expect(segundosDoTexto('60 s')).toBe(60)
    expect(segundosDoTexto('90s')).toBe(90)
  })

  it('faixa usa o menor: melhor zerar cedo e apertar +30s', () => {
    expect(segundosDoTexto('2–3 min')).toBe(120) // travessão
    expect(segundosDoTexto('2-3 min')).toBe(120) // hífen
    expect(segundosDoTexto('60–90 s')).toBe(60)
    expect(segundosDoTexto('90–120 s')).toBe(90)
    expect(segundosDoTexto('10–15 minutos')).toBe(600)
  })

  it('aceita vírgula decimal', () => {
    expect(segundosDoTexto('1,5 min')).toBe(90)
  })

  it('sem texto ou sem número, não inventa descanso', () => {
    expect(segundosDoTexto('')).toBeNull()
    expect(segundosDoTexto(undefined)).toBeNull()
    expect(segundosDoTexto(null)).toBeNull()
    expect(segundosDoTexto('à vontade')).toBeNull()
    expect(segundosDoTexto('0 s')).toBeNull()
  })

  it('não deixa um erro de digitação virar uma hora de descanso', () => {
    expect(segundosDoTexto('999 min')).toBe(3600)
  })
})
