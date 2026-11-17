import { useEffect, useState } from 'react'
import { MAX_FOCO } from '../../estudos/contexto'
import s from '../../pages/Estudos.module.scss'

interface Props {
  foco: string
  carregando: boolean
  /** a tabela ingles_perfil ainda não existe no Supabase */
  semTabela: boolean
  totalErros: number
  totalPalavras: number
  aoSalvar: (texto: string) => Promise<boolean>
}

export default function FocoAtual({ foco, carregando, semTabela, totalErros, totalPalavras, aoSalvar }: Props) {
  const [rascunho, setRascunho] = useState(foco)
  const [status, setStatus] = useState<'parado' | 'salvando' | 'salvo' | 'erro'>('parado')

  // o valor guardado chega depois da primeira pintura
  useEffect(() => {
    setRascunho(foco)
  }, [foco])

  const mudou = rascunho.trim() !== foco.trim()

  async function salvar() {
    if (!mudou || status === 'salvando') return
    setStatus('salvando')
    const deuCerto = await aoSalvar(rascunho.trim())
    setStatus(deuCerto ? 'salvo' : 'erro')
  }

  const lembra = [
    totalErros > 0 && 'seus erros mais recentes',
    totalPalavras > 0 && 'as últimas palavras do seu vocabulário',
  ].filter(Boolean)

  return (
    <section className={s.card}>
      <h2 className={s.titulo}>O que estou estudando</h2>

      {semTabela ? (
        <p className={s.aviso}>
          Para guardar o seu foco, rode de novo o <code>supabase/schema-estudos.sql</code> no SQL
          Editor do Supabase: ele ganhou a tabela <code>ingles_perfil</code>. Pode rodar o arquivo
          inteiro, nada do que já existe é apagado.
        </p>
      ) : (
        <>
          <textarea
            className={s.foco}
            rows={4}
            maxLength={MAX_FOCO}
            placeholder={
              'Ex.: Unidade 7 do livro 3. Present perfect x simple past. Vocabulário de saúde e rotina. Quero treinar perguntas de entrevista.'
            }
            value={rascunho}
            disabled={carregando}
            onChange={(e) => {
              setRascunho(e.target.value)
              setStatus('parado')
            }}
            aria-label="O que estou estudando agora"
          />

          <div className={s.focoRodape}>
            <span>
              {status === 'erro'
                ? 'Não consegui salvar. Tente de novo.'
                : status === 'salvo' && !mudou
                  ? 'Salvo. Vale a partir da próxima fala.'
                  : 'O tutor puxa esses assuntos na conversa. Pode escrever em português.'}
            </span>
            <button
              type="button"
              className={s.secundario}
              onClick={() => void salvar()}
              disabled={!mudou || status === 'salvando'}
            >
              {status === 'salvando' ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </>
      )}

      {lembra.length > 0 && <p className={s.nota}>O tutor também recebe {lembra.join(' e ')}.</p>}
    </section>
  )
}
