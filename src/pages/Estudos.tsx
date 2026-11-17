/* =========================================================
   Estudos — por enquanto, o tutor de inglês

   A conversa fala com a tutor-api (FastAPI + Gemini); o
   vocabulário, as correções e os resumos ficam no Supabase,
   junto com o resto do app.
   ========================================================= */

import { useMemo, useState } from 'react'
import Conversa from '../components/estudos/Conversa'
import FocoAtual from '../components/estudos/FocoAtual'
import Historico from '../components/estudos/Historico'
import Vocabulario from '../components/estudos/Vocabulario'
import { montarContexto } from '../estudos/contexto'
import { useEstudos } from '../estudos/useEstudos'
import { useFala } from '../estudos/useVoz'
import s from './Estudos.module.scss'

type Aba = 'conversa' | 'vocabulario' | 'historico'

export default function Estudos() {
  const e = useEstudos()
  const voz = useFala()
  const [aba, setAba] = useState<Aba>('conversa')

  const contexto = useMemo(
    () => montarContexto(e.foco, e.erros, e.palavras),
    [e.foco, e.erros, e.palavras],
  )

  const abas: { id: Aba; rotulo: string; total?: number }[] = [
    { id: 'conversa', rotulo: 'Conversa' },
    { id: 'vocabulario', rotulo: 'Vocabulário', total: e.palavras.length },
    { id: 'historico', rotulo: 'Histórico', total: e.sessoes.length },
  ]

  return (
    <div className={s.page}>
      <header className={s.topo}>
        <div>
          <span className={s.rotulo}>Estudos</span>
          <h1>Inglês</h1>
        </div>

        <div className={s.abas} role="tablist" aria-label="Seções do estudo de inglês">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              className={`${s.aba} ${aba === a.id ? s.ativo : ''}`}
              onClick={() => setAba(a.id)}
            >
              {a.rotulo}
              {a.total ? <span className={s.contagem}>{a.total}</span> : null}
            </button>
          ))}
        </div>
      </header>

      {e.semTabelas && (
        <div className={s.card}>
          <h2 className={s.titulo}>Falta um passo no Supabase</h2>
          <p className={s.aviso}>
            As tabelas dos estudos ainda não existem. No painel do Supabase, abra{' '}
            <b>SQL Editor → New query</b>, cole o arquivo <code>supabase/schema-estudos.sql</code>{' '}
            e clique em <b>RUN</b>. Até lá a conversa funciona, mas nada fica guardado.
          </p>
          <button type="button" className={s.secundario} onClick={() => void e.recarregar()}>
            Já rodei, tentar de novo
          </button>
        </div>
      )}

      {e.erro && (
        <div className={s.card}>
          <h2 className={s.titulo}>Não consegui carregar os estudos</h2>
          <p className={s.erro}>{e.erro}</p>
          <button type="button" className={s.secundario} onClick={() => void e.recarregar()}>
            Tentar de novo
          </button>
        </div>
      )}

      {e.avisoSalvar && !e.semTabelas && <p className={s.erro}>{e.avisoSalvar}</p>}

      {/* a conversa fica montada mesmo escondida: trocar de aba pra
          conferir uma palavra não pode apagar a sessão em andamento */}
      <div hidden={aba !== 'conversa'} className={s.painel}>
        <Conversa
          contexto={contexto}
          falar={voz.falar}
          calar={voz.calar}
          aoAprender={(p) => void e.adicionarPalavras(p)}
          aoErrar={(c) => void e.adicionarErros(c)}
          aoEncerrar={(x) => void e.registrarSessao(x)}
        >
          <FocoAtual
            foco={e.foco}
            carregando={e.carregando}
            semTabela={e.semTabelaFoco}
            totalErros={contexto.mistakes.length}
            totalPalavras={contexto.words.length}
            aoSalvar={e.mudarFoco}
          />
        </Conversa>
      </div>

      {aba === 'vocabulario' &&
        (e.carregando ? (
          <div className={s.card}>Carregando...</div>
        ) : (
          <Vocabulario
            palavras={e.palavras}
            erros={e.erros}
            falar={voz.falar}
            aoRemover={(id) => void e.removerPalavra(id)}
          />
        ))}

      {aba === 'historico' &&
        (e.carregando ? <div className={s.card}>Carregando...</div> : <Historico sessoes={e.sessoes} />)}
    </div>
  )
}
