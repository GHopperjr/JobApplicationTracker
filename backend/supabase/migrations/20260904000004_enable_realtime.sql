-- Enables Realtime on applications, used to keep multiple open clients of the
-- same user in sync (e.g. a laptop and a phone). See docs/02-backend-architecture.md.

alter publication supabase_realtime add table public.applications;

-- Required for DELETE events to be usable. With the default REPLICA IDENTITY
-- (primary key only), the `old` record for a DELETE contains only the id —
-- user_id is absent, so the realtime subscription's `user_id=eq.` filter can
-- never match and the event is silently dropped, i.e. deletions would fail to
-- sync across devices.
alter table public.applications replica identity full;
