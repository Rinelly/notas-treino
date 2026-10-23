import { describe, expect, it } from 'vitest'
import { inserirExercicio, mover, moverExercicio } from './exercicios'
import type { CategoriaExercicio, ExercicioRotina } from '../types'

const ex = (id: string, categoria: CategoriaExercicio = 'treino'): ExercicioRotina => ({
  id,
  nome: id,
  categoria,
  seriesAlvo: '3 × 10',
})

/** aquecimento, três de treino, cardio — a forma do treino real */
const LISTA: ExercicioRotina[] = [
  ex('esteira', 'aquecimento'),
  ex('agachamento'),
  ex('leg-press'),
  ex('hip-thrust'),
  ex('escada', 'cardio'),
]

const ids = (l: ExercicioRotina[]) => l.map((e) => e.id)

describe('mover', () => {
  it('leva o item para cima', () => {
    expect(mover(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('leva o item para baixo', () => {
    expect(mover(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('mover para o mesmo lugar devolve a MESMA lista', () => {
    // identidade importa: é o que evita gravar no banco à toa
    const l = ['a', 'b', 'c']
    expect(mover(l, 1, 1)).toBe(l)
  })

  it('não altera a lista original', () => {
    const l = ['a', 'b', 'c']
    mover(l, 0, 2)
    expect(l).toEqual(['a', 'b', 'c'])
  })

  it('índice fora da lista não quebra nem embaralha', () => {
    const l = ['a', 'b', 'c']
    expect(mover(l, 9, 0)).toBe(l)
    expect(mover(l, -1, 0)).toBe(l)
    expect(mover(l, 0, 99)).toEqual(['b', 'c', 'a'])
    expect(mover(l, 2, -5)).toEqual(['c', 'a', 'b'])
  })

  it('lista vazia ou de um item continua igual', () => {
    expect(mover([], 0, 0)).toEqual([])
    expect(mover(['a'], 0, 0)).toEqual(['a'])
  })
})

describe('moverExercicio — a categoria segue o lugar onde soltou', () => {
  it('reordenar dentro da mesma seção não mexe na categoria', () => {
    const r = moverExercicio(LISTA, 3, 1)
    expect(ids(r)).toEqual(['esteira', 'hip-thrust', 'agachamento', 'leg-press', 'escada'])
    expect(r[1].categoria).toBe('treino')
  })

  it('arrastar para baixo do cardio vira cardio', () => {
    const r = moverExercicio(LISTA, 1, 4)
    expect(ids(r)).toEqual(['esteira', 'leg-press', 'hip-thrust', 'escada', 'agachamento'])
    expect(r[4].categoria).toBe('cardio')
  })

  it('arrastar para o topo pega a categoria de quem ficou embaixo', () => {
    // não há vizinho de cima: quem manda é o de baixo
    const r = moverExercicio(LISTA, 2, 0)
    expect(r[0].id).toBe('leg-press')
    expect(r[0].categoria).toBe('aquecimento')
  })

  it('o resto da lista mantém a categoria de cada um', () => {
    const r = moverExercicio(LISTA, 1, 4)
    expect(r.find((e) => e.id === 'esteira')?.categoria).toBe('aquecimento')
    expect(r.find((e) => e.id === 'escada')?.categoria).toBe('cardio')
  })

  it('para o mesmo lugar, devolve a mesma lista', () => {
    expect(moverExercicio(LISTA, 2, 2)).toBe(LISTA)
  })

  it('não altera os objetos da lista original', () => {
    moverExercicio(LISTA, 1, 4)
    expect(LISTA[1].categoria).toBe('treino')
  })

  it('lista de um item só não tem vizinho pra copiar', () => {
    const um = [ex('agachamento')]
    expect(moverExercicio(um, 0, 0)).toBe(um)
  })
})

describe('inserirExercicio', () => {
  it('entra no fim do bloco da própria categoria, não no fim da lista', () => {
    // no fim da lista ele cairia depois do cardio e abriria
    // uma segunda seção "Treino" embaixo de tudo
    const r = inserirExercicio(LISTA, ex('stiff'))
    expect(ids(r)).toEqual([
      'esteira',
      'agachamento',
      'leg-press',
      'hip-thrust',
      'stiff',
      'escada',
    ])
  })

  it('aquecimento novo entra depois do último aquecimento', () => {
    const r = inserirExercicio(LISTA, ex('bicicleta', 'aquecimento'))
    expect(ids(r).slice(0, 3)).toEqual(['esteira', 'bicicleta', 'agachamento'])
  })

  it('cardio novo vai pro fim mesmo', () => {
    const r = inserirExercicio(LISTA, ex('eliptico', 'cardio'))
    expect(ids(r)[5]).toBe('eliptico')
  })

  it('primeira categoria do tipo respeita a ordem das seções', () => {
    const soTreino = [ex('agachamento'), ex('leg-press')]
    expect(ids(inserirExercicio(soTreino, ex('esteira', 'aquecimento')))).toEqual([
      'esteira',
      'agachamento',
      'leg-press',
    ])
    expect(ids(inserirExercicio(soTreino, ex('escada', 'cardio')))).toEqual([
      'agachamento',
      'leg-press',
      'escada',
    ])
  })

  it('lista vazia recebe o primeiro', () => {
    expect(ids(inserirExercicio([], ex('agachamento')))).toEqual(['agachamento'])
  })

  it('não altera a lista original', () => {
    inserirExercicio(LISTA, ex('stiff'))
    expect(LISTA).toHaveLength(5)
  })
})

describe('moverExercicio — a regra de "na dúvida, não mexe"', () => {
  it('encostar no último aquecimento não transforma o exercício em aquecimento', () => {
    // o primeiro lugar do bloco de treino faz fronteira com o
    // aquecimento; reordenar ali é o caso mais comum de todos
    const r = moverExercicio(LISTA, 3, 1)
    expect(r[1].id).toBe('hip-thrust')
    expect(r[1].categoria).toBe('treino')
  })

  it('só muda quando nenhum vizinho é da mesma seção', () => {
    // cai entre o cardio e o fim da lista: não sobrou treino perto
    const r = moverExercicio(LISTA, 1, 4)
    expect(r[4].categoria).toBe('cardio')
  })

  it('o único da própria seção muda ao sair dela', () => {
    const r = moverExercicio(LISTA, 0, 4) // esteira, único aquecimento
    expect(r[4].id).toBe('esteira')
    expect(r[4].categoria).toBe('cardio')
  })
})
