import { describe, expect, it } from 'vitest'
import { BOM, celula, nomeArquivo, num, paraCSV, type Coluna } from './csv'

describe('celula', () => {
  it('texto simples sai sem enfeite', () => {
    expect(celula('Agachamento')).toBe('Agachamento')
    expect(celula(42)).toBe('42')
  })

  it('vazio e nulo viram célula vazia, não "null"', () => {
    expect(celula(null)).toBe('')
    expect(celula(undefined)).toBe('')
    expect(celula('')).toBe('')
  })

  it('booleano vira palavra, que é o que se lê numa planilha', () => {
    expect(celula(true)).toBe('sim')
    expect(celula(false)).toBe('não')
  })

  it('põe aspas quando o texto tem o separador', () => {
    expect(celula('peito; ombro')).toBe('"peito; ombro"')
    // com vírgula como separador, o ponto e vírgula deixa de ser problema
    expect(celula('peito; ombro', ',')).toBe('peito; ombro')
  })

  it('aspas dentro do texto são dobradas', () => {
    expect(celula('o "leve" de hoje')).toBe('"o ""leve"" de hoje"')
  })

  it('quebra de linha fica dentro de aspas e não vira linha nova', () => {
    const saida = celula('primeira\nsegunda')
    expect(saida).toBe('"primeira\nsegunda"')
    expect(saida.startsWith('"')).toBe(true)
  })
})

describe('num', () => {
  it('usa vírgula decimal, que é o que o Excel em português espera', () => {
    expect(num(47.5)).toBe('47,5')
    expect(num(12)).toBe('12,0')
  })

  it('aceita outro número de casas', () => {
    expect(num(47.456, 2)).toBe('47,46')
    expect(num(47.4, 0)).toBe('47')
  })

  it('sem número, célula vazia — nada de NaN na planilha', () => {
    expect(num(null)).toBe('')
    expect(num(undefined)).toBe('')
    expect(num(Number.NaN)).toBe('')
  })
})

describe('paraCSV', () => {
  interface Linha {
    data: string
    nome: string
    carga: number | null
  }

  const colunas: Coluna<Linha>[] = [
    { cabecalho: 'Data', valor: (l) => l.data },
    { cabecalho: 'Exercício', valor: (l) => l.nome },
    { cabecalho: 'Carga (kg)', valor: (l) => num(l.carga) },
  ]

  const linhas: Linha[] = [
    { data: '2026-10-20', nome: 'Agachamento', carga: 47.5 },
    { data: '2026-10-20', nome: 'Leg Press; unilateral', carga: null },
  ]

  it('começa com BOM, senão o Excel estraga os acentos', () => {
    expect(paraCSV(linhas, colunas).startsWith(BOM)).toBe(true)
  })

  it('primeira linha é o cabeçalho', () => {
    const l = paraCSV(linhas, colunas).slice(BOM.length).split('\r\n')
    expect(l[0]).toBe('Data;Exercício;Carga (kg)')
  })

  it('uma linha por registro, com as células escapadas', () => {
    const l = paraCSV(linhas, colunas).slice(BOM.length).split('\r\n')
    expect(l[1]).toBe('2026-10-20;Agachamento;47,5')
    expect(l[2]).toBe('2026-10-20;"Leg Press; unilateral";')
  })

  it('termina em quebra de linha e não deixa linha fantasma', () => {
    const texto = paraCSV(linhas, colunas)
    expect(texto.endsWith('\r\n')).toBe(true)
    expect(texto.slice(BOM.length).split('\r\n').filter(Boolean)).toHaveLength(3)
  })

  it('sem registro nenhum, sai só o cabeçalho', () => {
    const texto = paraCSV([], colunas)
    expect(texto.slice(BOM.length).split('\r\n').filter(Boolean)).toEqual([
      'Data;Exercício;Carga (kg)',
    ])
  })

  it('dá pra pedir vírgula quando o destino não é o Excel', () => {
    const l = paraCSV([linhas[0]], colunas, ',').slice(BOM.length).split('\r\n')
    expect(l[0]).toBe('Data,Exercício,Carga (kg)')
  })
})

describe('nomeArquivo', () => {
  it('carimba a data no nome, pra não sobrescrever o anterior', () => {
    expect(nomeArquivo('foco', 'csv', '2026-10-23')).toBe('foco-2026-10-23.csv')
    expect(nomeArquivo('backup', 'json', '2026-10-23')).toBe('backup-2026-10-23.json')
  })
})
