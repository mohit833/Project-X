create or replace function public.save_match_timeline(
  p_match_id uuid,
  p_status text default null,
  p_starts_at timestamptz default null,
  p_innings_started_at timestamptz default null,
  p_playing_xi_announced_at timestamptz default null,
  p_picks_deadline_at timestamptz default null,
  p_score_deadline_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  select *
  into v_match
  from public.matches
  where id = p_match_id;

  if v_match.id is null then
    raise exception 'Match not found.';
  end if;

  if not public.is_league_admin(v_match.league_id) then
    raise exception 'Only admins can edit match windows.';
  end if;

  if v_match.status = 'cancelled' then
    raise exception 'Cancelled matches are frozen.';
  end if;

  update public.matches
  set status = coalesce(nullif(trim(coalesce(p_status, '')), ''), status),
      starts_at = coalesce(p_starts_at, starts_at),
      innings_started_at = p_innings_started_at,
      playing_xi_announced_at = p_playing_xi_announced_at,
      picks_deadline_at = coalesce(p_picks_deadline_at, picks_deadline_at),
      score_deadline_at = coalesce(p_score_deadline_at, score_deadline_at)
  where id = p_match_id;
end;
$$;

create or replace function public.cancel_match(
  p_match_id uuid,
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
  v_note text;
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
    raise exception 'Only admins can cancel matches.';
  end if;

  v_note := nullif(trim(coalesce(p_notes, '')), '');

  if v_note is null then
    v_note := nullif(trim(coalesce(v_match.notes, '')), '');
  end if;

  if v_note is null then
    v_note := 'Cancelled by admin. This fixture does not count toward scoring.';
  elsif position('cancelled by admin' in lower(v_note)) = 0 then
    v_note := v_note || E'\n\nCancelled by admin. This fixture does not count toward scoring.';
  end if;

  delete from public.match_results
  where match_id = p_match_id;

  update public.matches
  set status = 'cancelled',
      auto_sync_enabled = false,
      current_innings_ball = null,
      current_over_display = null,
      sync_error = null,
      notes = v_note
  where id = p_match_id;
end;
$$;

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

  if v_match.status = 'cancelled' then
    raise exception 'This match has been cancelled.';
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

create or replace function public.admin_recover_prediction(
  p_match_id uuid,
  p_target_user_id uuid,
  p_batsman_name text,
  p_bowler_name text,
  p_team_pick text,
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
  v_target_member public.league_members%rowtype;
  v_prediction public.predictions%rowtype;
  v_prediction_id uuid;
  v_batsman text := nullif(trim(coalesce(p_batsman_name, '')), '');
  v_bowler text := nullif(trim(coalesce(p_bowler_name, '')), '');
  v_team_pick text := nullif(trim(coalesce(p_team_pick, '')), '');
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
    raise exception 'Only admins can recover member picks.';
  end if;

  if v_match.status = 'cancelled' then
    raise exception 'Cancelled matches cannot accept recovered picks.';
  end if;

  if p_target_user_id is null then
    raise exception 'Target member is required.';
  end if;

  if v_batsman is null or v_bowler is null or v_team_pick is null then
    raise exception 'Recovery needs batsman, bowler, and winning team.';
  end if;

  select *
  into v_target_member
  from public.league_members
  where league_id = v_match.league_id
    and user_id = p_target_user_id
    and is_active = true;

  if v_target_member.id is null then
    raise exception 'Target member is not active in this league.';
  end if;

  if lower(v_team_pick) = lower(v_match.team_a) then
    v_team_pick := v_match.team_a;
  elsif lower(v_team_pick) = lower(v_match.team_b) then
    v_team_pick := v_match.team_b;
  else
    raise exception 'Winning team must match one of the teams in this fixture.';
  end if;

  if public.normalize_pick(v_batsman) = public.normalize_pick(v_bowler) then
    raise exception 'Batsman and bowler must be two different players.';
  end if;

  if exists (
    select 1
    from public.predictions
    where match_id = p_match_id
      and user_id <> p_target_user_id
      and public.normalize_pick(batsman_name) = public.normalize_pick(v_batsman)
      and public.normalize_pick(bowler_name) = public.normalize_pick(v_bowler)
  ) then
    raise exception 'That batsman-bowler combination has already been taken.';
  end if;

  if p_predicted_score is not null then
    if p_predicted_score < 0 then
      raise exception 'Predicted score must be zero or higher.';
    end if;

    if exists (
      select 1
      from public.predictions
      where match_id = p_match_id
        and user_id <> p_target_user_id
        and predicted_score = p_predicted_score
    ) then
      raise exception 'That score prediction has already been taken.';
    end if;
  end if;

  select *
  into v_prediction
  from public.predictions
  where match_id = p_match_id
    and user_id = p_target_user_id
  for update;

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
      v_target_member.id,
      p_target_user_id,
      v_batsman,
      v_bowler,
      v_team_pick,
      p_predicted_score,
      v_now,
      case when p_predicted_score is not null then v_now else null end,
      false
    )
    returning id into v_prediction_id;
  else
    update public.predictions
    set member_id = v_target_member.id,
        batsman_name = v_batsman,
        bowler_name = v_bowler,
        team_pick = v_team_pick,
        predicted_score = case
          when p_predicted_score is not null then p_predicted_score
          else predicted_score
        end,
        core_submitted_at = coalesce(v_prediction.core_submitted_at, v_now),
        score_submitted_at = case
          when p_predicted_score is not null then coalesce(v_prediction.score_submitted_at, v_now)
          else v_prediction.score_submitted_at
        end,
        core_locked_due_to_pre_xi = case
          when v_prediction.core_submitted_at is null then false
          else v_prediction.core_locked_due_to_pre_xi
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

grant execute on function public.save_match_timeline(uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
grant execute on function public.cancel_match(uuid, text) to authenticated;
grant execute on function public.submit_prediction(uuid, text, text, text, integer) to authenticated;
grant execute on function public.admin_recover_prediction(uuid, uuid, text, text, text, integer) to authenticated;
grant execute on function public.save_match_result(uuid, text, integer, jsonb, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
