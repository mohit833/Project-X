create or replace function public.score_map_lookup(p_score_map jsonb, p_player_name text)
returns integer
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(p_player_name, '')), '') is null then 0
    else coalesce(
      (
        select max(score_entry.value::integer)
        from jsonb_each_text(coalesce(p_score_map, '{}'::jsonb)) as score_entry(key, value)
        where score_entry.value ~ '^-?\d+$'
          and public.normalize_pick(score_entry.key) = public.normalize_pick(p_player_name)
      ),
      0
    )
  end;
$$;

alter table public.predictions
drop constraint if exists predictions_core_all_or_none_chk;

alter table public.predictions
add constraint predictions_core_all_or_none_chk
check (
  (batsman_name is null and bowler_name is null and team_pick is null)
  or
  (batsman_name is not null and bowler_name is not null and team_pick is not null)
);

notify pgrst, 'reload schema';
