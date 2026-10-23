-- =========================================================
-- Foco — estrutura do banco no Supabase
--
-- COMO USAR:
-- 1. Entre no seu projeto no Supabase
-- 2. Menu da esquerda -> SQL Editor -> New query
-- 3. Cole este arquivo inteiro e clique em RUN
--
-- Pode rodar mais de uma vez sem problema (é idempotente).
-- =========================================================


-- ---------------------------------------------------------
-- CONFIGURAÇÕES — uma linha por pessoa
-- ---------------------------------------------------------
create table if not exists public.settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  goal_hours  numeric(4,2) not null default 6,
  focus_min   integer      not null default 25,
  short_min   integer      not null default 5,
  long_min    integer      not null default 15,
  long_every  integer      not null default 4,
  sound       boolean      not null default true,
  last_type   text         not null default 'estudo' check (last_type in ('trabalho','estudo')),
  updated_at  timestamptz  not null default now()
);

-- caso você já tenha rodado uma versão anterior deste arquivo
alter table public.settings add column if not exists last_type text not null default 'estudo';


-- ---------------------------------------------------------
-- DIAS — horas focadas, pomodoros e a anotação do dia
-- ---------------------------------------------------------
-- seconds = total do dia
-- seconds_work + seconds_study = seconds (todo tempo tem um tipo)
create table if not exists public.days (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  date          date        not null,
  seconds       integer     not null default 0,
  seconds_work  integer     not null default 0,
  seconds_study integer     not null default 0,
  pomodoros     integer     not null default 0,
  note          text        not null default '',
  updated_at    timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.days add column if not exists seconds_work  integer not null default 0;
alter table public.days add column if not exists seconds_study integer not null default 0;

create index if not exists days_user_date_idx on public.days (user_id, date desc);


-- ---------------------------------------------------------
-- TAREFAS
-- ---------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  type       text        not null default 'estudo' check (type in ('trabalho','estudo')),
  done       boolean     not null default false,
  pomodoros  integer     not null default 0,
  date       date,
  created_at timestamptz not null default now()
);

alter table public.tasks add column if not exists type text not null default 'estudo';

create index if not exists tasks_user_date_idx on public.tasks (user_id, date);


-- =========================================================
-- SEGURANÇA (Row Level Security)
--
-- É ISTO que protege seus dados. Sem estas políticas,
-- qualquer pessoa com a chave pública do projeto poderia
-- ler o banco inteiro. Com elas, cada linha só é visível
-- para o dono — o banco compara auth.uid() com user_id
-- a cada consulta.
-- =========================================================

alter table public.settings enable row level security;
alter table public.days     enable row level security;
alter table public.tasks    enable row level security;

-- settings
drop policy if exists "settings: dono lê"      on public.settings;
drop policy if exists "settings: dono insere"  on public.settings;
drop policy if exists "settings: dono atualiza" on public.settings;
drop policy if exists "settings: dono apaga"   on public.settings;

create policy "settings: dono lê"       on public.settings for select using (auth.uid() = user_id);
create policy "settings: dono insere"   on public.settings for insert with check (auth.uid() = user_id);
create policy "settings: dono atualiza" on public.settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings: dono apaga"    on public.settings for delete using (auth.uid() = user_id);

-- days
drop policy if exists "days: dono lê"       on public.days;
drop policy if exists "days: dono insere"   on public.days;
drop policy if exists "days: dono atualiza" on public.days;
drop policy if exists "days: dono apaga"    on public.days;

create policy "days: dono lê"       on public.days for select using (auth.uid() = user_id);
create policy "days: dono insere"   on public.days for insert with check (auth.uid() = user_id);
create policy "days: dono atualiza" on public.days for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "days: dono apaga"    on public.days for delete using (auth.uid() = user_id);

-- tasks
drop policy if exists "tasks: dono lê"       on public.tasks;
drop policy if exists "tasks: dono insere"   on public.tasks;
drop policy if exists "tasks: dono atualiza" on public.tasks;
drop policy if exists "tasks: dono apaga"    on public.tasks;

create policy "tasks: dono lê"       on public.tasks for select using (auth.uid() = user_id);
create policy "tasks: dono insere"   on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks: dono atualiza" on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks: dono apaga"    on public.tasks for delete using (auth.uid() = user_id);


-- =========================================================
-- Conferência rápida: as três tabelas devem aparecer
-- com rowsecurity = true
-- =========================================================
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('settings','days','tasks');
