import { useCallback, useEffect, useRef, useState } from "react";
import { apitar, liberarSom } from "../lib/som";
import { avancarTimer } from "./avancarTimer";
import type { Config } from "./tipos";

export type Modo = "foco" | "curta" | "longa";

interface Ganchos {
  aoAcumular: (segundos: number) => void;
  aoConcluir: (eraFoco: boolean) => void;
}

export function useTimer(config: Config, ganchos: Ganchos) {
  const [modo, setModoState] = useState<Modo>("foco");
  const [rodando, setRodando] = useState(false);
  const [restanteMs, setRestanteMs] = useState(config.focoMin * 60_000);
  const [ciclo, setCiclo] = useState(0);

  const modoRef = useRef(modo);
  const rodandoRef = useRef(false);
  const restanteRef = useRef(restanteMs);
  const cicloRef = useRef(0);
  const sobraRef = useRef(0); 
  const ultimoRef = useRef(0);
  const configRef = useRef(config);
  const ganchosRef = useRef(ganchos);

  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    ganchosRef.current = ganchos;
  }, [ganchos]);

  const duracaoMs = useCallback((m: Modo) => {
    const c = configRef.current;
    const min =
      m === "foco" ? c.focoMin : m === "curta" ? c.curtaMin : c.longaMin;
    return min * 60_000;
  }, []);

  const duracaoAplicadaRef = useRef(config.focoMin * 60_000);

  const definirModo = useCallback(
    (m: Modo) => {
      modoRef.current = m;
      rodandoRef.current = false;
      sobraRef.current = 0;
      restanteRef.current = duracaoMs(m);
      duracaoAplicadaRef.current = restanteRef.current;
      setModoState(m);
      setRodando(false);
      setRestanteMs(restanteRef.current);
    },
    [duracaoMs],
  );

  useEffect(() => {
    const nova = duracaoMs(modoRef.current);
    const intocado =
      !rodandoRef.current && restanteRef.current === duracaoAplicadaRef.current;
    duracaoAplicadaRef.current = nova;
    if (!intocado) return;
    restanteRef.current = nova;
    setRestanteMs(nova);
  }, [config.focoMin, config.curtaMin, config.longaMin, duracaoMs]);

  /* ---------- um passo ---------- */
  const passo = useCallback(() => {
    if (!rodandoRef.current) return;

    const agora = Date.now();
    const dt = agora - ultimoRef.current;
    ultimoRef.current = agora;

    const r = avancarTimer({
      restanteMs: restanteRef.current,
      sobraMs: sobraRef.current,
      dtMs: dt,
      ehFoco: modoRef.current === "foco",
    });

    restanteRef.current = r.restanteMs;
    sobraRef.current = r.sobraMs;
    if (r.segundosDeFoco > 0) ganchosRef.current.aoAcumular(r.segundosDeFoco);

    if (!r.concluiu) {
      setRestanteMs(r.restanteMs);
      return;
    }

    const eraFoco = modoRef.current === "foco";
    rodandoRef.current = false;
    setRodando(false);

    apitar(eraFoco, configRef.current.som);
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Foco", {
          body: eraFoco
            ? "Pomodoro concluído — hora da pausa"
            : "Pausa terminada — bora voltar",
        });
      }
    } catch {
      /* notificação é opcional */
    }

    ganchosRef.current.aoConcluir(eraFoco);

    if (eraFoco) {
      const proximo = cicloRef.current + 1;
      const vaiPraLonga = proximo >= configRef.current.longaCada;
      cicloRef.current = vaiPraLonga ? 0 : proximo;
      setCiclo(cicloRef.current);
      definirModo(vaiPraLonga ? "longa" : "curta");
    } else {
      definirModo("foco");
    }
  }, [definirModo]);

  /* ---------- laço principal ---------- */
  useEffect(() => {
    const id = setInterval(passo, 250);
    return () => clearInterval(id);
  }, [passo]);

  /* ---------- tela acesa e volta do segundo plano ----------

     Dois problemas diferentes:

     1. a tela apagar. O Wake Lock segura a tela acesa enquanto o
        cronômetro roda — é o que evita o problema em vez de
        remediar. O sistema devolve o lock sozinho quando a aba
        sai de vista, por isso ele é pedido de novo na volta.
     2. ter apagado assim mesmo (ou o navegador não ter Wake Lock).
        Aí o passo na volta acerta a conta de uma vez, porque
        avancarTimer trabalha com tempo real.                     */
  const lockRef = useRef<WakeLockSentinel | null>(null);

  const segurarTela = useCallback(async () => {
    if (!rodandoRef.current) return;
    if (lockRef.current) return;
    try {
      lockRef.current = await navigator.wakeLock?.request("screen");
      lockRef.current?.addEventListener("release", () => {
        lockRef.current = null;
      });
    } catch {
      /* navegador sem Wake Lock, ou recusado: o passo da volta resolve */
    }
  }, []);

  const soltarTela = useCallback(() => {
    void lockRef.current?.release().catch(() => {});
    lockRef.current = null;
  }, []);

  useEffect(() => {
    if (rodando) void segurarTela();
    else soltarTela();
  }, [rodando, segurarTela, soltarTela]);

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      passo();
      void segurarTela();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      soltarTela();
    };
  }, [passo, segurarTela, soltarTela]);

  /* ---------- ações ---------- */
  const alternar = useCallback(() => {
    if (rodandoRef.current) {
      rodandoRef.current = false;
      setRodando(false);
      return;
    }
    if (restanteRef.current <= 0)
      restanteRef.current = duracaoMs(modoRef.current);
    ultimoRef.current = Date.now();
    rodandoRef.current = true;
    setRodando(true);
    liberarSom();
  }, [duracaoMs]);

  const reiniciar = useCallback(() => {
    rodandoRef.current = false;
    sobraRef.current = 0;
    restanteRef.current = duracaoMs(modoRef.current);
    duracaoAplicadaRef.current = restanteRef.current;
    setRodando(false);
    setRestanteMs(restanteRef.current);
  }, [duracaoMs]);

  const pular = useCallback(() => {
    if (modoRef.current === "foco") {
      definirModo(
        cicloRef.current + 1 >= configRef.current.longaCada ? "longa" : "curta",
      );
    } else {
      definirModo("foco");
    }
  }, [definirModo]);

  const novo = restanteMs === duracaoMs(modo);

  return {
    modo,
    rodando,
    restanteMs,
    ciclo,
    novo,
    alternar,
    reiniciar,
    pular,
    definirModo,
    liberarAudio: liberarSom,
  };
}
