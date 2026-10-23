import { describe, expect, it } from 'vitest'
import { nomeCurto, partesDoNome } from './nomeTreino'

describe('partesDoNome', () => {
  it('separa no travessão', () => {
    expect(partesDoNome('Inferiores A — quadríceps e glúteos')).toEqual({
      curto: 'Inferiores A',
      detalhe: 'quadríceps e glúteos',
    })
  })

  it('aceita meia-risca e hífen também', () => {
    expect(partesDoNome('Superiores B – costas e ombros').curto).toBe('Superiores B')
    expect(partesDoNome('Inferiores C - glúteos').detalhe).toBe('glúteos')
  })

  it('sem separador, o nome inteiro é o apelido', () => {
    expect(partesDoNome('Inferiores A')).toEqual({ curto: 'Inferiores A', detalhe: '' })
  })

  it('hífen dentro de palavra não é separador', () => {
    // "bi-set" e "pré-treino" não podem partir o nome ao meio
    expect(partesDoNome('Pré-treino A').curto).toBe('Pré-treino A')
    expect(partesDoNome('Peito-costas').detalhe).toBe('')
  })

  it('corta no primeiro separador, mesmo que haja outro depois', () => {
    expect(partesDoNome('Inferiores A — glúteos — e posteriores')).toEqual({
      curto: 'Inferiores A',
      detalhe: 'glúteos — e posteriores',
    })
  })

  it('aguenta nome vazio ou ausente sem quebrar a tela', () => {
    expect(partesDoNome('')).toEqual({ curto: '', detalhe: '' })
    expect(partesDoNome(null)).toEqual({ curto: '', detalhe: '' })
    expect(partesDoNome(undefined)).toEqual({ curto: '', detalhe: '' })
  })

  it('tira o espaço sobrando dos dois lados', () => {
    expect(partesDoNome('  Inferiores A  —  glúteos  ')).toEqual({
      curto: 'Inferiores A',
      detalhe: 'glúteos',
    })
  })
})

describe('nomeCurto', () => {
  it('é o atalho pro apelido', () => {
    expect(nomeCurto('Superiores A — costas, peito e braços')).toBe('Superiores A')
  })
})
