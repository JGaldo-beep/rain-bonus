import type {
  RecommendationOrigin,
  RecommendationStatus,
} from "@fleetweather/shared";
import { LOW_CONFIDENCE_THRESHOLD } from "./bonus.js";

/**
 * Bonus Recommendation lifecycle — pure decision logic (ADR-0002).
 *
 * No I/O here: these functions decide *what should happen* given the current
 * live state; the service layer applies the result to the database and the WS
 * hub. Keeping it pure is what makes the override-pins-recalc rule unit-testable.
 *
 * Invariant the caller must preserve: at most one `published` recommendation
 * covers a Zone at a time.
 */

/** The currently-live recommendation for a Zone, as the rules need to see it. */
export interface LiveRecommendation {
  status: RecommendationStatus;
  origin: RecommendationOrigin;
  pinned: boolean;
  valid_until: string; // ISO8601
}

export interface ClassifyInput {
  confidencePct: number;
  /** The Zone's current live recommendation, or null if none. */
  live: LiveRecommendation | null;
  now: Date;
}

export interface Classification {
  /** Status the newly-computed automatic recommendation should be stored with. */
  status: RecommendationStatus;
  /** A pinned Override is live, so the new recommendation must not go live. */
  deferToOverride: boolean;
  /** True when a Low-Confidence recommendation was parked for Ops approval. */
  needsApproval: boolean;
}

/** Is `live` a pinned Override that still covers `now`? (ADR-0002) */
export function isOverrideActive(
  live: LiveRecommendation | null,
  now: Date,
): boolean {
  return Boolean(
    live &&
      live.pinned &&
      live.status === "published" &&
      new Date(live.valid_until).getTime() > now.getTime(),
  );
}

/**
 * Decides the fate of a freshly-computed automatic recommendation.
 *
 * - If a pinned Override is live, the new one is born `superseded` (computed but
 *   never live) and the Override is left untouched — automation defers to the human.
 * - Otherwise Confidence gates it: ≥60% → `published`; <60% → `pending_approval`.
 *
 * What the new status supersedes is the service's job (a published rec replaces the
 * prior live bonus; a pending one must NOT take down a live bonus) — this function
 * only classifies.
 */
export function classifyNewRecommendation(input: ClassifyInput): Classification {
  const { confidencePct, live, now } = input;

  if (isOverrideActive(live, now)) {
    return { status: "superseded", deferToOverride: true, needsApproval: false };
  }

  if (confidencePct < LOW_CONFIDENCE_THRESHOLD) {
    return {
      status: "pending_approval",
      deferToOverride: false,
      needsApproval: true,
    };
  }

  return { status: "published", deferToOverride: false, needsApproval: false };
}

/** Can Ops approve this recommendation? Only `pending_approval` ones. */
export function canApprove(status: RecommendationStatus): boolean {
  return status === "pending_approval";
}

export class InvalidTransitionError extends Error {}

/**
 * Approval: a `pending_approval` recommendation goes live. Throws if the
 * recommendation is in any other state, so the route returns a clean 409.
 */
export function approve(status: RecommendationStatus): {
  status: RecommendationStatus;
  origin: RecommendationOrigin;
} {
  if (!canApprove(status)) {
    throw new InvalidTransitionError(
      `cannot approve a recommendation in state "${status}"`,
    );
  }
  return { status: "published", origin: "approved" };
}
