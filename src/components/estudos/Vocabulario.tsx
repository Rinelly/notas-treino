import { useState } from 'react'
import type { Erro, Palavra } from '../../estudos/tipos'
import s from '../../pages/Estudos.module.scss'

interface Props {
  palavras: Palavra[]
  erros: Erro[]
  falar: (texto: string, velocidade?: number) => void
  aoRemover: (id: string) => void
}

export default function Vocabulario({ palavras, erros, falar, aoRemover }: Props) {
  const [busca, setBusca] = useState('')

  const termo = busca.trim().toLowerCase()
  const visiveis = termo
    ? palavras.filter(
        (p) => p.palavra.toLowerCase().includes(termo) || p.significado.toLowerCase().includes(termo),
      )
    : palavras

  return (
    <>
      <section className={s.card}>
        <h2 className={s.titulo}>
          Minhas palavras <span className={s.contagem}>{palavras.length}</span>
        </h2>

        {palavras.length === 0 ? (
          <div className={s.vazio}>
            Nenhuma palavra ainda.
            <br />
            As palavras novas que o tutor usar na conversa aparecem aqui.
          </div>
        ) : (
          <>
            {palavras.length > 6 && (
              <input
                type="search"
                className={s.busca}
                placeholder="Buscar palavra ou significado"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar no vocabulário"
              />
            )}

            {visiveis.length === 0 ? (
              <div className={s.vazio}>Nada encontrado para "{busca.trim()}".</div>
            ) : (
              <ul className={s.listaPalavras}>
                {visiveis.map((p) => (
                  <li key={p.id} className={s.itemPalavra}>
                    <div className={s.itemTopo}>
                      <strong>{p.palavra}</strong>
                      <button
                        type="button"
                        className={s.acao}
                        onClick={() => falar(p.palavra, 0.8)}
                        title="Ouvir a pronúncia"
                        aria-label={`Ouvir ${p.palavra}`}
                      >
                        🔊
                      </button>
                      <button
                        type="button"
                        className={s.acao}
                        onClick={() => aoRemover(p.id)}
                        title="Remover"
                        aria-label={`Remover ${p.palavra}`}
                      >
                        ×
                      </button>
                    </div>
                    {p.significado && <span>{p.significado}</span>}
                    {p.exemplo && <em>{p.exemplo}</em>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className={s.card}>
        <h2 className={s.titulo}>Erros recentes</h2>
        {erros.length === 0 ? (
          <div className={s.vazio}>Nenhuma correção registrada ainda.</div>
        ) : (
          <ul className={s.listaErros}>
            {erros.map((e) => (
              <li key={e.id} className={s.correcao}>
                <span className={s.errado}>{e.original}</span>
                <span className={s.seta}>→</span>
                <span className={s.certo}>{e.correcao}</span>
                {e.explicacao && <small>{e.explicacao}</small>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
