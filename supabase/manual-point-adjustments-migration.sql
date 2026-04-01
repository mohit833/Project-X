create table if not exists public.manual_point_adjustments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  points_delta integer not null,
  reason text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.manual_point_adjustments enable row level security;

drop policy if exists "manual_point_adjustments_select_member" on public.manual_point_adjustments;
create policy "manual_point_adjustments_select_member"
on public.manual_point_adjustments
for select
to authenticated
using (public.is_league_member(league_id));

create or replace function public.save_leaderboard_adjustment(
  p_league_id uuid,
  p_target_user_id uuid,
  p_points_delta integer,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.league_members%rowtype;
  v_adjustment_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  if p_league_id is null then
    raise exception 'League not found.';
  end if;

  if not public.is_league_admin(p_league_id) then
    raise exception 'Only admins can adjust leaderboard points.';
  end if;

  if p_target_user_id is null then
    raise exception 'Target member is required.';
  end if;

  if p_points_delta is null or p_points_delta = 0 then
    raise exception 'Points delta must be a non-zero whole number.';
  end if;

  select *
  into v_member
  from public.league_members
  where league_id = p_league_id
    and user_id = p_target_user_id
    and is_active = true;

  if v_member.id is null then
    raise exception 'Target member is not active in this league.';
  end if;

  insert into public.manual_point_adjustments (
    league_id,
    user_id,
    points_delta,
    reason,
    created_by
  )
  values (
    p_league_id,
    p_target_user_id,
    p_points_delta,
    nullif(trim(coalesce(p_reason, '')), ''),
    v_uid
  )
  returning id into v_adjustment_id;

  return v_adjustment_id;
end;
$$;

create or replace function public.set_leaderboard_total(
  p_league_id uuid,
  p_target_user_id uuid,
  p_target_total integer,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.league_members%rowtype;
  v_current_total integer := 0;
  v_points_delta integer;
  v_adjustment_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  if p_league_id is null then
    raise exception 'League not found.';
  end if;

  if not public.is_league_admin(p_league_id) then
    raise exception 'Only admins can adjust leaderboard points.';
  end if;

  if p_target_user_id is null then
    raise exception 'Target member is required.';
  end if;

  if p_target_total is null then
    raise exception 'Target total is required.';
  end if;

  select *
  into v_member
  from public.league_members
  where league_id = p_league_id
    and user_id = p_target_user_id
    and is_active = true;

  if v_member.id is null then
    raise exception 'Target member is not active in this league.';
  end if;

  select coalesce(total_points, 0)
  into v_current_total
  from public.league_leaderboard
  where league_id = p_league_id
    and user_id = p_target_user_id;

  v_points_delta := p_target_total - coalesce(v_current_total, 0);

  if v_points_delta = 0 then
    raise exception 'Target total already matches the current leaderboard points.';
  end if;

  insert into public.manual_point_adjustments (
    league_id,
    user_id,
    points_delta,
    reason,
    created_by
  )
  values (
    p_league_id,
    p_target_user_id,
    v_points_delta,
    coalesce(
      nullif(trim(coalesce(p_reason, '')), ''),
      format('Set exact total to %s', p_target_total)
    ),
    v_uid
  )
  returning id into v_adjustment_id;

  return v_adjustment_id;
end;
$$;

create or replace view public.league_leaderboard
with (security_invoker = true)
as
with adjustment_totals as (
  select
    league_id,
    user_id,
    coalesce(sum(points_delta), 0) as manual_points
  from public.manual_point_adjustments
  group by league_id, user_id
)
select
  lm.league_id,
  lm.user_id,
  lm.display_name,
  lm.role,
  count(distinct p.match_id) as matches_joined,
  coalesce(sum(pp.batsman_points), 0) as batsman_points,
  coalesce(sum(pp.bowler_points), 0) as bowler_points,
  coalesce(sum(pp.score_points), 0) as score_points,
  coalesce(sum(pp.team_points), 0) as team_points,
  coalesce(adjustment_totals.manual_points, 0) as manual_points,
  coalesce(sum(pp.total_points), 0) + coalesce(adjustment_totals.manual_points, 0) as total_points
from public.league_members lm
left join public.predictions p
  on p.member_id = lm.id
left join public.prediction_points pp
  on pp.prediction_id = p.id
left join adjustment_totals
  on adjustment_totals.league_id = lm.league_id
 and adjustment_totals.user_id = lm.user_id
where lm.is_active = true
group by lm.league_id, lm.user_id, lm.display_name, lm.role, adjustment_totals.manual_points;

grant select on public.manual_point_adjustments to authenticated;
grant select on public.league_leaderboard to authenticated;
grant execute on function public.save_leaderboard_adjustment(uuid, uuid, integer, text) to authenticated;
grant execute on function public.set_leaderboard_total(uuid, uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
