// Lot 40b (ARC-10, décision D9, ADR 0076) — une tâche périodique ne tourne jamais deux fois en même
// temps : deux processus (ici, deux connexions) se disputent le verrou ; un seul lance les tâches, et
// l'autre prend la relève quand le premier s'arrête (comme au déploiement). Nom de verrou propre au
// test, pour ne pas gêner un serveur de dev qui tournerait.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { whenSchedulerLockHeld } from "./scheduler-lock";

async function eventually(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("délai dépassé");
    await new Promise((done) => setTimeout(done, 25));
  }
}

describe("ARC-10 — Tâches périodiques sans doublon (verrou en base)", () => {
  it("un seul processus lance les tâches ; l'autre prend la relève quand le premier s'arrête", async () => {
    const lockName = `symbola:test:${randomUUID()}`;
    const started: string[] = [];
    const first = whenSchedulerLockHeld(() => started.push("premier"), { lockName, retryMs: 50 });
    await eventually(() => first.held());
    const second = whenSchedulerLockHeld(() => started.push("second"), { lockName, retryMs: 50 });
    await new Promise((done) => setTimeout(done, 300));
    expect(started).toEqual(["premier"]);
    expect(second.held()).toBe(false);

    await first.release();
    await eventually(() => second.held());
    expect(started).toEqual(["premier", "second"]);
    await second.release();
  });
});
