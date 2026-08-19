import { useState, type FormEvent } from 'react'
import { traduzirErro, useAuth } from '../auth/AuthProvider'
import styles from './Login.module.scss'

export default function Login() {
  const { entrar, criarConta } = useAuth()
  const [modoCadastro, setModoCadastro] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setMsg(modoCadastro ? 'Criando sua conta...' : 'Entrando...')
    setMsgOk(true)

    try {
      if (modoCadastro) {
        const { precisaConfirmar } = await criarConta(email, senha)
        if (precisaConfirmar) {
          setMsg('Conta criada. Confirme o e-mail que enviamos e depois entre aqui.')
          setMsgOk(true)
          setEnviando(false)
          return
        }
      } else {
        await entrar(email, senha)
      }
      // dando certo, o AuthProvider troca a tela sozinho
    } catch (err) {
      setMsg(traduzirErro(err))
      setMsgOk(false)
      setEnviando(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.box}>
        <h1 className={styles.titulo}>Treino</h1>
        <p className={styles.sub}>
          Use a mesma conta do Foco. Seus treinos ficam salvos na nuvem e aparecem em
          qualquer aparelho.
        </p>

        <form onSubmit={onSubmit}>
          <label className={styles.campo}>
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.campo}>
            <span>Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={modoCadastro ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>

          <div className={`${styles.msg} ${msgOk ? styles.ok : ''}`}>{msg}</div>

          <button type="submit" className={styles.enviar} disabled={enviando}>
            {modoCadastro ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <div className={styles.alternar}>
          <button
            type="button"
            onClick={() => {
              setModoCadastro((v) => !v)
              setMsg('')
            }}
          >
            {modoCadastro ? 'Já tenho conta — entrar' : 'Ainda não tenho conta — criar'}
          </button>
        </div>
      </div>
    </div>
  )
}
