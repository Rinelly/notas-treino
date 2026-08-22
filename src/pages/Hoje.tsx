import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getOrCriarSessaoHoje,
  proximoTreino,
  type ProximoTreino,
} from "../db/queries";
import {
  getConfig,
  getDia,
  getTarefasDeHoje,
  salvarConfig,
} from "../foco/queries";
import { calcularVencimento, formatarDia } from "../lib/academia";
import {
  CONFIG_PADRAO,
  diaVazio,
  type Config,
  type Dia,
  type Tarefa,
} from "../foco/tipos";
import { dataLonga, fmtHM, hojeChave } from "../lib/datas";
import s from "./Hoje.module.scss";

function saudacao() {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Hoje() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO);
  const [dia, setDia] = useState<Dia>(() => diaVazio(hojeChave()));
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [treino, setTreino] = useState<ProximoTreino | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoAcademia, setEditandoAcademia] = useState(false);
  const [diaDigitado, setDiaDigitado] = useState("");
  const [erroAcademia, setErroAcademia] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [c, d, ts, tr] = await Promise.all([
          getConfig(),
          getDia(hojeChave()),
          getTarefasDeHoje(),
          proximoTreino(),
        ]);
        if (!vivo) return;
        setConfig(c);
        setDia(d);
        setTarefas(ts);
        setTreino(tr);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function salvarAcademia(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(diaDigitado);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      setErroAcademia("Escolha um dia entre 1 e 31.");
      return;
    }
    const nova = { ...config, academiaDia: n };
    setErroAcademia(null);
    try {
      await salvarConfig(nova);
      setConfig(nova);
      setEditandoAcademia(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErroAcademia(
        /academia_dia/.test(msg)
          ? "Falta rodar a migração no Supabase: alter table settings add column if not exists academia_dia int;"
          : msg,
      );
    }
  }

  async function abrirTreino() {
    if (!treino?.rotina?.id) return;
    const sessao = await getOrCriarSessaoHoje(treino.rotina.id);
    navigate(`/sessao/${sessao.id}`);
  }

  if (carregando) return <div className={s.page}>Carregando...</div>;
  if (erro) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <div className={s.rotulo}>Não consegui carregar</div>
          <div style={{ color: "var(--danger)", fontSize: 13 }}>{erro}</div>
        </div>
      </div>
    );
  }

  const metaSeg = config.metaHoras * 3600;
  const escala = Math.max(metaSeg, dia.seg) || 1;
  const bateu = dia.seg >= metaSeg;
  const pendentes = tarefas.filter((t) => !t.feita);
  const feitasHoje = tarefas.filter((t) => t.feita).length;

  return (
    <div className={s.page}>
      <header className={s.cabecalho}>
        <h1 className={s.saudacao}>{saudacao()}, Rinelly</h1>
        <div className={s.data}>{dataLonga(new Date())}</div>
      </header>

      <div className={s.grade}>
        {/* ---------- foco ---------- */}
        <button
          type="button"
          className={s.card}
          onClick={() => navigate("/foco")}
        >
          <div className={s.rotulo}>Foco de hoje</div>
          <div className={s.destaque}>
            {fmtHM(dia.seg)} <small>de {fmtHM(metaSeg)}</small>
          </div>
          <div className={s.barra}>
            <div
              className={`${s.fatia} ${s.trabalho}`}
              style={{ width: `${(dia.segTrabalho / escala) * 100}%` }}
            />
            <div
              className={`${s.fatia} ${s.estudo}`}
              style={{ width: `${(dia.segEstudo / escala) * 100}%` }}
            />
          </div>
          <div className={s.detalhe}>
            {bateu ? (
              <>Meta batida 🎉 — {dia.pomodoros} pomodoros</>
            ) : (
              <>
                Faltam {fmtHM(metaSeg - dia.seg)} · {dia.pomodoros} pomodoros
              </>
            )}
          </div>
          <div className={s.detalhe}>
            {fmtHM(dia.segTrabalho)} trabalho · {fmtHM(dia.segEstudo)} estudo
          </div>
        </button>

        {/* ---------- treino ---------- */}
        <button
          type="button"
          className={s.card}
          onClick={() => void abrirTreino()}
        >
          <div className={s.rotulo}>Treino atual</div>
          {treino?.rotina ? (
            <>
              <div
                className={s.destaque}
                style={{ fontSize: 17, lineHeight: 1.3 }}
              >
                Treino {treino.rotina.letra}
              </div>
              <div className={s.detalhe}>{treino.rotina.nome}</div>
              <div className={s.barra}>
                <div
                  className={`${s.fatia} ${s.feito}`}
                  style={{
                    width: `${treino.total ? (treino.feitos / treino.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className={s.detalhe}>
                {treino.feitos}/{treino.total} exercícios
              </div>
              <span
                className={[
                  s.selo,
                  treino.finalizada
                    ? s.ok
                    : treino.emAndamento
                      ? s.andamento
                      : s.pendente,
                ].join(" ")}
              >
                {treino.finalizada
                  ? "✓ concluído"
                  : treino.emAndamento
                    ? "em andamento"
                    : "não iniciado"}
              </span>
            </>
          ) : (
            <>
              <div className={s.destaque} style={{ fontSize: 17 }}>
                Sem treinos
              </div>
              <div className={s.vazio}>Nenhuma rotina cadastrada ainda.</div>
            </>
          )}
        </button>
      </div>

      {/* ---------- academia ---------- */}
      <div className={`${s.card} ${s.largo} ${s.semClique}`}>
        <div className={s.linhaTopo}>
          <div className={s.rotulo}>Academia</div>
          {config.academiaDia != null && !editandoAcademia && (
            <button
              type="button"
              className={s.linkzinho}
              onClick={() => {
                setDiaDigitado(String(config.academiaDia));
                setEditandoAcademia(true);
              }}
            >
              alterar
            </button>
          )}
        </div>

        {editandoAcademia || config.academiaDia == null ? (
          <form
            className={s.formAcademia}
            onSubmit={(e) => void salvarAcademia(e)}
          >
            <label>
              Vence todo dia
              <input
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                value={diaDigitado}
                onChange={(e) => setDiaDigitado(e.target.value)}
                placeholder="10"
                autoFocus={editandoAcademia}
              />
              do mês
            </label>
            <button type="submit" className={s.botaoSalvar}>
              Salvar
            </button>
            {config.academiaDia != null && (
              <button
                type="button"
                className={s.linkzinho}
                onClick={() => {
                  setEditandoAcademia(false);
                  setErroAcademia(null);
                }}
              >
                cancelar
              </button>
            )}
          </form>
        ) : (
          (() => {
            const v = calcularVencimento(config.academiaDia);
            return (
              <div className={s.linhaAcademia}>
                <span className={`${s.selo} ${s[v.nivel]}`}>{v.texto}</span>
                <span className={s.detalhe}>
                  mensalidade · {formatarDia(v.data)}
                </span>
              </div>
            );
          })()
        )}

        {erroAcademia && <div className={s.erroLinha}>{erroAcademia}</div>}
      </div>

      {/* ---------- tarefas ---------- */}
      <button
        type="button"
        className={`${s.card} ${s.largo}`}
        onClick={() => navigate("/foco")}
      >
        <div className={s.rotulo}>
          Tarefas{" "}
          {pendentes.length > 0 &&
            `· ${pendentes.length} pendente${pendentes.length > 1 ? "s" : ""}`}
        </div>

        {tarefas.length === 0 ? (
          <div className={s.vazio}>
            Nenhuma tarefa hoje. Abra o Foco pra planejar o que quer fazer.
          </div>
        ) : (
          <>
            <ul className={s.lista}>
              {pendentes.slice(0, 5).map((t) => (
                <li key={t.id} className={s.tarefa}>
                  <span
                    style={{
                      background:
                        t.tipo === "trabalho"
                          ? "var(--cor-trabalho)"
                          : "var(--cor-estudo)",
                    }}
                  />
                  <span className={s.nome}>{t.nome}</span>
                  {t.pomodoros > 0 && (
                    <span className={s.pomos}>{t.pomodoros} 🍅</span>
                  )}
                </li>
              ))}
            </ul>
            {(pendentes.length > 5 || feitasHoje > 0) && (
              <div className={s.detalhe}>
                {pendentes.length > 5 && `e mais ${pendentes.length - 5}. `}
                {feitasHoje > 0 &&
                  `${feitasHoje} já concluída${feitasHoje > 1 ? "s" : ""}.`}
              </div>
            )}
          </>
        )}
      </button>

      {/* ---------- anotação ---------- */}
      {dia.nota.trim() && (
        <div className={`${s.card} ${s.largo}`}>
          <div className={s.rotulo}>Anotação de hoje</div>
          <div className={s.nota}>{dia.nota}</div>
        </div>
      )}

      <div className={s.versao}>
        versão {__VERSAO__} ·{" "}
        <button
          type="button"
          className={s.linkVersao}
          onClick={() => navigate("/diagnostico")}
        >
          diagnóstico
        </button>
      </div>
    </div>
  );
}
