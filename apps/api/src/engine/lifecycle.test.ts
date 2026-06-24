import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approve,
  canApprove,
  classifyNewRecommendation,
  InvalidTransitionError,
  isOverrideActive,
  type LiveRecommendation,
} from "./lifecycle.js";

const NOW = new Date("2026-06-23T10:00:00Z");
const future = "2026-06-23T14:00:00Z";
const past = "2026-06-23T08:00:00Z";

function live(overrides: Partial<LiveRecommendation> = {}): LiveRecommendation {
  return {
    status: "published",
    origin: "auto",
    pinned: false,
    valid_until: future,
    ...overrides,
  };
}

test("high confidence with no live rec publishes", () => {
  const c = classifyNewRecommendation({ confidencePct: 90, live: null, now: NOW });
  assert.equal(c.status, "published");
  assert.equal(c.deferToOverride, false);
  assert.equal(c.needsApproval, false);
});

test("low confidence parks in pending_approval and does not defer", () => {
  const c = classifyNewRecommendation({
    confidencePct: 54,
    live: live(),
    now: NOW,
  });
  assert.equal(c.status, "pending_approval");
  assert.equal(c.deferToOverride, false);
  assert.equal(c.needsApproval, true);
});

test("60% is the inclusive publish threshold", () => {
  assert.equal(classifyNewRecommendation({ confidencePct: 60, live: null, now: NOW }).status, "published");
  assert.equal(classifyNewRecommendation({ confidencePct: 59.9, live: null, now: NOW }).status, "pending_approval");
});

test("a live pinned override defers the recalc: new rec is born superseded", () => {
  const c = classifyNewRecommendation({
    confidencePct: 95, // even high confidence must defer
    live: live({ pinned: true, origin: "override" }),
    now: NOW,
  });
  assert.equal(c.status, "superseded");
  assert.equal(c.deferToOverride, true);
});

test("an expired pinned override no longer defers — automation resumes", () => {
  const c = classifyNewRecommendation({
    confidencePct: 95,
    live: live({ pinned: true, origin: "override", valid_until: past }),
    now: NOW,
  });
  assert.equal(c.status, "published");
  assert.equal(c.deferToOverride, false);
});

test("isOverrideActive requires pinned + published + unexpired", () => {
  assert.equal(isOverrideActive(live({ pinned: true }), NOW), true);
  assert.equal(isOverrideActive(live({ pinned: false }), NOW), false);
  assert.equal(isOverrideActive(live({ pinned: true, status: "superseded" }), NOW), false);
  assert.equal(isOverrideActive(live({ pinned: true, valid_until: past }), NOW), false);
  assert.equal(isOverrideActive(null, NOW), false);
});

test("approve only works from pending_approval", () => {
  assert.equal(canApprove("pending_approval"), true);
  assert.equal(canApprove("published"), false);

  const r = approve("pending_approval");
  assert.deepEqual(r, { status: "published", origin: "approved" });

  assert.throws(() => approve("published"), InvalidTransitionError);
  assert.throws(() => approve("superseded"), InvalidTransitionError);
});
