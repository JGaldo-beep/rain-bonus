-- Per-delivery Bonus Recommendations. recommended_bonus_cop is the main output.
-- (Renamed from investment_recommendations — "Bonus" is the canonical term; see
-- CONTEXT.md and ADR-0002 for the lifecycle.)
DROP TABLE IF EXISTS investment_recommendations;

CREATE TABLE IF NOT EXISTS bonus_recommendations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id           UUID REFERENCES forecast_results(id),
  zone_id               UUID NOT NULL REFERENCES zones(id),
  rain_intensity        TEXT NOT NULL,
  expected_supply_gap   INTEGER NOT NULL,
  demand_multiplier     NUMERIC(6,3) NOT NULL,
  recommended_bonus_cop INTEGER NOT NULL,
  confidence_pct        NUMERIC(5,2) NOT NULL,
  factors               JSONB NOT NULL,
  -- Lifecycle (ADR-0002).
  status                TEXT NOT NULL DEFAULT 'published'
                          CHECK (status IN ('pending_approval','published','superseded','expired')),
  origin                TEXT NOT NULL DEFAULT 'auto'
                          CHECK (origin IN ('auto','approved','override')),
  pinned                BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from            TIMESTAMPTZ NOT NULL,
  valid_until           TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonus_recommendations_zone_created
  ON bonus_recommendations (zone_id, created_at DESC);

-- Enforce the core invariant in the schema: at most one Published recommendation
-- per Zone at a time. The recompute/override services always supersede the prior
-- live row before inserting the new one, so the constraint is never violated.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bonus_recommendations_one_published_per_zone
  ON bonus_recommendations (zone_id)
  WHERE status = 'published';
