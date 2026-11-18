// Lot 51 (ARC-09, NFR-09, JRJ-05 à JRJ-09 ; D5, D7, ADR 0064, ADR 0091) — la file d'actions du jour J
// sur l'appareil, écrite à la main (IndexedDB, aucune dépendance). Toute écriture du jour J (pointage,
// validation d'un décalage, incident, case, remise, photo) y entre d'abord, avec un identifiant créé
// sur le téléphone, l'heure de l'appareil et la personne qui l'a faite. Dès que le réseau revient et
// que l'écran est ouvert, la file part dans l'ordre ; le serveur ignore une action déjà reçue, donc la
// rejouer est sans risque. Rien ne se perd : sans réseau ou avec une session expirée, la file reste ;
// les actions d'une autre personne attendent sa session. Une action refusée pour de bon sort de la
// file et se signale.
import type { DayAction, DayActionOutcome, DayPhotoMeta } from "@symbola/contracts";

export type QueuedDayAction = {
  actionId: string;
  eventId: string;
  userId: string;
  createdAt: string;
  // Rang dans la file (posé à l'entrée).
  seq?: number;
} & ({ action: DayAction; photo?: undefined } | { photo: { meta: DayPhotoMeta; blob: Blob }; action?: undefined });

export interface DayQueueStore {
  put(entry: QueuedDayAction & { seq: number }): Promise<void>;
  get(actionId: string): Promise<(QueuedDayAction & { seq: number }) | undefined>;
  list(eventId: string): Promise<(QueuedDayAction & { seq: number })[]>;
  remove(actionId: string): Promise<void>;
}

export type DayQueueTransport = {
  sendActions(eventId: string, actions: DayAction[]): Promise<{ status: "ok"; outcomes: DayActionOutcome[] } | { status: "offline" | "session" | "error" }>;
  sendPhoto(eventId: string, meta: DayPhotoMeta, blob: Blob): Promise<{ status: "ok"; outcome: DayActionOutcome & { rejection?: string | null } } | { status: "offline" | "session" | "error" }>;
};

export type DayFlushResult = {
  status: "done" | "offline" | "session" | "error";
  sent: number;
  duplicates: number;
  rejected: { actionId: string; reason: string }[];
  // Photos reçues mais refusées à l'arrivée (type, taille, antivirus) : l'incident ou la case restent.
  refusedPhotos: { actionId: string; rejection: string }[];
  remaining: number;
};

const BATCH = 50;
let lastSeq = 0;

function nextSeq(): number {
  lastSeq = Math.max(Date.now() * 1000, lastSeq + 1);
  return lastSeq;
}

// Une action déjà en file (double toucher) n'entre pas deux fois.
export async function enqueueDayAction(store: DayQueueStore, entry: QueuedDayAction): Promise<void> {
  if (await store.get(entry.actionId)) return;
  await store.put({ ...entry, seq: entry.seq ?? nextSeq() });
}

export async function pendingDayActions(store: DayQueueStore, eventId: string, userId: string | null = null): Promise<(QueuedDayAction & { seq: number })[]> {
  return (await store.list(eventId)).filter((entry) => userId === null || entry.userId === userId).sort((a, b) => a.seq - b.seq);
}

// Un seul envoi à la fois par évènement sur l'appareil (retour du réseau et toucher simultanés).
const running = new Map<string, Promise<DayFlushResult>>();

export function flushDayQueue(input: { store: DayQueueStore; eventId: string; userId: string; transport: DayQueueTransport }): Promise<DayFlushResult> {
  const key = `${input.eventId}:${input.userId}`;
  const current = running.get(key);
  if (current) return current.then(() => flushOnce(input));
  const promise = flushOnce(input).finally(() => running.delete(key));
  running.set(key, promise);
  return promise;
}

async function flushOnce(input: { store: DayQueueStore; eventId: string; userId: string; transport: DayQueueTransport }): Promise<DayFlushResult> {
  const result: DayFlushResult = { status: "done", sent: 0, duplicates: 0, rejected: [], refusedPhotos: [], remaining: 0 };
  const settle = async (outcome: DayActionOutcome) => {
    if (outcome.status === "applied") result.sent += 1;
    else if (outcome.status === "duplicate") result.duplicates += 1;
    else result.rejected.push({ actionId: outcome.actionId, reason: outcome.reason ?? "rejected" });
    await input.store.remove(outcome.actionId);
  };
  for (;;) {
    const pending = await pendingDayActions(input.store, input.eventId, input.userId);
    if (pending.length === 0) break;
    const first = pending[0]!;
    if (first.photo) {
      const sent = await input.transport.sendPhoto(input.eventId, first.photo.meta, first.photo.blob);
      if (sent.status !== "ok") {
        result.status = sent.status;
        break;
      }
      if (sent.outcome.rejection) result.refusedPhotos.push({ actionId: first.actionId, rejection: sent.outcome.rejection });
      await settle(sent.outcome);
      continue;
    }
    // Les actions qui précèdent la prochaine photo, par lots.
    const batch: (QueuedDayAction & { seq: number })[] = [];
    for (const entry of pending) {
      if (entry.photo || batch.length >= BATCH) break;
      batch.push(entry);
    }
    const sent = await input.transport.sendActions(
      input.eventId,
      batch.map((entry) => entry.action!),
    );
    if (sent.status !== "ok") {
      result.status = sent.status;
      break;
    }
    const answered = new Set(sent.outcomes.map((outcome) => outcome.actionId));
    for (const outcome of sent.outcomes) await settle(outcome);
    // Une action sans réponse reste en file (elle repartira) : on s'arrête pour ne pas boucler.
    if (batch.some((entry) => !answered.has(entry.actionId))) {
      result.status = "error";
      break;
    }
  }
  result.remaining = (await pendingDayActions(input.store, input.eventId, input.userId)).length;
  return result;
}

// —— Magasins ——————————————————————————————————————————————————————————————————————————————

export function createMemoryQueueStore(): DayQueueStore {
  const entries = new Map<string, QueuedDayAction & { seq: number }>();
  return {
    async put(entry) {
      entries.set(entry.actionId, entry);
    },
    async get(actionId) {
      return entries.get(actionId);
    },
    async list(eventId) {
      return [...entries.values()].filter((entry) => entry.eventId === eventId);
    },
    async remove(actionId) {
      entries.delete(actionId);
    },
  };
}

// Base IndexedDB de l'appareil : elle survit à la fermeture de l'onglet, à une session expirée et à
// la déconnexion (une action faite hors ligne n'est jamais perdue) ; seule l'action de son auteur part.
export const DAY_QUEUE_DATABASE = "symbola-jour-j-file";
const STORE = "actions";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DAY_QUEUE_DATABASE, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(STORE, { keyPath: "actionId" });
      store.createIndex("eventId", "eventId");
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

export function createIndexedDbQueueStore(): DayQueueStore {
  let database: Promise<IDBDatabase> | null = null;
  const db = () => (database ??= openDatabase());
  const run = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const transaction = (await db()).transaction(STORE, mode);
    const result = await request(fn(transaction.objectStore(STORE)));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return result;
  };
  return {
    async put(entry) {
      await run("readwrite", (store) => store.put(entry));
    },
    async get(actionId) {
      return (await run("readonly", (store) => store.get(actionId))) as (QueuedDayAction & { seq: number }) | undefined;
    },
    async list(eventId) {
      return (await run("readonly", (store) => store.index("eventId").getAll(eventId))) as (QueuedDayAction & { seq: number })[];
    },
    async remove(actionId) {
      await run("readwrite", (store) => store.delete(actionId));
    },
  };
}

// —— Transport HTTP ——————————————————————————————————————————————————————————————————————————

// Une session expirée renvoie 401, ou un renvoi vers la connexion : la file reste.
function failure(response: Response): "session" | "error" {
  if (response.status === 401 || response.status === 403) return "session";
  if (response.redirected) return "session";
  return "error";
}

export const httpDayQueueTransport: DayQueueTransport = {
  async sendActions(eventId, actions) {
    let response: Response;
    try {
      response = await fetch(`/jour-j/${eventId}/actions`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actions }) });
    } catch {
      return { status: "offline" };
    }
    if (response.status >= 500) return { status: "offline" };
    if (!response.ok || response.redirected) return { status: failure(response) };
    const body = (await response.json().catch(() => null)) as { outcomes?: DayActionOutcome[] } | null;
    return body?.outcomes ? { status: "ok", outcomes: body.outcomes } : { status: "error" };
  },
  async sendPhoto(eventId, meta, blob) {
    const form = new FormData();
    form.set("meta", JSON.stringify(meta));
    form.set("photo", blob, "photo.jpg");
    let response: Response;
    try {
      response = await fetch(`/jour-j/${eventId}/photos`, { method: "POST", credentials: "same-origin", body: form });
    } catch {
      return { status: "offline" };
    }
    if (response.status >= 500) return { status: "offline" };
    // Trop lourde pour être reçue : refusée pour de bon, la file continue.
    if (response.status === 413) return { status: "ok", outcome: { actionId: meta.actionId, status: "rejected", reason: "size", rejection: "size" } };
    if (!response.ok || response.redirected) return { status: failure(response) };
    const body = (await response.json().catch(() => null)) as (DayActionOutcome & { photo?: { rejection: string | null } | null }) | null;
    if (!body?.status) return { status: "error" };
    return { status: "ok", outcome: { actionId: meta.actionId, status: body.status, ...(body.reason ? { reason: body.reason } : {}), rejection: body.photo?.rejection ?? null } };
  },
};
