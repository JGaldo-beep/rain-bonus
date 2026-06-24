# Bonus formula is an additive COP decomposition, not a multiplicative magic scale

To honor the "honest, transparent heuristic" posture (ADR-0001) and the requirement that
`contributing_factors` genuinely decompose the result, the Bonus is the **sum of named COP
terms**, then snapped and capped:

```
bonus_raw =
    gap_closing_cost          // COP to recruit the marginal Rappiteneros (scales with Supply Gap)
  + demand_surge_premium      // COP for elevated demand (scales with demand_multiplier - 1)
  + rain_severity_premium     // flat COP per Rain Intensity level (light/moderate/heavy)

recommended_bonus_cop = cap( snap_to_500(bonus_raw), max_bonus_cop )
```

- Each `contributing_factors[i].contribution` is that term's COP value; the terms sum to
  `bonus_raw`. A reader can verify the math by eye. (The displayed factors are pre-rounding;
  the published number is then snapped to the $500 increment and capped — note this delta.)
- Every constant (`COP_PER_GAP_POINT`, demand premium scale, the per-level rain premiums) is
  documented at its definition with a one-line rationale and an explicit
  "calibrate with real supply-elasticity data" note. They are honest placeholders, not
  claimed-rigorous parameters.

This **replaces** the SPEC §5.4 multiplicative sketch (`BONUS_SCALE × weight × deficitRatio`)
and the current `bonus.ts` implementation, whose factors did not sum to the output. Rejected:
keeping the multiplicative form and explaining factors as multiplicative shares — faithful to
the SPEC sketch but a reviewer can't verify it by inspection, which defeats the explainability
showpiece that suits this audience.
