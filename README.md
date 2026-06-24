# FleetWeather — Bono dinámico por lluvia para Rappiteneros

> Sistema que observa el **forecast de lluvia por zona** y recomienda un **bono concreto por entrega (en COP)** para mantener suficientes Rappiteneros conectados cuando la lluvia sube la demanda y baja la oferta.
>
> **Ejemplo de salida:** `+$2.500 COP/entrega en Chapinero — lluvia fuerte pronosticada`.

Cuando llueve el mercado de delivery se desbalancea en dos direcciones a la vez: la **demanda sube** (nadie quiere salir) y la **oferta baja** (muchos Rappiteneros no se conectan). Hoy decidir cuánto subir el incentivo se hace a mano. FleetWeather automatiza el ciclo completo — clima → forecast → brecha oferta/demanda → **bono recomendado en COP** → publicación/aprobación → visualización en vivo — **por zona**, no por ciudad.

---

## ⚠️ Qué es esto (y qué no)

Esto es una **pieza demo end-to-end**, construida para que un equipo técnico la **lea y la vea funcionar**. Corre **100% sobre datos sintéticos** (no consume APIs reales de Rappi ni de clima). El objetivo es una **rebanada vertical sólida y defendible**, no un sistema de producción. Las decisiones de alcance están documentadas en [`docs/adr/`](docs/adr) y el vocabulario del dominio en [`CONTEXT.md`](CONTEXT.md).

Si quieres entender *por qué* se tomó cada decisión, salta a [Decisiones de diseño](#-decisiones-de-diseño-el-porqué).

---

## 🚀 Arranque rápido (Docker — recomendado)

Necesitas **Docker** y **Docker Compose**. Nada más (ni Node, ni Postgres en tu máquina).

```bash
docker compose up -d --build
```

Eso levanta tres contenedores:

| Servicio   | URL                          | Qué es                                  |
|------------|------------------------------|-----------------------------------------|
| **web**    | http://localhost:3001        | 👈 **El dashboard. Empieza aquí.**       |
| **api**    | http://localhost:3000        | API REST + WebSocket (Fastify)          |
| **postgres** | `localhost:5432`           | Base de datos (Postgres 17)             |

Al arrancar, la API **migra el esquema y siembra los datos** automáticamente (ver `start:demo`), así que el dashboard muestra una ciudad con lluvia desde el primer segundo.

Para apagar todo:

```bash
docker compose down        # detiene y borra contenedores
docker compose down -v     # …y además borra la base de datos
```

> Si los puertos 3000/3001/5432 están ocupados, cámbialos con variables de entorno: `API_HOST_PORT`, `WEB_HOST_PORT`, `POSTGRES_HOST_PORT` (ver `.env.example`).

---

## 🎬 Cómo probarlo (guion de 2 minutos)

Abre **http://localhost:3001**. Vas a ver el centro de operaciones de Bogotá con 6 zonas. La demo está sembrada como un **frente de lluvia escalonado** para que cada estado sea visible a la vez:

| Zona       | Lluvia   | Bono   | Estado            | Para qué sirve en la demo            |
|------------|----------|--------|-------------------|--------------------------------------|
| Chapinero  | fuerte   | $2.500 | Publicado         | El titular: bono alto, alta confianza |
| Suba       | fuerte   | $2.500 | **Aprobación manual** | El forecast tiene baja confianza (<60%) |
| Fontibón   | moderada | $1.500 | Publicado         | Nivel medio                           |
| Usaquén    | moderada | $1.500 | Publicado         | Nivel medio                           |
| Kennedy    | llovizna | $500   | Publicado         | Nivel bajo                            |
| Engativá   | sin lluvia | $0   | Publicado         | Zona seca (verde en el mapa)          |

Sigue estos pasos para recorrer cada "beat":

1. **Mira el mapa y la lista.** Las zonas están coloreadas por nivel de bono. El punto de conexión arriba a la derecha indica que estás recibiendo actualizaciones **en vivo** por WebSocket.
2. **Entra a Suba** (la que dice *Aprobación manual*). Verás un banner: el forecast tiene **53.6% de confianza (< 60%)**, así que el bono **no se publica solo** — espera a un humano (regla de negocio §8). Pulsa **“Aprobar y publicar”** → pasa a *Publicado*.
3. **Entra a cualquier zona y pulsa “Recalcular ahora”.** Fuerza un recálculo del forecast y el bono; la tarjeta se actualiza al instante (vía WebSocket).
4. **Haz un Override.** En el panel *Override de Ops* sube/baja el bono (múltiplos de $500, tope $3.000) y pulsa **“Fijar bono”**. La zona queda marcada como **Override Ops**.
5. **Comprueba que el override “se fija” (pins).** Vuelve a pulsar **“Recalcular ahora”** en esa misma zona: el bono **no se sobreescribe** — la automatización respeta la decisión del humano hasta que su ventana expira ([ADR-0002](docs/adr/0002-bonus-recommendation-lifecycle.md)).
6. **Mira el desglose del bono.** En el detalle de zona, la sección *Desglose del bono* muestra cómo cada factor (cierre de brecha + prima de demanda + prima de intensidad) **suma** hasta el bono recomendado. Nada es una caja negra.

> El **scheduler interno** recalcula todas las zonas cada ~45 s, así que el panel también se mueve solo si lo dejas abierto.

---

## 🧠 El modelo de bono (cómo se calcula)

El bono es una **descomposición aditiva** de tres términos en COP ([ADR-0005](docs/adr/0005-additive-bonus-formula.md)):

```
bono_bruto = costo_cierre_brecha      (escala con la brecha de oferta)
           + prima_por_demanda        (escala con demand_multiplier − 1)
           + prima_por_intensidad     (fijo por nivel de lluvia)

bono = min( redondear_a_500(bono_bruto), tope_de_la_zona )
```

- Cada término se reporta en `contributing_factors` y **la suma de los términos es el bono** — un revisor puede verificar la cuenta a ojo.
- Las constantes (`COP_PER_GAP_RATIO`, primas por nivel, etc.) son **placeholders honestos**, calibrados para que la demo caiga en un rango colombiano creíble (llovizna ≈ $500, moderada ≈ $1.500, fuerte ≈ $2.500). **No** están ajustadas a datos reales: el siguiente paso explícito es calibrarlas con elasticidad real de oferta. Todo esto está documentado en [`apps/api/src/engine/bonus.ts`](apps/api/src/engine/bonus.ts).

**Reglas de negocio (§8)** que el modelo respeta:
- Incremento mínimo: múltiplos de **$500 COP**.
- Tope máximo: **$3.000 COP** sobre la tarifa base (configurable por zona).
- **Baja confianza** (< 60%): requiere **aprobación manual** antes de publicarse.

---

## 🔄 Ciclo de vida de la recomendación

Una recomendación de bono pasa por una pequeña máquina de estados ([ADR-0002](docs/adr/0002-bonus-recommendation-lifecycle.md)):

```
                confianza ≥ 60%
   ┌──────────────────────────────────►  published ──(llega una nueva)──► superseded
   │                                         ▲
 (nueva                                       │ aprobar (Ops)
  recomendación)   confianza < 60%            │
   └───────────────────────────────►  pending_approval
                                              │
 override de Ops ──► published (pinned) ──────┘   (la automatización lo respeta
                                                   hasta que expira su ventana)
```

- **Invariante clave:** a lo sumo **una** recomendación `published` por zona a la vez. Está garantizado en el esquema con un *índice único parcial* (`WHERE status = 'published'`), no solo en el código.
- **Override “pinned”:** un override manual se fija y los recálculos automáticos **no lo pisan** — porque un botón de override que la automatización borra a los 30 minutos no sirve de nada. La automatización aconseja; el humano manda en la ventana en la que actuó.

El glosario completo de términos (Bono, Rappitenero, Zona, Override, Pinned, Superseded…) está en [`CONTEXT.md`](CONTEXT.md).

---

## 🏗️ Arquitectura

```
┌─────────────────────┐   in-process scheduler (~45s)   ┌──────────────────┐
│  Datos sintéticos   │  ───────────────────────────►   │   Motor          │
│  (escenarios de     │   forecast → bono → ciclo de     │  forecast.ts     │
│   lluvia por zona)  │   vida (publish/approval/pin)    │  bonus.ts        │
└─────────────────────┘                                  │  lifecycle.ts    │
                                                         └────────┬─────────┘
                                                                  ▼
┌────────────────────────┐      REST + WebSocket        ┌──────────────────┐
│  Next.js (App Router)  │ ◄──────────────────────────► │  Fastify API     │
│  Dashboard + Ops UI    │   bono en vivo, override,     │  + Postgres 17   │
│  (localhost:3001)      │   aprobar, recalcular         │  (localhost:3000)│
└────────────────────────┘                              └──────────────────┘
```

### Stack

| Capa            | Tecnología                                              |
|-----------------|--------------------------------------------------------|
| API / backend   | Node.js + **Fastify 5**, **WebSocket** (`@fastify/websocket`) |
| Motor de cálculo| TypeScript puro (forecast, bono, ciclo de vida)        |
| Base de datos   | **PostgreSQL 17** (sin extensiones)                     |
| Jobs            | **Scheduler in-process** (sin BullMQ/Redis)            |
| Frontend        | **Next.js 16** (App Router, React 19), **Tailwind v4** |
| Tiempo real     | WebSocket nativo (sin librería en el cliente)          |
| Monorepo        | **pnpm workspaces** (`apps/*`, `packages/*`)           |
| Infra           | **Docker Compose** (`postgres + api + web`)            |

---

## 🌐 API REST

Base: `http://localhost:3000/api/v1` · **Auth:** todos los endpoints (excepto `/health`) requieren `Authorization: Bearer demo-key`.

| Método | Endpoint                                   | Descripción                                      |
|--------|--------------------------------------------|--------------------------------------------------|
| GET    | `/zones`                                   | Zonas activas                                    |
| GET    | `/zones/recommendations/all`               | Bono activo por zona (vista city-wide)           |
| GET    | `/zones/:id/forecast/latest`               | Forecast de lluvia más reciente                  |
| GET    | `/zones/:id/recommendation/current`        | Bono actual de la zona                           |
| GET    | `/zones/:id/recommendation/forecast`       | Proyección del bono a 72 h                       |
| POST   | `/zones/:id/recommendation/trigger`        | Forzar recálculo (el beat “en vivo”)             |
| POST   | `/zones/:id/recommendation/override`        | Override manual de Ops (`{ "recommended_bonus_cop": 2500 }`) |
| POST   | `/zones/:id/recommendation/approve`        | Aprobar la recomendación pendiente               |
| GET    | `/health`                                  | Health check (sin auth)                          |

Ejemplos rápidos:

```bash
# Vista city-wide
curl -s -H "Authorization: Bearer demo-key" \
  http://localhost:3000/api/v1/zones/recommendations/all | jq

# Sin la API key → 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/zones
```

> **Sobre la auth:** el navegador **nunca** ve la API key. Las acciones de Ops (override/aprobar/recalcular) pasan por *route handlers* de Next del lado del servidor, que guardan la key en el entorno y hacen de proxy hacia la API. Ver [ADR-0003](docs/adr/0003-no-queue-no-cache-in-process-scheduler.md).

### WebSocket

- `ws://localhost:3000/ws/v1` — todos los eventos (lo usa el dashboard)
- `ws://localhost:3000/ws/v1/zones/:id` — eventos de una sola zona (detalle)

Eventos emitidos: `forecast.updated`, `recommendation.updated`, `recommendation.published`, `alert.low_confidence`.

---

## 🧪 Tests

El corazón del sistema (motor de bono + máquina de estados) son **funciones puras**, así que están cubiertas con tests unitarios — incluyendo que los factores **sumen** al bono y que el override **se fije** ante un recálculo:

```bash
pnpm --filter @fleetweather/api test
```

Verificación completa que ya pasa: 14/14 tests · `tsc` build limpio (API) · `next build` limpio (web) · `pnpm -r lint` limpio.

---

## 🛠️ Desarrollo local (sin Docker, opcional)

Si prefieres correr las apps con tu Node local (necesitas **Node 24+**, **pnpm 10+** y un Postgres accesible):

```bash
pnpm install
cp .env.example .env                 # ajusta DATABASE_URL a tu Postgres

# Levanta solo la base de datos con Docker (opcional):
docker compose up -d postgres

# Esquema + datos sintéticos:
pnpm --filter @fleetweather/api db:migrate
pnpm --filter @fleetweather/api db:seed

# Arranca API y web en paralelo:
pnpm dev
```

Scripts útiles (raíz del monorepo):

| Comando                                   | Qué hace                                  |
|-------------------------------------------|-------------------------------------------|
| `pnpm dev`                                | API + web en paralelo                     |
| `pnpm build`                              | Build de todos los paquetes               |
| `pnpm lint`                               | Typecheck/lint de todo el workspace       |
| `pnpm --filter @fleetweather/api test`    | Tests unitarios del motor                 |
| `pnpm --filter @fleetweather/api db:seed` | Re-siembra los datos de la demo           |

---

## 📁 Estructura del repositorio

```
.
├── apps/
│   ├── api/                      # Fastify + Postgres
│   │   └── src/
│   │       ├── engine/           # ★ lógica pura y testeada
│   │       │   ├── bonus.ts          # fórmula aditiva del bono
│   │       │   ├── lifecycle.ts      # máquina de estados
│   │       │   ├── forecast.ts       # forecast sintético de lluvia
│   │       │   └── *.test.ts         # tests unitarios
│   │       ├── services/         # recompute + acciones de Ops (DB + WS)
│   │       ├── routes/           # endpoints REST
│   │       ├── db/               # migraciones, seed, datos demo
│   │       ├── ws.ts             # hub de WebSocket (pub/sub)
│   │       └── scheduler.ts      # ciclo de recálculo in-process
│   └── web/                      # Next.js 16 (App Router)
│       ├── app/                  # páginas + route handlers (proxy de Ops)
│       ├── components/           # dashboard, detalle de zona, mapa, timeline
│       └── lib/                  # capa de datos (server-only) + tipos + formato
├── packages/shared/             # tipos de dominio compartidos
├── docs/adr/                    # ★ decisiones de arquitectura (el "porqué")
├── CONTEXT.md                   # ★ glosario del dominio (lenguaje ubicuo)
├── SPEC.md                      # especificación original (v2.0.0)
└── docker-compose.yml
```

---

## 💡 Decisiones de diseño (el "porqué")

Cada decisión no obvia está registrada como ADR. Resumen:

| ADR | Decisión | Por qué |
|-----|----------|---------|
| [0001](docs/adr/0001-demo-for-technical-hiring.md) | Demo depth-first para revisión técnica, datos sintéticos | Profundidad > amplitud: una rebanada vertical confiable vale más que tres fases a medias. Fuera de alcance: APIs reales, ML, auth multi-tenant. |
| [0002](docs/adr/0002-bonus-recommendation-lifecycle.md) | Auto-publicación con compuerta de confianza + override “pinned” | Es una herramienta de Ops: el humano manda, la automatización aconseja. Invariante: ≤1 publicada por zona. |
| [0003](docs/adr/0003-no-queue-no-cache-in-process-scheduler.md) | Sin BullMQ ni Redis; scheduler in-process | Una cola distribuida sin workers separados sería sobre-ingeniería en un solo nodo; cachear datos sintéticos resuelve un problema que la demo no tiene. |
| [0004](docs/adr/0004-anchored-now-seed-and-scenario.md) | Seed anclado al “ahora” + frente de lluvia escalonado | El panel nunca se ve vacío ni obsoleto, sin construir un reloj simulado. |
| [0005](docs/adr/0005-additive-bonus-formula.md) | Fórmula aditiva en COP (no multiplicativa) | Heurística honesta y verificable: los factores **suman** al bono; nada de cajas negras. |
| [0006](docs/adr/0006-plain-postgres-not-timescaledb.md) | Postgres plano, sin TimescaleDB | El volumen de la demo no justifica hypertables; un índice btree cubre las búsquedas. |

**Desviaciones deliberadas respecto a [`SPEC.md`](SPEC.md):** se quitaron BullMQ, Redis, TimescaleDB, JWT/multi-tenant, NOAA y el forecast con ML (Prophet/LSTM). No es que “falten” — son preocupaciones de producción (Fase 3–4 del spec) que no hacen la demo más convincente. Si esto escalara a producción real, volverían.

---

## 📝 Variables de entorno

Copia [`.env.example`](.env.example) → `.env`. Las principales:

| Variable                   | Default                  | Para qué |
|----------------------------|--------------------------|----------|
| `DATABASE_URL`             | `postgresql://…/fleetweather` | Conexión a Postgres |
| `API_KEY`                  | `demo-key`               | Bearer key de la API (servidor) |
| `API_PORT`                 | `3000`                   | Puerto de la API |
| `RECOMPUTE_INTERVAL_SEC`   | `45`                     | Cadencia del scheduler |
| `NEXT_PUBLIC_WS_URL`       | `ws://localhost:3000/ws/v1` | WebSocket que usa el navegador |
| `API_INTERNAL_URL`         | `http://localhost:3000/api/v1` | API que usa Next del lado servidor |

En `docker-compose.yml` los contenedores se alcanzan por nombre de servicio, así que esas URLs se sobreescriben automáticamente dentro de la red de Docker.
