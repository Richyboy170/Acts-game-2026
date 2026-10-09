create table if not exists public.games (
  id text primary key,
  name text not null,
  sort_order integer not null unique
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  color text not null,
  image_path text not null,
  sort_order integer not null unique
);

create table if not exists public.team_score_totals (
  game_id text not null references public.games(id) on delete restrict,
  team_id text not null references public.teams(id) on delete restrict,
  total_points integer not null default 0 check (total_points >= 0),
  updated_at timestamptz not null default now(),
  primary key (game_id, team_id)
);

create table if not exists public.score_entries (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) on delete restrict,
  team_id text not null references public.teams(id) on delete restrict,
  entry_type text not null check (entry_type in ('award', 'adjustment')),
  points_delta integer not null check (points_delta <> 0),
  note text check (note is null or length(note) <= 500),
  actor text not null,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  check (entry_type <> 'award' or points_delta > 0)
);

create index if not exists score_entries_team_game_time_idx
  on public.score_entries (team_id, game_id, created_at desc);

create table if not exists public.event_finalization_state (
  id boolean primary key default true check (id),
  is_locked boolean not null default false,
  results jsonb not null default '[]'::jsonb,
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.event_finalization_state (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.event_finalization_events (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('locked', 'relocked', 'refreshed')),
  results jsonb not null,
  actor text not null,
  created_at timestamptz not null default now()
);

insert into public.games (id, name, sort_order) values
  ('sandwich', 'Sandwich', 1),
  ('balloon-direction', 'Balloon Direction', 2),
  ('water-cup', 'Water Cup', 3),
  ('get-the-ball-off', 'Get the Ball Off', 4)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.teams (id, name, color, image_path, sort_order) values
  ('cat', 'Cat', '#d8aa45', '/assets/house-icon/cat_0.jfif', 1),
  ('dragon', 'Dragon', '#ac3d42', '/assets/house-icon/dragon_0.jfif', 2),
  ('monkey', 'Monkey', '#d47a36', '/assets/house-icon/monkey_0.jfif', 3),
  ('owl', 'Owl', '#9571a5', '/assets/house-icon/owl_0.jfif', 4),
  ('sheep', 'Sheep', '#d883a1', '/assets/house-icon/sheep_0.jfif', 5),
  ('snake', 'Snake', '#39775d', '/assets/house-icon/snake_0.jfif', 6),
  ('unicorn', 'Unicorn', '#9fc8d5', '/assets/house-icon/unicorn_0.jfif', 7),
  ('wolf', 'Wolf', '#758ba4', '/assets/house-icon/wolf_0.jfif', 8)
on conflict (id) do update set
  name = excluded.name,
  color = excluded.color,
  image_path = excluded.image_path,
  sort_order = excluded.sort_order;

insert into public.team_score_totals (game_id, team_id)
select games.id, teams.id
from public.games as games
cross join public.teams as teams
on conflict (game_id, team_id) do nothing;

alter table public.games enable row level security;
alter table public.teams enable row level security;
alter table public.team_score_totals enable row level security;
alter table public.score_entries enable row level security;
alter table public.event_finalization_state enable row level security;
alter table public.event_finalization_events enable row level security;

revoke all on public.games, public.teams, public.team_score_totals,
  public.score_entries, public.event_finalization_state,
  public.event_finalization_events from anon, authenticated;

grant select on public.games, public.teams, public.team_score_totals,
  public.event_finalization_state to anon, authenticated;

drop policy if exists "Public can read games" on public.games;
create policy "Public can read games" on public.games
  for select to anon, authenticated using (true);

drop policy if exists "Public can read teams" on public.teams;
create policy "Public can read teams" on public.teams
  for select to anon, authenticated using (true);

drop policy if exists "Public can read game totals" on public.team_score_totals;
create policy "Public can read game totals" on public.team_score_totals
  for select to anon, authenticated using (true);

drop policy if exists "Public can read event reveal state" on public.event_finalization_state;
create policy "Public can read event reveal state" on public.event_finalization_state
  for select to anon, authenticated using (true);

create or replace function public.write_event_result_snapshot(p_actor text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_results jsonb;
begin
  -- Serialize every event write with finalization so the snapshot is exact.
  perform pg_advisory_xact_lock(hashtextextended('acts-scoreboard-event', 0));

  if not exists (select 1 from public.score_entries) then
    raise exception 'Add at least one score before locking the event results.' using errcode = 'P0001';
  end if;

  with overall_totals as (
    select teams.id as team_id, teams.name as team_name,
      coalesce(sum(totals.total_points), 0)::integer as total_points
    from public.teams as teams
    left join public.team_score_totals as totals on totals.team_id = teams.id
    group by teams.id, teams.name
  ), ranked as (
    select overall_totals.*,
      rank() over (order by overall_totals.total_points desc) as place
    from overall_totals
  )
  select jsonb_agg(
    jsonb_build_object(
      'rank', ranked.place,
      'team_id', ranked.team_id,
      'team_name', ranked.team_name,
      'total_points', ranked.total_points
    ) order by ranked.place, ranked.team_id
  )
  into v_results
  from ranked
  where ranked.place <= 3;

  v_results := coalesce(v_results, '[]'::jsonb);

  update public.event_finalization_state
  set is_locked = true,
      results = v_results,
      locked_at = now(),
      updated_at = now()
  where id = true;

  insert into public.event_finalization_events (action, results, actor)
  values (p_action, v_results, p_actor);

  return v_results;
end;
$$;

create or replace function public.record_score_change(
  p_game_id text,
  p_team_id text,
  p_points_delta integer,
  p_entry_type text,
  p_note text,
  p_actor text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current integer;
  v_entry_id uuid;
  v_new_total integer;
  v_locked boolean;
  v_existing public.score_entries%rowtype;
  v_final_results jsonb;
begin
  if p_entry_type not in ('award', 'adjustment') or p_points_delta = 0 then
    raise exception 'Enter a valid non-zero score change.' using errcode = 'P0001';
  end if;
  if p_entry_type = 'award' and p_points_delta < 0 then
    raise exception 'Awards must add a positive number of points.' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or p_actor is null or length(trim(p_actor)) = 0 then
    raise exception 'A score submission key and admin identity are required.' using errcode = 'P0001';
  end if;
  if p_note is not null and length(p_note) > 500 then
    raise exception 'Notes must be 500 characters or fewer.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('acts-scoreboard-event', 0));
  perform pg_advisory_xact_lock(hashtextextended(p_game_id || ':' || p_team_id, 0));

  select * into v_existing
  from public.score_entries
  where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('duplicate', true, 'entry_id', v_existing.id);
  end if;

  select total_points into v_current
  from public.team_score_totals
  where game_id = p_game_id and team_id = p_team_id
  for update;
  if not found then
    raise exception 'Choose a valid game and team.' using errcode = 'P0001';
  end if;
  if v_current + p_points_delta < 0 then
    raise exception 'A correction cannot reduce a team below zero points for a game.' using errcode = 'P0001';
  end if;

  insert into public.score_entries (
    game_id, team_id, entry_type, points_delta, note, actor, idempotency_key
  ) values (
    p_game_id, p_team_id, p_entry_type, p_points_delta, nullif(trim(p_note), ''), p_actor, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into v_entry_id;

  if v_entry_id is null then
    select * into v_existing
    from public.score_entries
    where idempotency_key = p_idempotency_key;
    return jsonb_build_object('duplicate', true, 'entry_id', v_existing.id);
  end if;

  update public.team_score_totals
  set total_points = total_points + p_points_delta,
      updated_at = now()
  where game_id = p_game_id and team_id = p_team_id
  returning total_points into v_new_total;

  select is_locked into v_locked
  from public.event_finalization_state
  where id = true;

  if coalesce(v_locked, false) then
    v_final_results := public.write_event_result_snapshot(p_actor, 'refreshed');
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'entry_id', v_entry_id,
    'game_id', p_game_id,
    'team_id', p_team_id,
    'total_points', v_new_total,
    'finalization_results', v_final_results
  );
end;
$$;

create or replace function public.lock_event_results(p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_was_locked boolean;
  v_action text;
begin
  if p_actor is null or length(trim(p_actor)) = 0 then
    raise exception 'An admin identity is required.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('acts-scoreboard-event', 0));

  select is_locked into v_was_locked
  from public.event_finalization_state
  where id = true
  for update;

  v_action := case when coalesce(v_was_locked, false) then 'relocked' else 'locked' end;
  return public.write_event_result_snapshot(p_actor, v_action);
end;
$$;

revoke all on function public.write_event_result_snapshot(text, text) from public, anon, authenticated;
revoke all on function public.record_score_change(text, text, integer, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.lock_event_results(text) from public, anon, authenticated;
grant execute on function public.record_score_change(text, text, integer, text, text, text, uuid) to service_role;
grant execute on function public.lock_event_results(text) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_score_totals') then
      alter publication supabase_realtime add table public.team_score_totals;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_finalization_state') then
      alter publication supabase_realtime add table public.event_finalization_state;
    end if;
  end if;
end;
$$;
