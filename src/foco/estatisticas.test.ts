import { describe, expect, it } from 'vitest'
import { calcularEstatisticas } from './estatisticas'
import { diaVazio, type Dia } from './tipos'

const H = 3600
const META = 6 * H

/** série de dias terminando em `fim`, com os segundos dados em ordem */
function serie(fim: string, segundos: number[]): Dia[] {
  const [ano, mes, dia] = fim.split('-').map(Number)
  return segundos.map((seg, i) => {
    const d = new Date(ano, mes - 1, dia - (segundos.length - 1 - i))
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { ...diaVazio(chave), seg }
  })
}

// 23/10/2026 é uma sexta-feira
const SEXTA = new Date(2026, 9, 23, 15, 0)

describe('sequência na meta', () => {
  it('conta os dias seguidos que bateram a meta', () => {
    const dias = serie('2026-10-23', [0, META, META, META])
    expect(calcularEstatisticas(dias, META, SEXTA).sequencia).toBe(3)
  })

  it('o dia de hoje ainda não acabou: não bater hoje não zera a sequência', () => {
    // bateu os três dias anteriores; hoje tem só 1h até agora
    const dias = serie('2026-10-23', [META, META, META, 1 * H])
    expect(calcularEstatisticas(dias, META, SEXTA).sequencia).toBe(3)
  })

  it('mas se hoje já bateu, hoje entra na conta', () => {
    const dias = serie('2026-10-23', [META, META, META, META])
    expect(calcularEstatisticas(dias, META, SEXTA).sequencia).toBe(4)
  })

  it('um dia falhado no meio corta a sequência ali', () => {
    const dias = serie('2026-10-23', [META, META, 1 * H, META, META])
    expect(calcularEstatisticas(dias, META, SEXTA).sequencia).toBe(2)
  })

  it('sem meta definida, não existe sequência', () => {
    const dias = serie('2026-10-23', [META, META])
    expect(calcularEstatisticas(dias, 0, SEXTA).sequencia).toBe(0)
  })

  it('aguenta lista vazia', () => {
    expect(calcularEstatisticas([], META, SEXTA).sequencia).toBe(0)
  })
})

describe('semana', () => {
  it('soma da segunda até hoje, não os últimos sete dias', () => {
    // sexta: segunda a sexta são os 5 últimos da série
    const dias = serie('2026-10-23', [99 * H, 99 * H, 1 * H, 2 * H, 3 * H, 4 * H, 5 * H])
    const e = calcularEstatisticas(dias, META, SEXTA)
    expect(e.semana).toBe(15 * H) // 1+2+3+4+5
  })

  it('na segunda-feira, a semana é só o próprio dia', () => {
    const segunda = new Date(2026, 9, 19, 10, 0)
    const dias = serie('2026-10-19', [99 * H, 99 * H, 2 * H])
    expect(calcularEstatisticas(dias, META, segunda).semana).toBe(2 * H)
  })

  it('no domingo, a semana inteira entra', () => {
    const domingo = new Date(2026, 9, 25, 10, 0)
    const dias = serie('2026-10-25', [99 * H, 1 * H, 1 * H, 1 * H, 1 * H, 1 * H, 1 * H, 1 * H])
    expect(calcularEstatisticas(dias, META, domingo).semana).toBe(7 * H)
  })

  it('separa trabalho e estudo na semana', () => {
    const dias = serie('2026-10-23', [0, 0, 0, 0, 0])
    dias[4] = { ...dias[4], seg: 3 * H, segTrabalho: 2 * H, segEstudo: 1 * H }
    const e = calcularEstatisticas(dias, META, SEXTA)
    expect(e.semanaTrabalho).toBe(2 * H)
    expect(e.semanaEstudo).toBe(1 * H)
  })
})

describe('média por dia ativo', () => {
  it('ignora os dias sem nada', () => {
    const dias = serie('2026-10-23', [0, 0, 4 * H, 2 * H])
    expect(calcularEstatisticas(dias, META, SEXTA).media).toBe(3 * H)
  })

  it('um minuto ou menos não conta como dia ativo', () => {
    // sem esse corte, abrir o app sem querer derrubaria a média
    const dias = serie('2026-10-23', [30, 60, 4 * H])
    expect(calcularEstatisticas(dias, META, SEXTA).media).toBe(4 * H)
  })

  it('sem nenhum dia ativo, a média é zero e não NaN', () => {
    const dias = serie('2026-10-23', [0, 0])
    expect(calcularEstatisticas(dias, META, SEXTA).media).toBe(0)
  })
})
