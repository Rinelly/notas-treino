import { describe, expect, it } from 'vitest'
import {
  chaveData,
  dataDaChave,
  diasEntre,
  fmtHM,
  haQuantoTempo,
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

describe('diasEntre', () => {
  it('conta por data de calendário', () => {
    expect(diasEntre('2026-10-20', '2026-10-23')).toBe(3)
    expect(diasEntre('2026-10-23', '2026-10-23')).toBe(0)
  })

  it('atravessa mês e ano', () => {
    expect(diasEntre('2026-10-31', '2026-11-01')).toBe(1)
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('atravessa a virada do horário de verão sem errar um dia', () => {
    // compara meio-dia justamente pra hora a mais ou a menos não contar
    expect(diasEntre('2026-02-14', '2026-02-16')).toBe(2)
    expect(diasEntre('2026-10-17', '2026-10-19')).toBe(2)
  })

  it('fica negativo quando a ordem se inverte', () => {
    expect(diasEntre('2026-10-23', '2026-10-20')).toBe(-3)
  })
})

describe('haQuantoTempo', () => {
  const H = '2026-10-23'

  it('sem data nenhuma, não inventa texto', () => {
    expect(haQuantoTempo(null, H)).toBeNull()
  })

  it('os casos do dia a dia', () => {
    expect(haQuantoTempo('2026-10-23', H)).toBe('hoje')
    expect(haQuantoTempo('2026-10-22', H)).toBe('ontem')
    expect(haQuantoTempo('2026-10-20', H)).toBe('há 3 dias')
    expect(haQuantoTempo('2026-10-17', H)).toBe('há 6 dias')
    expect(haQuantoTempo('2026-10-16', H)).toBe('há 1 semana')
    expect(haQuantoTempo('2026-10-09', H)).toBe('há 2 semanas')
  })

  it('a partir de um mês, fala em meses', () => {
    expect(haQuantoTempo('2026-09-10', H)).toBe('há 1 mês')
    expect(haQuantoTempo('2026-07-01', H)).toBe('há 3 meses')
  })

  it('data no futuro vira "hoje" em vez de texto estranho', () => {
    expect(haQuantoTempo('2026-10-25', H)).toBe('hoje')
  })
})
