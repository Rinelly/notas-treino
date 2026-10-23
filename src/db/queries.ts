import { supabase, uid } from "../lib/supabase";
import {
  ultimasMarcas,
  type LinhaComSessao,
  type Marca,
} from "./ultimasMarcas";
import {
  escolherTreino,
  SEM_TREINO,
  type TreinoEscolhido,
} from "./escolherTreino";
import { linhasDeHistorico, type LinhaHistorico } from "./historico";
import { inserirExercicio } from "./exercicios";
import type {
  CategoriaExercicio,
  Execucao,
  ExercicioRotina,
  Rotina,
  Sessao,
} from "../types";

export function hoje() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

type RotinaRow = {
  id: number;
  dia_semana: string;
  nome: string;
  exercicios: ExercicioRotina[] | null;
};
type SessaoRow = {
  id: number;
  rotina_id: number;
  data: string;
  finalizada: boolean;
};
type ExecucaoRow = {
  id: number;
  sessao_id: number;
  exercicio_id: string;
  concluido: boolean;
  carga: number | string | null;
  reps_feitas: number | null;
};

function paraRotina(r: RotinaRow): Rotina {
  return {
    id: r.id,
    diaSemana: r.dia_semana,
    nome: r.nome,
    exercicios: r.exercicios ?? [],
  };
}
function paraSessao(s: SessaoRow): Sessao {
  return {
    id: s.id,
    rotinaId: s.rotina_id,
    data: s.data,
    finalizada: s.finalizada,
  };
}
function paraExecucao(e: ExecucaoRow): Execucao {
  return {
    id: e.id,
    sessaoId: e.sessao_id,
    exercicioId: e.exercicio_id,
    concluido: e.concluido,
    carga: e.carga == null ? undefined : Number(e.carga),
    repsFeitas: e.reps_feitas ?? undefined,
  };
}

function checar<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function letraDoTreino(indice: number) {
  return String.fromCharCode(65 + (indice % 26));
}

export async function getRotinas(): Promise<Rotina[]> {
  const rows = checar(
    await supabase
      .from("rotinas")
      .select("id, dia_semana, nome, exercicios")
      .order("id"),
  ) as RotinaRow[] | null;
  return (rows ?? []).map((r, i) => ({
    ...paraRotina(r),
    letra: letraDoTreino(i),
  }));
}

export async function getRotina(id: number): Promise<Rotina | null> {
  const rotinas = await getRotinas();
  return rotinas.find((r) => r.id === id) ?? null;
}

export async function getSessao(id: number): Promise<Sessao | null> {
  const row = checar(
    await supabase
      .from("sessoes")
      .select("id, rotina_id, data, finalizada")
      .eq("id", id)
      .maybeSingle(),
  ) as SessaoRow | null;
  return row ? paraSessao(row) : null;
}

export async function getOrCriarSessaoHoje(rotinaId: number): Promise<Sessao> {
  return getOrCriarSessaoEm(rotinaId, hoje());
}

export async function sessoesDoDia(
  data: string,
): Promise<{ sessao: Sessao; rotina: Rotina }[]> {
  const rows =
    (checar(
      await supabase
        .from("sessoes")
        .select("id, rotina_id, data, finalizada")
        .eq("data", data),
    ) as SessaoRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const rotinas = await getRotinas();
  return rows
    .map((r) => {
      const rotina = rotinas.find((x) => x.id === r.rotina_id);
      return rotina ? { sessao: paraSessao(r), rotina } : null;
    })
    .filter((x): x is { sessao: Sessao; rotina: Rotina } => x !== null);
}

export async function getOrCriarSessaoEm(
  rotinaId: number,
  data: string,
): Promise<Sessao> {
  const existente = checar(
    await supabase
      .from("sessoes")
      .select("id, rotina_id, data, finalizada")
      .eq("rotina_id", rotinaId)
      .eq("data", data)
      .maybeSingle(),
  ) as SessaoRow | null;
  if (existente) return paraSessao(existente);

  const criada = checar(
    await supabase
      .from("sessoes")
      .upsert(
        { user_id: await uid(), rotina_id: rotinaId, data },
        { onConflict: "user_id,rotina_id,data" },
      )
      .select("id, rotina_id, data, finalizada")
      .single(),
  ) as SessaoRow;
  return paraSessao(criada);
}

export async function finalizarSessao(sessaoId: number, finalizada: boolean) {
  checar(
    await supabase.from("sessoes").update({ finalizada }).eq("id", sessaoId),
  );
}

export async function execucoesDaSessao(sessaoId: number): Promise<Execucao[]> {
  const rows = checar(
    await supabase
      .from("execucoes")
      .select("id, sessao_id, exercicio_id, concluido, carga, reps_feitas")
      .eq("sessao_id", sessaoId),
  ) as ExecucaoRow[] | null;
  return (rows ?? []).map(paraExecucao);
}

export async function upsertExecucao(
  sessaoId: number,
  exercicioId: string,
  dados: Partial<Pick<Execucao, "concluido" | "carga" | "repsFeitas">>,
) {
  const patch: Record<string, unknown> = {};
  if (dados.concluido !== undefined) patch.concluido = dados.concluido;
  if (dados.carga !== undefined) patch.carga = dados.carga ?? null;
  if (dados.repsFeitas !== undefined)
    patch.reps_feitas = dados.repsFeitas ?? null;
  if (Object.keys(patch).length === 0) return;

  // 1) já existe? então só altera o que mudou
  const alteradas = checar(
    await supabase
      .from("execucoes")
      .update(patch)
      .eq("sessao_id", sessaoId)
      .eq("exercicio_id", exercicioId)
      .select("id"),
  ) as { id: number }[] | null;

  if (alteradas && alteradas.length > 0) return;

  // 2) primeira vez nesse exercício: cria a linha
  const res = await supabase.from("execucoes").insert({
    user_id: await uid(),
    sessao_id: sessaoId,
    exercicio_id: exercicioId,
    concluido: false,
    carga: null,
    reps_feitas: null,
    ...patch,
  });

  if (res.error) {
    if (res.error.code === "23505") {
      checar(
        await supabase
          .from("execucoes")
          .update(patch)
          .eq("sessao_id", sessaoId)
          .eq("exercicio_id", exercicioId),
      );
      return;
    }
    throw new Error(res.error.message);
  }
}

/**
 * A carga/reps da última vez, de TODOS os exercícios da rotina,
 * numa consulta só.
 *
 * Antes isso era uma consulta por exercício dentro de um
 * Promise.all — oito exercícios, oito idas ao servidor, bem na
 * hora em que a conexão é pior (academia).
 */
export async function marcasDaRotina(
  rotinaId: number,
  sessaoAtualId?: number,
): Promise<Map<string, Marca>> {
  const rows = checar(
    await supabase
      .from("execucoes")
      .select("sessao_id, exercicio_id, carga, reps_feitas, sessoes!inner(data, rotina_id)")
      .eq("sessoes.rotina_id", rotinaId)
      .or("carga.not.is.null,reps_feitas.not.is.null"),
  ) as unknown as LinhaComSessao[] | null;

  return ultimasMarcas(rows ?? [], sessaoAtualId);
}

export async function ultimaSessaoComProgresso() {
  type SessaoComRotina = SessaoRow & { rotinas: RotinaRow | null };

  const sessoes =
    (checar(
      await supabase
        .from("sessoes")
        .select(
          "id, rotina_id, data, finalizada, rotinas!inner(id, dia_semana, nome, exercicios)",
        )
        .order("data", { ascending: false })
        .limit(40),
    ) as unknown as SessaoComRotina[] | null) ?? [];

  if (sessoes.length === 0) return null;

  const feitosPorSessao = new Map<number, number>();
  const execs = checar(
    await supabase
      .from("execucoes")
      .select("sessao_id")
      .in(
        "sessao_id",
        sessoes.map((s) => s.id),
      )
      .eq("concluido", true),
  ) as { sessao_id: number }[] | null;

  for (const e of execs ?? []) {
    feitosPorSessao.set(
      e.sessao_id,
      (feitosPorSessao.get(e.sessao_id) ?? 0) + 1,
    );
  }

  for (const s of sessoes) {
    const feitos = feitosPorSessao.get(s.id) ?? 0;
    if (feitos === 0 || !s.rotinas) continue;
    const rotina = paraRotina(s.rotinas);
    return {
      sessao: paraSessao(s),
      rotina,
      feitos,
      total: rotina.exercicios.length,
    };
  }

  return null;
}

export async function diasTreinadosNoMes(ano: number, mesIndice0: number) {
  const primeiro = `${ano}-${String(mesIndice0 + 1).padStart(2, "0")}-01`;
  const fimMes = new Date(ano, mesIndice0 + 1, 0).getDate();
  const ultimo = `${ano}-${String(mesIndice0 + 1).padStart(2, "0")}-${String(fimMes).padStart(2, "0")}`;

  const sessoes =
    (checar(
      await supabase
        .from("sessoes")
        .select("id, rotina_id, data, finalizada")
        .gte("data", primeiro)
        .lte("data", ultimo),
    ) as SessaoRow[] | null) ?? [];

  const finalizados = new Set(
    sessoes.filter((s) => s.finalizada).map((s) => s.data),
  );
  if (sessoes.length === 0)
    return { comProgresso: new Set<string>(), finalizados };

  const dataPorSessaoId = new Map(sessoes.map((s) => [s.id, s.data]));
  const execs =
    (checar(
      await supabase
        .from("execucoes")
        .select("sessao_id")
        .in("sessao_id", [...dataPorSessaoId.keys()])
        .eq("concluido", true),
    ) as { sessao_id: number }[] | null) ?? [];

  const comProgresso = new Set(
    execs.map((e) => dataPorSessaoId.get(e.sessao_id)!).filter(Boolean),
  );

  return { comProgresso, finalizados };
}

export async function atualizarExercicio(
  rotinaId: number,
  exercicioId: string,
  dados: Partial<{
    nome: string;
    seriesAlvo: string;
    descanso: string;
    observacao: string;
    categoria: CategoriaExercicio;
  }>,
) {
  const rotina = await getRotina(rotinaId);
  if (!rotina) return;

  const exercicios = rotina.exercicios.map((ex) =>
    ex.id === exercicioId ? { ...ex, ...dados } : ex,
  );
  checar(
    await supabase.from("rotinas").update({ exercicios }).eq("id", rotinaId),
  );
}

export async function adicionarExercicio(
  rotinaId: number,
  dados: { nome: string; categoria: CategoriaExercicio; seriesAlvo: string },
) {
  const rotina = await getRotina(rotinaId);
  if (!rotina) return;

  const novoExercicio: ExercicioRotina = { id: crypto.randomUUID(), ...dados };
  // entra no fim do bloco da categoria dele, não no fim da lista
  checar(
    await supabase
      .from("rotinas")
      .update({ exercicios: inserirExercicio(rotina.exercicios, novoExercicio) })
      .eq("id", rotinaId),
  );
  return novoExercicio;
}

/**
 * Grava a lista inteira na ordem em que ela está na tela.
 *
 * Manda a lista pronta em vez de "mova o item X para a posição N":
 * a tela já reordenou enquanto o dedo arrastava, e recalcular aqui
 * daria chance de os dois discordarem.
 */
export async function salvarOrdemExercicios(
  rotinaId: number,
  exercicios: ExercicioRotina[],
) {
  checar(
    await supabase.from("rotinas").update({ exercicios }).eq("id", rotinaId),
  );
}

/** o nome completo da rotina: "Inferiores A — quadríceps e glúteos" */
export async function renomearRotina(rotinaId: number, nome: string) {
  checar(await supabase.from("rotinas").update({ nome }).eq("id", rotinaId));
}

export async function removerExercicio(rotinaId: number, exercicioId: string) {
  const rotina = await getRotina(rotinaId);
  if (!rotina) return;

  const exercicios = rotina.exercicios.filter((ex) => ex.id !== exercicioId);
  checar(
    await supabase.from("rotinas").update({ exercicios }).eq("id", rotinaId),
  );
}

export type ProximoTreino = TreinoEscolhido;

/**
 * Busca o que a regra precisa e delega pra escolherTreino.
 * A regra em si mora em escolherTreino.ts, coberta por teste.
 */
export async function proximoTreino(): Promise<ProximoTreino> {
  const rotinas = await getRotinas();
  if (rotinas.length === 0) return SEM_TREINO;

  const sessoes =
    (checar(
      await supabase
        .from("sessoes")
        .select("id, rotina_id, data, finalizada")
        .order("data", { ascending: false })
        .order("id", { ascending: false })
        .limit(40),
    ) as SessaoRow[] | null) ?? [];

  const feitosPorSessao = new Map<number, number>();
  if (sessoes.length) {
    const execs =
      (checar(
        await supabase
          .from("execucoes")
          .select("sessao_id")
          .in(
            "sessao_id",
            sessoes.map((s) => s.id),
          )
          .eq("concluido", true),
      ) as { sessao_id: number }[] | null) ?? [];
    for (const e of execs) {
      feitosPorSessao.set(
        e.sessao_id,
        (feitosPorSessao.get(e.sessao_id) ?? 0) + 1,
      );
    }
  }

  return escolherTreino(rotinas, sessoes, feitosPorSessao, hoje());
}

/**
 * Tudo o que já foi registrado, achatado em linhas de planilha.
 * A junção mora em historico.ts, coberta por teste; aqui é só busca.
 */
export async function historicoCompleto(): Promise<LinhaHistorico[]> {
  const rotinas = await getRotinas();

  const sessoes = (
    ((checar(
      await supabase
        .from("sessoes")
        .select("id, rotina_id, data, finalizada")
        .order("data", { ascending: false }),
    ) as SessaoRow[] | null) ?? []) as SessaoRow[]
  ).map(paraSessao);

  if (sessoes.length === 0) return [];

  const execucoes = (
    ((checar(
      await supabase
        .from("execucoes")
        .select("id, sessao_id, exercicio_id, concluido, carga, reps_feitas")
        .in(
          "sessao_id",
          sessoes.map((s) => s.id!),
        ),
    ) as ExecucaoRow[] | null) ?? []) as ExecucaoRow[]
  ).map(paraExecucao);

  return linhasDeHistorico(rotinas, sessoes, execucoes);
}
