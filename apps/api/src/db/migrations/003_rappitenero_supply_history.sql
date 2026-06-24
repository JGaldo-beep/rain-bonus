-- Historical Rappitenero login rate by hour/zone/rain as a hypertable (SPEC §6.1).
CREATE TABLE IF NOT EXISTS rappitenero_supply_history (
  id                    UUID NOT NULL DEFAULT gen_random_uuid(),
  zone_id               UUID NOT NULL REFERENCES zones(id),
  hour                  SMALLINT NOT NULL,
  rain_intensity        TEXT NOT NULL,
  active_rappiteneros   INTEGER NOT NULL,
  baseline_rappiteneros INTEGER NOT NULL,
  timestamp             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

SELECT create_hypertable('rappitenero_supply_history', 'timestamp', if_not_exists => TRUE);
