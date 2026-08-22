-- dia de mês de academia
alter table public.settings
  add column if not exists academia_dia smallint;

-- só dia de mês faz sentido aqui
alter table public.settings
  drop constraint if exists settings_academia_dia_valido;

alter table public.settings
  add constraint settings_academia_dia_valido
  check (academia_dia is null or (academia_dia between 1 and 31));

-- conferência: deve listar a coluna
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'settings'
  and column_name = 'academia_dia';
