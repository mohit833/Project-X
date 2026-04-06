create or replace function public.normalize_pick(p_value text)
returns text
language sql
immutable
as $$
  with cleaned as (
    select trim(
      both '-'
      from regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(p_value, '')), '\([^)]*\)', ' ', 'g'),
          '[+*]',
          ' ',
          'g'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    ) as slug
  )
  select trim(
    both '-'
    from regexp_replace(slug, '(-(?:c|cs|ip|rp|sub|vc|wk))+$', '', 'g')
  )
  from cleaned;
$$;

create or replace function public.normalize_score_map(p_score_map jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(normalized_key, max_value),
    '{}'::jsonb
  )
  from (
    select
      public.normalize_pick(score_entry.key) as normalized_key,
      max(score_entry.value::integer) as max_value
    from jsonb_each_text(coalesce(p_score_map, '{}'::jsonb)) as score_entry(key, value)
    where score_entry.value ~ '^-?\d+$'
    group by public.normalize_pick(score_entry.key)
  ) normalized_entries
  where normalized_key <> '';
$$;

create or replace function public.score_map_lookup(p_score_map jsonb, p_player_name text)
returns integer
language sql
immutable
as $$
  select coalesce(
    (
      select max(score_entry.value::integer)
      from jsonb_each_text(coalesce(p_score_map, '{}'::jsonb)) as score_entry(key, value)
      where score_entry.value ~ '^-?\d+$'
        and public.normalize_pick(score_entry.key) = public.normalize_pick(p_player_name)
    ),
    0
  );
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1
      from public.leagues
      where invite_code = v_code
    );
  end loop;

  return v_code;
end;
$$;

alter table public.matches
  add column if not exists provider text not null default 'manual',
  add column if not exists external_match_id text,
  add column if not exists series_name text,
  add column if not exists playing_xi jsonb not null default '{"team_a":[],"team_b":[]}'::jsonb,
  add column if not exists current_innings_ball integer,
  add column if not exists current_over_display text,
  add column if not exists auto_sync_enabled boolean not null default false,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_error text;

create unique index if not exists matches_league_external_match_unique_idx
on public.matches (league_id, external_match_id)
where external_match_id is not null;

drop index if exists predictions_match_batsman_unique_idx;
drop index if exists predictions_match_bowler_unique_idx;
create unique index if not exists predictions_match_combo_unique_idx
on public.predictions (match_id, batsman_key, bowler_key)
where batsman_key <> '' and bowler_key <> '';

create or replace function public.submit_prediction(
  p_match_id uuid,
  p_batsman_name text default null,
  p_bowler_name text default null,
  p_team_pick text default null,
  p_predicted_score integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_match public.matches%rowtype;
  v_member public.league_members%rowtype;
  v_league_status text;
  v_prediction public.predictions%rowtype;
  v_prediction_id uuid;
  v_wants_core boolean;
  v_batsman text := nullif(trim(coalesce(p_batsman_name, '')), '');
  v_bowler text := nullif(trim(coalesce(p_bowler_name, '')), '');
  v_team_pick text := nullif(trim(coalesce(p_team_pick, '')), '');
  v_core_locked boolean := false;
  v_score_window_open boolean := false;
  v_score_locked boolean := false;
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

  select *
  into v_member
  from public.league_members
  where league_id = v_match.league_id
    and user_id = v_uid
    and is_active = true;

  if v_member.id is null then
    raise exception 'You are not part of this league.';
  end if;

  select status
  into v_league_status
  from public.leagues
  where id = v_match.league_id;

  if coalesce(v_league_status, 'active') <> 'active' then
    raise exception 'This league has already ended.';
  end if;

  v_wants_core := v_batsman is not null or v_bowler is not null or v_team_pick is not null;

  if v_wants_core and (v_batsman is null or v_bowler is null or v_team_pick is null) then
    raise exception 'Submit batsman, bowler, and winning team together.';
  end if;

  if v_team_pick is not null then
    if lower(v_team_pick) = lower(v_match.team_a) then
      v_team_pick := v_match.team_a;
    elsif lower(v_team_pick) = lower(v_match.team_b) then
      v_team_pick := v_match.team_b;
    else
      raise exception 'Winning team must match one of the teams in this fixture.';
    end if;
  end if;

  select *
  into v_prediction
  from public.predictions
  where match_id = p_match_id
    and user_id = v_uid
  for update;

  if v_match.current_innings_ball is not null then
    v_core_locked := v_match.current_innings_ball >= 19;
    v_score_window_open := v_match.current_innings_ball >= 19 and v_match.current_innings_ball < 43;
    v_score_locked := v_match.current_innings_ball >= 43;
  else
    v_core_locked := v_match.picks_deadline_at is not null and v_now > v_match.picks_deadline_at;
    v_score_window_open := v_match.picks_deadline_at is not null
      and v_now >= v_match.picks_deadline_at
      and not (v_match.score_deadline_at is not null and v_now > v_match.score_deadline_at);
    v_score_locked := v_match.score_deadline_at is not null and v_now > v_match.score_deadline_at;
  end if;

  if v_wants_core then
    if public.normalize_pick(v_batsman) = public.normalize_pick(v_bowler) then
      raise exception 'Batsman and bowler must be two different players.';
    end if;

    if v_core_locked then
      raise exception 'Core picks are locked after the 3.1 over cutoff.';
    end if;

    if exists (
      select 1
      from public.predictions
      where match_id = p_match_id
        and user_id <> v_uid
        and public.normalize_pick(batsman_name) = public.normalize_pick(v_batsman)
        and public.normalize_pick(bowler_name) = public.normalize_pick(v_bowler)
    ) then
      raise exception 'That batsman-bowler combination has already been taken.';
    end if;
  end if;

  if p_predicted_score is not null then
    if p_predicted_score < 0 then
      raise exception 'Predicted score must be zero or higher.';
    end if;

    if not v_score_window_open or v_score_locked then
      if v_score_locked then
        raise exception 'Score prediction is locked after the 7.1 over cutoff.';
      end if;

      raise exception 'Score prediction opens after the 3.1 over cutoff.';
    end if;

    if exists (
      select 1
      from public.predictions
      where match_id = p_match_id
        and user_id <> v_uid
        and predicted_score = p_predicted_score
    ) then
      raise exception 'That score prediction has already been taken.';
    end if;
  end if;

  if v_prediction.id is null then
    insert into public.predictions (
      league_id,
      match_id,
      member_id,
      user_id,
      batsman_name,
      bowler_name,
      team_pick,
      predicted_score,
      core_submitted_at,
      score_submitted_at,
      core_locked_due_to_pre_xi
    )
    values (
      v_match.league_id,
      p_match_id,
      v_member.id,
      v_uid,
      case when v_wants_core then v_batsman else null end,
      case when v_wants_core then v_bowler else null end,
      case when v_wants_core then v_team_pick else null end,
      p_predicted_score,
      case when v_wants_core then v_now else null end,
      case when p_predicted_score is not null then v_now else null end,
      case
        when v_wants_core
          and (v_match.playing_xi_announced_at is null or v_now < v_match.playing_xi_announced_at)
          then true
        else false
      end
    )
    returning id into v_prediction_id;
  else
    update public.predictions
    set batsman_name = case when v_wants_core then v_batsman else batsman_name end,
        bowler_name = case when v_wants_core then v_bowler else bowler_name end,
        team_pick = case when v_wants_core then v_team_pick else team_pick end,
        predicted_score = case when p_predicted_score is not null then p_predicted_score else predicted_score end,
        core_submitted_at = case when v_wants_core then v_now else core_submitted_at end,
        score_submitted_at = case when p_predicted_score is not null then v_now else score_submitted_at end,
        core_locked_due_to_pre_xi = case
          when v_wants_core then
            (
              v_match.playing_xi_announced_at is null or v_now < v_match.playing_xi_announced_at
            )
          else core_locked_due_to_pre_xi
        end
    where id = v_prediction.id
    returning id into v_prediction_id;
  end if;

  return v_prediction_id;
exception
  when unique_violation then
    raise exception 'That score or batsman-bowler combination was just taken by someone else. Refresh and choose a different option.';
end;
$$;

create or replace function public.end_league(p_league_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if p_league_id is null then
    raise exception 'League not found.';
  end if;

  if not public.is_league_admin(p_league_id) then
    raise exception 'Only the league creator can end this league.';
  end if;

  update public.leagues
  set status = 'archived'
  where id = p_league_id;

  if not found then
    raise exception 'League not found.';
  end if;

  return p_league_id;
end;
$$;

grant execute on function public.end_league(uuid) to authenticated;

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

  if lower(v_winner) = lower(v_match.team_a) then
    v_winner := v_match.team_a;
  elsif lower(v_winner) = lower(v_match.team_b) then
    v_winner := v_match.team_b;
  else
    raise exception 'Winner must match one of the teams in this fixture.';
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
    public.normalize_score_map(p_batsman_runs),
    public.normalize_score_map(p_bowler_wickets),
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

create or replace view public.prediction_points
with (security_invoker = true)
as
with scored_predictions as (
  select
    p.id as prediction_id,
    p.league_id,
    p.match_id,
    p.member_id,
    p.user_id,
    public.score_map_lookup(mr.batsman_runs, p.batsman_name) as batsman_points,
    public.score_map_lookup(mr.bowler_wickets, p.bowler_name) * 20 as bowler_points,
    case
      when mr.winner_team is not null and lower(mr.winner_team) = lower(coalesce(p.team_pick, '')) then 50
      else 0
    end as team_points,
    mr.first_innings_total,
    p.predicted_score,
    case
      when mr.first_innings_total is not null and p.predicted_score is not null
        then abs(mr.first_innings_total - p.predicted_score)
      else null
    end as score_delta
  from public.predictions p
  left join public.match_results mr
    on mr.match_id = p.match_id
),
best_scores as (
  select
    scored_predictions.*,
    min(score_delta) filter (where score_delta is not null) over (partition by match_id) as best_score_delta
  from scored_predictions
),
resolved_score_ties as (
  select
    best_scores.*,
    count(*) filter (
      where score_delta is not null
        and best_score_delta is not null
        and score_delta = best_score_delta
    ) over (partition by match_id) as best_score_tie_count
  from best_scores
),
resolved_scores as (
  select
    prediction_id,
    league_id,
    match_id,
    member_id,
    user_id,
    batsman_points,
    bowler_points,
    case
      when first_innings_total is null or predicted_score is null then 0
      when best_score_delta is null or best_score_tie_count <= 0 then 0
      when score_delta = best_score_delta then (10 / best_score_tie_count)::integer
      else 0
    end as score_points,
    team_points
  from resolved_score_ties
)
select
  prediction_id,
  league_id,
  match_id,
  member_id,
  user_id,
  batsman_points,
  bowler_points,
  score_points,
  team_points,
  batsman_points + bowler_points + score_points + team_points as total_points
from resolved_scores;
