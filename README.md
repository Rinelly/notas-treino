# Foco & Treino

Um app só pra três coisas: **acompanhar as horas de foco do dia**,
**estudar inglês** e **registrar os treinos**. As abas:

- **Hoje** — painel do dia: horas de foco, treino previsto e o quanto dele já
  foi feito, tarefas pendentes e a anotação
- **Foco** — pomodoro com meta diária em horas, tarefas classificadas em
  trabalho/estudo, anotações e histórico de 14 dias. Só o tempo de foco conta
  na meta; pausa não entra
- **Estudos** — tutor de conversação em inglês, por voz ou texto: corrige as
  suas falas, traduz as dele quando você pede, apresenta palavras novas e guarda vocabulário, erros e o resumo
  de cada sessão
- **Treinos** — rotina fixa por dia da semana, marcação de séries com carga e
  repetições, calendário de frequência, e a carga da última vez como sugestão

React + TypeScript + Vite, PWA (dá pra instalar no celular).
Tudo no **Supabase**, uma conta só.

---

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha com suas chaves
npm run dev
```

O Vite lê o `.env` só na inicialização — se mexer nele, reinicie o `npm run dev`.

---

## Configurando o Supabase

**1. Crie as tabelas**

No painel do Supabase: **SQL Editor → New query**, cole o
`supabase/schema-treino.sql` inteiro e clique em **RUN**.

No fim deve aparecer uma tabelinha com `rotinas`, `sessoes`, `execucoes` e
`rowsecurity = true` nas três. Se alguma vier `false`, pare — sem RLS o banco
fica aberto pra qualquer um com a chave pública.

**2. Preencha o `.env.local`**

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

- **Project URL** fica em Settings → **Data API**
- **Publishable key** fica em Settings → **API Keys**

Use só o domínio na URL, **sem `/rest/v1`** no final — o cliente monta esse
caminho sozinho.

O `.env.local` não vai pro Git (o `.gitignore` já cobre `*.local`).

---

## Estudos: o tutor de inglês

A aba Estudos tem duas metades. O vocabulário, as correções e o histórico
ficam no Supabase, como o resto. A conversa em si passa pela **tutor-api**
(pasta `tutor-api/`, FastAPI + Gemini), porque a chave do Gemini não pode
ficar no navegador.

**1. Crie as tabelas** — no SQL Editor do Supabase, rode o
`supabase/schema-estudos.sql`. No fim devem aparecer `ingles_palavras`,
`ingles_erros`, `ingles_sessoes` e `ingles_perfil` com `rowsecurity = true`.

**2. Suba a tutor-api** (em outro terminal):

```bash
cd tutor-api
python -m venv .venv
.venv\Scripts\activate          # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # Mac/Linux: cp — e cole sua GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

A chave do Gemini é gratuita: aistudio.google.com/apikey.

**3. Abra a aba Estudos** com o `npm run dev` rodando. O Vite repassa `/api`
para `http://localhost:8000`, então não há nada a configurar no app. Use o
Chrome ou o Edge para falar — o reconhecimento de voz depende deles.

**Como o tutor "aprende".** O modelo não é treinado nem lembra de nada
sozinho: ele só sabe o que vai escrito nas instruções de cada chamada. Por
isso o app manda, junto com a conversa, o campo **O que estou estudando** e o
que há de mais recente nos seus erros e no seu vocabulário
(`src/estudos/contexto.ts`), e a tutor-api transforma isso em instruções
(`tutor-api/contexto.py`). Para mudar o comportamento de base do tutor — tom,
nível, cenários — o lugar é `tutor-api/prompts.py`.

Sem a tutor-api no ar, o vocabulário e o histórico continuam funcionando; só a
conversa avisa que não achou o tutor.

**Publicando.** Com a tutor-api hospedada em algum lugar, o app precisa de
`VITE_TUTOR_API_URL` (o endereço dela) e a API precisa de `CORS_ORIGINS`,
`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no `.env` dela. Com as duas
últimas preenchidas, a API só responde a quem está logado no app — sem isso,
qualquer pessoa com o endereço gastaria a sua cota do Gemini. Está tudo
comentado em `tutor-api/.env.example`.

---

## Primeiro acesso

Entre com a mesma conta do Foco. Se você já tinha treinos salvos no navegador,
o app detecta e pergunta se quer enviar tudo pra nuvem — cargas, repetições e
datas vão junto, ligadas aos mesmos exercícios.

**Nada é apagado do IndexedDB.** Os dados locais continuam lá como cópia de
segurança, só param de ser usados.

Se a conta estiver vazia e não houver nada local, as cinco rotinas padrão são
criadas automaticamente.

---

## Estrutura

```
src/
├── lib/
│   ├── supabase.ts        o cliente, criado uma vez
│   └── datas.ts           chaves de data e formatação (sempre local, nunca UTC)
├── auth/AuthProvider.tsx  sessão do usuário pro app todo
├── components/
│   ├── Nav.tsx            as abas Hoje / Foco / Estudos / Treinos / Medidas
│   ├── estudos/           conversa, vocabulário e histórico da aba Estudos
│   └── FrequencyCalendar.tsx
├── db/                    ⬅ lado TREINO
│   ├── queries.ts         todo acesso a rotinas/sessoes/execucoes
│   ├── seed.ts            rotinas padrão do primeiro acesso
│   ├── migrarLocal.ts     IndexedDB -> nuvem, roda uma vez
│   └── db.ts              Dexie antigo, só pra ler na migração
├── estudos/               ⬅ lado ESTUDOS
│   ├── api.ts             fala com a tutor-api (chat e resumo)
│   ├── queries.ts         acesso a ingles_palavras/erros/sessoes/perfil
│   ├── contexto.ts        o que o tutor recebe além da conversa
│   ├── useEstudos.ts      vocabulário, erros e sessões guardados
│   ├── useVoz.ts          fala -> texto e texto -> fala, no navegador
│   └── vocabulario.ts     regras puras: o que conta como palavra nova
├── foco/                  ⬅ lado FOCO
│   ├── queries.ts         acesso a settings/days/tasks
│   ├── useTimer.ts        o motor do pomodoro
│   ├── useFoco.ts         estado do dia, tarefas e config
│   └── tipos.ts
└── pages/
    ├── Login.tsx          entrar / criar conta
    ├── Boot.tsx           migração e seed, entre o login e o app
    ├── Hoje.tsx           o painel que junta os dois lados
    ├── Foco.tsx           pomodoro completo
    ├── Estudos.tsx        tutor de inglês
    ├── Home.tsx           aba Treinos: rotinas + calendário
    └── Sessao.tsx         o treino do dia
```

Fora do `src/`, a pasta `tutor-api/` é o servidor do tutor: `main.py` (rotas),
`llm.py` (Gemini ou Claude), `prompts.py` (o tutor e os cenários),
`contexto.py` (foco atual e histórico viram instruções) e `auth.py` (quem
pode usar).

**Nenhuma página fala com o banco direto.** O lado treino passa por
`db/queries.ts`, o lado foco por `foco/queries.ts`, o lado estudos por
`estudos/queries.ts`. Trocar de banco de novo
custaria mexer em dois arquivos.

### As duas larguras

O app de treino nasceu pra celular, e as telas dele continuam com largura de
480px. As telas de Foco e Hoje são de computador e usam mais espaço. Por isso
o limite de largura fica em cada página, não no `#root`.

### As tabelas

O Foco usa `settings`, `days` e `tasks` — as mesmas que o app Foco original
criou. Enquanto os dois existirem, o que você registrar num aparece no outro.
O Treino usa `rotinas`, `sessoes` e `execucoes`. Os Estudos usam
`ingles_palavras`, `ingles_erros`, `ingles_sessoes` e `ingles_perfil`.

---

## Detalhes que valem saber

**Datas agora são locais.** A versão anterior usava `toISOString()`, que devolve
a data em UTC — em Maceió (UTC-3) um treino registrado depois das 21h caía no
dia seguinte. Agora a data é a do relógio. Sessões antigas migradas mantêm a
data que tinham.

**Uma sessão por rotina por dia.** Garantido pela constraint
`unique (user_id, rotina_id, data)`, então abrir a mesma rotina duas vezes no
mesmo dia não cria duplicata.

**O `exercicio_id` não é chave estrangeira de propósito.** Ele é o uuid que vive
dentro do jsonb da rotina — assim renomear ou reordenar um exercício não quebra
o histórico de carga dele.

---

## Próximos passos

- Gráfico de evolução de carga por exercício
- Metas separadas por tipo (ex.: 4h de trabalho + 2h de estudo)
- Aposentar o app Foco antigo depois de alguns dias usando este
- Agenda do dia em blocos de horário (planejado × realizado)
