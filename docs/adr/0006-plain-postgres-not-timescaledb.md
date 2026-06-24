# Plain Postgres, not TimescaleDB

The SPEC (§6.1) specifies PostgreSQL + the TimescaleDB extension with the history
tables as hypertables. For this demo (ADR-0001) we use **plain `postgres:17-alpine`**:
the synthetic dataset is tiny (24 hourly rows per zone), so hypertable partitioning
buys nothing, and the extension adds an image dependency and a composite-PK
requirement (the partition column must be in the primary key) for no demo payoff.

The history tables keep a simple `id` primary key plus a btree index on
`(zone_id, timestamp DESC)`, which covers the time-range lookups a hypertable would
have at this scale. **Intentional — don't re-add TimescaleDB to "match the SPEC."**
If the historical volume ever grew to production scale, hypertables (or native
Postgres partitioning) would come back.
