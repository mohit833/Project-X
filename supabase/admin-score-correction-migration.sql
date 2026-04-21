create or replace function public.admin_update_prediction_score(
  p_match_id uuid,
  p_target_user_id uuid,
  p_predicted_score integer
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
    raise exception 'Only admins can correct member scores.';
  end if;

  if v_match.status = 'cancelled' then
    raise exception 'Cancelled matches cannot accept score corrections.';
  end if;

  if p_target_user_id is null then
    raise exception 'Target member is required.';
  end if;

  if p_predicted_score is null or p_predicted_score < 0 then
    raise exception 'Predicted score must be zero or higher.';
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

  if exists (
    select 1
    from public.predictions
    where match_id = p_match_id
      and user_id <> p_target_user_id
      and predicted_score = p_predicted_score
  ) then
    raise exception 'That score prediction has already been taken.';
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
      predicted_score,
      score_submitted_at,
      core_locked_due_to_pre_xi
    )
    values (
      v_match.league_id,
      p_match_id,
      v_target_member.id,
      p_target_user_id,
      p_predicted_score,
      v_now,
      false
    )
    returning id into v_prediction_id;
  else
    update public.predictions
    set member_id = v_target_member.id,
        predicted_score = p_predicted_score,
        score_submitted_at = coalesce(v_prediction.score_submitted_at, v_now)
    where id = v_prediction.id
    returning id into v_prediction_id;
  end if;

  return v_prediction_id;
exception
  when unique_violation then
    raise exception 'That score prediction was just taken by someone else. Refresh and choose a different score.';
end;
$$;

grant execute on function public.admin_update_prediction_score(uuid, uuid, integer) to authenticated;

notify pgrst, 'reload schema';
