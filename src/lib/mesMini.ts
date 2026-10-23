/* =========================================================
   mesMini — a miniatura do mês da tela Hoje

   Só a montagem das casinhas: quantas células em branco antes do
   dia 1, quais dias já passaram, quais tiveram treino. Fica fora
   do componente porque o "quantos treinos até agora" não pode
   contar dias futuros nem o próprio dia de hoje duas vezes.
   ========================================================= */

export interface CasaDoMes {
  /** null = buraco antes do dia 1, só pra alinhar a primeira semana */
  dia: number | null
  /** AAAA-MM-DD */
  data: string
  treinado: boolean
  hoje: boolean
  futuro: boolean
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * @param mes0   mês em base 0, como o Date do JavaScript
 * @param feitos datas AAAA-MM-DD em que houve treino
 */
export function mesMini(
  ano: number,
  mes0: number,
  feitos: Set<string>,
  hojeStr: string,
): { casas: CasaDoMes[]; quantos: number } {
  const offset = new Date(ano, mes0, 1).getDay() // 0 = domingo
  const total = new Date(ano, mes0 + 1, 0).getDate()

  const casas: CasaDoMes[] = []
  for (let i = 0; i < offset; i++) {
    casas.push({ dia: null, data: '', treinado: false, hoje: false, futuro: false })
  }

  let quantos = 0
  for (let d = 1; d <= total; d++) {
    const data = `${ano}-${pad(mes0 + 1)}-${pad(d)}`
    const treinado = feitos.has(data)
    if (treinado) quantos++
    casas.push({ dia: d, data, treinado, hoje: data === hojeStr, futuro: data > hojeStr })
  }

  return { casas, quantos }
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export function nomeDoMes(mes0: number) {
  return MESES[mes0] ?? ''
}
