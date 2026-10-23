import { describe, expect, it } from 'vitest'
import { escolherTreino, SEM_TREINO, type SessaoResumo } from './escolherTreino'
import type { Rotina } from '../types'

const rotina = (id: number, letra: string, qtdExercicios = 8): Rotina => ({
  id,
  diaSemana: '',
  letra,
  nome: `Treino ${letra}`,
  exercicios: Array.from({ length: qtdExercicios }, (_, i) => ({
    id: `${id}-${i}`,
    nome: `ex ${i}`,
    categoria: 'treino' as const,
    seriesAlvo: '4x10',
  })),
})

const ROTINAS = [rotina(1, 'A'), rotina(2, 'B'), rotina(3, 'C')]
const HOJE = '2026-10-23'

const sessao = (
  id: number,
  rotina_id: number,
  data: string,
  finalizada = false,
): SessaoResumo => ({ id, rotina_id, data, finalizada })

describe('escolherTreino', () => {
  it('sem rotinas cadastradas, não mostra nada', () => {
    expect(escolherTreino([], [], new Map(), HOJE)).toEqual(SEM_TREINO)
  })

  it('sem histórico nenhum, começa pelo primeiro', () => {
    const r = escolherTreino(ROTINAS, [], new Map(), HOJE)
    expect(r.rotina?.letra).toBe('A')
    expect(r.emAndamento).toBe(false)
  })

  describe('o treino de hoje não avança no mesmo dia', () => {
    it('com exercício marcado, continua mostrando o de hoje', () => {
      const sessoes = [sessao(10, 3, HOJE)]
      const r = escolherTreino(ROTINAS, sessoes, new Map([[10, 5]]), HOJE)
      expect(r.rotina?.letra).toBe('C')
      expect(r.feitos).toBe(5)
      expect(r.total).toBe(8)
      expect(r.emAndamento).toBe(true)
      expect(r.finalizada).toBe(false)
    })

    it('finalizado conta mesmo sem nenhum exercício marcado', () => {
      const sessoes = [sessao(10, 3, HOJE, true)]
      const r = escolherTreino(ROTINAS, sessoes, new Map(), HOJE)
      expect(r.rotina?.letra).toBe('C')
      expect(r.finalizada).toBe(true)
      expect(r.emAndamento).toBe(false)
    })

    it('sessão de hoje vazia não segura o painel', () => {
      // abriu o treino B sem fazer nada; o anterior de verdade foi o A
      const sessoes = [sessao(11, 2, HOJE), sessao(10, 1, '2026-10-22', true)]
      const r = escolherTreino(ROTINAS, sessoes, new Map(), HOJE)
      expect(r.rotina?.letra).toBe('B')
      expect(r.feitos).toBe(0)
      expect(r.sessaoId).toBe(11) // reaproveita a sessão vazia que já existe
    })
  })

  describe('rodízio', () => {
    it('depois do A vem o B', () => {
      const sessoes = [sessao(10, 1, '2026-10-22', true)]
      expect(escolherTreino(ROTINAS, sessoes, new Map(), HOJE).rotina?.letra).toBe('B')
    })

    it('depois do último, volta para o primeiro', () => {
      const sessoes = [sessao(10, 3, '2026-10-22', true)]
      expect(escolherTreino(ROTINAS, sessoes, new Map(), HOJE).rotina?.letra).toBe('A')
    })

    it('ignora dias sem progresso e usa o último treino de verdade', () => {
      const sessoes = [
        sessao(12, 2, '2026-10-22'), // aberta ontem e abandonada
        sessao(11, 3, '2026-10-21', true), // esse foi o último de verdade
      ]
      const r = escolherTreino(ROTINAS, sessoes, new Map(), HOJE)
      expect(r.rotina?.letra).toBe('A')
    })

    it('rotina apagada não trava o rodízio', () => {
      const sessoes = [sessao(10, 99, '2026-10-22', true)]
      expect(escolherTreino(ROTINAS, sessoes, new Map(), HOJE).rotina?.letra).toBe('A')
    })
  })

  it('dá a volta completa A→B→C→A em dias seguidos', () => {
    const letras: string[] = []
    const sessoes: SessaoResumo[] = []
    const feitos = new Map<number, number>()
    let id = 1

    for (let i = 0; i < 4; i++) {
      const dia = `2026-10-${String(10 + i).padStart(2, '0')}`
      const escolhido = escolherTreino(ROTINAS, sessoes, feitos, dia)
      letras.push(escolhido.rotina!.letra!)
      // "treina" o que foi escolhido
      const s = sessao(id, escolhido.rotina!.id!, dia, true)
      sessoes.unshift(s) // mais recente primeiro
      feitos.set(id, 8)
      id++
    }

    expect(letras).toEqual(['A', 'B', 'C', 'A'])
  })
})

describe('última vez que fiz este treino', () => {
  it('sem histórico nenhum, não tem última vez', () => {
    expect(escolherTreino(ROTINAS, [], new Map(), HOJE).ultimaVez).toBeNull()
  })

  it('devolve a data da vez anterior DESTE treino, não de outro', () => {
    // rodízio: fez C ontem, então hoje toca o A. O A foi no dia 18.
    const sessoes = [
      sessao(9, 3, '2026-10-22', true),
      sessao(8, 2, '2026-10-20', true),
      sessao(7, 1, '2026-10-18', true),
    ]
    const r = escolherTreino(ROTINAS, sessoes, new Map(), HOJE)
    expect(r.rotina?.letra).toBe('A')
    expect(r.ultimaVez).toBe('2026-10-18')
  })

  it('pega a mais recente quando houve várias', () => {
    const sessoes = [
      sessao(9, 1, '2026-10-16', true),
      sessao(8, 1, '2026-10-09', true),
      sessao(7, 1, '2026-10-02', true),
    ]
    // depois do A vem o B; o B nunca foi feito
    expect(escolherTreino(ROTINAS, sessoes, new Map(), HOJE).ultimaVez).toBeNull()
    // olhando só o A, a mais recente é a do dia 16
    expect(escolherTreino([rotina(1, 'A')], sessoes, new Map(), HOJE).ultimaVez).toBe(
      '2026-10-16',
    )
  })

  it('a sessão de hoje não conta como "última vez"', () => {
    const sessoes = [sessao(9, 1, HOJE, true), sessao(8, 1, '2026-10-16', true)]
    const r = escolherTreino([rotina(1, 'A')], sessoes, new Map(), HOJE)
    expect(r.finalizada).toBe(true)
    expect(r.ultimaVez).toBe('2026-10-16')
  })

  it('sessão antiga aberta e vazia não conta: aquele dia não teve treino', () => {
    const sessoes = [sessao(9, 1, '2026-10-16', false)]
    const r = escolherTreino([rotina(1, 'A')], sessoes, new Map(), HOJE)
    expect(r.ultimaVez).toBeNull()

    // com um exercício marcado, aí sim conta
    const comProgresso = escolherTreino(
      [rotina(1, 'A')],
      sessoes,
      new Map([[9, 1]]),
      HOJE,
    )
    expect(comProgresso.ultimaVez).toBe('2026-10-16')
  })
})
