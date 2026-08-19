# Foco & Treino

Um app só pra duas coisas: **acompanhar as horas de foco do dia** e
**registrar os treinos**. Três abas:

- **Hoje** — painel do dia: horas de foco, treino previsto e o quanto dele já
  foi feito, tarefas pendentes e a anotação
- **Foco** — pomodoro com meta diária em horas, tarefas classificadas em
  trabalho/estudo, anotações e histórico de 14 dias. Só o tempo de foco conta
  na meta; pausa não entra
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
│   ├── Nav.tsx            as abas Hoje / Foco / Treinos
│   └── FrequencyCalendar.tsx
├── db/                    ⬅ lado TREINO
│   ├── queries.ts         todo acesso a rotinas/sessoes/execucoes
│   ├── seed.ts            rotinas padrão do primeiro acesso
│   ├── migrarLocal.ts     IndexedDB -> nuvem, roda uma vez
│   └── db.ts              Dexie antigo, só pra ler na migração
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
    ├── Home.tsx           aba Treinos: rotinas + calendário
    └── Sessao.tsx         o treino do dia
```

**Nenhuma página fala com o banco direto.** O lado treino passa por
`db/queries.ts`, o lado foco por `foco/queries.ts`. Trocar de banco de novo
custaria mexer em dois arquivos.

### As duas larguras

O app de treino nasceu pra celular, e as telas dele continuam com largura de
480px. As telas de Foco e Hoje são de computador e usam mais espaço. Por isso
o limite de largura fica em cada página, não no `#root`.

### As tabelas

O Foco usa `settings`, `days` e `tasks` — as mesmas que o app Foco original
criou. Enquanto os dois existirem, o que você registrar num aparece no outro.
O Treino usa `rotinas`, `sessoes` e `execucoes`.

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
