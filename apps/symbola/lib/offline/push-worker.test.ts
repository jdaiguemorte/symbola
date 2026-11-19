// Lot 53 (ARC-09, HUB-15, UX-16 ; D4) — le service worker affiche un push et ouvre, au clic, l'écran où
// agir ; un chemin venu d'ailleurs est remplacé par le centre de notifications. Le fichier est exécuté
// tel quel, dans un bac à sable, avec un faux « self ».
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Listener = (event: Record<string, unknown>) => void;

function loadWorker(windows: { url: string; focus: () => Promise<unknown> }[] = []) {
  const listeners: Record<string, Listener> = {};
  const showNotification = vi.fn(async () => undefined);
  const openWindow = vi.fn(async () => undefined);
  const self = {
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow, claim: vi.fn() },
    location: { origin: "https://symbola.test" },
  };
  runInNewContext(readFileSync(resolve(import.meta.dirname, "..", "..", "public", "sw.js"), "utf8"), { self, URL, caches: {}, fetch, Response, setTimeout, clearTimeout });
  const run = async (type: string, event: Record<string, unknown>) => {
    let waited: Promise<unknown> = Promise.resolve();
    listeners[type]!({ ...event, waitUntil: (promise: Promise<unknown>) => (waited = promise) });
    await waited;
  };
  return { run, showNotification, openWindow };
}

describe("ARC-09 — Notifications push du service worker (lot 53)", () => {
  it("affiche la sorte et l'action, avec le chemin de l'écran où agir", async () => {
    const worker = loadWorker();
    await worker.run("push", { data: { json: () => ({ title: "Devis signé", body: "Voir le devis", url: "/devis/123", tag: "quote_signed:1" }) } });
    expect(worker.showNotification).toHaveBeenCalledWith("Devis signé", expect.objectContaining({ body: "Voir le devis", tag: "quote_signed:1", data: { url: "/devis/123" } }));
  });

  it("refuse une adresse extérieure ou un message illisible : le centre de notifications, sous le nom de Symbola", async () => {
    const worker = loadWorker();
    await worker.run("push", { data: { json: () => ({ title: "x", url: "https://ailleurs.test/piege" }) } });
    expect(worker.showNotification).toHaveBeenLastCalledWith("x", expect.objectContaining({ data: { url: "/notifications" } }));
    await worker.run("push", { data: { json: () => ({ url: "//ailleurs.test" }) } });
    expect(worker.showNotification).toHaveBeenLastCalledWith("Symbola", expect.objectContaining({ data: { url: "/notifications" } }));
    await worker.run("push", { data: { json: () => { throw new Error("illisible"); } } });
    expect(worker.showNotification).toHaveBeenLastCalledWith("Symbola", expect.objectContaining({ data: { url: "/notifications" } }));
  });

  it("au clic, ouvre l'écran de l'action, ou ramène la fenêtre déjà ouverte dessus", async () => {
    const close = vi.fn();
    const worker = loadWorker();
    await worker.run("notificationclick", { notification: { close, data: { url: "/devis/123" } } });
    expect(close).toHaveBeenCalled();
    expect(worker.openWindow).toHaveBeenCalledWith("/devis/123");

    const focus = vi.fn(async () => undefined);
    const focused = loadWorker([{ url: "https://symbola.test/devis/123", focus }]);
    await focused.run("notificationclick", { notification: { close, data: { url: "/devis/123" } } });
    expect(focus).toHaveBeenCalled();
    expect(focused.openWindow).not.toHaveBeenCalled();

    const outside = loadWorker();
    await outside.run("notificationclick", { notification: { close, data: { url: "https://ailleurs.test" } } });
    expect(outside.openWindow).toHaveBeenCalledWith("/notifications");
  });
});
