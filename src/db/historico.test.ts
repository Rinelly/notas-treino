import { describe, expect, it } from 'vitest'
import { linhasDeHistorico } from './historico'
import type { Execucao, Rotina, Sessao } from '../types'

const ROTINA: Rotina = {
  id: 1,
  letra: 'A',
  diaSemana: 'Segunda',
  nome: 'Inferiores A',
  exercicios: [
    { id: 'e0', nome: 'Esteira', categoria: 'aquecimento', seriesAlvo: '8 min' },
    { id: 'e1', nome: 'Agachamento', categoria: 'treino', seriesAlvo: '4x10' },
    { id: 'e2', nome: 'Leg Press', categoria: 'treino', seriesAlvo: '4x12' },
  ],
}

const SESSOES: Sessao[] = [
  { id: 10, rotinaId: 1, data: '2026-10-20', finalizada: true },
  { id: 11, rotinaId: 1, data: '2026-10-23', finalizada: false },
]

const exec = (
  id: number,
  sessaoId: number,
  exercicioId: string,
  extra: Partial<Execucao> = {},
): Execucao => ({ id, sessaoId, exercicioId, concluido: true, ...extra })

describe('linhasDeHistorico', () => {
  it('vira uma linha por execução, com os dados da rotina junto', () => {
    const linhas = linhasDeHistorico(
      [ROTINA],
      SESSOES,
      [exec(1, 10, 'e1', { carga: 47.5, repsFeitas: 10 })],
    )
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({
      data: '2026-10-20',
      treino: 'A',
      rotina: 'Inferiores A',
      exercicio: 'Agachamento',
      categoria: 'treino',
      seriesAlvo: '4x10',
      concluido: true,
      repsFeitas: 10,
      carga: 47.5,
      sessaoFinalizada: true,
    })
  })

  it('exercício que você nunca tocou não vira linha', () => {
    // a rotina tem 3, mas só um foi registrado
    const linhas = linhasDeHistorico([ROTINA], SESSOES, [exec(1, 10, 'e1')])
    expect(linhas.map((l) => l.exercicio)).toEqual(['Agachamento'])
  })

  it('campo não preenchido vira null, não zero', () => {
    // zero seria mentira: "fez com 0kg" é diferente de "não anotei"
    const [l] = linhasDeHistorico([ROTINA], SESSOES, [exec(1, 10, 'e1')])
    expect(l.carga).toBeNull()
    expect(l.repsFeitas).toBeNull()
  })

  it('guarda o que não foi concluído também', () => {
    const [l] = linhasDeHistorico([ROTINA], SESSOES, [
      exec(1, 10, 'e1', { concluido: false, carga: 40 }),
    ])
    expect(l.concluido).toBe(false)
    expect(l.carga).toBe(40)
  })

  it('execução de sessão que não existe mais é descartada', () => {
    const linhas = linhasDeHistorico([ROTINA], SESSOES, [exec(1, 999, 'e1')])
    expect(linhas).toHaveLength(0)
  })

  it('exercício apagado da rotina depois não apaga o histórico de carga', () => {
    const [l] = linhasDeHistorico([ROTINA], SESSOES, [
      exec(1, 10, 'e9', { carga: 60, repsFeitas: 8 }),
    ])
    expect(l.carga).toBe(60)
    expect(l.exercicio).toContain('e9')
    expect(l.categoria).toBe('')
  })

  it('sessão de rotina apagada ainda aparece, marcada', () => {
    const [l] = linhasDeHistorico([], SESSOES, [exec(1, 10, 'e1', { carga: 30 })])
    expect(l.rotina).toBe('(rotina apagada)')
    expect(l.carga).toBe(30)
  })

  it('ordena do dia mais recente para o mais antigo', () => {
    const linhas = linhasDeHistorico([ROTINA], SESSOES, [
      exec(1, 10, 'e1'),
      exec(2, 11, 'e1'),
    ])
    expect(linhas.map((l) => l.data)).toEqual(['2026-10-23', '2026-10-20'])
  })

  it('dentro do dia, aquecimento vem antes do treino', () => {
    const linhas = linhasDeHistorico([ROTINA], SESSOES, [
      exec(1, 10, 'e1'), // Agachamento, treino
      exec(2, 10, 'e0'), // Esteira, aquecimento
      exec(3, 10, 'e2'), // Leg Press, treino
    ])
    expect(linhas.map((l) => l.exercicio)).toEqual([
      'Esteira',
      'Agachamento',
      'Leg Press',
    ])
  })

  it('sem nada registrado, sai lista vazia e não quebra', () => {
    expect(linhasDeHistorico([ROTINA], SESSOES, [])).toEqual([])
    expect(linhasDeHistorico([], [], [])).toEqual([])
  })
})
