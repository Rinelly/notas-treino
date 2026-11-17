import { describe, expect, it } from 'vitest'
import { chaveDaPalavra, lerErrosAntigos, lerPalavrasAntigas, soAsNovas } from './vocabulario'

const p = (word: string) => ({ word, meaning: 'm', example: 'e' })

describe('chaveDaPalavra', () => {
  it('ignora maiúsculas e espaço sobrando', () => {
    expect(chaveDaPalavra('  Deadline ')).toBe('deadline')
    expect(chaveDaPalavra('Look   forward  to')).toBe('look forward to')
  })
})

describe('soAsNovas', () => {
  it('tira o que já é conhecido', () => {
    expect(soAsNovas([p('Deadline'), p('thrive')], ['deadline']).map((x) => x.word)).toEqual(['thrive'])
  })

  it('tira repetição dentro da própria lista e fica com a primeira', () => {
    const r = soAsNovas([{ ...p('thrive'), meaning: 'primeira' }, p('Thrive ')], [])
    expect(r).toHaveLength(1)
    expect(r[0].meaning).toBe('primeira')
  })

  it('tira palavra vazia', () => {
    expect(soAsNovas([p('   '), p('ok')], [])).toHaveLength(1)
  })
})

describe('o que o tutor antigo deixou no navegador', () => {
  it('lê as palavras salvas', () => {
    const bruto = JSON.stringify([
      { word: 'thrive', meaning: 'prosperar', example: 'Plants thrive here.', savedAt: '2026-11-13' },
      { word: 'Thrive', meaning: 'repetida', example: '' },
      { meaning: 'sem palavra' },
      'lixo',
    ])
    expect(lerPalavrasAntigas(bruto)).toEqual([
      { word: 'thrive', meaning: 'prosperar', example: 'Plants thrive here.' },
    ])
  })

  it('lê os erros salvos e descarta os incompletos', () => {
    const bruto = JSON.stringify([
      { original: 'I have 30 years', better: 'I am 30 years old', explanation: 'idade usa to be' },
      { original: 'sem correção' },
    ])
    expect(lerErrosAntigos(bruto)).toEqual([
      { original: 'I have 30 years', better: 'I am 30 years old', explanation: 'idade usa to be' },
    ])
  })

  it('não quebra com nada, lixo ou formato errado', () => {
    expect(lerPalavrasAntigas(null)).toEqual([])
    expect(lerPalavrasAntigas('{não é json')).toEqual([])
    expect(lerErrosAntigos('{"a":1}')).toEqual([])
  })
})
