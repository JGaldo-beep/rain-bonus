-- Normalized weather readings (SPEC §6.1). Plain Postgres (ADR-0006): the demo's
-- data volume doesn't warrant TimescaleDB, so a btree index on (zone_id, timestamp)
-- covers the lookups a hypertable would have.
CREATE TABLE IF NOT EXISTS weather_readings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source     TEXT NOT NULL,
  zone_id    UUID NOT NULL REFERENCES zones(id),
  timestamp  TIMESTAMPTZ NOT NULL,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_readings_zone_ts
  ON weather_readings (zone_id, timestamp DESC);
