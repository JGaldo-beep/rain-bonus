# Demo data: anchored-to-now seed, staged rain front across ~6 zones

The demo runs on synthetic data (ADR-0001) and must always show an interesting state without a
simulated clock. So the seed is generated **relative to real wall-clock "now"**, not baked at
fixed timestamps:

- A rain front sweeps across ~6 Bogotá zones, staggered in time, so that at any "now" the city
  map shows a spread of Rain Intensities (none/light/moderate/heavy) and at least one zone has a
  rain event ~45 min out.
- One zone is seeded Low-Confidence (weather sources disagree) so the Approval beat is always
  demonstrable.
- The narrator can override a second zone live to show the pinned-override path.
- The manual `recommendation/trigger` endpoint forces a recalc for the on-demand beat.

This means the seed is a **function of current time**, run at startup (and re-runnable), not a
static SQL fixture. Trade-off: slightly more seed logic, but the demo is never stale and needs no
clock-scrubbing UI. The staged front (vs a single deep zone) is what makes the city map and the
"all zones" view non-empty and exercises every lifecycle state.
