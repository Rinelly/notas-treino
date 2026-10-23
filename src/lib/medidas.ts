/* =========================================================
   medidas — peso corporal e circunferências

   A conta toda mora aqui, fora do componente, porque tem três
   coisas que erram fácil e só se garantem com teste: campo em
   branco não é zero, a variação tem que pular os dias em que
   você não mediu aquele campo, e o gráfico precisa de um eixo
   que não divida por zero quando o valor não muda.
   ========================================================= */

export type ChaveMedida =
  | 'peso'
  | 'gordura'
  | 'cintura'
  | 'quadril'
  | 'peito'
  | 'braco'
  | 'coxa'
  | 'panturrilha'

export interface Medida {
  id?: number
  /** AAAA-MM-DD */
  data: string
  peso: number | null
  gordura: number | null
  cintura: number | null
  quadril: number | null
  peito: number | null
  braco: number | null
  coxa: number | null
  panturrilha: number | null
  nota: string
}

export interface CampoMedida {
  chave: ChaveMedida
  rotulo: string
  unidade: string
  casas: number
  /** usada só no formulário, pra dar um chute de teclado e validação */
  maximo: number
}

export const CAMPOS: CampoMedida[] = [
  { chave: 'peso', rotulo: 'Peso', unidade: 'kg', casas: 1, maximo: 400 },
  { chave: 'gordura', rotulo: 'Gordura', unidade: '%', casas: 1, maximo: 80 },
  { chave: 'cintura', rotulo: 'Cintura', unidade: 'cm', casas: 1, maximo: 250 },
  { chave: 'quadril', rotulo: 'Quadril', unidade: 'cm', casas: 1, maximo: 250 },
  { chave: 'peito', rotulo: 'Peito', unidade: 'cm', casas: 1, maximo: 250 },
  { chave: 'braco', rotulo: 'Braço', unidade: 'cm', casas: 1, maximo: 120 },
  { chave: 'coxa', rotulo: 'Coxa', unidade: 'cm', casas: 1, maximo: 150 },
  { chave: 'panturrilha', rotulo: 'Panturrilha', unidade: 'cm', casas: 1, maximo: 120 },
]

export function medidaVazia(data: string): Medida {
  return {
    data,
    peso: null,
    gordura: null,
    cintura: null,
    quadril: null,
    peito: null,
    braco: null,
    coxa: null,
    panturrilha: null,
    nota: '',
  }
}

/** "68,4" — vírgula decimal, que é como se escreve peso em português */
export function fmt(valor: number | null | undefined, casas = 1): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return valor.toFixed(casas).replace('.', ',')
}

/**
 * Lê o que a pessoa digitou. Aceita vírgula e ponto, e devolve
 * null para campo em branco — nunca 0, que seria uma medida falsa.
 */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (limpo === '') return null
  const n = Number(limpo)
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface Variacao {
  atual: number
  atualEm: string
  anterior: number
  anteriorEm: string
  delta: number
}

/**
 * O valor mais recente e o anterior DESTE campo.
 *
 * `medidas` vem da mais recente para a mais antiga. Pula as linhas
 * em que o campo está vazio: se você pesou hoje e mediu a cintura
 * só mês passado, a variação da cintura é contra o mês passado, e
 * não contra um "nada" de hoje.
 */
export function variacao(medidas: Medida[], campo: ChaveMedida): Variacao | null {
  const comValor = medidas.filter((m) => m[campo] != null)
  if (comValor.length === 0) return null

  const atual = comValor[0][campo] as number
  if (comValor.length === 1) return null

  const anterior = comValor[1][campo] as number
  return {
    atual,
    atualEm: comValor[0].data,
    anterior,
    anteriorEm: comValor[1].data,
    delta: Number((atual - anterior).toFixed(2)),
  }
}

/** só o valor mais recente, quando ainda não dá pra comparar */
export function ultimo(
  medidas: Medida[],
  campo: ChaveMedida,
): { valor: number; data: string } | null {
  const m = medidas.find((x) => x[campo] != null)
  return m ? { valor: m[campo] as number, data: m.data } : null
}

export interface Ponto {
  /** 0 = mais antigo, 1 = mais recente */
  x: number
  /** 0 = menor valor da série, 1 = maior */
  y: number
  valor: number
  data: string
}

/**
 * A série normalizada para desenhar, do mais antigo ao mais novo.
 *
 * O eixo x é a POSIÇÃO e não a data: medir de 15 em 15 dias e
 * depois de 3 em 3 geraria um gráfico todo espremido num canto, e
 * o que interessa aqui é a forma da curva, não o calendário.
 */
export function serie(medidas: Medida[], campo: ChaveMedida): Ponto[] {
  const comValor = medidas
    .filter((m) => m[campo] != null)
    .slice()
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))

  if (comValor.length === 0) return []

  const valores = comValor.map((m) => m[campo] as number)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const amplitude = max - min

  return comValor.map((m, i) => ({
    // um ponto só fica no meio em vez de dividir por zero
    x: comValor.length === 1 ? 0.5 : i / (comValor.length - 1),
    // série constante vira uma linha reta no meio, não no chão
    y: amplitude === 0 ? 0.5 : ((m[campo] as number) - min) / amplitude,
    valor: m[campo] as number,
    data: m.data,
  }))
}

/**
 * Vira um `d` de <path>. O y é invertido porque em SVG o zero
 * fica em cima, e um valor maior tem que subir, não descer.
 */
export function caminho(pontos: Ponto[], largura: number, altura: number, folga = 3): string {
  if (pontos.length === 0) return ''
  const alturaUtil = altura - folga * 2
  const partes = pontos.map((p, i) => {
    const x = (p.x * largura).toFixed(2)
    const y = (folga + (1 - p.y) * alturaUtil).toFixed(2)
    return `${i === 0 ? 'M' : 'L'}${x},${y}`
  })
  return partes.join(' ')
}

/**
 * A tabela ainda não existe porque o SQL não foi rodado.
 *
 * O Postgres e o PostgREST dizem isso de duas formas diferentes
 * ("relation does not exist" e "could not find the table ... in
 * the schema cache"), e as duas precisam virar a mesma mensagem
 * em português na tela.
 */
export function faltaTabela(msg: string): boolean {
  return (
    /medidas/i.test(msg) &&
    /(does not exist|could not find|not find the table|schema cache)/i.test(msg)
  )
}
