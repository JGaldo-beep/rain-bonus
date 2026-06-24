# SPEC.md — Sistema de Bono Dinámico por Lluvia para Rappiteneros

**Versión:** 2.0.0
**Fecha:** 2026-06-23
**Estado:** Draft

---

## 1. Visión General

Sistema end-to-end que consume APIs públicas de clima y datos internos de Rappi (oferta de Rappiteneros y demanda de pedidos) para **calcular dinámicamente el bono adicional por entrega (en COP) que Rappi debe ofrecer por zona** durante condiciones de lluvia, de forma que se cierre la brecha entre oferta y demanda.

### Problema que resuelve

Cuando llueve, el mercado de delivery se desbalancea en dos direcciones a la vez:

- **La demanda SUBE** — los usuarios piden más (no quieren salir).
- **La oferta BAJA** — muchos Rappiteneros no se conectan bajo la lluvia.

Hoy la decisión de cuánto incrementar el incentivo por pedido para motivar a suficientes Rappiteneros se hace de forma manual, reactiva y sin un modelo unificado por zona. Este sistema automatiza el ciclo completo: ingesta de clima + oferta + demanda → forecast de lluvia por zona → cálculo de brecha oferta/demanda → **recomendación concreta de bono por entrega (COP)** → publicación y visualización.

> **Ejemplo de salida:** `+$1.200 COP/entrega en zona Chapinero — lluvia fuerte pronosticada en 45 min`.

### Usuarios objetivo

- **Equipo de Operaciones (Ops)** — supervisa y aprueba/ajusta los bonos recomendados por zona.
- **Pricing / Incentivos** — configura curvas base, topes y sensibilidades por zona.
- **Analistas de datos** — consumen la API para modelos downstream y reportes.

---

## 2. Arquitectura del Sistema

```
┌──────────────────────┐
│   APIs Externas      │
│  (Clima público)     │──┐
└──────────────────────┘  │
                          ▼
┌──────────────────────┐  ┌──────────────────────────┐     ┌──────────────────┐
│   APIs Internas Rappi│─▶│   Capa de Procesamiento  │────▶│   Persistencia   │
│  (Oferta + Demanda)  │  │  Ingesta → Forecast →    │     │  DB + Cache      │
└──────────────────────┘  │  Calculador de Bono      │     └────────┬─────────┘
                          └──────────────────────────┘              │
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │   API Layer          │
                                                          │  REST + WebSocket    │
                                                          └────────┬─────────────┘
                                                                   │
                                                                   ▼
                                                          ┌──────────────────────┐
                                                          │   Frontend           │
                                                          │  Dashboard + Override│
                                                          └──────────────────────┘
```

### Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend / API | Node.js (Fastify) |
| Procesamiento / Forecast | Node.js + (Fase 3) Python para curvas de sensibilidad |
| Base de datos | PostgreSQL (Supabase / TimescaleDB extension) |
| Cache | Redis |
| Queue / Jobs | BullMQ |
| Frontend | Next.js + Recharts / Tremor |
| Infraestructura | Docker Compose (dev) / Railway o Fly.io (prod) |
| Auth | JWT + API Keys para consumidores externos |

---

## 3. Fuentes de Datos

### 3.1 APIs de Clima (externas)

| API | Endpoint principal | Datos relevantes | Frecuencia de polling |
|-----|-------------------|------------------|-----------------------|
| OpenWeatherMap | `api.openweathermap.org/data/2.5/forecast` | Temperatura, viento, precipitación, humedad | Cada 30 min |
| Open-Meteo | `api.open-meteo.com/v1/forecast` | Forecast 7 días, precipitación horaria, visibilidad | Cada 1 hora |
| NOAA / NWS | `api.weather.gov/points/{lat},{lon}` | Alertas meteorológicas oficiales, radar | Cada 15 min |

La variable crítica para este sistema es la **intensidad de lluvia** (`precipitation_mm`), que se discretiza a un enum operativo:

| `rain_intensity` | Umbral (mm/h) |
|------------------|---------------|
| `none` | 0 |
| `light` | 0 < mm/h ≤ 2.5 |
| `moderate` | 2.5 < mm/h ≤ 7.6 |
| `heavy` | > 7.6 |

### 3.2 Normalización de clima

Todos los datos externos se normalizan al esquema `WeatherReading`:

```typescript
interface WeatherReading {
  source: string;           // "openweather" | "open-meteo" | "noaa"
  zone_id: string;
  timestamp: ISO8601;
  temperature_c: number;
  wind_speed_kmh: number;
  precipitation_mm: number;
  visibility_km: number;
  humidity_pct: number;
  pressure_hpa: number;
  rain_intensity: "none" | "light" | "moderate" | "heavy";
  condition_code: string;
  raw: object;              // payload original sin modificar
}
```

### 3.3 APIs Internas de Rappi

Dos fuentes internas, consultadas con `RAPPI_INTERNAL_API_KEY`, alimentan el modelo de oferta/demanda.

**a) Oferta de Rappiteneros** — tasa histórica y actual de conexión por hora, zona y condición de lluvia.

```typescript
interface RappiteneroSupplyRecord {
  zone_id: string;
  hour: number;             // 0–23 (hora local de la zona)
  rain_intensity: "none" | "light" | "moderate" | "heavy";
  active_rappiteneros: number;     // conectados observados
  baseline_rappiteneros: number;   // conectados esperados en seco a esa hora
  timestamp: ISO8601;
}
```

**b) Demanda de pedidos** — volumen histórico y actual de órdenes por hora, zona y condición de lluvia.

```typescript
interface DemandRecord {
  zone_id: string;
  hour: number;             // 0–23
  rain_intensity: "none" | "light" | "moderate" | "heavy";
  order_count: number;             // pedidos observados
  baseline_order_count: number;    // pedidos esperados en seco a esa hora
  timestamp: ISO8601;
}
```

---

## 4. Motor de Forecast de Lluvia (por zona)

### 4.1 Descripción

El motor agrega las lecturas de clima de múltiples fuentes y genera, **por zona**, un forecast de 72 horas en intervalos de 1 hora de la intensidad de lluvia esperada. Este forecast es el disparador del cálculo de bono.

### 4.2 Variables de salida

| Variable | Descripción | Unidad |
|----------|-------------|--------|
| `precipitation_mm` | Precipitación esperada en el intervalo | mm |
| `rain_intensity` | Intensidad discretizada | enum |
| `rain_start_eta` | Tiempo estimado hasta inicio de lluvia | min |
| `confidence_pct` | Confianza del forecast (concordancia entre fuentes) | % 0–100 |

### 4.3 Modelo

- **Fase 1 (MVP):** Promedio ponderado de fuentes externas con pesos configurables; intensidad derivada del `precipitation_mm` agregado.
- **Fase 3:** Modelo time-series (Prophet o LSTM) entrenado con histórico de 6 meses.
- **Validación:** RMSE mensual de `precipitation_mm`, umbral de alerta si supera 15%.

### 4.4 Esquema de salida `ForecastResult`

```typescript
interface ForecastResult {
  id: string;               // UUID
  zone_id: string;
  generated_at: ISO8601;
  valid_from: ISO8601;
  valid_to: ISO8601;        // generated_at + 72h
  intervals: ForecastInterval[];
  summary: {
    peak_rain_intensity: "none" | "light" | "moderate" | "heavy";
    next_rain_eta_min: number | null;
    rainy_hours: number;
  };
}

interface ForecastInterval {
  timestamp: ISO8601;
  precipitation_mm: number;
  rain_intensity: "none" | "light" | "moderate" | "heavy";
  confidence_pct: number;
}
```

---

## 5. Calculador de Inversión (Bono por Entrega)

### 5.1 Descripción

El calculador cruza el `ForecastResult` de lluvia con el modelo de oferta/demanda **de cada zona** para producir una `InvestmentRecommendation`: un **monto concreto de bono por entrega en COP** que cierra la brecha de oferta proyectada.

### 5.2 Inputs del calculador

| Input | Fuente | Descripción |
|-------|--------|-------------|
| `forecast` | Motor de Forecast | ForecastResult de lluvia por zona |
| `zone_config` | Configuración (`zones`) | Curva base de oferta, sensibilidad a lluvia, elasticidad de demanda, tarifa base |
| `supply_history` | API interna Rappi | Tasa de conexión por hora/zona/lluvia |
| `demand_history` | API interna Rappi | Volumen de pedidos por hora/zona/lluvia |

### 5.3 Modelo por zona (zone-aware)

El sistema calcula **por zona, no por ciudad**. Cada zona tiene su propio perfil:

```typescript
interface Zone {
  id: string;
  name: string;                 // "Chapinero"
  city: string;                 // "Bogotá"
  centroid: { lat: number; lon: number };
  base_delivery_rate_cop: number;     // tarifa base por entrega
  baseline_supply_curve: number[];    // 24 valores horarios (Rappiteneros en seco)
  rain_sensitivity: {                 // % que se desconecta por nivel de lluvia
    light: number;
    moderate: number;
    heavy: number;
  };
  demand_elasticity: {                // multiplicador de demanda por nivel
    light: number;
    moderate: number;
    heavy: number;
  };
  max_bonus_cop: number;              // tope sobre la tarifa base (config)
  active: boolean;
}
```

### 5.4 Lógica de cálculo

```
supply_gap            = expected_baseline_supply - expected_rainy_supply(rain_intensity, zone)
demand_multiplier     = expected_rainy_demand / expected_baseline_demand
required_rappiteneros = baseline_rappiteneros * demand_multiplier
rappiteneros_to_incentivize = required_rappiteneros - expected_rainy_supply

investment_per_order  = base_rate + (
  incentive_sensitivity_curve(rappiteneros_to_incentivize, zone) * rain_intensity_weight
)
```

Donde:
- `expected_rainy_supply` se deriva de `baseline_supply_curve[hour]` reducido por `rain_sensitivity[rain_intensity]`.
- `expected_rainy_demand` se deriva de la demanda base de la hora multiplicada por `demand_elasticity[rain_intensity]`.
- `incentive_sensitivity_curve` traduce el déficit de Rappiteneros (`rappiteneros_to_incentivize`) a COP necesarios para reclutar esa oferta marginal en la zona.

Pesos por defecto (configurables por zona):

| Factor | Peso default |
|--------|-------------|
| `rain_intensity_weight` (light) | 0.30 |
| `rain_intensity_weight` (moderate) | 0.65 |
| `rain_intensity_weight` (heavy) | 1.00 |

El resultado se redondea según las reglas de negocio (§8) antes de publicarse.

### 5.5 Esquema de salida `InvestmentRecommendation`

```typescript
interface InvestmentRecommendation {
  id: string;
  forecast_id: string;
  zone_id: string;
  generated_at: ISO8601;
  rain_intensity: "none" | "light" | "moderate" | "heavy";
  expected_supply_gap: number;        // # de Rappiteneros faltantes
  demand_multiplier: number;          // float (>1 cuando llueve)
  base_rate_cop: number;
  recommended_bonus_cop: number;      // ← salida principal (COP sobre tarifa base)
  confidence_pct: number;             // float 0–100 (hereda confianza del forecast)
  low_confidence: boolean;            // confidence_pct < 60
  requires_manual_approval: boolean;  // ver §8
  contributing_factors: {             // explicabilidad de la recomendación
    factor: string;
    value: number;
    weight: number;
    contribution: number;
  }[];
  valid_from: ISO8601;
  valid_until: ISO8601;
}
```

---

## 6. Persistencia

### 6.1 Base de datos — PostgreSQL (Supabase) + TimescaleDB

```sql
-- Zonas y su configuración (reemplaza a 'locations')
CREATE TABLE zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  city          TEXT NOT NULL,
  lat           NUMERIC(9,6) NOT NULL,
  lon           NUMERIC(9,6) NOT NULL,
  base_delivery_rate_cop INTEGER NOT NULL,
  config        JSONB NOT NULL,        -- baseline_supply_curve, rain_sensitivity, demand_elasticity, max_bonus_cop
  active        BOOLEAN DEFAULT TRUE
);

-- Lecturas de clima normalizadas (hypertable)
CREATE TABLE weather_readings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT NOT NULL,
  zone_id     UUID NOT NULL REFERENCES zones(id),
  timestamp   TIMESTAMPTZ NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
SELECT create_hypertable('weather_readings', 'timestamp');

-- Histórico de oferta de Rappiteneros (hypertable)
CREATE TABLE rappitenero_supply_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id               UUID NOT NULL REFERENCES zones(id),
  hour                  SMALLINT NOT NULL,
  rain_intensity        TEXT NOT NULL,
  active_rappiteneros   INTEGER NOT NULL,
  baseline_rappiteneros INTEGER NOT NULL,
  timestamp             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
SELECT create_hypertable('rappitenero_supply_history', 'timestamp');

-- Histórico de demanda de pedidos (hypertable)
CREATE TABLE demand_history (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id              UUID NOT NULL REFERENCES zones(id),
  hour                 SMALLINT NOT NULL,
  rain_intensity       TEXT NOT NULL,
  order_count          INTEGER NOT NULL,
  baseline_order_count INTEGER NOT NULL,
  timestamp            TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
SELECT create_hypertable('demand_history', 'timestamp');

-- Resultados de forecast de lluvia
CREATE TABLE forecast_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id      UUID NOT NULL REFERENCES zones(id),
  generated_at TIMESTAMPTZ NOT NULL,
  valid_from   TIMESTAMPTZ NOT NULL,
  valid_to     TIMESTAMPTZ NOT NULL,
  intervals    JSONB NOT NULL,
  summary      JSONB NOT NULL,
  model_version TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Recomendaciones de bono (reemplaza 'investment_scores')
CREATE TABLE investment_recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id         UUID REFERENCES forecast_results(id),
  zone_id             UUID NOT NULL REFERENCES zones(id),
  rain_intensity      TEXT NOT NULL,
  expected_supply_gap INTEGER NOT NULL,
  demand_multiplier   NUMERIC(6,3) NOT NULL,
  recommended_bonus_cop INTEGER NOT NULL,   -- salida principal
  confidence_pct      NUMERIC(5,2) NOT NULL,
  factors             JSONB NOT NULL,
  requires_manual_approval BOOLEAN DEFAULT FALSE,
  valid_from          TIMESTAMPTZ NOT NULL,
  valid_until         TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.2 Cache — Redis

| Key pattern | TTL | Contenido |
|-------------|-----|-----------|
| `forecast:{zone_id}:latest` | 30 min | ForecastResult de lluvia más reciente |
| `recommendation:{zone_id}:latest` | 15 min | InvestmentRecommendation más reciente |
| `weather:{source}:{zone_id}` | 10 min | WeatherReading por fuente |

---

## 7. API Layer

### 7.1 REST Endpoints

**Base URL:** `/api/v1`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/zones` | Lista de zonas activas |
| `GET` | `/zones/:id/weather/current` | Clima actual normalizado de la zona |
| `GET` | `/zones/:id/forecast/latest` | Forecast de lluvia más reciente |
| `GET` | `/zones/:id/recommendation/current` | **Bono recomendado (COP) para las próximas 6 horas** |
| `GET` | `/zones/:id/recommendation/forecast` | **Proyección del bono para las próximas 72h según evoluciona la lluvia** |
| `GET` | `/zones/recommendations/all` | **Vista city-wide: todos los bonos activos por zona** |
| `POST` | `/zones/:id/recommendation/override` | Ajuste manual del bono por Ops |
| `POST` | `/zones/:id/recommendation/trigger` | Forzar recálculo manual |
| `GET` | `/health` | Health check del sistema |

**Autenticación:** `Authorization: Bearer <API_KEY>` para todos los endpoints excepto `/health`.

**Formato de respuesta:**

```json
{
  "success": true,
  "data": { ... },
  "meta": { "generated_at": "2026-06-23T10:00:00Z", "cache_hit": false }
}
```

### 7.2 WebSocket

**Endpoint:** `ws://host/ws/v1/zones/:id`

| Evento | Payload | Trigger |
|--------|---------|---------|
| `forecast.updated` | ForecastResult | Nuevo forecast de lluvia generado |
| `recommendation.updated` | InvestmentRecommendation | Nuevo bono calculado |
| `recommendation.published` | `{ zone_id, recommended_bonus_cop, valid_from }` | Bono aprobado/publicado |
| `alert.low_confidence` | `{ zone_id, confidence_pct, recommended_bonus_cop }` | Recomendación con confianza < 60% requiere aprobación |
| `weather.reading` | WeatherReading | Nueva lectura de clima |

---

## 8. Reglas de Negocio (Business Rules)

- **Incremento mínimo del bono:** múltiplos de **$500 COP** (el `recommended_bonus_cop` se redondea al múltiplo de 500 más cercano).
- **Tope máximo del bono:** **$3.000 COP** por encima de la tarifa base (`max_bonus_cop`, configurable por zona).
- **Anticipación:** el bono debe quedar fijado **al menos 30 minutos antes** del inicio de lluvia pronosticado (`rain_start_eta`).
- **Baja confianza:** si `confidence_pct < 60%`, la recomendación se marca como *low confidence* (`requires_manual_approval = true`) y **requiere aprobación manual de Ops antes de publicarse**.

---

## 9. Frontend — Dashboard

### 9.1 Páginas y vistas

#### `/dashboard` — Vista principal
- **Mapa de la ciudad con zonas coloreadas por nivel de bono activo** (sin bono / bajo / medio / alto).
- Tabla resumen: zona | lluvia actual | bono recomendado (COP) | estado (publicado / pendiente aprobación).

#### `/zones/:id` — Detalle de zona
- **Tarjeta de zona:** forecast de lluvia + brecha de oferta (`expected_supply_gap`) + **bono recomendado en COP**.
- **Timeline 72h:** chart de cómo evoluciona el bono a medida que la lluvia entra y sale.
- **Panel de override de Ops:** ajuste manual del bono recomendado por zona (respetando incremento mínimo y tope).
- **Sección Alertas:** historial de recomendaciones de baja confianza y aprobaciones.

#### `/settings` — Configuración
- Curva base de oferta, sensibilidad a lluvia y elasticidad de demanda por zona.
- Tarifa base y tope de bono (`max_bonus_cop`) por zona.
- Thresholds de confianza y de aprobación manual.
- API Keys para consumidores externos.

### 9.2 Componentes clave

| Componente | Descripción |
|-----------|-------------|
| `<ZoneMap />` | Mapa con zonas coloreadas por nivel de bono activo |
| `<BonusCard />` | Tarjeta por zona: lluvia + brecha de oferta + bono COP |
| `<BonusTimeline />` | Chart 72h de evolución del bono según la lluvia |
| `<SupplyDemandGap />` | Visualización de oferta esperada vs. requerida |
| `<OpsOverridePanel />` | Ajuste manual del bono con validación de reglas |
| `<LowConfidenceBanner />` | Banner para recomendaciones que requieren aprobación |

### 9.3 Estados de UI
- **Loading:** Skeleton loaders en todas las secciones de datos.
- **Stale data:** Badge "Datos desactualizados" si el último forecast tiene más de 2 horas.
- **Offline:** Banner de error si el WebSocket se desconecta.
- **Low confidence:** Resalte prominente de la zona y bloqueo de publicación hasta aprobación.

---

## 10. Jobs y Automatización

| Job | Frecuencia | Descripción |
|-----|-----------|-------------|
| `ingest-weather` | Cada 15 min | Consume APIs externas de clima para zonas activas |
| `ingest-rappi-data` | Cada 15 min | Consume oferta y demanda internas de Rappi por zona |
| `run-forecast` | Cada 30 min | Genera ForecastResult de lluvia por zona |
| `calculate-bonus` | Cada 30 min (tras forecast) | Calcula InvestmentRecommendation (bono COP) por zona |
| `purge-old-readings` | Diario (2am) | Elimina lecturas/históricos con más de 30 días |
| `model-retrain` | Semanal (domingo 3am) | Reentrena curvas de oferta/demanda y forecast |

---

## 11. Configuración de Entorno

```env
# APIs Externas (clima)
OPENWEATHER_API_KEY=
OPEN_METEO_BASE_URL=https://api.open-meteo.com
NOAA_BASE_URL=https://api.weather.gov

# API Interna Rappi (oferta + demanda)
RAPPI_INTERNAL_API_KEY=

# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/fleetweather
REDIS_URL=redis://localhost:6379

# API
API_PORT=3000
JWT_SECRET=
API_KEY_SALT=

# Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws/v1

# Jobs
JOB_CONCURRENCY=3
INGEST_INTERVAL_MIN=15
FORECAST_INTERVAL_MIN=30

# Alertas (opcional)
SLACK_WEBHOOK_URL=
ALERT_EMAIL_TO=
```

---

## 12. Fases de Desarrollo

### Fase 1 — Core (MVP) · ~2 semanas
- [ ] Setup de proyecto: monorepo, Docker Compose, CI básico
- [ ] Ingesta de OpenWeather y Open-Meteo con normalización a intensidad de lluvia
- [ ] Ingesta de oferta (Rappiteneros) y demanda (pedidos) internas por zona
- [ ] Forecast de lluvia básico por zona (promedio ponderado)
- [ ] Calculador de bono v1 (fórmula estática de brecha oferta/demanda)
- [ ] Persistencia en PostgreSQL (zones, históricos, recomendaciones)
- [ ] API REST: zonas + recomendación current/forecast/all
- [ ] Dashboard mínimo: tabla de zonas + bono COP por zona

### Fase 2 — Realtime & UX · ~1.5 semanas
- [ ] Cache Redis + TTL policy
- [ ] WebSocket para updates de bono en tiempo real
- [ ] Frontend completo: ZoneMap, BonusCard, BonusTimeline, OpsOverridePanel
- [ ] Reglas de negocio: incremento mínimo, tope, anticipación 30 min, aprobación por baja confianza
- [ ] Alertas de baja confianza vía Slack/email
- [ ] Jobs automatizados con BullMQ

### Fase 3 — Inteligencia · ~2 semanas
- [ ] Modelo Prophet/LSTM para forecast de lluvia mejorado
- [ ] Curvas de sensibilidad de incentivo entrenadas por zona (oferta marginal vs. COP)
- [ ] Ingesta NOAA + alertas oficiales
- [ ] Configuración fina de sensibilidad/elasticidad por zona
- [ ] Reentrenamiento automático semanal

### Fase 4 — Producción · ~1 semana
- [ ] Deploy en Railway / Fly.io
- [ ] Monitoreo con Sentry + Uptime checks
- [ ] Documentación de API (OpenAPI / Swagger)
- [ ] Rate limiting y API Keys multi-tenant
- [ ] Backup automático de PostgreSQL

---

## 13. Decisiones de Diseño y Consideraciones

### Por qué calcular por zona y no por ciudad
La sensibilidad a la lluvia (cuántos Rappiteneros se desconectan) y la elasticidad de demanda varían fuertemente entre zonas. Un bono único por ciudad sobre-paga en zonas con oferta robusta y sub-paga donde la brecha es crítica. El cálculo por zona optimiza el gasto de incentivo.

### Por qué un monto en COP y no una categoría de riesgo
El producto necesita una palanca operativa accionable: el bono concreto por entrega. Las categorías abstractas obligaban a un paso manual de traducción a dinero; aquí el COP es el dato primario.

### Por qué promediar múltiples APIs de clima
Ninguna API pública de clima tiene 100% de disponibilidad ni cobertura uniforme. El promedio ponderado reduce el error en la intensidad de lluvia pronosticada y aporta la `confidence_pct` que gobierna la aprobación manual.

### Por qué exigir anticipación y aprobación por baja confianza
Publicar un bono tarde no atrae oferta a tiempo; publicarlo con baja confianza arriesga gasto innecesario. Las reglas de negocio (§8) equilibran reacción rápida y control de costo.

### Extensibilidad
La arquitectura permite agregar nuevas señales (tráfico, eventos masivos) o nuevos calculadores (ej. bono por hora pico sin lluvia) sin modificar el core, siguiendo un patrón de plugins sobre el calculador.

---

*Documento generado por Claude · Revisar y ajustar curvas de sensibilidad de incentivo y elasticidad de demanda según datos reales por zona.*
