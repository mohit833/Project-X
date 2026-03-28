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
  v_is_admin boolean := false;
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

  v_is_admin := v_member.role = 'admin';
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

    if not v_is_admin and v_core_locked then
      raise exception 'Core picks are locked after the 3.1 over cutoff.';
    end if;

    if exists (
      select 1
      from public.predictions
      where match_id = p_match_id
        and user_id <> v_uid
        and batsman_key = public.normalize_pick(v_batsman)
        and bowler_key = public.normalize_pick(v_bowler)
    ) then
      raise exception 'That batsman-bowler combination has already been taken.';
    end if;
  end if;

  if p_predicted_score is not null then
    if p_predicted_score < 0 then
      raise exception 'Predicted score must be zero or higher.';
    end if;

    if (not v_is_admin and (not v_score_window_open or v_score_locked))
      and (v_prediction.id is null or v_prediction.predicted_score is distinct from p_predicted_score) then
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
          and not v_is_admin
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
              not v_is_admin
              and (v_match.playing_xi_announced_at is null or v_now < v_match.playing_xi_announced_at)
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
    coalesce((mr.batsman_runs ->> p.batsman_key)::integer, 0) as batsman_points,
    coalesce((mr.bowler_wickets ->> p.bowler_key)::integer, 0) * 20 as bowler_points,
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
    end as score_delta,
    row_number() over (
      partition by p.match_id
      order by
        case
          when mr.first_innings_total is not null and p.predicted_score = mr.first_innings_total then 0
          else 1
        end,
        case
          when mr.first_innings_total is not null and p.predicted_score is not null
            then abs(mr.first_innings_total - p.predicted_score)
          else 2147483647
        end,
        coalesce(p.score_submitted_at, p.created_at, 'infinity'::timestamptz),
        coalesce(p.created_at, 'infinity'::timestamptz),
        p.id
    ) as score_rank
  from public.predictions p
  left join public.match_results mr
    on mr.match_id = p.match_id
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
      when score_rank = 1 then 10
      else 0
    end as score_points,
    team_points
  from scored_predictions
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
