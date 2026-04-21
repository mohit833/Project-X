create or replace function public.save_match_result(
  p_match_id uuid,
  p_winner_team text,
  p_first_innings_total integer,
  p_batsman_runs jsonb default '{}'::jsonb,
  p_bowler_wickets jsonb default '{}'::jsonb,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_winner text := trim(coalesce(p_winner_team, ''));
  v_batsman_runs jsonb := public.normalize_score_map(p_batsman_runs);
  v_bowler_wickets jsonb := public.normalize_score_map(p_bowler_wickets);
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  select *
  into v_match
  from public.matches
  where id = p_match_id;

  if v_match.id is null then
    raise exception 'Match not found.';
  end if;

  if not public.is_league_admin(v_match.league_id) then
    raise exception 'Only admins can save match results.';
  end if;

  if v_match.status = 'cancelled' then
    raise exception 'Cancelled matches cannot be settled.';
  end if;

  if lower(v_winner) = lower(v_match.team_a) then
    v_winner := v_match.team_a;
  elsif lower(v_winner) = lower(v_match.team_b) then
    v_winner := v_match.team_b;
  else
    raise exception 'Winner must match one of the teams in this fixture.';
  end if;

  if v_batsman_runs = '{}'::jsonb and v_bowler_wickets = '{}'::jsonb then
    raise exception 'Scorecard player stats are not ready yet. Try syncing again before settling this match.';
  end if;

  insert into public.match_results (
    match_id,
    winner_team,
    first_innings_total,
    batsman_runs,
    bowler_wickets,
    notes,
    settled_by,
    settled_at
  )
  values (
    p_match_id,
    v_winner,
    p_first_innings_total,
    v_batsman_runs,
    v_bowler_wickets,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_uid,
    timezone('utc', now())
  )
  on conflict (match_id)
  do update
    set winner_team = excluded.winner_team,
        first_innings_total = excluded.first_innings_total,
        batsman_runs = excluded.batsman_runs,
        bowler_wickets = excluded.bowler_wickets,
        notes = excluded.notes,
        settled_by = excluded.settled_by,
        settled_at = timezone('utc', now());

  update public.matches
  set status = 'completed'
  where id = p_match_id;
end;
$$;

grant execute on function public.save_match_result(uuid, text, integer, jsonb, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
