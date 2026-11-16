-- =========================================================
-- Estudos (tutor de inglês) — estrutura do banco no Supabase
--
-- COMO USAR:
-- 1. Entre no seu projeto no Supabase
-- 2. Menu da esquerda -> SQL Editor -> New query
-- 3. Cole este arquivo inteiro e clique em RUN
--
-- Pode rodar mais de uma vez sem problema (é idempotente).
-- =========================================================


-- ---------------------------------------------------------
-- PALAVRAS — o vocabulário que o tutor foi apresentando
-- ---------------------------------------------------------
-- chave = a palavra em minúsculas e sem espaço sobrando.
-- É ela que impede "Deadline" e "deadline" de virarem duas linhas.
create table if not exists public.ingles_palavras (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  chave       text        not null,
  palavra     text        not null,
  significado text        not null default '',
  exemplo     text        not null default '',
  criado_em   timestamptz not null default now(),
  unique (user_id, chave)
);

create index if not exists ingles_palavras_user_idx
  on public.ingles_palavras (user_id, criado_em desc);


-- ---------------------------------------------------------
-- ERROS — as correções que o tutor fez nas suas falas
-- ---------------------------------------------------------
create table if not exists public.ingles_erros (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  original   text        not null,
  correcao   text        not null,
  explicacao text        not null default '',
  criado_em  timestamptz not null default now()
);

create index if not exists ingles_erros_user_idx
  on public.ingles_erros (user_id, criado_em desc);


-- ---------------------------------------------------------
-- SESSÕES — uma linha por conversa encerrada, com o resumo
-- ---------------------------------------------------------
create table if not exists public.ingles_sessoes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  cenario      text        not null default 'free',
  mensagens    integer     not null default 0,
  correcoes    integer     not null default 0,
  palavras     integer     not null default 0,
  duracao_seg  integer     not null default 0,
  resumo       text        not null default '',
  iniciada_em  timestamptz not null default now(),
  encerrada_em timestamptz not null default now()
);

create index if not exists ingles_sessoes_user_idx
  on public.ingles_sessoes (user_id, encerrada_em desc);


-- =========================================================
-- SEGURANÇA (Row Level Security)
-- Cada linha só é visível para o dono, igual ao resto do app.
-- =========================================================

alter table public.ingles_palavras enable row level security;
alter table public.ingles_erros    enable row level security;
alter table public.ingles_sessoes  enable row level security;

-- ingles_palavras
drop policy if exists "ingles_palavras: dono lê"       on public.ingles_palavras;
drop policy if exists "ingles_palavras: dono insere"   on public.ingles_palavras;
drop policy if exists "ingles_palavras: dono atualiza" on public.ingles_palavras;
drop policy if exists "ingles_palavras: dono apaga"    on public.ingles_palavras;

create policy "ingles_palavras: dono lê"       on public.ingles_palavras for select using (auth.uid() = user_id);
create policy "ingles_palavras: dono insere"   on public.ingles_palavras for insert with check (auth.uid() = user_id);
create policy "ingles_palavras: dono atualiza" on public.ingles_palavras for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ingles_palavras: dono apaga"    on public.ingles_palavras for delete using (auth.uid() = user_id);

-- ingles_erros
drop policy if exists "ingles_erros: dono lê"       on public.ingles_erros;
drop policy if exists "ingles_erros: dono insere"   on public.ingles_erros;
drop policy if exists "ingles_erros: dono atualiza" on public.ingles_erros;
drop policy if exists "ingles_erros: dono apaga"    on public.ingles_erros;

create policy "ingles_erros: dono lê"       on public.ingles_erros for select using (auth.uid() = user_id);
create policy "ingles_erros: dono insere"   on public.ingles_erros for insert with check (auth.uid() = user_id);
create policy "ingles_erros: dono atualiza" on public.ingles_erros for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ingles_erros: dono apaga"    on public.ingles_erros for delete using (auth.uid() = user_id);

-- ingles_sessoes
drop policy if exists "ingles_sessoes: dono lê"       on public.ingles_sessoes;
drop policy if exists "ingles_sessoes: dono insere"   on public.ingles_sessoes;
drop policy if exists "ingles_sessoes: dono atualiza" on public.ingles_sessoes;
drop policy if exists "ingles_sessoes: dono apaga"    on public.ingles_sessoes;

create policy "ingles_sessoes: dono lê"       on public.ingles_sessoes for select using (auth.uid() = user_id);
create policy "ingles_sessoes: dono insere"   on public.ingles_sessoes for insert with check (auth.uid() = user_id);
create policy "ingles_sessoes: dono atualiza" on public.ingles_sessoes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ingles_sessoes: dono apaga"    on public.ingles_sessoes for delete using (auth.uid() = user_id);


-- =========================================================
-- Conferência rápida: as três tabelas devem aparecer
-- com rowsecurity = true
-- =========================================================
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('ingles_palavras','ingles_erros','ingles_sessoes');
