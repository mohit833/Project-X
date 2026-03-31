drop function if exists public.admin_recover_prediction(uuid, uuid, text, text, text);
drop function if exists public.admin_recover_prediction(uuid, uuid, text, text, text, integer);

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

grant execute on function public.admin_recover_prediction(uuid, uuid, text, text, text, integer) to authenticated;

notify pgrst, 'reload schema';
