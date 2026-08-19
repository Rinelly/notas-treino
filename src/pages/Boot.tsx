/* =========================================================
   Boot — o que roda entre o login e o app

   Duas tarefas:
   1. se ainda existir histórico no navegador que nunca foi
      enviado, oferece a migração
   2. senão, garante que as rotinas padrão existem
   ========================================================= */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  jaMigrou,
  lerResumoLocal,
  marcarComoMigrado,
  migrarParaNuvem,
  nuvemTemDados,
  type ResultadoMigracao,
  type ResumoLocal,
} from '../db/migrarLocal'
import { seedRotinas } from '../db/seed'
import styles from './Boot.module.scss'

type Estado =
  | { fase: 'verificando' }
  | { fase: 'perguntar'; local: ResumoLocal; nuvemOcupada: boolean }
  | { fase: 'enviando' }
  | { fase: 'resultado'; r: ResultadoMigracao }
  | { fase: 'pronto' }
  | { fase: 'erro'; msg: string }

export default function Boot({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'verificando' })

  const verificar = useCallback(async () => {
    try {
      setEstado({ fase: 'verificando' })

      if (!jaMigrou()) {
        const local = await lerResumoLocal()
        if (local.rotinas > 0 || local.sessoes > 0) {
          // oferece mesmo que a nuvem já tenha algo: pode ser sobra de
          // uma tentativa que falhou no meio, e aí ficar preso é pior
          setEstado({ fase: 'perguntar', local, nuvemOcupada: await nuvemTemDados() })
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

  async function pular() {
    marcarComoMigrado()
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
    return <div className={styles.centro}>Enviando seu histórico pra nuvem...</div>
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
    const houveFusao = r.sessoesFundidas > 0 || r.execucoesFundidas > 0
    return (
      <div className={styles.centro}>
        <div className={styles.box}>
          <h2 className={styles.titulo}>Pronto, seu histórico está na nuvem</h2>

          <ul className={styles.numeros}>
            <li>
              <span>Rotinas</span>
              <b>{r.rotinas}</b>
            </li>
            <li>
              <span>Sessões</span>
              <b>{r.sessoes}</b>
            </li>
            <li>
              <span>Exercícios registrados</span>
              <b>{r.execucoes}</b>
            </li>
          </ul>

          {houveFusao && (
            <p className={styles.texto}>
              Encontrei registros repetidos no banco antigo e juntei:{' '}
              {r.sessoesFundidas > 0 && (
                <>
                  <b>{r.sessoesFundidas}</b> sessão(ões) do mesmo treino no mesmo dia
                </>
              )}
              {r.sessoesFundidas > 0 && r.execucoesFundidas > 0 && ' e '}
              {r.execucoesFundidas > 0 && (
                <>
                  <b>{r.execucoesFundidas}</b> exercício(s) repetido(s) na mesma sessão
                </>
              )}
              . Em cada caso ficou a versão mais completa, então nenhuma carga foi perdida.
            </p>
          )}

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
        <h2 className={styles.titulo}>Encontrei treinos salvos neste navegador</h2>
        <p className={styles.texto}>
          Posso enviar esse histórico pra sua conta — as cargas e as repetições vão
          junto, ligadas aos mesmos exercícios.
        </p>

        <ul className={styles.numeros}>
          <li>
            <span>Rotinas</span>
            <b>{estado.local.rotinas}</b>
          </li>
          <li>
            <span>Sessões</span>
            <b>{estado.local.sessoes}</b>
          </li>
          <li>
            <span>Exercícios registrados</span>
            <b>{estado.local.execucoes}</b>
          </li>
        </ul>

        <p className={styles.texto}>
          {estado.nuvemOcupada
            ? 'Sua conta na nuvem já tem alguma coisa — provavelmente sobra de uma tentativa anterior. Ela será substituída por este histórico.'
            : 'Sua conta na nuvem está vazia.'}{' '}
          Nada é apagado do navegador: os dados locais continuam onde estão, como cópia
          de segurança.
        </p>

        <div className={styles.acoes}>
          <button type="button" className={styles.principal} onClick={enviar}>
            Enviar pra nuvem
          </button>
          <button type="button" className={styles.secundario} onClick={pular}>
            Começar do zero
          </button>
        </div>
      </div>
    </div>
  )
}
