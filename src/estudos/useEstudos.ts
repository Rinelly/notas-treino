import { useCallback, useEffect, useRef, useState } from 'react'
import {
  apagarPalavra,
  getErros,
  getPalavras,
  getSessoes,
  salvarErros,
  salvarPalavras,
  salvarSessao,
} from './queries'
import type { Correcao, Erro, NovaSessao, Palavra, PalavraNova, SessaoIngles } from './tipos'
import {
  CHAVE_ERROS_ANTIGA,
  CHAVE_PALAVRAS_ANTIGA,
  chaveDaPalavra,
  lerErrosAntigos,
  lerPalavrasAntigas,
  soAsNovas,
} from './vocabulario'

const JA_IMPORTOU = 'estudos.tutorAntigoImportado'

/** traz pro banco o que a primeira versão do tutor guardou neste navegador */
async function importarDoNavegador() {
  try {
    if (localStorage.getItem(JA_IMPORTOU)) return
    const palavras = lerPalavrasAntigas(localStorage.getItem(CHAVE_PALAVRAS_ANTIGA))
    const erros = lerErrosAntigos(localStorage.getItem(CHAVE_ERROS_ANTIGA))
    if (palavras.length) await salvarPalavras(palavras)
    if (erros.length) await salvarErros(erros)
    // os dados antigos ficam onde estão; só marca que já foram trazidos
    localStorage.setItem(JA_IMPORTOU, new Date().toISOString())
  } catch {
    /* fica pra próxima vez que abrir */
  }
}

/** tabela que ainda não existe: falta rodar o supabase/schema-estudos.sql */
function faltaTabela(mensagem: string) {
  return /ingles_(palavras|erros|sessoes)/.test(mensagem) && /not find|does not exist|schema cache/i.test(mensagem)
}

export function useEstudos() {
  const [palavras, setPalavras] = useState<Palavra[]>([])
  const [erros, setErros] = useState<Erro[]>([])
  const [sessoes, setSessoes] = useState<SessaoIngles[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [semTabelas, setSemTabelas] = useState(false)
  /** a conversa segue mesmo se guardar falhar; isto só avisa */
  const [avisoSalvar, setAvisoSalvar] = useState<string | null>(null)

  const palavrasRef = useRef(palavras)
  useEffect(() => {
    palavrasRef.current = palavras
  }, [palavras])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    setSemTabelas(false)
    try {
      await importarDoNavegador()
      const [p, e, s] = await Promise.all([getPalavras(), getErros(), getSessoes()])
      setPalavras(p)
      setErros(e)
      setSessoes(s)
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : 'Erro ao carregar os estudos.'
      if (faltaTabela(msg)) setSemTabelas(true)
      else setErro(msg)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const falhou = useCallback((ex: unknown) => {
    const msg = ex instanceof Error ? ex.message : 'erro desconhecido'
    setAvisoSalvar(`Não consegui guardar no banco: ${msg}`)
  }, [])

  const adicionarPalavras = useCallback(
    async (itens: PalavraNova[]) => {
      const novas = soAsNovas(
        itens,
        palavrasRef.current.map((p) => chaveDaPalavra(p.palavra)),
      )
      if (!novas.length) return
      try {
        const salvas = await salvarPalavras(novas)
        if (salvas.length) setPalavras((antes) => [...salvas, ...antes])
        setAvisoSalvar(null)
      } catch (ex) {
        falhou(ex)
      }
    },
    [falhou],
  )

  const adicionarErros = useCallback(
    async (itens: Correcao[]) => {
      if (!itens.length) return
      try {
        const salvos = await salvarErros(itens)
        setErros((antes) => [...salvos, ...antes].slice(0, 30))
        setAvisoSalvar(null)
      } catch (ex) {
        falhou(ex)
      }
    },
    [falhou],
  )

  const removerPalavra = useCallback(
    async (id: string) => {
      const antes = palavrasRef.current
      setPalavras(antes.filter((p) => p.id !== id))
      try {
        await apagarPalavra(id)
      } catch (ex) {
        setPalavras(antes)
        falhou(ex)
      }
    },
    [falhou],
  )

  const registrarSessao = useCallback(
    async (s: NovaSessao) => {
      try {
        const salva = await salvarSessao(s)
        setSessoes((antes) => [salva, ...antes])
        setAvisoSalvar(null)
      } catch (ex) {
        falhou(ex)
      }
    },
    [falhou],
  )

  return {
    palavras,
    erros,
    sessoes,
    carregando,
    erro,
    semTabelas,
    avisoSalvar,
    recarregar: carregar,
    adicionarPalavras,
    adicionarErros,
    removerPalavra,
    registrarSessao,
  }
}
