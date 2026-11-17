export type Papel = 'user' | 'assistant'

export type Cenario = 'free' | 'interview' | 'coworker' | 'travel'

export const CENARIOS: { id: Cenario; rotulo: string; dica: string }[] = [
  { id: 'free', rotulo: 'Conversa livre', dica: 'Você escolhe o assunto' },
  { id: 'interview', rotulo: 'Entrevista de emprego', dica: 'Vaga de estágio em dados' },
  { id: 'coworker', rotulo: 'Daily meeting', dica: 'Colega de um time internacional' },
  { id: 'travel', rotulo: 'Check-in no hotel', dica: 'Viagem ao exterior' },
]

export function rotuloDoCenario(id: string) {
  return CENARIOS.find((c) => c.id === id)?.rotulo ?? 'Conversa'
}

/* ---------- o que o tutor devolve (formato da API) ---------- */

export interface Correcao {
  original: string
  better: string
  explanation: string
}

export interface PalavraNova {
  word: string
  meaning: string
  example: string
}

export interface RespostaTutor {
  reply: string
  corrections: Correcao[]
  new_words: PalavraNova[]
}

export interface Mensagem {
  id: string
  papel: Papel
  texto: string
  correcoes?: Correcao[]
  palavras?: PalavraNova[]
  /** vai para o tutor, mas não aparece na tela (o "oi" que abre a sessão) */
  oculta?: boolean
}

/* ---------- o que fica guardado no banco ---------- */

export interface Palavra {
  id: string
  palavra: string
  significado: string
  exemplo: string
  criadoEm: string
}

export interface Erro {
  id: string
  original: string
  correcao: string
  explicacao: string
  criadoEm: string
}

export interface SessaoIngles {
  id: string
  cenario: string
  mensagens: number
  correcoes: number
  palavras: number
  duracaoSeg: number
  resumo: string
  encerradaEm: string
}

export type NovaSessao = Omit<SessaoIngles, 'id' | 'encerradaEm'> & { iniciadaEm: string }

/* ---------- o que o tutor recebe além da conversa ---------- */

export interface ContextoDoTutor {
  /** o que ela está estudando agora, escrito por ela */
  focus: string
  mistakes: { original: string; better: string }[]
  words: string[]
}
