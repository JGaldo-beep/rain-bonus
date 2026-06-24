"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Subscribes to the API's WebSocket feed (SPEC §7.2) and surfaces a connection
 * status so the UI can show an "offline" banner (§9.3). Pass a zoneId to receive
 * one zone's events, or null for the city-wide feed. Reconnects with backoff.
 */
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

export type ConnStatus = "connecting" | "online" | "offline";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000/ws/v1";

export function useZoneStream(
  zoneId: string | null,
  onEvent: (event: WsEvent) => void,
): ConnStatus {
  const [status, setStatus] = useState<ConnStatus>("connecting");
  // Keep the latest callback without forcing the socket to reconnect.
  const cb = useRef(onEvent);
  useEffect(() => {
    cb.current = onEvent;
  });

  useEffect(() => {
    const url = zoneId ? `${WS_BASE}/zones/${zoneId}` : WS_BASE;
    let socket: WebSocket | null = null;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      setStatus(retry === 0 ? "connecting" : "offline");
      socket = new WebSocket(url);

      socket.onopen = () => {
        retry = 0;
        setStatus("online");
      };
      socket.onmessage = (ev) => {
        try {
          cb.current(JSON.parse(ev.data) as WsEvent);
        } catch {
          // ignore malformed frames
        }
      };
      socket.onclose = () => {
        if (closed) return;
        setStatus("offline");
        retry += 1;
        const delay = Math.min(1000 * 2 ** retry, 10_000);
        reconnectTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [zoneId]);

  return status;
}
