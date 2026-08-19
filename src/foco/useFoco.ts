/* =========================================================
   useFoco — estado do pomodoro: config, dia, tarefas, notas

   Guarda tudo em memória e grava no Supabase com atraso,
   pra não fazer uma requisição por segundo enquanto o
   cronômetro roda.
   ========================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hojeChave, ultimosDias } from '../lib/datas'
import {
  apagarTarefa,
  getConfig,
  getDia,
  getDias,
  getTarefasDeHoje,
  novaTarefa,
  salvarConfig,
  salvarDia,
  salvarTarefa,
} from './queries'
import {
  CONFIG_PADRAO,
  diaVazio,
  type Config,
  type Dia,
  type Tarefa,
  type TipoTarefa,
} from './tipos'

const JANELA = 14

export function useFoco() {
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO)
  const [hoje, setHoje] = useState<Dia>(() => diaVazio(hojeChave()))
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [historico, setHistorico] = useState<Dia[]>([])
  const [tarefaAtivaId, setTarefaAtivaId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const hojeRef = useRef(hoje)
  useEffect(() => {
    hojeRef.current = hoje
  }, [hoje])

  /* ---------- gravação com atraso ---------- */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const agendar = useCallback((id: string, ms: number, fn: () => void) => {
    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(fn, ms)
  }, [])

  const gravarDiaAgora = useCallback(() => {
    clearTimeout(timers.current['dia'])
    void salvarDia(hojeRef.current).catch(() => {})
  }, [])

  /* ---------- carga inicial ---------- */
  const carregar = useCallback(async () => {
    try {
      setCarregando(true)
      setErro(null)

      const janela = ultimosDias(JANELA)
      const [c, d, ts, dias] = await Promise.all([
        getConfig(),
        getDia(hojeChave()),
        getTarefasDeHoje(),
        getDias(janela[0].chave, janela[janela.length - 1].chave),
      ])

      setConfig(c)
      setHoje(d)
      setTarefas(ts)
      setHistorico(dias)
      setTarefaAtivaId(ts.find((t) => !t.feita)?.id ?? null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // grava o que estiver pendente ao sair ou trocar de aba
  useEffect(() => {
    const sair = () => gravarDiaAgora()
    window.addEventListener('beforeunload', sair)
    const visibilidade = () => {
      if (document.hidden) gravarDiaAgora()
    }
    document.addEventListener('visibilitychange', visibilidade)
    return () => {
      window.removeEventListener('beforeunload', sair)
      document.removeEventListener('visibilitychange', visibilidade)
      gravarDiaAgora()
    }
  }, [gravarDiaAgora])

  /* ---------- derivados ---------- */
  const tarefaAtiva = useMemo(
    () => tarefas.find((t) => t.id === tarefaAtivaId) ?? null,
    [tarefas, tarefaAtivaId],
  )

  /** o tipo que está recebendo o tempo agora */
  const tipoAtual: TipoTarefa = tarefaAtiva ? tarefaAtiva.tipo : config.ultimoTipo

  const tipoAtualRef = useRef(tipoAtual)
  useEffect(() => {
    tipoAtualRef.current = tipoAtual
  }, [tipoAtual])

  /* ---------- ações do timer ---------- */
  const acumularSegundos = useCallback(
    (segundos: number) => {
      setHoje((d) => {
        const novo: Dia = {
          ...d,
          seg: d.seg + segundos,
          segTrabalho: d.segTrabalho + (tipoAtualRef.current === 'trabalho' ? segundos : 0),
          segEstudo: d.segEstudo + (tipoAtualRef.current === 'estudo' ? segundos : 0),
        }
        hojeRef.current = novo
        return novo
      })
      agendar('dia', 8000, () => void salvarDia(hojeRef.current).catch(() => {}))
    },
    [agendar],
  )

  const concluirPomodoro = useCallback(() => {
    setHoje((d) => {
      const novo = { ...d, pomodoros: d.pomodoros + 1 }
      hojeRef.current = novo
      void salvarDia(novo).catch(() => {})
      return novo
    })

    const ativa = tarefaAtivaId
    if (ativa) {
      setTarefas((lista) =>
        lista.map((t) => {
          if (t.id !== ativa) return t
          const atualizada = { ...t, pomodoros: t.pomodoros + 1 }
          void salvarTarefa(atualizada).catch(() => {})
          return atualizada
        }),
      )
    }
  }, [tarefaAtivaId])

  /* ---------- configurações ---------- */
  const mudarConfig = useCallback(
    (patch: Partial<Config>) => {
      setConfig((c) => {
        const novo = { ...c, ...patch }
        agendar('config', 400, () => void salvarConfig(novo).catch(() => {}))
        return novo
      })
    },
    [agendar],
  )

  /* ---------- tarefas ---------- */
  const adicionarTarefa = useCallback(
    (nome: string, tipo: TipoTarefa) => {
      if (!nome.trim()) return
      const t = novaTarefa(nome, tipo)
      setTarefas((l) => [...l, t])
      setTarefaAtivaId((atual) => atual ?? t.id)
      if (config.ultimoTipo !== tipo) mudarConfig({ ultimoTipo: tipo })
      void salvarTarefa(t).catch(() => {})
    },
    [config.ultimoTipo, mudarConfig],
  )

  const alternarFeita = useCallback((id: string) => {
    setTarefas((l) =>
      l.map((t) => {
        if (t.id !== id) return t
        const nova = { ...t, feita: !t.feita }
        void salvarTarefa(nova).catch(() => {})
        return nova
      }),
    )
    setTarefaAtivaId((atual) => (atual === id ? null : atual))
  }, [])

  const alternarTipo = useCallback((id: string) => {
    setTarefas((l) =>
      l.map((t) => {
        if (t.id !== id) return t
        const nova: Tarefa = { ...t, tipo: t.tipo === 'trabalho' ? 'estudo' : 'trabalho' }
        void salvarTarefa(nova).catch(() => {})
        return nova
      }),
    )
  }, [])

  const removerTarefa = useCallback((id: string) => {
    setTarefas((l) => l.filter((t) => t.id !== id))
    setTarefaAtivaId((atual) => (atual === id ? null : atual))
    void apagarTarefa(id).catch(() => {})
  }, [])

  const ativarTarefa = useCallback((id: string) => {
    setTarefaAtivaId((atual) => (atual === id ? null : id))
  }, [])

  /* ---------- anotações ---------- */
  const mudarNota = useCallback(
    (texto: string) => {
      setHoje((d) => {
        const novo = { ...d, nota: texto }
        hojeRef.current = novo
        return novo
      })
      agendar('nota', 700, () => void salvarDia(hojeRef.current).catch(() => {}))
    },
    [agendar],
  )

  /* ---------- estatísticas ---------- */
  const estatisticas = useMemo(() => {
    const porChave = new Map(historico.map((d) => [d.chave, d]))
    const chaveHoje = hojeChave()

    const dias = ultimosDias(JANELA).map(({ chave, data }) => {
      const d = chave === chaveHoje ? hoje : porChave.get(chave) ?? diaVazio(chave)
      return { ...d, data }
    })

    const metaSeg = config.metaHoras * 3600
    const agora = new Date()
    const diaSemana = (agora.getDay() + 6) % 7 // 0 = segunda
    const daSemana = dias.slice(-(diaSemana + 1))

    const semana = daSemana.reduce((a, x) => a + x.seg, 0)
    const ativos = dias.filter((x) => x.seg > 60)
    const media = ativos.length ? ativos.reduce((a, x) => a + x.seg, 0) / ativos.length : 0

    let sequencia = 0
    for (let i = dias.length - 1; i >= 0; i--) {
      if (metaSeg > 0 && dias[i].seg >= metaSeg) sequencia++
      else if (dias[i].chave === chaveHoje) continue // hoje em andamento não quebra
      else break
    }

    return {
      dias,
      metaSeg,
      semana,
      semanaTrabalho: daSemana.reduce((a, x) => a + x.segTrabalho, 0),
      semanaEstudo: daSemana.reduce((a, x) => a + x.segEstudo, 0),
      media,
      sequencia,
    }
  }, [historico, hoje, config.metaHoras])

  return {
    carregando,
    erro,
    recarregar: carregar,
    config,
    hoje,
    tarefas,
    tarefaAtiva,
    tarefaAtivaId,
    tipoAtual,
    estatisticas,
    acumularSegundos,
    concluirPomodoro,
    mudarConfig,
    adicionarTarefa,
    alternarFeita,
    alternarTipo,
    removerTarefa,
    ativarTarefa,
    mudarNota,
    gravarDiaAgora,
  }
}
