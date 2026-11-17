import { useEffect, useRef, useState, type ReactNode } from 'react'
import { enviarConversa, pedirResumo, traduzir, tutorConfigurado } from '../../estudos/api'
import {
  CENARIOS,
  rotuloDoCenario,
  type Cenario,
  type ContextoDoTutor,
  type Correcao,
  type Mensagem,
  type NovaSessao,
  type PalavraNova,
} from '../../estudos/tipos'
import { useEscuta } from '../../estudos/useVoz'
import ResumoMarkdown from './ResumoMarkdown'
import s from '../../pages/Estudos.module.scss'

const CHAVE_VOZ = 'estudos.lerEmVozAlta'

function lerPreferenciaDeVoz() {
  try {
    return localStorage.getItem(CHAVE_VOZ) !== '0'
  } catch {
    return true
  }
}

const novoId = () => crypto.randomUUID()

interface Props {
  /** foco atual + erros e palavras recentes: o que o tutor sabe além da conversa */
  contexto: ContextoDoTutor
  /** o cartão "O que estou estudando", mostrado antes da conversa começar */
  children?: ReactNode
  falar: (texto: string, velocidade?: number) => void
  calar: () => void
  aoAprender: (palavras: PalavraNova[]) => void
  aoErrar: (correcoes: Correcao[]) => void
  aoEncerrar: (sessao: NovaSessao) => void
}

export default function Conversa({ contexto, children, falar, calar, aoAprender, aoErrar, aoEncerrar }: Props) {
  const [cenario, setCenario] = useState<Cenario>('free')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [lerEmVozAlta, setLerEmVozAlta] = useState(lerPreferenciaDeVoz)
  const [resumo, setResumo] = useState<string | null>(null)
  /** qual chip de palavra nova está aberto, mostrando o significado */
  const [palavraAberta, setPalavraAberta] = useState<string | null>(null)

  /* tradução das falas do tutor, pedida uma a uma: o texto fica guardado
     por mensagem, então mostrar de novo não chama o tutor outra vez */
  const [traducoes, setTraducoes] = useState<Record<string, string>>({})
  const [traducaoVisivel, setTraducaoVisivel] = useState<Record<string, boolean>>({})
  const [traduzindo, setTraduzindo] = useState<Record<string, boolean>>({})
  const [erroTraducao, setErroTraducao] = useState<Record<string, string>>({})

  const rolagemRef = useRef<HTMLDivElement>(null)
  const inicioRef = useRef<Date | null>(null)
  // muda a cada sessão nova; resposta de uma sessão abandonada é ignorada
  const sessaoRef = useRef(0)

  const escuta = useEscuta((falado) => void enviar(falado))

  useEffect(() => {
    const el = rolagemRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensagens, enviando, escuta.parcial, resumo, erro])

  function trocarVoz() {
    const novo = !lerEmVozAlta
    if (!novo) calar()
    setLerEmVozAlta(novo)
    try {
      localStorage.setItem(CHAVE_VOZ, novo ? '1' : '0')
    } catch {
      /* só não lembra da escolha */
    }
  }

  async function enviar(conteudo: string, oculta = false) {
    const limpo = conteudo.trim()
    if (!limpo || enviando) return
    setErro(null)
    setTexto('')
    calar()
    if (!inicioRef.current) inicioRef.current = new Date()

    const sessao = sessaoRef.current
    const minha: Mensagem = { id: novoId(), papel: 'user', texto: limpo, oculta }
    const historico = [...mensagens, minha]
    setMensagens(historico)
    setEnviando(true)

    try {
      const r = await enviarConversa(historico, cenario, contexto)
      if (sessao !== sessaoRef.current) return
      // as correções são sobre a última fala; o "oi" automático não tem o que corrigir
      const correcoes = oculta ? [] : (r.corrections ?? [])
      const palavras = r.new_words ?? []
      setMensagens((antes) => [
        ...antes.map((m) => (m.id === minha.id && !oculta ? { ...m, correcoes } : m)),
        { id: novoId(), papel: 'assistant', texto: r.reply, palavras },
      ])
      aoAprender(palavras)
      aoErrar(correcoes)
      if (lerEmVozAlta) falar(r.reply)
    } catch (ex) {
      if (sessao !== sessaoRef.current) return
      setErro(ex instanceof Error ? ex.message : 'Algo deu errado.')
      // devolve o texto pra caixa: ninguém quer digitar (ou falar) de novo
      setMensagens((antes) => antes.filter((m) => m.id !== minha.id))
      if (!oculta) setTexto(limpo)
    } finally {
      if (sessao === sessaoRef.current) setEnviando(false)
    }
  }

  async function alternarTraducao(m: Mensagem) {
    if (traducaoVisivel[m.id]) {
      setTraducaoVisivel((v) => ({ ...v, [m.id]: false }))
      return
    }
    if (traducoes[m.id]) {
      setTraducaoVisivel((v) => ({ ...v, [m.id]: true }))
      return
    }
    if (traduzindo[m.id]) return

    const sessao = sessaoRef.current
    setTraduzindo((v) => ({ ...v, [m.id]: true }))
    setErroTraducao((v) => ({ ...v, [m.id]: '' }))
    try {
      const pt = await traduzir(m.texto)
      if (sessao !== sessaoRef.current) return
      setTraducoes((v) => ({ ...v, [m.id]: pt }))
      setTraducaoVisivel((v) => ({ ...v, [m.id]: true }))
    } catch (ex) {
      if (sessao !== sessaoRef.current) return
      const msg = ex instanceof Error ? ex.message : 'Não consegui traduzir.'
      setErroTraducao((v) => ({ ...v, [m.id]: msg }))
    } finally {
      if (sessao === sessaoRef.current) setTraduzindo((v) => ({ ...v, [m.id]: false }))
    }
  }

  const falas = mensagens.filter((m) => m.papel === 'user' && !m.oculta)

  async function encerrar() {
    if (!falas.length || enviando) return
    calar()
    const sessao = sessaoRef.current
    setEnviando(true)
    setErro(null)
    try {
      const textoDoResumo = await pedirResumo(mensagens, cenario, contexto)
      if (sessao !== sessaoRef.current) return
      setResumo(textoDoResumo)
      const inicio = inicioRef.current ?? new Date()
      aoEncerrar({
        cenario,
        mensagens: falas.length,
        correcoes: mensagens.reduce((n, m) => n + (m.correcoes?.length ?? 0), 0),
        palavras: mensagens.reduce((n, m) => n + (m.palavras?.length ?? 0), 0),
        duracaoSeg: Math.max(0, Math.round((Date.now() - inicio.getTime()) / 1000)),
        resumo: textoDoResumo,
        iniciadaEm: inicio.toISOString(),
      })
    } catch (ex) {
      if (sessao === sessaoRef.current) {
        setErro(ex instanceof Error ? ex.message : 'Não consegui gerar o resumo.')
      }
    } finally {
      if (sessao === sessaoRef.current) setEnviando(false)
    }
  }

  function novaSessao() {
    sessaoRef.current += 1
    inicioRef.current = null
    calar()
    if (escuta.ouvindo) escuta.cancelar()
    setMensagens([])
    setResumo(null)
    setErro(null)
    setTexto('')
    setEnviando(false)
    setPalavraAberta(null)
    setTraducoes({})
    setTraducaoVisivel({})
    setTraduzindo({})
    setErroTraducao({})
  }

  function voltar() {
    // só pergunta se há conversa de verdade que ainda não virou resumo
    if (falas.length && !resumo && !window.confirm('Sair da sessão? A conversa atual será perdida.')) {
      return
    }
    novaSessao()
  }

  /* ---------- antes de começar: escolha do cenário ---------- */
  if (!mensagens.length) {
    return (
      <>
        <section className={s.card}>
          <h2 className={s.titulo}>Escolha um cenário</h2>

          <div className={s.cenarios}>
            {CENARIOS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${s.cenario} ${cenario === c.id ? s.ativo : ''}`}
                aria-pressed={cenario === c.id}
                onClick={() => setCenario(c.id)}
              >
                <strong>{c.rotulo}</strong>
                <span>{c.dica}</span>
              </button>
            ))}
          </div>

          {tutorConfigurado ? (
            <div className={s.comecar}>
              <button
                type="button"
                className={s.principal}
                disabled={enviando}
                onClick={() => void enviar("Hi! Let's start the session.", true)}
              >
                {enviando ? 'Chamando o tutor...' : 'Começar conversa'}
              </button>
              <button type="button" className={s.secundario} onClick={trocarVoz}>
                {lerEmVozAlta ? '🔊 Respostas em voz alta' : '🔇 Respostas só em texto'}
              </button>
            </div>
          ) : (
            <p className={s.aviso}>
              O tutor ainda não está publicado: por enquanto ele só conversa com o app rodando no
              computador. O vocabulário e o histórico continuam disponíveis aqui.
            </p>
          )}

          {erro && <p className={s.erro}>{erro}</p>}
          {tutorConfigurado && !escuta.suportado && (
            <p className={s.nota}>
              Este navegador não reconhece voz. Dá pra conversar digitando; pra falar, use o Chrome
              ou o Edge.
            </p>
          )}
        </section>
        {children}
      </>
    )
  }

  /* ---------- a conversa ---------- */
  return (
    <section className={`${s.card} ${s.chat}`}>
      <header className={s.chatTopo}>
        <button type="button" className={s.secundario} onClick={voltar} title="Voltar para a escolha de cenário">
          ← Voltar
        </button>
        <span className={s.chatCenario}>{rotuloDoCenario(cenario)}</span>
        <span className={s.espaco} />
        <button
          type="button"
          className={s.secundario}
          onClick={trocarVoz}
          title="Ler as respostas em voz alta"
          aria-pressed={lerEmVozAlta}
        >
          {lerEmVozAlta ? '🔊 Voz' : '🔇 Voz'}
        </button>
        {!resumo && (
          <button
            type="button"
            className={s.secundario}
            onClick={() => void encerrar()}
            disabled={enviando || !falas.length}
            title="Encerrar e ver o resumo da sessão"
          >
            Encerrar
          </button>
        )}
      </header>

      <div className={s.mensagens} ref={rolagemRef}>
        {mensagens
          .filter((m) => !m.oculta)
          .map((m) => (
            <div key={m.id} className={`${s.linha} ${m.papel === 'user' ? s.minha : s.tutor}`}>
              <div className={s.balao}>
                <p>{m.texto}</p>
                {m.papel === 'assistant' && traducaoVisivel[m.id] && traducoes[m.id] && (
                  <p className={s.traducao} lang="pt-BR">
                    {traducoes[m.id]}
                  </p>
                )}
                {m.papel === 'assistant' && (
                  <button
                    type="button"
                    className={s.ouvir}
                    onClick={() => falar(m.texto)}
                    title="Ouvir de novo"
                    aria-label="Ouvir de novo"
                  >
                    ▶
                  </button>
                )}
              </div>

              {m.papel === 'assistant' && (
                <button
                  type="button"
                  className={s.traduzir}
                  onClick={() => void alternarTraducao(m)}
                  disabled={traduzindo[m.id]}
                  aria-expanded={Boolean(traducaoVisivel[m.id])}
                >
                  {traduzindo[m.id]
                    ? 'Traduzindo...'
                    : traducaoVisivel[m.id]
                      ? 'Ocultar tradução'
                      : 'Ver tradução'}
                </button>
              )}
              {erroTraducao[m.id] && <p className={s.erro}>{erroTraducao[m.id]}</p>}

              {m.correcoes &&
                (m.correcoes.length ? (
                  <div className={s.correcoes}>
                    {m.correcoes.map((c, i) => (
                      <div key={i} className={s.correcao}>
                        <span className={s.errado}>{c.original}</span>
                        <span className={s.seta}>→</span>
                        <span className={s.certo}>{c.better}</span>
                        {c.explanation && <small>{c.explanation}</small>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={s.semErros}>✓ sem erros</div>
                ))}

              {m.palavras && m.palavras.length > 0 && (
                <div className={s.palavras}>
                  {m.palavras.map((p) => {
                    const chave = `${m.id}:${p.word}`
                    const aberta = palavraAberta === chave
                    return (
                      <button
                        key={p.word}
                        type="button"
                        className={`${s.palavra} ${aberta ? s.aberta : ''}`}
                        aria-expanded={aberta}
                        onClick={() => setPalavraAberta(aberta ? null : chave)}
                      >
                        <b>{p.word}</b>
                        {aberta && (
                          <span>
                            {p.meaning}
                            {p.example && <i>{p.example}</i>}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

        {escuta.ouvindo && escuta.parcial && (
          <div className={`${s.linha} ${s.minha}`}>
            <div className={`${s.balao} ${s.provisorio}`}>
              <p>{escuta.parcial}…</p>
            </div>
          </div>
        )}

        {enviando && (
          <div className={`${s.linha} ${s.tutor}`}>
            <div className={`${s.balao} ${s.digitando}`} aria-label="O tutor está respondendo">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {resumo && (
          <div className={s.resumo}>
            <h3 className={s.titulo}>Resumo da sessão</h3>
            <ResumoMarkdown texto={resumo} />
            <button type="button" className={s.principal} onClick={novaSessao}>
              Nova sessão
            </button>
          </div>
        )}

        {erro && <p className={s.erro}>{erro}</p>}
        {escuta.erro && <p className={s.erro}>Microfone: {escuta.erro}</p>}
      </div>

      {!resumo && (
        <form
          className={s.compositor}
          onSubmit={(e) => {
            e.preventDefault()
            void enviar(texto)
          }}
        >
          <button
            type="button"
            className={`${s.microfone} ${escuta.ouvindo ? s.gravando : ''}`}
            onClick={() => {
              if (escuta.ouvindo) return escuta.parar()
              calar()
              escuta.comecar()
            }}
            disabled={!escuta.suportado || enviando}
            title={
              !escuta.suportado
                ? 'Este navegador não reconhece voz'
                : escuta.ouvindo
                  ? 'Parar e enviar'
                  : 'Falar'
            }
            aria-label={escuta.ouvindo ? 'Parar e enviar' : 'Falar'}
          >
            {escuta.ouvindo ? '■' : '🎙'}
          </button>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={escuta.ouvindo ? 'Ouvindo… toque em ■ para enviar' : 'Type or speak in English…'}
            disabled={enviando || escuta.ouvindo}
            aria-label="Sua mensagem em inglês"
          />
          <button type="submit" className={s.enviar} disabled={!texto.trim() || enviando}>
            Enviar
          </button>
        </form>
      )}
    </section>
  )
}
