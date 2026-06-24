-- Normalized weather readings as a TimescaleDB hypertable (SPEC §6.1).
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS weather_readings (
  id         UUID NOT NULL DEFAULT gen_random_uuid(),
  source     TEXT NOT NULL,
  zone_id    UUID NOT NULL REFERENCES zones(id),
  timestamp  TIMESTAMPTZ NOT NULL,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

SELECT create_hypertable('weather_readings', 'timestamp', if_not_exists => TRUE);
