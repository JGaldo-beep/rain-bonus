/**
 * API-local re-export of the shared domain types (SPEC §3–§5).
 *
 * `@fleetweather/shared` is the single source of truth; this barrel lets API
 * code import domain types from a local path. `export type *` keeps the
 * re-export type-only so it is fully erased at runtime.
 */
export type * from "@fleetweather/shared";
