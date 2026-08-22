

export interface Vencimento {
  data: Date
  emDias: number
  texto: string
  nivel: 'tranquilo' | 'perto' | 'hoje' | 'vencido'
}

function comDiaValido(ano: number, mes: number, dia: number) {
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  return new Date(ano, mes, Math.min(dia, ultimo))
}

export function calcularVencimento(dia: number, agora = new Date()): Vencimento {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())

  let data = comDiaValido(hoje.getFullYear(), hoje.getMonth(), dia)
  
  if (data < hoje) data = comDiaValido(hoje.getFullYear(), hoje.getMonth() + 1, dia)

  const emDias = Math.round((data.getTime() - hoje.getTime()) / 86_400_000)

  let texto: string
  let nivel: Vencimento['nivel']
  if (emDias === 0) {
    texto = 'Vence hoje'
    nivel = 'hoje'
  } else if (emDias === 1) {
    texto = 'Vence amanhã'
    nivel = 'perto'
  } else if (emDias <= 5) {
    texto = `Vence em ${emDias} dias`
    nivel = 'perto'
  } else {
    texto = `Vence em ${emDias} dias`
    nivel = 'tranquilo'
  }

  return { data, emDias, texto, nivel }
}

export function formatarDia(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
