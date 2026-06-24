/**
 * In-process WebSocket pub/sub hub (SPEC §7.2).
 *
 * A client connecting to `/ws/v1` receives events for every Zone; a client on
 * `/ws/v1/zones/:id` receives only that Zone's events. The recompute and Ops
 * services call `broadcast()` whenever a forecast or recommendation changes.
 *
 * Single-node only — no Redis fan-out (ADR-0003). If this became multi-node, the
 * hub would sit behind a shared pub/sub.
 */

/** The slice of a WebSocket we use — keeps us decoupled from the `ws` version. */
export interface Sendable {
  send(data: string): void;
  readyState: number;
}

const OPEN = 1;

export type WsEventType =
  | "forecast.updated"
  | "recommendation.updated"
  | "recommendation.published"
  | "alert.low_confidence";

export interface WsEvent {
  type: WsEventType;
  zone_id: string;
  payload: unknown;
  ts: string;
}

interface Client {
  socket: Sendable;
  /** null = subscribed to all zones. */
  zoneId: string | null;
}

const clients = new Set<Client>();

/** Registers a socket; returns an unsubscribe function for the close handler. */
export function subscribe(socket: Sendable, zoneId: string | null): () => void {
  const client: Client = { socket, zoneId };
  clients.add(client);
  return () => clients.delete(client);
}

/** Sends an event to every client subscribed to its zone (or to all zones). */
export function broadcast(event: Omit<WsEvent, "ts"> & { ts?: string }): void {
  const msg = JSON.stringify({ ...event, ts: event.ts ?? new Date().toISOString() });
  for (const c of clients) {
    if (c.socket.readyState !== OPEN) continue;
    if (c.zoneId === null || c.zoneId === event.zone_id) {
      try {
        c.socket.send(msg);
      } catch {
        // a dead socket will be cleaned up by its close handler
      }
    }
  }
}

/** Current connection count — exposed on /health for the demo. */
export function connectionCount(): number {
  return clients.size;
}
