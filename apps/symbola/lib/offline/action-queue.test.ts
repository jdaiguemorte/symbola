// Lot 51 (ARC-09, NFR-09, JRJ-08 ; D5, D7, ADR 0091) — la file d'actions du jour J sur l'appareil :
// envoi dans l'ordre, une action déjà reçue sortie de la file sans doublon, rien de perdu sans réseau
// ni avec une session expirée, la photo d'un incident après lui, les actions d'une autre personne
// gardées pour elle. Magasin en mémoire et transport simulé (IndexedDB dans le navigateur).
import { describe, expect, it } from "vitest";
import { createMemoryQueueStore, enqueueDayAction, flushDayQueue, pendingDayActions, type DayQueueTransport, type QueuedDayAction } from "./action-queue";

const EVENT = "11111111-1111-4111-8111-111111111111";
const CAMILLE = "22222222-2222-4222-8222-222222222222";
const HUGO = "33333333-3333-4333-8333-333333333333";

function serverOf() {
  const received = new Set<string>();
  const log: string[] = [];
  let mode: "online" | "offline" | "session" = "online";
  const transport: DayQueueTransport = {
    async sendActions(_eventId, actions) {
      if (mode !== "online") return { status: mode };
      return {
        status: "ok",
        outcomes: actions.map((action) => {
          log.push(action.actionId);
          if (action.kind === "check" && action.checklistItemId === "gone") return { actionId: action.actionId, status: "rejected" as const, reason: "item" };
          const duplicate = received.has(action.actionId);
          received.add(action.actionId);
          return { actionId: action.actionId, status: duplicate ? ("duplicate" as const) : ("applied" as const) };
        }),
      };
    },
    async sendPhoto(_eventId, meta) {
      if (mode !== "online") return { status: mode };
      log.push(`photo:${meta.actionId}`);
      const duplicate = received.has(meta.actionId);
      received.add(meta.actionId);
      return { status: "ok", outcome: { actionId: meta.actionId, status: duplicate ? "duplicate" : "applied" } };
    },
  };
  return { transport, log, received, setMode: (next: typeof mode) => (mode = next) };
}

const checkpoint = (id: string, userId = CAMILLE): QueuedDayAction => ({
  actionId: id,
  eventId: EVENT,
  userId,
  createdAt: "2027-06-12T14:20:00Z",
  action: { kind: "checkpoint", actionId: id, deviceAt: "2027-06-12T14:20:00Z", itemId: "item", checkpoint: "started" },
});

describe("ARC-09 — file d'actions hors ligne du jour J", () => {
  it("sans réseau, tout reste dans la file ; au retour du réseau, tout part dans l'ordre et la file se vide", async () => {
    const store = createMemoryQueueStore();
    const server = serverOf();
    server.setMode("offline");
    for (const id of ["a1", "a2", "a3"]) await enqueueDayAction(store, checkpoint(id));
    expect(await flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport })).toMatchObject({ status: "offline", remaining: 3 });
    expect((await pendingDayActions(store, EVENT, CAMILLE)).map((entry) => entry.actionId)).toEqual(["a1", "a2", "a3"]);
    server.setMode("online");
    expect(await flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport })).toMatchObject({ status: "done", sent: 3, remaining: 0 });
    expect(server.log).toEqual(["a1", "a2", "a3"]);
  });

  it("une action rejouée deux fois (réponse perdue) n'est comptée qu'une fois : aucune perte, aucun doublon", async () => {
    const store = createMemoryQueueStore();
    const server = serverOf();
    await enqueueDayAction(store, checkpoint("b1"));
    // Le serveur l'a reçue, mais la réponse s'est perdue : elle est encore en file.
    server.received.add("b1");
    const result = await flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport });
    expect(result).toMatchObject({ status: "done", sent: 0, duplicates: 1, remaining: 0 });
    expect(server.received.size).toBe(1);
    // Mise en file deux fois sur l'appareil (double toucher) : une seule entrée.
    await enqueueDayAction(store, checkpoint("b2"));
    await enqueueDayAction(store, checkpoint("b2"));
    expect(await pendingDayActions(store, EVENT, CAMILLE)).toHaveLength(1);
  });

  it("session expirée pendant la coupure : la file est gardée, puis vidée après la reconnexion", async () => {
    const store = createMemoryQueueStore();
    const server = serverOf();
    await enqueueDayAction(store, checkpoint("c1"));
    server.setMode("session");
    expect(await flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport })).toMatchObject({ status: "session", remaining: 1 });
    server.setMode("online");
    expect(await flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport })).toMatchObject({ status: "done", remaining: 0 });
  });

  it("une action refusée pour de bon sort de la file et se signale ; les autres partent", async () => {
    const store = createMemoryQueueStore();
    const server = serverOf();
    await enqueueDayAction(store, { ...checkpoint("d1"), action: { kind: "check", actionId: "d1", deviceAt: "2027-06-12T14:20:00Z", checklistItemId: "gone" } });
    await enqueueDayAction(store, checkpoint("d2"));
    const result = await flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport });
    expect(result).toMatchObject({ status: "done", sent: 1, remaining: 0, rejected: [{ actionId: "d1", reason: "item" }] });
  });

  it("la photo d'un incident part après lui, dans l'ordre de la file", async () => {
    const store = createMemoryQueueStore();
    const server = serverOf();
    await enqueueDayAction(store, { ...checkpoint("e1"), action: { kind: "incident", actionId: "e1", deviceAt: "2027-06-12T14:41:00Z", body: "Portail bloqué", severity: null, keyMomentId: null } });
    await enqueueDayAction(store, {
      actionId: "e2",
      eventId: EVENT,
      userId: CAMILLE,
      createdAt: "2027-06-12T14:41:05Z",
      photo: { meta: { actionId: "e2", deviceAt: "2027-06-12T14:41:05Z", subject: "incident", subjectId: null, subjectActionId: "e1" }, blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }) },
    });
    await enqueueDayAction(store, checkpoint("e3"));
    await flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport });
    expect(server.log).toEqual(["e1", "photo:e2", "e3"]);
  });

  it("les actions d'une autre personne (téléphone prêté) restent pour elle : elles ne partent qu'avec sa session", async () => {
    const store = createMemoryQueueStore();
    const server = serverOf();
    await enqueueDayAction(store, checkpoint("f1", HUGO));
    await enqueueDayAction(store, checkpoint("f2", CAMILLE));
    expect(await flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport })).toMatchObject({ status: "done", sent: 1, remaining: 0 });
    expect((await pendingDayActions(store, EVENT, HUGO)).map((entry) => entry.actionId)).toEqual(["f1"]);
    expect(server.log).toEqual(["f2"]);
  });

  it("deux envois simultanés (retour du réseau et toucher) ne doublent rien", async () => {
    const store = createMemoryQueueStore();
    const server = serverOf();
    for (const id of ["g1", "g2"]) await enqueueDayAction(store, checkpoint(id));
    await Promise.all([
      flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport }),
      flushDayQueue({ store, eventId: EVENT, userId: CAMILLE, transport: server.transport }),
    ]);
    expect(server.log).toEqual(["g1", "g2"]);
    expect(await pendingDayActions(store, EVENT, CAMILLE)).toEqual([]);
  });
});
