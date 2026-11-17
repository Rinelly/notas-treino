import { describe, expect, it } from 'vitest'
import { MAX_FOCO, montarContexto } from './contexto'
import type { Erro, Palavra } from './tipos'

const erro = (original: string, correcao: string, i = 0): Erro => ({
  id: `e${i}`,
  original,
  correcao,
  explicacao: '',
  criadoEm: '2026-11-16T12:00:00Z',
})

const palavra = (p: string, i = 0): Palavra => ({
  id: `p${i}`,
  palavra: p,
  significado: '',
  exemplo: '',
  criadoEm: '2026-11-16T12:00:00Z',
})

describe('montarContexto', () => {
  it('junta foco, erros e palavras no formato da API', () => {
    const c = montarContexto(
      '  Present perfect; vocabulário de saúde  ',
      [erro('since two years', 'for two years')],
      [palavra('rewarding')],
    )
    expect(c).toEqual({
      focus: 'Present perfect; vocabulário de saúde',
      mistakes: [{ original: 'since two years', better: 'for two years' }],
      words: ['rewarding'],
    })
  })

  it('não repete o mesmo erro e fica com o mais recente', () => {
    const c = montarContexto(
      '',
      [erro('I have 30 years', 'I am 30', 1), erro('i have 30 years ', 'I am 30 years old', 2)],
      [],
    )
    expect(c.mistakes).toEqual([{ original: 'I have 30 years', better: 'I am 30' }])
  })

  it('pula erro sem correção', () => {
    expect(montarContexto('', [erro('x', '  ')], []).mistakes).toEqual([])
  })

  it('limita a quantidade de erros, de palavras e o tamanho do foco', () => {
    const erros = Array.from({ length: 30 }, (_, i) => erro(`erro ${i}`, `certo ${i}`, i))
    const palavras = Array.from({ length: 40 }, (_, i) => palavra(`word${i}`, i))
    const c = montarContexto('a'.repeat(MAX_FOCO + 500), erros, palavras)
    expect(c.mistakes).toHaveLength(8)
    expect(c.mistakes[0].original).toBe('erro 0')
    expect(c.words).toHaveLength(15)
    expect(c.words[0]).toBe('word0')
    expect(c.focus).toHaveLength(MAX_FOCO)
  })

  it('sem nada, devolve tudo vazio', () => {
    expect(montarContexto('', [], [])).toEqual({ focus: '', mistakes: [], words: [] })
  })
})
