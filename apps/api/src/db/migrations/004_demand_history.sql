-- Historical order volume by hour/zone/rain as a hypertable (SPEC §6.1).
CREATE TABLE IF NOT EXISTS demand_history (
  id                   UUID NOT NULL DEFAULT gen_random_uuid(),
  zone_id              UUID NOT NULL REFERENCES zones(id),
  hour                 SMALLINT NOT NULL,
  rain_intensity       TEXT NOT NULL,
  order_count          INTEGER NOT NULL,
  baseline_order_count INTEGER NOT NULL,
  timestamp            TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

SELECT create_hypertable('demand_history', 'timestamp', if_not_exists => TRUE);
