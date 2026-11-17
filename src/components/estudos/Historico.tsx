import { rotuloDoCenario, type SessaoIngles } from '../../estudos/tipos'
import { chaveData, dataLonga, haQuantoTempo } from '../../lib/datas'
import ResumoMarkdown from './ResumoMarkdown'
import s from '../../pages/Estudos.module.scss'

function duracao(seg: number) {
  const min = Math.round(seg / 60)
  return min < 1 ? 'menos de 1 min' : `${min} min`
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export default function Historico({ sessoes }: { sessoes: SessaoIngles[] }) {
  return (
    <section className={s.card}>
      <h2 className={s.titulo}>
        Sessões <span className={s.contagem}>{sessoes.length}</span>
      </h2>

      {sessoes.length === 0 ? (
        <div className={s.vazio}>
          Nenhuma sessão encerrada ainda.
          <br />
          Ao encerrar uma conversa, o resumo dela fica guardado aqui.
        </div>
      ) : (
        <ul className={s.listaSessoes}>
          {sessoes.map((x) => {
            const quando = new Date(x.encerradaEm)
            return (
              <li key={x.id}>
                <details className={s.sessao}>
                  <summary>
                    <span className={s.sessaoTitulo}>
                      <strong>{rotuloDoCenario(x.cenario)}</strong>
                      <span>
                        {dataLonga(quando)} · {haQuantoTempo(chaveData(quando))}
                      </span>
                    </span>
                    <span className={s.sessaoNumeros}>
                      {duracao(x.duracaoSeg)} · {plural(x.mensagens, 'fala', 'falas')} ·{' '}
                      {plural(x.correcoes, 'correção', 'correções')} ·{' '}
                      {plural(x.palavras, 'palavra nova', 'palavras novas')}
                    </span>
                  </summary>
                  {x.resumo ? (
                    <ResumoMarkdown texto={x.resumo} />
                  ) : (
                    <p className={s.nota}>Esta sessão ficou sem resumo.</p>
                  )}
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
