begin;

create or replace function public.reset_event_scores(
  p_actor text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_entries integer;
begin
  if p_actor is null or length(trim(p_actor)) = 0 then
    raise exception 'An admin identity is required.' using errcode = 'P0001';
  end if;
  if p_confirmation is distinct from 'RESET' then
    raise exception 'Explicit RESET confirmation is required.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('acts-scoreboard-event', 0));

  delete from public.score_entries where id is not null;
  get diagnostics v_deleted_entries = row_count;

  update public.team_score_totals
  set total_points = 0,
      updated_at = now()
  where total_points <> 0;

  update public.event_finalization_state
  set is_locked = false,
      results = '[]'::jsonb,
      locked_at = null,
      updated_at = now()
  where id = true;

  insert into public.event_finalization_events (action, results, actor)
  values ('reset', '[]'::jsonb, p_actor);

  return jsonb_build_object(
    'deleted_entries', v_deleted_entries,
    'is_locked', false,
    'total_points', 0
  );
end;
$$;

revoke all on function public.reset_event_scores(text, text) from public, anon, authenticated;
grant execute on function public.reset_event_scores(text, text) to service_role;

commit;
