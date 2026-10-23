/* =========================================================
   Dados — levar o histórico embora

   Existe por um motivo simples: o que está aqui dentro é seu, e
   um app só é confiável se der pra sair dele. Dois CSV para abrir
   em planilha e um JSON que guarda tudo como está no banco.
   ========================================================= */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { historicoCompleto } from '../db/queries'
import type { LinhaHistorico } from '../db/historico'
import { getMedidas } from '../db/medidasQueries'
import { getDias } from '../foco/queries'
import type { Dia } from '../foco/tipos'
import { CAMPOS, type Medida } from '../lib/medidas'
import { baixar } from '../lib/baixar'
import { nomeArquivo, num, paraCSV, type Coluna } from '../lib/csv'
import { dataDaChave, hojeChave } from '../lib/datas'
import s from './Dados.module.scss'

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** o app não tem data de nascimento; esta faixa cobre qualquer histórico */
const DESDE_SEMPRE = '2000-01-01'
const ATE_SEMPRE = '2099-12-31'

const COLUNAS_TREINO: Coluna<LinhaHistorico>[] = [
  { cabecalho: 'Data', valor: (l) => l.data },
  { cabecalho: 'Dia', valor: (l) => DIAS_SEMANA[dataDaChave(l.data).getDay()] },
  { cabecalho: 'Treino', valor: (l) => l.treino },
  { cabecalho: 'Rotina', valor: (l) => l.rotina },
  { cabecalho: 'Exercício', valor: (l) => l.exercicio },
  { cabecalho: 'Categoria', valor: (l) => l.categoria },
  { cabecalho: 'Séries x reps', valor: (l) => l.seriesAlvo },
  { cabecalho: 'Reps feitas', valor: (l) => l.repsFeitas },
  { cabecalho: 'Carga (kg)', valor: (l) => num(l.carga) },
  { cabecalho: 'Concluído', valor: (l) => l.concluido },
  { cabecalho: 'Treino finalizado', valor: (l) => l.sessaoFinalizada },
]

const COLUNAS_FOCO: Coluna<Dia>[] = [
  { cabecalho: 'Data', valor: (d) => d.chave },
  { cabecalho: 'Dia', valor: (d) => DIAS_SEMANA[dataDaChave(d.chave).getDay()] },
  { cabecalho: 'Total (h)', valor: (d) => num(d.seg / 3600, 2) },
  { cabecalho: 'Trabalho (h)', valor: (d) => num(d.segTrabalho / 3600, 2) },
  { cabecalho: 'Estudo (h)', valor: (d) => num(d.segEstudo / 3600, 2) },
  { cabecalho: 'Pomodoros', valor: (d) => d.pomodoros },
  { cabecalho: 'Anotação', valor: (d) => d.nota },
]

const COLUNAS_MEDIDAS: Coluna<Medida>[] = [
  { cabecalho: 'Data', valor: (m) => m.data },
  ...CAMPOS.map((c) => ({
    cabecalho: `${c.rotulo} (${c.unidade})`,
    valor: (m: Medida) => num(m[c.chave], c.casas),
  })),
  { cabecalho: 'Observação', valor: (m) => m.nota },
]

export default function Dados() {
  const [treinos, setTreinos] = useState<LinhaHistorico[] | null>(null)
  const [dias, setDias] = useState<Dia[] | null>(null)
  const [medidas, setMedidas] = useState<Medida[]>([])
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([
        historicoCompleto(),
        getDias(DESDE_SEMPRE, ATE_SEMPRE),
      ])
      setTreinos(t)
      // as medidas são opcionais: se o SQL ainda não rodou, o resto
      // da página continua funcionando em vez de cair inteira
      setMedidas(await getMedidas().catch(() => []))
      // o banco devolve na ordem que quiser; aqui o mais novo vem primeiro
      setDias([...d].sort((a, b) => (a.chave < b.chave ? 1 : -1)))
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const hoje = hojeChave()
  const carregando = treinos == null || dias == null

  function baixarTreinos() {
    baixar(
      nomeArquivo('treinos', 'csv', hoje),
      paraCSV(treinos ?? [], COLUNAS_TREINO),
      'text/csv',
    )
  }

  function baixarFoco() {
    baixar(nomeArquivo('foco', 'csv', hoje), paraCSV(dias ?? [], COLUNAS_FOCO), 'text/csv')
  }

  function baixarMedidas() {
    baixar(
      nomeArquivo('medidas', 'csv', hoje),
      paraCSV(medidas, COLUNAS_MEDIDAS),
      'text/csv',
    )
  }

  function baixarTudo() {
    const backup = {
      app: 'Foco & Treino',
      exportadoEm: new Date().toISOString(),
      foco: dias ?? [],
      treinos: treinos ?? [],
      medidas,
    }
    baixar(
      nomeArquivo('backup', 'json', hoje),
      JSON.stringify(backup, null, 2),
      'application/json',
    )
  }

  return (
    <div className={s.page}>
      <div className={s.topo}>
        <Link to="/" className={s.voltar}>
          ← Voltar
        </Link>
      </div>

      <h1>Seus dados</h1>
      <p className={s.intro}>
        O histórico é seu. Os CSV abrem direto no Excel e no Google Sheets; o JSON
        guarda tudo como está no banco, para o caso de você querer levar embora.
      </p>

      {erro && (
        <div className={s.erro}>
          <b>Não consegui ler o histórico.</b> {erro}
        </div>
      )}

      <div className={s.card}>
        <div className={s.titulo}>Treinos</div>
        <div className={s.detalhe}>
          {carregando
            ? 'contando...'
            : `${treinos!.length} ${treinos!.length === 1 ? 'registro' : 'registros'} — uma linha por exercício, com reps e carga de cada dia`}
        </div>
        <button
          type="button"
          className={s.botao}
          onClick={baixarTreinos}
          disabled={carregando || treinos!.length === 0}
        >
          Baixar CSV
        </button>
      </div>

      <div className={s.card}>
        <div className={s.titulo}>Foco</div>
        <div className={s.detalhe}>
          {carregando
            ? 'contando...'
            : `${dias!.length} ${dias!.length === 1 ? 'dia' : 'dias'} — horas de trabalho e estudo, pomodoros e a anotação do dia`}
        </div>
        <button
          type="button"
          className={s.botao}
          onClick={baixarFoco}
          disabled={carregando || dias!.length === 0}
        >
          Baixar CSV
        </button>
      </div>

      <div className={s.card}>
        <div className={s.titulo}>Medidas</div>
        <div className={s.detalhe}>
          {carregando
            ? 'contando...'
            : medidas.length === 0
              ? 'Nenhuma medida registrada ainda.'
              : `${medidas.length} ${medidas.length === 1 ? 'registro' : 'registros'} — peso, gordura e circunferências de cada dia`}
        </div>
        <button
          type="button"
          className={s.botao}
          onClick={baixarMedidas}
          disabled={carregando || medidas.length === 0}
        >
          Baixar CSV
        </button>
      </div>

      <div className={s.card}>
        <div className={s.titulo}>Backup completo</div>
        <div className={s.detalhe}>
          Tudo junto, em JSON. É o arquivo para guardar se um dia quiser recomeçar
          em outro lugar.
        </div>
        <button
          type="button"
          className={s.botaoFraco}
          onClick={baixarTudo}
          disabled={carregando}
        >
          Baixar JSON
        </button>
      </div>

      <p className={s.rodape}>
        As horas saem com vírgula decimal e o arquivo com acento certo, para o
        Excel em português não embaralhar nada.
      </p>
    </div>
  )
}
