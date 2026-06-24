-- Historical Rappitenero login rate by hour/zone/rain (SPEC §6.1). Plain Postgres (ADR-0006).
CREATE TABLE IF NOT EXISTS rappitenero_supply_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id               UUID NOT NULL REFERENCES zones(id),
  hour                  SMALLINT NOT NULL,
  rain_intensity        TEXT NOT NULL,
  active_rappiteneros   INTEGER NOT NULL,
  baseline_rappiteneros INTEGER NOT NULL,
  timestamp             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_history_zone_ts
  ON rappitenero_supply_history (zone_id, timestamp DESC);
