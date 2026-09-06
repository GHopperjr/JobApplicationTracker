-- doc 11 — the card/row distance badge previously showed a straight-line
-- figure computed for free at render time. It now shows OSRM's real road
-- distance instead, matching the drawer, but a live call per visible card
-- would violate the "rendering the board costs zero requests" guarantee the
-- feature was built around (docs/11-navigation-and-distance.md). So the
-- result is cached here instead of recomputed on every render.
--
-- `road_distance_from_lat`/`road_distance_from_lng` record which saved
-- location's coordinates the cache was computed against — not just its id,
-- since editing that location's own address (without changing which
-- location is default) must also invalidate the cache. The frontend treats
-- any mismatch against the current default location's coordinates as stale
-- and recomputes once, in the background.
alter table public.applications
  add column road_distance_meters   double precision,
  add column road_duration_seconds  integer,
  add column road_distance_from_lat double precision,
  add column road_distance_from_lng double precision;
