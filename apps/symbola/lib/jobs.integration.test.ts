// NFR-02 (lot 65, ADR 0114) — le worker de la file des tâches, contre un vrai PostgreSQL : entre deux
// tours complets, il ne visite que les organisations dont une tâche est due ; une reprise planifiée
// est prise à son heure ; un tour complet a lieu toutes les cinq minutes et rattrape ce que le
// processus ne savait pas. Horloge simulée.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { jobs } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { configureMailTransport, memoryTransport, type MemoryMailTransport } from "@symbola/mail";
import { enqueueEmail, retryDelay, runJob } from "@/modules/hub/jobs";
import { JOBS_FULL_SCAN_INTERVAL_MS, resetJobsScan, runJobsOnce } from "./jobs";

const { sql, db } = createAppConnection();
let mail: MemoryMailTransport;

afterAll(async () => {
  await sql.end();
});

beforeEach(() => {
  mail = memoryTransport();
  configureMailTransport(mail);
  resetJobsScan();
});

afterEach(() => {
  configureMailTransport(null);
});

async function organization(): Promise<string> {
  return (await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`)).id;
}

function message() {
  return { to: `client-${randomUUID()}@example.test`, subject: "Votre programme", text: "Bonjour, voici le programme." };
}

const at = (start: Date, ms: number) => new Date(start.getTime() + ms);

describe("NFR-02 — La file des tâches ne visite que les organisations qui ont une tâche due", { timeout: 120_000 }, () => {
  it("après le tour complet du démarrage, un passage sans tâche due ne visite aucune organisation", async () => {
    const start = new Date("2026-11-18T09:00:00Z");
    await organization();
    const first = await runJobsOnce(start);
    expect(first.full).toBe(true);
    expect(first.visited).toBeGreaterThan(0);
    expect(await runJobsOnce(at(start, 30_000))).toEqual({ visited: 0, full: false });
  });

  it("une reprise planifiée est prise à son heure, par la seule organisation concernée ; un seul envoi", async () => {
    const start = new Date("2026-11-18T10:00:00Z");
    const organizationId = await organization();
    await runJobsOnce(start);
    const jobId = (await enqueueEmail(organizationId, message(), undefined, at(start, 1_000)))!;
    mail.failNext(1);
    expect(await runJob(organizationId, jobId, at(start, 1_000))).toBe("retry");
    // L'inscription signale l'organisation : visitée, rien n'est encore dû ; la reprise est notée.
    expect(await runJobsOnce(at(start, 30_000))).toEqual({ visited: 1, full: false });
    expect(mail.sent).toHaveLength(0);
    expect(await runJobsOnce(at(start, 45_000))).toEqual({ visited: 0, full: false });
    // À l'heure de la reprise, la seule organisation concernée est visitée ; l'e-mail part.
    expect(await runJobsOnce(at(start, 1_000 + retryDelay(1)))).toEqual({ visited: 1, full: false });
    expect(mail.sent).toHaveLength(1);
    const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(jobs));
    expect(row).toMatchObject({ state: "done", attempts: 2 });
  });

  it("une tâche inconnue du processus (inscrite ailleurs) part au tour complet suivant, cinq minutes au plus", async () => {
    const start = new Date("2026-11-18T11:00:00Z");
    const organizationId = await organization();
    await runJobsOnce(start);
    // Inscrite directement en base, comme par un autre processus : le worker ne la connaît pas.
    await withOrganization(db, organizationId, (tx) =>
      tx.insert(jobs).values({ organizationId, kind: "email", idempotencyKey: `email:${randomUUID()}`, state: "pending", payload: message(), runAfter: at(start, 1_000), createdAt: start, updatedAt: start }),
    );
    expect(await runJobsOnce(at(start, 30_000))).toEqual({ visited: 0, full: false });
    expect(mail.sent).toHaveLength(0);
    const full = await runJobsOnce(at(start, JOBS_FULL_SCAN_INTERVAL_MS));
    expect(full.full).toBe(true);
    expect(mail.sent).toHaveLength(1);
  });
});
