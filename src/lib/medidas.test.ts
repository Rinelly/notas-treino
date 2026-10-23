import { describe, expect, it } from 'vitest'
import {
  CAMPOS,
  caminho,
  faltaTabela,
  fmt,
  lerNumero,
  medidaVazia,
  serie,
  ultimo,
  variacao,
  type Medida,
} from './medidas'

/** atalho: só os campos que o teste usa, o resto vazio */
const m = (data: string, campos: Partial<Medida> = {}): Medida => ({
  ...medidaVazia(data),
  ...campos,
})

describe('medidaVazia', () => {
  it('nasce com tudo em branco, nunca com zero', () => {
    const vazia = medidaVazia('2026-10-23')
    for (const c of CAMPOS) {
      expect(vazia[c.chave]).toBeNull()
    }
    expect(vazia.nota).toBe('')
  })
})

describe('lerNumero', () => {
  it('aceita vírgula e ponto', () => {
    expect(lerNumero('68,4')).toBe(68.4)
    expect(lerNumero('68.4')).toBe(68.4)
    expect(lerNumero(' 68 ')).toBe(68)
  })

  it('campo em branco é null, não zero', () => {
    // zero seria uma medida falsa: "pesa 0kg" não é "não pesei"
    expect(lerNumero('')).toBeNull()
    expect(lerNumero('   ')).toBeNull()
  })

  it('texto sem número e valor impossível também viram null', () => {
    expect(lerNumero('abc')).toBeNull()
    expect(lerNumero('0')).toBeNull()
    expect(lerNumero('-5')).toBeNull()
  })
})

describe('fmt', () => {
  it('usa vírgula decimal', () => {
    expect(fmt(68.4)).toBe('68,4')
    expect(fmt(68)).toBe('68,0')
  })

  it('sem medida, mostra travessão em vez de número inventado', () => {
    expect(fmt(null)).toBe('—')
    expect(fmt(undefined)).toBe('—')
  })
})

describe('variacao', () => {
  const historico = [
    m('2026-10-23', { peso: 67.2, cintura: null }),
    m('2026-10-16', { peso: 68.0, cintura: null }),
    m('2026-09-20', { peso: 69.5, cintura: 74 }),
    m('2026-08-20', { peso: 70.0, cintura: 76 }),
  ]

  it('compara as duas pesagens mais recentes', () => {
    const v = variacao(historico, 'peso')!
    expect(v.atual).toBe(67.2)
    expect(v.anterior).toBe(68)
    expect(v.delta).toBe(-0.8)
    expect(v.atualEm).toBe('2026-10-23')
    expect(v.anteriorEm).toBe('2026-10-16')
  })

  it('pula os dias em que aquele campo ficou em branco', () => {
    // a cintura não foi medida em outubro: compara setembro com agosto
    const v = variacao(historico, 'cintura')!
    expect(v.atual).toBe(74)
    expect(v.anterior).toBe(76)
    expect(v.atualEm).toBe('2026-09-20')
    expect(v.delta).toBe(-2)
  })

  it('com uma medida só, não há o que comparar', () => {
    expect(variacao([m('2026-10-23', { peso: 67 })], 'peso')).toBeNull()
  })

  it('campo nunca medido não inventa variação', () => {
    expect(variacao(historico, 'braco')).toBeNull()
  })

  it('não acumula lixo de ponto flutuante', () => {
    const v = variacao(
      [m('2026-10-23', { peso: 70.1 }), m('2026-10-16', { peso: 70.0 })],
      'peso',
    )!
    expect(v.delta).toBe(0.1)
  })
})

describe('ultimo', () => {
  it('devolve a medida mais recente daquele campo', () => {
    const r = ultimo([m('2026-10-23', { peso: 67.2 }), m('2026-10-16', { peso: 68 })], 'peso')
    expect(r).toEqual({ valor: 67.2, data: '2026-10-23' })
  })

  it('pula as linhas em branco', () => {
    const r = ultimo([m('2026-10-23'), m('2026-10-16', { peso: 68 })], 'peso')
    expect(r).toEqual({ valor: 68, data: '2026-10-16' })
  })

  it('sem nenhuma medida, nulo', () => {
    expect(ultimo([m('2026-10-23')], 'peso')).toBeNull()
  })
})

describe('serie', () => {
  const historico = [
    m('2026-10-23', { peso: 67 }),
    m('2026-10-16', { peso: 69 }),
    m('2026-10-09', { peso: 71 }),
  ]

  it('inverte a ordem: desenha do mais antigo para o mais novo', () => {
    expect(serie(historico, 'peso').map((p) => p.data)).toEqual([
      '2026-10-09',
      '2026-10-16',
      '2026-10-23',
    ])
  })

  it('o x vai de 0 a 1 por posição, não por data', () => {
    // medir de 7 em 7 dias e depois de 60 em 60 não espreme o gráfico
    const irregular = [
      m('2026-10-23', { peso: 67 }),
      m('2026-10-22', { peso: 68 }),
      m('2026-01-01', { peso: 75 }),
    ]
    expect(serie(irregular, 'peso').map((p) => p.x)).toEqual([0, 0.5, 1])
  })

  it('o y vai de 0 no menor a 1 no maior valor', () => {
    const pts = serie(historico, 'peso')
    expect(pts[0].y).toBe(1) // 71, o maior
    expect(pts[2].y).toBe(0) // 67, o menor
    expect(pts[1].y).toBeCloseTo(0.5)
  })

  it('peso que não mudou vira linha no meio, e não divisão por zero', () => {
    const iguais = [m('2026-10-23', { peso: 68 }), m('2026-10-16', { peso: 68 })]
    expect(serie(iguais, 'peso').map((p) => p.y)).toEqual([0.5, 0.5])
  })

  it('uma medida só fica no meio do gráfico', () => {
    const pts = serie([m('2026-10-23', { peso: 68 })], 'peso')
    expect(pts).toHaveLength(1)
    expect(pts[0]).toMatchObject({ x: 0.5, y: 0.5, valor: 68 })
  })

  it('campo sem medida nenhuma não gera pontos', () => {
    expect(serie(historico, 'cintura')).toEqual([])
  })
})

describe('caminho', () => {
  it('sem pontos, não desenha nada', () => {
    expect(caminho([], 100, 40)).toBe('')
  })

  it('começa com M e segue com L', () => {
    const d = caminho(serie([m('b', { peso: 70 }), m('a', { peso: 60 })], 'peso'), 100, 40)
    expect(d.startsWith('M')).toBe(true)
    expect(d.split(' ')[1].startsWith('L')).toBe(true)
  })

  it('inverte o y: valor maior sobe na tela', () => {
    // em SVG o zero é em cima, então o maior valor tem que ter o menor y
    const pts = serie([m('b', { peso: 70 }), m('a', { peso: 60 })], 'peso')
    const [p1, p2] = caminho(pts, 100, 40).split(' ')
    const y = (s: string) => Number(s.split(',')[1])
    expect(y(p1)).toBeGreaterThan(y(p2)) // o antigo (60) está mais embaixo
  })

  it('respeita a folga pra linha não encostar na borda', () => {
    const pts = serie([m('b', { peso: 70 }), m('a', { peso: 60 })], 'peso')
    const ys = caminho(pts, 100, 40, 3)
      .split(' ')
      .map((s) => Number(s.split(',')[1]))
    expect(Math.min(...ys)).toBeCloseTo(3)
    expect(Math.max(...ys)).toBeCloseTo(37)
  })
})

describe('faltaTabela', () => {
  it('reconhece as duas formas de dizer que a tabela não existe', () => {
    expect(faltaTabela('relation "public.medidas" does not exist')).toBe(true)
    expect(
      faltaTabela("Could not find the table 'public.medidas' in the schema cache"),
    ).toBe(true)
  })

  it('não confunde com erro de outra tabela', () => {
    expect(faltaTabela('relation "public.sessoes" does not exist')).toBe(false)
  })

  it('não confunde com problema de rede ou permissão', () => {
    expect(faltaTabela('Failed to fetch')).toBe(false)
    expect(faltaTabela('new row violates row-level security policy for table "medidas"')).toBe(
      false,
    )
  })
})
