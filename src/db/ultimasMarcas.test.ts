import { describe, expect, it } from 'vitest'
import { ultimasMarcas, type LinhaComSessao } from './ultimasMarcas'

const linha = (
  sessao_id: number,
  exercicio_id: string,
  data: string,
  carga: number | string | null,
  reps_feitas: number | null = null,
): LinhaComSessao => ({
  sessao_id,
  exercicio_id,
  carga,
  reps_feitas,
  sessoes: { data },
})

describe('ultimasMarcas', () => {
  it('sem histórico, devolve mapa vazio', () => {
    expect(ultimasMarcas([]).size).toBe(0)
  })

  it('pega a sessão mais recente de cada exercício', () => {
    const linhas = [
      linha(1, 'agacho', '2026-10-01', 40),
      linha(3, 'agacho', '2026-10-15', 50),
      linha(2, 'agacho', '2026-10-08', 45),
      linha(2, 'leg', '2026-10-08', 100),
    ]
    const m = ultimasMarcas(linhas)
    expect(m.get('agacho')?.carga).toBe(50)
    expect(m.get('leg')?.carga).toBe(100)
  })

  it('ignora a sessão que está aberta agora', () => {
    // senão o "última vez" mostraria o que acabou de ser digitado
    const linhas = [
      linha(9, 'agacho', '2026-10-23', 60), // hoje, sessão atual
      linha(3, 'agacho', '2026-10-15', 50),
    ]
    const m = ultimasMarcas(linhas, 9)
    expect(m.get('agacho')?.carga).toBe(50)
  })

  it('duas sessões no mesmo dia: vale a criada depois', () => {
    const linhas = [
      linha(5, 'agacho', '2026-10-15', 50),
      linha(7, 'agacho', '2026-10-15', 55),
    ]
    expect(ultimasMarcas(linhas).get('agacho')?.carga).toBe(55)
  })

  it('linha sem carga e sem reps não conta como marca', () => {
    const linhas = [
      linha(5, 'agacho', '2026-10-20', null, null),
      linha(3, 'agacho', '2026-10-15', 50),
    ]
    expect(ultimasMarcas(linhas).get('agacho')?.carga).toBe(50)
  })

  it('só repetições, sem carga, ainda é uma marca', () => {
    const linhas = [linha(3, 'abdominal', '2026-10-15', null, 20)]
    const m = ultimasMarcas(linhas)
    expect(m.get('abdominal')).toEqual({ carga: undefined, repsFeitas: 20 })
  })

  it('carga que volta como texto do Postgres vira número', () => {
    // numeric(7,2) chega como "47.50" em alguns casos
    const linhas = [linha(3, 'agacho', '2026-10-15', '47.50')]
    expect(ultimasMarcas(linhas).get('agacho')?.carga).toBe(47.5)
  })

  it('linha sem sessão junto é descartada em vez de quebrar', () => {
    const linhas: LinhaComSessao[] = [
      { sessao_id: 1, exercicio_id: 'agacho', carga: 40, reps_feitas: null, sessoes: null },
    ]
    expect(ultimasMarcas(linhas).size).toBe(0)
  })

  it('devolve uma marca por exercício, não uma por sessão', () => {
    const linhas = [
      linha(1, 'a', '2026-10-01', 10),
      linha(2, 'a', '2026-10-02', 11),
      linha(3, 'a', '2026-10-03', 12),
      linha(1, 'b', '2026-10-01', 20),
    ]
    const m = ultimasMarcas(linhas)
    expect(m.size).toBe(2)
    expect(m.get('a')?.carga).toBe(12)
  })
})
