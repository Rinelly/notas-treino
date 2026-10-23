/* =========================================================
   Medidas — peso e circunferências

   Uma linha por dia: registrar de novo no mesmo dia corrige em
   vez de criar outra entrada. Pesagem dupla no mesmo dia é ruído
   de balança, não dado, e sujaria o gráfico.
   ========================================================= */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apagarMedida, getMedidas, salvarMedida } from '../db/medidasQueries'
import { dataDaChave, haQuantoTempo, hojeChave } from '../lib/datas'
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
} from '../lib/medidas'
import s from './Medidas.module.scss'

const LARGURA = 280
const ALTURA = 64

function Grafico({ medidas }: { medidas: Medida[] }) {
  const pontos = serie(medidas, 'peso')
  if (pontos.length < 2) return null

  const d = caminho(pontos, LARGURA, ALTURA)
  const ultimoPonto = pontos[pontos.length - 1]

  return (
    <svg
      className={s.grafico}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Peso ao longo de ${pontos.length} medições`}
    >
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle
        cx={ultimoPonto.x * LARGURA}
        cy={3 + (1 - ultimoPonto.y) * (ALTURA - 6)}
        r="3.5"
        fill="var(--accent)"
      />
    </svg>
  )
}

export default function Medidas() {
  const [medidas, setMedidas] = useState<Medida[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [data, setData] = useState(hojeChave())
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [nota, setNota] = useState('')

  const carregar = useCallback(async () => {
    try {
      setMedidas(await getMedidas())
      setErro(null)
    } catch (e) {
      setMedidas([])
      setErro(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /* trocar a data traz o que já estava anotado naquele dia, pra
     corrigir em vez de apagar sem querer o resto da linha */
  useEffect(() => {
    if (!medidas) return
    const doDia = medidas.find((m) => m.data === data)
    const preenchido: Record<string, string> = {}
    for (const c of CAMPOS) {
      const v = doDia?.[c.chave]
      preenchido[c.chave] = v == null ? '' : String(v).replace('.', ',')
    }
    setCampos(preenchido)
    setNota(doDia?.nota ?? '')
  }, [data, medidas])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!medidas) return

    const nova: Medida = { ...medidaVazia(data), nota }
    let algum = false
    for (const c of CAMPOS) {
      const v = lerNumero(campos[c.chave] ?? '')
      nova[c.chave] = v
      if (v != null) algum = true
    }
    if (!algum && !nota.trim()) {
      setErro('Preencha pelo menos uma medida.')
      return
    }

    setSalvando(true)
    try {
      const gravada = await salvarMedida(nova)
      setMedidas((prev) => {
        const sem = (prev ?? []).filter((m) => m.data !== gravada.data)
        return [...sem, gravada].sort((a, b) => (a.data < b.data ? 1 : -1))
      })
      setErro(null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err))
    } finally {
      setSalvando(false)
    }
  }

  async function apagar(dia: string) {
    try {
      await apagarMedida(dia)
      setMedidas((prev) => (prev ?? []).filter((m) => m.data !== dia))
      setErro(null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err))
    }
  }

  if (medidas == null) return <div className={s.page}>Carregando...</div>

  const pesoUltimo = ultimo(medidas, 'peso')
  const pesoVar = variacao(medidas, 'peso')

  return (
    <div className={s.page}>
      <div className={s.topo}>
        <Link to="/" className={s.voltar}>
          ← Voltar
        </Link>
      </div>

      <h1>Medidas</h1>

      {erro && (
        <div className={s.erro}>
          {faltaTabela(erro) ? (
            <>
              <b>Falta criar a tabela.</b> Rode{' '}
              <code>supabase/migracao-medidas.sql</code> no SQL Editor do Supabase e
              recarregue esta página.
            </>
          ) : (
            <>
              <b>Deu problema.</b> {erro}
            </>
          )}
        </div>
      )}

      {/* ---------- peso em destaque ---------- */}
      <div className={s.card}>
        <div className={s.rotulo}>Peso</div>
        <div className={s.linhaPeso}>
          <div>
            <div className={s.destaque}>
              {fmt(pesoUltimo?.valor ?? null)} <small>kg</small>
            </div>
            <div className={s.detalhe}>
              {pesoUltimo
                ? pesoVar
                  ? `${pesoVar.delta > 0 ? '+' : ''}${fmt(pesoVar.delta)} kg desde ${haQuantoTempo(pesoVar.anteriorEm)}`
                  : `primeira pesagem, ${haQuantoTempo(pesoUltimo.data)}`
                : 'Nenhuma pesagem ainda.'}
            </div>
          </div>
          <Grafico medidas={medidas} />
        </div>
      </div>

      {/* ---------- os outros campos, cada um com a variação ---------- */}
      <div className={s.tiras}>
        {CAMPOS.filter((c) => c.chave !== 'peso').map((c) => {
          const u = ultimo(medidas, c.chave)
          const v = variacao(medidas, c.chave)
          return (
            <div key={c.chave} className={s.tira}>
              <span className={s.tiraRotulo}>{c.rotulo}</span>
              <span className={s.tiraValor}>
                {fmt(u?.valor ?? null, c.casas)}
                {u && <small> {c.unidade}</small>}
              </span>
              {v && (
                <span className={v.delta === 0 ? s.igual : v.delta > 0 ? s.subiu : s.caiu}>
                  {v.delta > 0 ? '+' : ''}
                  {fmt(v.delta, c.casas)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ---------- registrar ---------- */}
      <form className={s.card} onSubmit={(e) => void salvar(e)}>
        <div className={s.rotulo}>Registrar</div>

        <label className={s.campoData}>
          Dia
          <input
            type="date"
            value={data}
            max={hojeChave()}
            onChange={(e) => setData(e.target.value || hojeChave())}
          />
        </label>

        <div className={s.grade}>
          {CAMPOS.map((c) => (
            <label key={c.chave} className={s.campo}>
              <span>
                {c.rotulo} <small>({c.unidade})</small>
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={campos[c.chave] ?? ''}
                placeholder="—"
                onChange={(e) =>
                  setCampos((prev) => ({ ...prev, [c.chave]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>

        <label className={s.campo}>
          <span>Observação</span>
          <input
            type="text"
            value={nota}
            placeholder="em jejum, depois do treino..."
            onChange={(e) => setNota(e.target.value)}
          />
        </label>

        <button type="submit" className={s.botao} disabled={salvando}>
          {salvando ? 'Salvando...' : medidas.some((m) => m.data === data) ? 'Atualizar' : 'Salvar'}
        </button>
        <div className={s.dica}>
          Pode deixar em branco o que não mediu. Registrar de novo no mesmo dia corrige
          a entrada em vez de criar outra.
        </div>
      </form>

      {/* ---------- histórico ---------- */}
      {medidas.length > 0 && (
        <div className={s.card}>
          <div className={s.rotulo}>Histórico</div>
          <ul className={s.lista}>
            {medidas.map((m) => (
              <li key={m.data} className={s.linha}>
                <button
                  type="button"
                  className={s.linhaData}
                  onClick={() => setData(m.data)}
                  title="Abrir no formulário"
                >
                  {dataDaChave(m.data).toLocaleDateString('pt-BR')}
                </button>
                <span className={s.linhaValores}>
                  {CAMPOS.filter((c) => m[c.chave] != null)
                    .map((c) => `${c.rotulo} ${fmt(m[c.chave] as number, c.casas)}${c.unidade}`)
                    .join(' · ') || '—'}
                </span>
                <button
                  type="button"
                  className={s.apagar}
                  onClick={() => void apagar(m.data)}
                  aria-label={`Apagar medidas de ${m.data}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
