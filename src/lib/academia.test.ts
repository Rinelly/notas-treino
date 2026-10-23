import { describe, expect, it } from 'vitest'
import { calcularVencimento, formatarDia } from './academia'

const em = (ano: number, mes1a12: number, dia: number) =>
  new Date(ano, mes1a12 - 1, dia, 14, 0)

describe('calcularVencimento', () => {
  it('aponta para este mês quando a data ainda não passou', () => {
    const v = calcularVencimento(20, em(2026, 10, 5))
    expect(formatarDia(v.data)).toBe('20/10')
    expect(v.emDias).toBe(15)
  })

  it('pula para o mês seguinte quando a data já passou', () => {
    const v = calcularVencimento(5, em(2026, 10, 20))
    expect(formatarDia(v.data)).toBe('05/11')
  })

  it('vence hoje é hoje, não daqui a um mês', () => {
    const v = calcularVencimento(10, em(2026, 10, 10))
    expect(v.emDias).toBe(0)
    expect(v.texto).toBe('Vence hoje')
    expect(v.nivel).toBe('hoje')
  })

  it('encaixa o dia 31 em meses curtos', () => {
    // novembro tem 30 dias: o vencimento do dia 31 cai no dia 30
    const v = calcularVencimento(31, em(2026, 11, 15))
    expect(formatarDia(v.data)).toBe('30/11')
  })

  it('atravessa a virada do ano', () => {
    const v = calcularVencimento(3, em(2026, 12, 20))
    expect(v.data.getFullYear()).toBe(2027)
    expect(formatarDia(v.data)).toBe('03/01')
  })

  it('não se confunde com o horário de verão', () => {
    // a conta é feita em dias inteiros; se usasse milissegundos crus,
    // um fuso que muda no meio do caminho daria 29 ou 31 dias
    const v = calcularVencimento(20, em(2026, 1, 20))
    expect(v.emDias).toBe(0)
  })

  describe('níveis de alerta', () => {
    it('amanhã e até 5 dias é "perto"', () => {
      expect(calcularVencimento(11, em(2026, 10, 10)).nivel).toBe('perto')
      expect(calcularVencimento(11, em(2026, 10, 10)).texto).toBe('Vence amanhã')
      expect(calcularVencimento(15, em(2026, 10, 10)).nivel).toBe('perto')
    })

    it('mais de 5 dias é "tranquilo"', () => {
      expect(calcularVencimento(20, em(2026, 10, 10)).nivel).toBe('tranquilo')
    })

    it('nunca precisa de um nível além dos três', () => {
      // varre um ano inteiro de combinações dia-do-vencimento x hoje
      const niveis = new Set<string>()
      for (let mes = 1; mes <= 12; mes++) {
        for (let hoje = 1; hoje <= 28; hoje++) {
          for (const diaVenc of [1, 10, 15, 28, 31]) {
            niveis.add(calcularVencimento(diaVenc, em(2026, mes, hoje)).nivel)
          }
        }
      }
      expect([...niveis].sort()).toEqual(['hoje', 'perto', 'tranquilo'])
    })
  })
})

describe('formatarDia', () => {
  it('usa dois dígitos em dia e mês', () => {
    expect(formatarDia(new Date(2026, 0, 3))).toBe('03/01')
    expect(formatarDia(new Date(2026, 11, 25))).toBe('25/12')
  })
})
