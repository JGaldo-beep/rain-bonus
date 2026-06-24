# Bonus Recommendation lifecycle: confidence-gated auto-publish, with pinned overrides

A `BonusRecommendation` is created by the calculator and its state is driven by Confidence
and by human (Ops) action:

- **On creation:** Confidence ≥ 60% → `published` automatically; Confidence < 60% →
  `pending_approval` (Low Confidence, business rule §8). It cannot go live without Ops.
- **Approval:** Ops moves a `pending_approval` recommendation to `published`.
- **Supersession:** when a newer recommendation is published for a Zone, the previous one
  becomes `superseded`. At most one recommendation is `published` for a Zone at a time.
- **Override:** Ops sets a manual COP bonus. The override is itself a `published`
  recommendation marked **pinned**. While a pinned override covers the current window, the
  automatic `calculate-bonus` job still runs and stores its result (as `superseded`, i.e.
  computed-but-not-live) — it does **not** overwrite the override. The override holds until
  its window passes.
- **Expiry:** when a recommendation's validity window passes without replacement it is
  `expired`; the next recalc may publish normally again.

**Why pinned overrides:** this is an Ops tool — a human override that the automation erases
30 minutes later is worse than no override at all. Automation advises; the human is in
command for the window they acted on. The rejected alternative ("latest recalc always wins")
was simpler but makes the override button meaningless.

This whole lifecycle exists because the audience is a code-reading engineer (see ADR-0001):
a clean, explicit state machine with one invariant — *at most one Published recommendation
per Zone* — is the safety story for "what stops a bad auto-bonus from shipping."
