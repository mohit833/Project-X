create extension if not exists pgcrypto;

create or replace function public.normalize_pick(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g'));
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

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 40),
  email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 80),
  season text not null default 'IPL 2026',
  invite_code text not null unique default public.generate_invite_code(),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 40),
  role text not null default 'member' check (role in ('admin', 'member')),
  is_active boolean not null default true,
  joined_at timestamptz not null default timezone('utc', now()),
  unique (league_id, user_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  title text not null,
  team_a text not null,
  team_b text not null,
  venue text,
  starts_at timestamptz not null,
  innings_started_at timestamptz,
  playing_xi_announced_at timestamptz,
  picks_deadline_at timestamptz not null,
  score_deadline_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'locked', 'completed', 'cancelled')),
  notes text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (team_a <> team_b),
  check (score_deadline_at >= picks_deadline_at)
);

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

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  member_id uuid not null references public.league_members (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  batsman_name text,
  batsman_key text generated always as (public.normalize_pick(batsman_name)) stored,
  bowler_name text,
  bowler_key text generated always as (public.normalize_pick(bowler_name)) stored,
  team_pick text,
  predicted_score integer,
  core_submitted_at timestamptz,
  score_submitted_at timestamptz,
  core_locked_due_to_pre_xi boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (match_id, user_id),
  check (predicted_score is null or predicted_score >= 0),
  check (
    (batsman_name is null and bowler_name is null and team_pick is null)
    or
    (batsman_name is not null and bowler_name is not null and team_pick is not null)
  )
);

create unique index if not exists predictions_match_batsman_unique_idx
on public.predictions (match_id, batsman_key)
where batsman_key <> '';

create unique index if not exists predictions_match_bowler_unique_idx
on public.predictions (match_id, bowler_key)
where bowler_key <> '';

create unique index if not exists predictions_match_score_unique_idx
on public.predictions (match_id, predicted_score)
where predicted_score is not null;

create table if not exists public.match_results (
  match_id uuid primary key references public.matches (id) on delete cascade,
  winner_team text not null,
  first_innings_total integer not null check (first_innings_total >= 0),
  batsman_runs jsonb not null default '{}'::jsonb,
  bowler_wickets jsonb not null default '{}'::jsonb,
  notes text,
  settled_by uuid not null references auth.users (id) on delete restrict,
  settled_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists matches_touch_updated_at on public.matches;
create trigger matches_touch_updated_at
before update on public.matches
for each row
execute function public.touch_updated_at();

drop trigger if exists predictions_touch_updated_at on public.predictions;
create trigger predictions_touch_updated_at
before update on public.predictions
for each row
execute function public.touch_updated_at();

drop trigger if exists match_results_touch_updated_at on public.match_results;
create trigger match_results_touch_updated_at
before update on public.match_results
for each row
execute function public.touch_updated_at();

create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members
    where league_id = p_league_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.is_league_admin(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members
    where league_id = p_league_id
      and user_id = auth.uid()
      and is_active = true
      and role = 'admin'
  );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    execute 'alter publication supabase_realtime add table public.matches';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'predictions'
  ) then
    execute 'alter publication supabase_realtime add table public.predictions';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'league_members'
  ) then
    execute 'alter publication supabase_realtime add table public.league_members';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_results'
  ) then
    execute 'alter publication supabase_realtime add table public.match_results';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.match_results enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "leagues_select_member" on public.leagues;
create policy "leagues_select_member"
on public.leagues
for select
to authenticated
using (public.is_league_member(id));

drop policy if exists "leagues_update_admin" on public.leagues;
create policy "leagues_update_admin"
on public.leagues
for update
to authenticated
using (public.is_league_admin(id))
with check (public.is_league_admin(id));

drop policy if exists "league_members_select_member" on public.league_members;
create policy "league_members_select_member"
on public.league_members
for select
to authenticated
using (public.is_league_member(league_id));

drop policy if exists "league_members_update_admin" on public.league_members;
create policy "league_members_update_admin"
on public.league_members
for update
to authenticated
using (public.is_league_admin(league_id))
with check (public.is_league_admin(league_id));

drop policy if exists "matches_select_member" on public.matches;
create policy "matches_select_member"
on public.matches
for select
to authenticated
using (public.is_league_member(league_id));

drop policy if exists "matches_insert_admin" on public.matches;
create policy "matches_insert_admin"
on public.matches
for insert
to authenticated
with check (public.is_league_admin(league_id));

drop policy if exists "matches_update_admin" on public.matches;
create policy "matches_update_admin"
on public.matches
for update
to authenticated
using (public.is_league_admin(league_id))
with check (public.is_league_admin(league_id));

drop policy if exists "predictions_select_member" on public.predictions;
create policy "predictions_select_member"
on public.predictions
for select
to authenticated
using (public.is_league_member(league_id));

drop policy if exists "match_results_select_member" on public.match_results;
create policy "match_results_select_member"
on public.match_results
for select
to authenticated
using (
  exists (
    select 1
    from public.matches
    where public.matches.id = match_results.match_id
      and public.is_league_member(public.matches.league_id)
  )
);

create or replace function public.sync_member_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_display_name text := trim(coalesce(p_display_name, ''));
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  if char_length(v_display_name) < 2 then
    raise exception 'Display name must be at least 2 characters.';
  end if;

  update public.profiles
  set display_name = v_display_name
  where id = v_uid;

  update public.league_members
  set display_name = v_display_name
  where user_id = v_uid;
end;
$$;

create or replace function public.create_league(
  p_name text,
  p_season text default 'IPL 2026'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_display_name text;
  v_league_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  v_display_name := coalesce(
    (select display_name from public.profiles where id = v_uid),
    split_part(coalesce(auth.jwt() ->> 'email', 'Player'), '@', 1)
  );

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'League name is required.';
  end if;

  insert into public.leagues (name, season, created_by)
  values (trim(p_name), coalesce(nullif(trim(p_season), ''), 'IPL 2026'), v_uid)
  returning id into v_league_id;

  insert into public.league_members (league_id, user_id, display_name, role)
  values (v_league_id, v_uid, v_display_name, 'admin');

  return v_league_id;
end;
$$;

create or replace function public.join_league(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_display_name text;
  v_league_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  v_display_name := coalesce(
    (select display_name from public.profiles where id = v_uid),
    split_part(coalesce(auth.jwt() ->> 'email', 'Player'), '@', 1)
  );

  select id
  into v_league_id
  from public.leagues
  where invite_code = upper(trim(coalesce(p_invite_code, '')))
    and status = 'active';

  if v_league_id is null then
    raise exception 'Invite code not found.';
  end if;

  insert into public.league_members (league_id, user_id, display_name, role, is_active)
  values (v_league_id, v_uid, v_display_name, 'member', true)
  on conflict (league_id, user_id)
  do update
    set display_name = excluded.display_name,
        is_active = true;

  return v_league_id;
end;
$$;

create or replace function public.create_match(
  p_league_id uuid,
  p_title text,
  p_team_a text,
  p_team_b text,
  p_starts_at timestamptz,
  p_playing_xi_announced_at timestamptz,
  p_picks_deadline_at timestamptz,
  p_score_deadline_at timestamptz,
  p_venue text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;

  if not public.is_league_admin(p_league_id) then
    raise exception 'Only admins can create matches.';
  end if;

  if p_starts_at is null or p_picks_deadline_at is null or p_score_deadline_at is null then
    raise exception 'Start time and lock windows are required.';
  end if;

  insert into public.matches (
    league_id,
    title,
    team_a,
    team_b,
    venue,
    starts_at,
    playing_xi_announced_at,
    picks_deadline_at,
    score_deadline_at,
    notes,
    created_by
  )
  values (
    p_league_id,
    coalesce(nullif(trim(p_title), ''), trim(p_team_a) || ' vs ' || trim(p_team_b)),
    trim(p_team_a),
    trim(p_team_b),
    nullif(trim(coalesce(p_venue, '')), ''),
    p_starts_at,
    p_playing_xi_announced_at,
    p_picks_deadline_at,
    p_score_deadline_at,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_uid
  )
  returning id into v_match_id;

  return v_match_id;
end;
$$;

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
  v_prediction public.predictions%rowtype;
  v_prediction_id uuid;
  v_wants_core boolean;
  v_batsman text := nullif(trim(coalesce(p_batsman_name, '')), '');
  v_bowler text := nullif(trim(coalesce(p_bowler_name, '')), '');
  v_team_pick text := nullif(trim(coalesce(p_team_pick, '')), '');
  v_core_window_open boolean := true;
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

  if v_match.starts_at is not null then
    v_core_window_open := v_now >= (v_match.starts_at - interval '2 hours');
  end if;

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
    if not v_core_window_open then
      raise exception 'Core picks open only in the 2 hours before the match starts.';
    end if;

    if v_core_locked then
      raise exception 'Core picks are locked after the 3.1 over cutoff.';
    end if;

    if coalesce(v_prediction.core_locked_due_to_pre_xi, false) then
      raise exception 'These core picks were posted before the playing XI and cannot be changed.';
    end if;

    if exists (
      select 1
      from public.predictions
      where match_id = p_match_id
        and user_id <> v_uid
        and batsman_key = public.normalize_pick(v_batsman)
    ) then
      raise exception 'That batsman has already been taken.';
    end if;

    if exists (
      select 1
      from public.predictions
      where match_id = p_match_id
        and user_id <> v_uid
        and bowler_key = public.normalize_pick(v_bowler)
    ) then
      raise exception 'That bowler has already been taken.';
    end if;
  end if;

  if p_predicted_score is not null then
    if p_predicted_score < 0 then
      raise exception 'Predicted score must be zero or higher.';
    end if;

    if (not v_score_window_open or v_score_locked)
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
        when v_wants_core and (v_match.playing_xi_announced_at is null or v_now < v_match.playing_xi_announced_at)
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
          when v_wants_core and (v_match.playing_xi_announced_at is null or v_now < v_match.playing_xi_announced_at)
            then true
          else core_locked_due_to_pre_xi
        end
    where id = v_prediction.id
    returning id into v_prediction_id;
  end if;

  return v_prediction_id;
exception
  when unique_violation then
    raise exception 'That pick was just taken by someone else. Refresh and choose a different option.';
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
    coalesce(p_batsman_runs, '{}'::jsonb),
    coalesce(p_bowler_wickets, '{}'::jsonb),
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

create or replace view public.prediction_points
with (security_invoker = true)
as
select
  p.id as prediction_id,
  p.league_id,
  p.match_id,
  p.member_id,
  p.user_id,
  coalesce((mr.batsman_runs ->> p.batsman_key)::integer, 0) as batsman_points,
  coalesce((mr.bowler_wickets ->> p.bowler_key)::integer, 0) * 20 as bowler_points,
  case
    when mr.first_innings_total is not null and mr.first_innings_total = p.predicted_score then 10
    else 0
  end as score_points,
  case
    when mr.winner_team is not null and lower(mr.winner_team) = lower(coalesce(p.team_pick, '')) then 50
    else 0
  end as team_points,
  coalesce((mr.batsman_runs ->> p.batsman_key)::integer, 0)
  + coalesce((mr.bowler_wickets ->> p.bowler_key)::integer, 0) * 20
  + case when mr.first_innings_total is not null and mr.first_innings_total = p.predicted_score then 10 else 0 end
  + case when mr.winner_team is not null and lower(mr.winner_team) = lower(coalesce(p.team_pick, '')) then 50 else 0 end
    as total_points
from public.predictions p
left join public.match_results mr
  on mr.match_id = p.match_id;

create or replace view public.league_leaderboard
with (security_invoker = true)
as
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
  coalesce(sum(pp.total_points), 0) as total_points
from public.league_members lm
left join public.predictions p
  on p.member_id = lm.id
left join public.prediction_points pp
  on pp.prediction_id = p.id
where lm.is_active = true
group by lm.league_id, lm.user_id, lm.display_name, lm.role;

grant select, insert, update on public.profiles to authenticated;
grant select on public.leagues to authenticated;
grant select on public.league_members to authenticated;
grant select, insert, update on public.matches to authenticated;
grant select on public.predictions to authenticated;
grant select on public.match_results to authenticated;
grant select on public.prediction_points to authenticated;
grant select on public.league_leaderboard to authenticated;

grant execute on function public.sync_member_display_name(text) to authenticated;
grant execute on function public.create_league(text, text) to authenticated;
grant execute on function public.join_league(text) to authenticated;
grant execute on function public.create_match(uuid, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.save_match_timeline(uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
grant execute on function public.submit_prediction(uuid, text, text, text, integer) to authenticated;
grant execute on function public.save_match_result(uuid, text, integer, jsonb, jsonb, text) to authenticated;
