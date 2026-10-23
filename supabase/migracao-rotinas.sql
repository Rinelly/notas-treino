-- =========================================================
-- Rotinas — o programa de segunda a sexta
--
-- Rode no SQL Editor do Supabase. Pode rodar de novo quando quiser:
-- ele reescreve as mesmas linhas em vez de criar outras.
--
-- O QUE ELE FAZ, E O QUE NÃO FAZ
--
-- Não apaga nada. `sessoes` tem `on delete cascade` em `rotinas`:
-- apagar uma rotina levaria junto TODO o histórico de treino dela.
-- Por isso ele reaproveita as linhas que já existem, pela ordem de
-- id (a mesma ordem de que o app tira as letras A, B, C...), e só
-- insere linha nova se faltar.
--
-- Efeito colateral honesto: as sessões antigas continuam apontando
-- para as mesmas linhas, então um treino de semana passada passa a
-- aparecer com o nome novo. É o que "troquei de programa" significa
-- neste app — o histórico de carga continua lá, por exercício.
--
-- Os ids de exercício são preservados quando o NOME bate com o que
-- já estava na rotina. Onde o nome mudou, o registro antigo não se
-- perde: continua no histórico e sai no CSV marcado como removido.
--
-- Depois de rodar: segunda=A, terça=B, quarta=C, quinta=D, sexta=E.
-- =========================================================

do $$
declare
  u         uuid;
  p         record;
  id_atual  bigint;
  antigos   jsonb;
  novos     jsonb;
begin
  -- troque o e-mail aqui se a conta for outra
  select id into u
    from auth.users
   where lower(email) = lower('rinellyvasconcelos@gmail.com');

  if u is null then
    raise exception 'Não encontrei esse usuário em auth.users. Confira o e-mail na linha acima.';
  end if;

  for p in
    select *
      from (values

        (1, 'Segunda', 'Inferiores A — quadríceps e glúteos', $j$[
          {"id":"agachamento-livre-smith","nome":"Agachamento livre ou Smith","categoria":"treino","seriesAlvo":"3 × 6–10","descanso":"2–3 min"},
          {"id":"leg-press-45","nome":"Leg press 45°","categoria":"treino","seriesAlvo":"3 × 10–12","descanso":"2 min"},
          {"id":"hip-thrust","nome":"Hip thrust","categoria":"treino","seriesAlvo":"3 × 8–12","descanso":"2 min"},
          {"id":"extensora-dropset","nome":"Cadeira extensora","categoria":"treino","seriesAlvo":"3 × 12–15","descanso":"60–90 s","observacao":"+ 1 dropset na última"},
          {"id":"abdutora","nome":"Cadeira abdutora","categoria":"treino","seriesAlvo":"2 × 15–20","descanso":"60 s"},
          {"id":"cardio-escada","nome":"Escada","categoria":"cardio","seriesAlvo":"10–15 min"}
        ]$j$::jsonb),

        (2, 'Terça', 'Superiores A — costas, peito e braços', $j$[
          {"id":"puxada-alta-frente","nome":"Puxada alta pela frente","categoria":"treino","seriesAlvo":"3 × 8–12","descanso":"90 s"},
          {"id":"remada-baixa","nome":"Remada baixa","categoria":"treino","seriesAlvo":"3 × 8–12","descanso":"90 s"},
          {"id":"supino-maquina-elevacao","nome":"Supino máquina + elevação lateral","categoria":"treino","seriesAlvo":"3 × 8–12","descanso":"90–120 s","observacao":"bi-set"},
          {"id":"rosca-direta-triceps-corda","nome":"Rosca direta + tríceps corda","categoria":"treino","seriesAlvo":"2 × 10–15","descanso":"60 s","observacao":"bi-set"},
          {"id":"cardio-escada-eliptico","nome":"Escada ou elíptico","categoria":"cardio","seriesAlvo":"15 min"}
        ]$j$::jsonb),

        (3, 'Quarta', 'Inferiores B — posteriores e glúteos', $j$[
          {"id":"stiff","nome":"Stiff com barra ou halteres","categoria":"treino","seriesAlvo":"3 × 8–10","descanso":"2–3 min"},
          {"id":"mesa-flexora","nome":"Mesa flexora","categoria":"treino","seriesAlvo":"3 × 10–15","descanso":"90 s"},
          {"id":"afundo-bulgaro","nome":"Afundo búlgaro","categoria":"treino","seriesAlvo":"3 × 8–12 por perna","descanso":"2 min"},
          {"id":"flexora-sentada","nome":"Cadeira flexora sentada","categoria":"treino","seriesAlvo":"2 × 12–15","descanso":"60–90 s"},
          {"id":"extensao-quadril-cabo","nome":"Extensão de quadril no cabo","categoria":"treino","seriesAlvo":"2 × 12–15 por perna","descanso":"60 s"},
          {"id":"cardio-escada","nome":"Escada","categoria":"cardio","seriesAlvo":"10 min"}
        ]$j$::jsonb),

        (4, 'Quinta', 'Superiores B — costas, ombros, peito e braços', $j$[
          {"id":"remada-apoio-peito","nome":"Remada com apoio no peito","categoria":"treino","seriesAlvo":"3 × 8–12","descanso":"90 s"},
          {"id":"puxada-pegada-neutra","nome":"Puxada com pegada neutra","categoria":"treino","seriesAlvo":"3 × 10–12","descanso":"90 s"},
          {"id":"supino-inclinado-halteres","nome":"Supino inclinado com halteres","categoria":"treino","seriesAlvo":"3 × 8–12","descanso":"90–120 s"},
          {"id":"desenvolvimento-maquina","nome":"Desenvolvimento na máquina","categoria":"treino","seriesAlvo":"2 × 8–12","descanso":"90 s"},
          {"id":"face-pull","nome":"Face pull","categoria":"treino","seriesAlvo":"2 × 12–20","descanso":"60 s"},
          {"id":"rosca-martelo-triceps-polia","nome":"Rosca martelo + tríceps na polia","categoria":"treino","seriesAlvo":"2 × 10–15","descanso":"60 s","observacao":"bi-set"},
          {"id":"cardio-escada-eliptico","nome":"Escada ou elíptico","categoria":"cardio","seriesAlvo":"15 min"}
        ]$j$::jsonb),

        (5, 'Sexta', 'Inferiores C — glúteos', $j$[
          {"id":"hip-thrust","nome":"Hip thrust","categoria":"treino","seriesAlvo":"3 × 8–12","descanso":"2 min"},
          {"id":"agachamento-smith","nome":"Agachamento no Smith","categoria":"treino","seriesAlvo":"3 × 10–12","descanso":"2 min"},
          {"id":"cadeira-flexora","nome":"Cadeira flexora","categoria":"treino","seriesAlvo":"3 × 12–15","descanso":"90 s"},
          {"id":"cadeira-extensora","nome":"Cadeira extensora","categoria":"treino","seriesAlvo":"2 × 12–15","descanso":"60–90 s"},
          {"id":"abdutora","nome":"Cadeira abdutora","categoria":"treino","seriesAlvo":"2 × 15–20","descanso":"60 s"},
          {"id":"cardio-eliptico","nome":"Elíptico","categoria":"cardio","seriesAlvo":"10–15 min"}
        ]$j$::jsonb)

      ) as t(ordem, dia_semana, nome, itens)
     order by ordem
  loop

    -- a n-ésima rotina que já existe, na mesma ordem de que saem as letras
    select id into id_atual
      from public.rotinas
     where user_id = u
     order by id
    offset p.ordem - 1
     limit 1;

    if id_atual is null then
      insert into public.rotinas (user_id, dia_semana, nome, exercicios)
      values (u, p.dia_semana, p.nome, p.itens);

    else
      select coalesce(exercicios, '[]'::jsonb)
        into antigos
        from public.rotinas
       where id = id_atual;

      -- mesmo nome de exercício = mesmo id de antes, pra não perder
      -- a carga já registrada naquele exercício
      select jsonb_agg(
               jsonb_strip_nulls(
                 jsonb_build_object(
                   'id', coalesce(
                           (select o->>'id'
                              from jsonb_array_elements(antigos) o
                             where lower(o->>'nome') = lower(i->>'nome')
                             limit 1),
                           i->>'id'),
                   'nome',       i->>'nome',
                   'categoria',  i->>'categoria',
                   'seriesAlvo', i->>'seriesAlvo',
                   'descanso',   i->>'descanso',
                   'observacao', i->>'observacao'
                 )
               )
               order by ord
             )
        into novos
        from jsonb_array_elements(p.itens) with ordinality as t(i, ord);

      -- rede de segurança: dois exercícios com o mesmo id na mesma
      -- rotina fariam um sobrescrever o registro do outro, porque
      -- `execucoes` é única por (sessao_id, exercicio_id)
      if (select count(distinct e->>'id') from jsonb_array_elements(novos) e)
         <> jsonb_array_length(novos) then
        raise exception 'Rotina "%": dois exercícios ficaram com o mesmo id. Nada foi gravado.', p.nome;
      end if;

      update public.rotinas
         set dia_semana = p.dia_semana,
             nome       = p.nome,
             exercicios = novos
       where id = id_atual;
    end if;

  end loop;
end $$;


-- Como ficou. Se aparecer alguma linha depois da sexta-feira, é uma
-- rotina antiga que sobrou — ela foi deixada de pé de propósito,
-- porque apagar levaria o histórico junto.
select r.id,
       r.dia_semana,
       r.nome,
       jsonb_array_length(r.exercicios) as exercicios
  from public.rotinas r
  join auth.users u on u.id = r.user_id
 where lower(u.email) = lower('rinellyvasconcelos@gmail.com')
 order by r.id;
