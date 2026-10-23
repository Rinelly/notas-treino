-- =========================================================
-- registrar_dia — soma no servidor em vez de sobrescrever
--
-- O PROBLEMA
-- O app gravava o total do dia: `seconds = 7200`. Com dois
-- aparelhos no mesmo dia, o último a gravar apagava o outro —
-- duas horas no computador e uma no celular viravam uma hora,
-- sem aviso nenhum.
--
-- A SOLUÇÃO
-- O cliente passa a mandar só o que acumulou desde a última
-- gravação, e quem soma é o Postgres. Dois aparelhos podem
-- gravar ao mesmo tempo que os dois pedaços entram.
--
-- A anotação é diferente: texto não se soma. Ela continua sendo
-- "o último que escreveu manda", e só é tocada quando p_nota vem
-- preenchido — assim gravar tempo nunca apaga o que foi escrito.
--
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- =========================================================

create or replace function public.registrar_dia(
  p_data     date,
  p_seg      integer default 0,
  p_seg_trab integer default 0,
  p_seg_est  integer default 0,
  p_pom      integer default 0,
  p_nota     text    default null
)
returns public.days
language plpgsql
security invoker
set search_path = public
as $$
declare
  linha public.days;
begin
  -- greatest(...,0): incremento negativo só poderia vir de erro,
  -- e um erro não pode apagar hora registrada
  insert into public.days as d (
    user_id, date, seconds, seconds_work, seconds_study, pomodoros, note, updated_at
  )
  values (
    auth.uid(),
    p_data,
    greatest(coalesce(p_seg, 0), 0),
    greatest(coalesce(p_seg_trab, 0), 0),
    greatest(coalesce(p_seg_est, 0), 0),
    greatest(coalesce(p_pom, 0), 0),
    coalesce(p_nota, ''),
    now()
  )
  on conflict (user_id, date) do update
    set seconds       = d.seconds       + greatest(coalesce(p_seg, 0), 0),
        seconds_work  = d.seconds_work  + greatest(coalesce(p_seg_trab, 0), 0),
        seconds_study = d.seconds_study + greatest(coalesce(p_seg_est, 0), 0),
        pomodoros     = d.pomodoros     + greatest(coalesce(p_pom, 0), 0),
        note          = coalesce(p_nota, d.note),
        updated_at    = now()
  returning * into linha;

  return linha;
end;
$$;

grant execute on function public.registrar_dia(date, integer, integer, integer, integer, text)
  to authenticated;

-- conferência: deve devolver uma linha com a função
select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'registrar_dia';
