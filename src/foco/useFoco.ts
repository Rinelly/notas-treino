import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hojeChave, ultimosDias } from "../lib/datas";
import { useDiaAtual } from "../lib/useDiaAtual";
import {
  apagarTarefa,
  getConfig,
  getDia,
  getDias,
  getTarefasDeHoje,
  novaTarefa,
  salvarConfig,
  salvarTarefa,
  somarNoDia,
} from "./queries";
import { calcularEstatisticas } from "./estatisticas";
import {
  devolver,
  PENDENTE_ZERO,
  segundosDoTipo,
  somar,
  vazio,
  type Pendente,
} from "./pendente";
import {
  CONFIG_PADRAO,
  diaVazio,
  type Config,
  type Dia,
  type Tarefa,
  type TipoTarefa,
} from "./tipos";

const JANELA = 14;

/** no máximo meio minuto de foco pode estar só na memória da aba */
const INTERVALO_MAXIMO = 30_000;

export function useFoco() {
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO);
  const [hoje, setHoje] = useState<Dia>(() => diaVazio(hojeChave()));
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [historico, setHistorico] = useState<Dia[]>([]);
  const [tarefaAtivaId, setTarefaAtivaId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const hojeRef = useRef(hoje);
  useEffect(() => {
    hojeRef.current = hoje;
  }, [hoje]);

  /* ---------- gravação com atraso ----------

     O app não grava mais o total do dia: grava só o pedaço que
     acumulou desde a última vez, e o Postgres soma. Com o total,
     dois aparelhos no mesmo dia se apagavam.

     Se a gravação falha, o pedaço volta pro acumulador — senão
     some hora registrada.                                        */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const agendar = useCallback((id: string, ms: number, fn: () => void) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(fn, ms);
  }, []);

  const pendenteRef = useRef<Pendente>(PENDENTE_ZERO);
  const notaPendenteRef = useRef<string | null>(null);
  const enviandoRef = useRef(false);
  const ultimoEnvioRef = useRef(Date.now());

  const enviar = useCallback(async () => {
    if (enviandoRef.current) return;

    const pedaco = pendenteRef.current;
    const nota = notaPendenteRef.current;
    if (vazio(pedaco) && nota === null) return;

    const chave = hojeRef.current.chave;
    pendenteRef.current = PENDENTE_ZERO;
    notaPendenteRef.current = null;
    enviandoRef.current = true;

    try {
      const salvo = await somarNoDia(chave, pedaco, nota ?? undefined);

      // o servidor virou a verdade: além de confirmar o que subiu,
      // traz o que o outro aparelho somou enquanto isso
      setHoje((d) => {
        if (d.chave !== salvo.chave) return d; // virou o dia no meio do caminho
        const aindaNaoSubiu = pendenteRef.current;
        const novo: Dia = {
          chave: salvo.chave,
          seg: salvo.seg + aindaNaoSubiu.seg,
          segTrabalho: salvo.segTrabalho + aindaNaoSubiu.segTrabalho,
          segEstudo: salvo.segEstudo + aindaNaoSubiu.segEstudo,
          pomodoros: salvo.pomodoros + aindaNaoSubiu.pomodoros,
          nota: notaPendenteRef.current ?? salvo.nota,
        };
        hojeRef.current = novo;
        return novo;
      });
    } catch {
      pendenteRef.current = devolver(pendenteRef.current, pedaco);
      if (nota !== null && notaPendenteRef.current === null) {
        notaPendenteRef.current = nota;
      }
    } finally {
      enviandoRef.current = false;
      ultimoEnvioRef.current = Date.now();
    }
  }, []);

  const gravarDiaAgora = useCallback(() => {
    clearTimeout(timers.current["dia"]);
    clearTimeout(timers.current["nota"]);
    void enviar();
  }, [enviar]);

  /* ---------- carga inicial ---------- */
  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const janela = ultimosDias(JANELA);
      const [c, d, ts, dias] = await Promise.all([
        getConfig(),
        getDia(hojeChave()),
        getTarefasDeHoje(),
        getDias(janela[0].chave, janela[janela.length - 1].chave),
      ]);

      setConfig(c);
      setHoje(d);
      setTarefas(ts);
      setHistorico(dias);
      setTarefaAtivaId(ts.find((t) => !t.feita)?.id ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // virou o dia com o app aberto: grava o que ficou no dia que
  // acabou e recarrega, senão o tempo da madrugada entraria na
  // linha de ontem
  useDiaAtual(
    useCallback(() => {
      gravarDiaAgora();
      void carregar();
    }, [carregar, gravarDiaAgora]),
  );

  useEffect(() => {
    const sair = () => gravarDiaAgora();
    window.addEventListener("beforeunload", sair);
    const visibilidade = () => {
      if (document.hidden) gravarDiaAgora();
    };
    document.addEventListener("visibilitychange", visibilidade);
    return () => {
      window.removeEventListener("beforeunload", sair);
      document.removeEventListener("visibilitychange", visibilidade);
      gravarDiaAgora();
    };
  }, [gravarDiaAgora]);

  /* ---------- derivados ---------- */
  const tarefaAtiva = useMemo(
    () => tarefas.find((t) => t.id === tarefaAtivaId) ?? null,
    [tarefas, tarefaAtivaId],
  );
 
  const tipoAtual: TipoTarefa = tarefaAtiva
    ? tarefaAtiva.tipo
    : config.ultimoTipo;

  const tipoAtualRef = useRef(tipoAtual);
  useEffect(() => {
    tipoAtualRef.current = tipoAtual;
  }, [tipoAtual]);

  /* ---------- ações do timer ---------- */
  const acumularSegundos = useCallback(
    (segundos: number) => {
      const patch = segundosDoTipo(segundos, tipoAtualRef.current);
      pendenteRef.current = somar(pendenteRef.current, patch);

      setHoje((d) => {
        const novo: Dia = {
          ...d,
          seg: d.seg + segundos,
          segTrabalho: d.segTrabalho + (patch.segTrabalho ?? 0),
          segEstudo: d.segEstudo + (patch.segEstudo ?? 0),
        };
        hojeRef.current = novo;
        return novo;
      });

      // O atraso de 8s é um debounce: cada segundo que passa adiava
      // de novo, e com o cronômetro rodando sem parar a gravação
      // nunca acontecia — um pomodoro inteiro ficava só na memória
      // da aba. O teto garante uma subida a cada meio minuto.
      if (Date.now() - ultimoEnvioRef.current >= INTERVALO_MAXIMO) {
        clearTimeout(timers.current["dia"]);
        void enviar();
      } else {
        agendar("dia", 8000, () => void enviar());
      }
    },
    [agendar, enviar],
  );

  const concluirPomodoro = useCallback(() => {
    pendenteRef.current = somar(pendenteRef.current, { pomodoros: 1 });
    setHoje((d) => {
      const novo = { ...d, pomodoros: d.pomodoros + 1 };
      hojeRef.current = novo;
      return novo;
    });
    void enviar();

    const ativa = tarefaAtivaId;
    if (ativa) {
      setTarefas((lista) =>
        lista.map((t) => {
          if (t.id !== ativa) return t;
          const atualizada = { ...t, pomodoros: t.pomodoros + 1 };
          void salvarTarefa(atualizada).catch(() => {});
          return atualizada;
        }),
      );
    }
  }, [enviar, tarefaAtivaId]);

  /* ---------- configurações ---------- */
  const mudarConfig = useCallback(
    (patch: Partial<Config>) => {
      setConfig((c) => {
        const novo = { ...c, ...patch };
        agendar("config", 400, () => void salvarConfig(novo).catch(() => {}));
        return novo;
      });
    },
    [agendar],
  );

  /* ---------- tarefas ---------- */
  const adicionarTarefa = useCallback(
    (nome: string, tipo: TipoTarefa) => {
      if (!nome.trim()) return;
      const t = novaTarefa(nome, tipo);
      setTarefas((l) => [...l, t]);
      setTarefaAtivaId((atual) => atual ?? t.id);
      if (config.ultimoTipo !== tipo) mudarConfig({ ultimoTipo: tipo });
      void salvarTarefa(t).catch(() => {});
    },
    [config.ultimoTipo, mudarConfig],
  );

  const alternarFeita = useCallback((id: string) => {
    setTarefas((l) =>
      l.map((t) => {
        if (t.id !== id) return t;
        const nova = { ...t, feita: !t.feita };
        void salvarTarefa(nova).catch(() => {});
        return nova;
      }),
    );
    setTarefaAtivaId((atual) => (atual === id ? null : atual));
  }, []);

  const alternarTipo = useCallback((id: string) => {
    setTarefas((l) =>
      l.map((t) => {
        if (t.id !== id) return t;
        const nova: Tarefa = {
          ...t,
          tipo: t.tipo === "trabalho" ? "estudo" : "trabalho",
        };
        void salvarTarefa(nova).catch(() => {});
        return nova;
      }),
    );
  }, []);

  const removerTarefa = useCallback((id: string) => {
    setTarefas((l) => l.filter((t) => t.id !== id));
    setTarefaAtivaId((atual) => (atual === id ? null : atual));
    void apagarTarefa(id).catch(() => {});
  }, []);

  const ativarTarefa = useCallback((id: string) => {
    setTarefaAtivaId((atual) => (atual === id ? null : id));
  }, []);

  /* ---------- anotações ---------- */
  const mudarNota = useCallback(
    (texto: string) => {
      notaPendenteRef.current = texto;
      setHoje((d) => {
        const novo = { ...d, nota: texto };
        hojeRef.current = novo;
        return novo;
      });
      agendar("nota", 700, () => void enviar());
    },
    [agendar, enviar],
  );

  /* ---------- estatísticas ---------- */
  const estatisticas = useMemo(() => {
    const porChave = new Map(historico.map((d) => [d.chave, d]));
    const chaveHoje = hojeChave();

    // o dia de hoje vem do estado (está sendo contado agora),
    // os outros vêm do que foi carregado
    const dias = ultimosDias(JANELA).map(({ chave, data }) => {
      const d =
        chave === chaveHoje ? hoje : (porChave.get(chave) ?? diaVazio(chave));
      return { ...d, data };
    });

    return { dias, ...calcularEstatisticas(dias, config.metaHoras * 3600) };
  }, [historico, hoje, config.metaHoras]);

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
  };
}
