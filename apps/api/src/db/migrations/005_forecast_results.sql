-- 72h rain forecast results per zone (SPEC §6.1).
CREATE TABLE IF NOT EXISTS forecast_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id       UUID NOT NULL REFERENCES zones(id),
  generated_at  TIMESTAMPTZ NOT NULL,
  valid_from    TIMESTAMPTZ NOT NULL,
  valid_to      TIMESTAMPTZ NOT NULL,
  intervals     JSONB NOT NULL,
  summary       JSONB NOT NULL,
  model_version TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecast_results_zone_generated
  ON forecast_results (zone_id, generated_at DESC);
