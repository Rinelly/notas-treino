/* =========================================================
   Boot — o que roda entre o login e o app

   Duas tarefas:
   1. se ainda existir histórico neste navegador que nunca foi
      pra nuvem, oferece a junção
   2. senão, garante que as rotinas padrão existem
   ========================================================= */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  jaMigrou,
  lerResumoLocal,
  migrarParaNuvem,
  type ResultadoMigracao,
  type ResumoLocal,
} from '../db/migrarLocal'
import { seedRotinas } from '../db/seed'
import styles from './Boot.module.scss'

const PULOU = 'treino.migracao.adiada'

type Estado =
  | { fase: 'verificando' }
  | { fase: 'perguntar'; local: ResumoLocal }
  | { fase: 'enviando' }
  | { fase: 'resultado'; r: ResultadoMigracao }
  | { fase: 'pronto' }
  | { fase: 'erro'; msg: string }

export default function Boot({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'verificando' })

  const verificar = useCallback(async () => {
    try {
      setEstado({ fase: 'verificando' })

      let pulouAgora = false
      try {
        pulouAgora = sessionStorage.getItem(PULOU) === '1'
      } catch {
        /* ignora */
      }

      if (!jaMigrou() && !pulouAgora) {
        const local = await lerResumoLocal()
        if (local.rotinas > 0 || local.sessoes > 0) {
          setEstado({ fase: 'perguntar', local })
          return
        }
      }

      await seedRotinas()
      setEstado({ fase: 'pronto' })
    } catch (err) {
      setEstado({ fase: 'erro', msg: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => {
    verificar()
  }, [verificar])

  async function enviar() {
    setEstado({ fase: 'enviando' })
    try {
      const r = await migrarParaNuvem()
      setEstado({ fase: 'resultado', r })
    } catch (err) {
      setEstado({ fase: 'erro', msg: err instanceof Error ? err.message : String(err) })
    }
  }

  /**
   * "Agora não" só vale pra esta aba. De propósito: isso virou uma
   * ferramenta de recuperação, e esconder pra sempre um histórico
   * que ainda não subiu é justamente como se perde treino.
   */
  async function pular() {
    try {
      sessionStorage.setItem(PULOU, '1')
    } catch {
      /* modo privado: só vai perguntar de novo */
    }
    try {
      await seedRotinas()
      setEstado({ fase: 'pronto' })
    } catch (err) {
      setEstado({ fase: 'erro', msg: err instanceof Error ? err.message : String(err) })
    }
  }

  if (estado.fase === 'pronto') return <>{children}</>

  if (estado.fase === 'verificando') {
    return <div className={styles.centro}>Carregando seus treinos...</div>
  }

  if (estado.fase === 'enviando') {
    return <div className={styles.centro}>Juntando o histórico deste aparelho...</div>
  }

  if (estado.fase === 'erro') {
    return (
      <div className={styles.centro}>
        <div className={styles.box}>
          <h2 className={styles.titulo}>Não consegui carregar</h2>
          <p className={styles.texto}>
            Se a mensagem falar em permissão ou em tabela que não existe, provavelmente
            o <code>schema-treino.sql</code> ainda não foi rodado no Supabase.
          </p>
          <div className={styles.erro}>{estado.msg}</div>
          <div className={styles.acoes} style={{ marginTop: 16 }}>
            <button type="button" className={styles.principal} onClick={verificar}>
              Tentar de novo
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (estado.fase === 'resultado') {
    const { r } = estado
    const achouAlgo = r.sessoesRecuperadas > 0 || r.execucoesRecuperadas > 0

    return (
      <div className={styles.centro}>
        <div className={styles.box}>
          <h2 className={styles.titulo}>
            {achouAlgo ? 'Recuperei o que estava só aqui' : 'Já estava tudo na nuvem'}
          </h2>

          <ul className={styles.numeros}>
            <li>
              <span>Dias de treino recuperados</span>
              <b>{r.sessoesRecuperadas}</b>
            </li>
            <li>
              <span>Cargas e repetições recuperadas</span>
              <b>{r.execucoesRecuperadas}</b>
            </li>
            <li>
              <span>Dias que já estavam lá (preservados)</span>
              <b>{r.sessoesJaExistiam}</b>
            </li>
          </ul>

          <p className={styles.texto}>
            Nada foi apagado: onde a nuvem já tinha registro, ela ficou como estava, e
            o banco deste navegador continua intacto como cópia de segurança.
            {r.execucoesSemPar > 0 && (
              <>
                {' '}
                <b>{r.execucoesSemPar}</b> registro(s) antigo(s) apontavam pra exercícios
                que não existem mais na rotina e ficaram de fora.
              </>
            )}
          </p>

          <div className={styles.acoes}>
            <button
              type="button"
              className={styles.principal}
              onClick={() => setEstado({ fase: 'pronto' })}
            >
              Abrir o app
            </button>
          </div>
        </div>
      </div>
    )
  }

  // fase === 'perguntar'
  return (
    <div className={styles.centro}>
      <div className={styles.box}>
        <h2 className={styles.titulo}>Encontrei treinos salvos neste aparelho</h2>
        <p className={styles.texto}>
          O app antigo guardava tudo dentro do navegador, e isso não atravessa de um
          aparelho pro outro. Posso juntar esse histórico com o que já está na sua conta.
        </p>

        <ul className={styles.numeros}>
          <li>
            <span>Rotinas</span>
            <b>{estado.local.rotinas}</b>
          </li>
          <li>
            <span>Dias de treino</span>
            <b>{estado.local.sessoes}</b>
          </li>
          <li>
            <span>Exercícios registrados</span>
            <b>{estado.local.execucoes}</b>
          </li>
        </ul>

        <p className={styles.texto}>
          <b>Nada é apagado.</b> Onde a nuvem já tem um treino, ela ganha; só entra o
          que estava faltando lá. Pode rodar de novo depois sem duplicar nada.
        </p>

        <div className={styles.acoes}>
          <button type="button" className={styles.principal} onClick={enviar}>
            Juntar com a nuvem
          </button>
          <button type="button" className={styles.secundario} onClick={pular}>
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}
