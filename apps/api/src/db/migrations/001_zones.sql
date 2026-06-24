-- Zones and their supply/demand configuration (SPEC §6.1).
CREATE TABLE IF NOT EXISTS zones (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  city                   TEXT NOT NULL,
  lat                    NUMERIC(9,6) NOT NULL,
  lon                    NUMERIC(9,6) NOT NULL,
  base_delivery_rate_cop INTEGER NOT NULL,
  config                 JSONB NOT NULL, -- baseline_supply_curve, rain_sensitivity, demand_elasticity, max_bonus_cop
  active                 BOOLEAN DEFAULT TRUE
);
