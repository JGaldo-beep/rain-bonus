# Rain Bonus System

A system that watches rain forecasts per zone and recommends a concrete per-delivery
bonus (in COP) to keep enough Rappiteneros online when rain pushes demand up and supply
down. This glossary is the project's ubiquitous language — use these words exactly, in
code and in conversation.

## Language

**Bonus**:
The per-delivery incentive, in COP, that the system recommends *on top of* the base
delivery rate to close a rain-driven supply gap. It is the system's primary output.
_Avoid_: investment, incentive, subsidy, surge.

**Bonus Recommendation**:
The record carrying a recommended Bonus for one Zone over a validity window, plus its
confidence and explainability. The entity is `BonusRecommendation`; the table is
`bonus_recommendations`.
_Avoid_: InvestmentRecommendation, InvestmentScore.

**Base Delivery Rate**:
The COP a Rappitenero earns for one delivery with no Bonus applied. The Bonus is always
an amount above this; total payout = base delivery rate + Bonus.
_Avoid_: base fare, base pay.

**Rappitenero**:
A Rappi courier who accepts and fulfills deliveries. The actor whose supply the Bonus is
meant to attract.
_Avoid_: driver, rider, courier (in code/identifiers), delivery person.

**Zone**:
The unit of calculation — a named sub-area of a city (e.g. "Chapinero" in Bogotá), with
its own supply curve, rain sensitivity, and demand elasticity. Bonuses are computed per
Zone, never per city.
_Avoid_: location, area, region, neighborhood.

**Supply**:
The count of active (online) Rappiteneros in a Zone at a given hour.
_Avoid_: drivers online, availability.

**Demand**:
The count of orders placed in a Zone at a given hour.
_Avoid_: volume, traffic.

**Supply Gap**:
The number of additional Rappiteneros needed to meet rainy demand — required supply minus
expected rainy supply. The quantity the Bonus is sized to close.
_Avoid_: deficit, shortfall.

**Rain Intensity**:
The discretized rain level driving the model: `none`, `light`, `moderate`, `heavy`.
Derived from forecast precipitation (mm/h). This enum, not raw mm, is what the model and
business rules speak in.
_Avoid_: rain level, severity.

**Forecast**:
The per-Zone, 72-hour, hourly projection of Rain Intensity (with confidence) that triggers
bonus calculation. The entity is `ForecastResult`.
_Avoid_: prediction, outlook.

**Confidence**:
How much the weather sources agree on a Forecast, as a percentage. Below 60% a Bonus
Recommendation is Low Confidence and cannot go live without an Approval.
_Avoid_: certainty, accuracy.

**Published**:
The state of the Bonus Recommendation that is currently live for a Zone — the bonus Rappi
is actually offering. At most one Published recommendation covers a Zone at a given moment.
_Avoid_: active, live, approved (these are looser).

**Approval**:
The Ops action that takes a Low-Confidence recommendation from Pending Approval to
Published. Only Low-Confidence recommendations require one.
_Avoid_: sign-off, confirmation.

**Override**:
The Ops action that replaces the recommended Bonus for a Zone with a manually chosen COP
amount. An Override is Pinned: it stays Published for its window and automatic recalculations
defer to it (they are still computed and stored, but do not replace it). Must respect the
minimum increment and max-bonus cap.
_Avoid_: manual adjustment, edit, correction.

**Pinned**:
A property of an Override: the human decision holds for its validity window and is not
overwritten by the automatic recalc job.
_Avoid_: locked, frozen.

**Superseded**:
The state of a recommendation that has been replaced — either by a newer Published one, or
by an Override it must defer to. A Superseded recommendation is never live.
_Avoid_: stale, expired (expiry is the window passing, not replacement).
