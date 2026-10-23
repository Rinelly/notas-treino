/* =========================================================
   exercicios — mexer na ordem da lista do treino

   A lista é agrupada por categoria na tela (aquecimento, treino,
   cardio), mas no banco é um array só. Então arrastar um exercício
   para debaixo do título "Cardio" tem que, além de mudar a posição,
   mudar a categoria dele — senão ele aparece desenhado na seção
   errada, ou pior: some da seção e reaparece lá em cima.

   Tudo aqui é função pura. É a parte que o teste pega.
   ========================================================= */

import type { CategoriaExercicio, ExercicioRotina } from '../types'

export const CATEGORIAS: CategoriaExercicio[] = ['aquecimento', 'treino', 'cardio']

/** tira o item de `de` e enfia em `para`, sem mexer no resto */
export function mover<T>(lista: T[], de: number, para: number): T[] {
  if (de === para) return lista
  if (de < 0 || de >= lista.length) return lista

  const destino = Math.min(Math.max(para, 0), lista.length - 1)
  const copia = lista.slice()
  const [item] = copia.splice(de, 1)
  copia.splice(destino, 0, item)
  return copia
}

/**
 * Em que seção o exercício foi parar, olhando os dois vizinhos.
 *
 * A regra é "na dúvida, não mexe": se um dos vizinhos é da mesma
 * categoria, ele continua na seção dele. Reordenar dentro do bloco
 * de treino encosta no último aquecimento o tempo todo, e olhar só
 * o vizinho de cima transformaria isso em troca de seção.
 *
 * Só quando NENHUM vizinho é da mesma categoria é que ele de fato
 * mudou de seção — aí a de cima manda, ou a de baixo se for o topo.
 */
function categoriaDepoisDeSoltar(
  lista: ExercicioRotina[],
  indice: number,
): CategoriaExercicio | null {
  const propria = lista[indice].categoria
  const acima = lista[indice - 1]?.categoria
  const abaixo = lista[indice + 1]?.categoria

  if (acima === propria || abaixo === propria) return propria
  return acima ?? abaixo ?? null
}

/** mover + acertar a categoria de quem mudou de seção */
export function moverExercicio(
  lista: ExercicioRotina[],
  de: number,
  para: number,
): ExercicioRotina[] {
  const movida = mover(lista, de, para)
  if (movida === lista) return lista

  const destino = Math.min(Math.max(para, 0), lista.length - 1)
  const nova = categoriaDepoisDeSoltar(movida, destino)
  if (!nova || nova === movida[destino].categoria) return movida

  const copia = movida.slice()
  copia[destino] = { ...copia[destino], categoria: nova }
  return copia
}

/**
 * Põe o exercício novo no FIM do bloco da categoria dele, não no
 * fim da lista: um exercício de treino acrescentado no fim cairia
 * depois do cardio, e a tela abriria uma segunda seção "Treino"
 * embaixo de tudo.
 */
export function inserirExercicio(
  lista: ExercicioRotina[],
  novo: ExercicioRotina,
): ExercicioRotina[] {
  let ultimo = -1
  lista.forEach((ex, i) => {
    if (ex.categoria === novo.categoria) ultimo = i
  })

  if (ultimo >= 0) {
    const copia = lista.slice()
    copia.splice(ultimo + 1, 0, novo)
    return copia
  }

  // nenhum da mesma categoria ainda: entra na ordem natural das seções
  const ordem = CATEGORIAS.indexOf(novo.categoria)
  const antes = lista.findIndex((ex) => CATEGORIAS.indexOf(ex.categoria) > ordem)
  if (antes < 0) return [...lista, novo]

  const copia = lista.slice()
  copia.splice(antes, 0, novo)
  return copia
}
