# No BullMQ, no Redis: in-process scheduler over Postgres

The SPEC specifies BullMQ for jobs and Redis for caching. For this single-node demo (ADR-0001)
we deliberately drop both:

- **Scheduler:** a small in-process interval scheduler inside the API runs the
  ingest → forecast → calculate cycle on a fast demo cadence (~30–60s) for ambient
  liveliness, plus the manual `recommendation/trigger` endpoint for the on-demand demo beat.
  A distributed queue buys nothing without separate workers and would read as
  resume-driven over-engineering.
- **Cache:** dropped. "latest forecast/recommendation per zone" is a single indexed Postgres
  query; caching synthetic single-node data solves a problem the demo doesn't have.

Result: `docker-compose` is `postgres + api + web` — fewer moving parts, nothing in the
stack that the demo's scale doesn't justify. **This is intentional — do not reintroduce
BullMQ/Redis to "match the SPEC."** If this ever became a real multi-node production system,
both would come back (the SPEC's Phase 2 still describes them).
