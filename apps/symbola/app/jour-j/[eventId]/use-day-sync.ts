"use client";

// Lot 51 (ARC-09, JRJ-08 ; D4, D5, D7, ADR 0091) — la synchronisation du jour J sur l'appareil :
// toute écriture entre dans la file (IndexedDB), part aussitôt si le réseau le permet, sinon au retour
// du réseau ; l'état partagé de l'équipe se relit toutes les 15 secondes en ligne et à chaque retour
// au premier plan. Après un envoi réussi, la copie de lecture gardée sur l'appareil se met à jour.
import { useCallback, useEffect, useRef, useState } from "react";
import type { DayHandover, DayState } from "@symbola/contracts";
import {
  createIndexedDbQueueStore,
  enqueueDayAction,
  flushDayQueue,
  httpDayQueueTransport,
  pendingDayActions,
  type DayFlushResult,
  type DayQueueStore,
  type QueuedDayAction,
} from "@/lib/offline/action-queue";
import type { DayTimes } from "@/lib/day-of/overlay";

export type DaySnapshot = { state: DayState; items: DayTimes[]; handovers: DayHandover[] | null };
export type DaySyncStatus = "idle" | "sending" | "done" | "offline" | "session" | "error";

// Signal pour la copie de lecture (day-copy-panel.tsx) : un envoi a réussi.
export const DAY_SENT_EVENT = "symbola:jour-j-envoye";

function memoryFallback(): DayQueueStore {
  const entries = new Map<string, QueuedDayAction & { seq: number }>();
  return {
    put: async (entry) => void entries.set(entry.actionId, entry),
    get: async (actionId) => entries.get(actionId),
    list: async (eventId) => [...entries.values()].filter((entry) => entry.eventId === eventId),
    remove: async (actionId) => void entries.delete(actionId),
  };
}

export function useDaySync(input: { eventId: string; userId: string; initial: DaySnapshot; refreshSeconds: number }) {
  const { eventId, userId, refreshSeconds } = input;
  const [snapshot, setSnapshot] = useState<DaySnapshot>(input.initial);
  const [pending, setPending] = useState<QueuedDayAction[]>([]);
  const [status, setStatus] = useState<DaySyncStatus>("idle");
  const [lastResult, setLastResult] = useState<DayFlushResult | null>(null);
  const storeRef = useRef<DayQueueStore | null>(null);

  const store = useCallback((): DayQueueStore => {
    if (!storeRef.current) storeRef.current = typeof indexedDB === "undefined" ? memoryFallback() : createIndexedDbQueueStore();
    return storeRef.current;
  }, []);

  const readPending = useCallback(async () => {
    try {
      setPending(await pendingDayActions(store(), eventId, userId));
    } catch {
      // IndexedDB indisponible (navigation privée stricte) : la file reste en mémoire.
      storeRef.current = memoryFallback();
    }
  }, [eventId, userId, store]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/jour-j/${eventId}/etat`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok || response.redirected) return;
      const body = (await response.json()) as DaySnapshot;
      if (body?.state) setSnapshot(body);
    } catch {
      // Sans réseau : l'écran garde le dernier état reçu.
    }
  }, [eventId]);

  const flush = useCallback(async () => {
    const queued = await pendingDayActions(store(), eventId, userId);
    if (queued.length === 0) {
      setStatus((current) => (current === "sending" ? "done" : current === "idle" ? "done" : current));
      return;
    }
    setStatus("sending");
    const result = await flushDayQueue({ store: store(), eventId, userId, transport: httpDayQueueTransport });
    setLastResult(result);
    setStatus(result.status);
    await readPending();
    if (result.sent + result.duplicates > 0) {
      window.dispatchEvent(new CustomEvent(DAY_SENT_EVENT, { detail: { eventId } }));
      await refresh();
    }
  }, [eventId, userId, store, readPending, refresh]);

  const enqueue = useCallback(
    async (entry: Omit<QueuedDayAction, "eventId" | "userId" | "createdAt">) => {
      await enqueueDayAction(store(), { ...entry, eventId, userId, createdAt: new Date().toISOString() } as QueuedDayAction);
      await readPending();
      await flush();
    },
    [eventId, userId, store, readPending, flush],
  );

  useEffect(() => {
    void readPending().then(flush);
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void flush().then(refresh);
    };
    const timer = setInterval(tick, refreshSeconds * 1000);
    const onVisible = () => tick();
    window.addEventListener("online", tick);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Une seule fois à l'ouverture de l'écran.
  }, []);

  return { snapshot, pending, status, lastResult, enqueue, flush, refresh };
}
