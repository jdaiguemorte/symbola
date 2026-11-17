// Lot 40b (ARC-10, décision D9, ADR 0076) — file des tâches de fond, contre un vrai PostgreSQL
// (RLS) : une tâche rejouée ou inscrite deux fois n'envoie pas deux fois le même e-mail ; un serveur
// d'envoi injoignable donne une reprise, puis un seul envoi ; le contenu disparaît à la fin. Le
// double d'envoi en mémoire (packages/mail, ARC-12) remplace SMTP. Tests d'abus : une organisation
// ne lit ni ne prend les tâches d'une autre.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { jobs } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { configureMailTransport, memoryTransport, type MemoryMailTransport } from "@symbola/mail";
import { enqueueEmail, findPendingEmailsByTerms, JOB_MAX_ATTEMPTS, JOB_RETENTION_DAYS, queueAndSendEmail, retryDelay, runDueJobs, runJob } from "./jobs";

const { sql, db } = createAppConnection();
let mail: MemoryMailTransport;

afterAll(async () => {
  await sql.end();
});

beforeEach(() => {
  mail = memoryTransport();
  configureMailTransport(mail);
});

afterEach(() => {
  configureMailTransport(null);
});

async function organization(): Promise<string> {
  return (await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`)).id;
}

function message(to = `client-${randomUUID()}@example.test`) {
  return { to, subject: "Votre programme", text: "Bonjour Inès, voici le programme.", attachments: [{ filename: "programme.pdf", content: Buffer.from("%PDF-1.4\n%%EOF\n", "latin1"), contentType: "application/pdf" }] };
}

async function rowsOf(organizationId: string) {
  return withOrganization(db, organizationId, (tx) => tx.select().from(jobs));
}

describe("ARC-10 — Tâches de fond en file, sans doublon", () => {
  it("un e-mail inscrit puis tenté aussitôt part une fois, et son contenu s'efface", async () => {
    const organizationId = await organization();
    const sent = message();
    expect(await queueAndSendEmail(organizationId, sent)).toBe("done");
    expect(mail.sent.map((entry) => entry.to)).toEqual([sent.to]);
    expect(mail.sent[0]?.attachments?.[0]?.content.toString("latin1")).toBe("%PDF-1.4\n%%EOF\n");
    const [row] = await rowsOf(organizationId);
    expect(row).toMatchObject({ state: "done", payload: null, attempts: 1, lastError: null });
    expect(row?.finishedAt).toBeInstanceOf(Date);
  });

  it("une tâche inscrite deux fois avec la même clé n'envoie qu'un e-mail", async () => {
    const organizationId = await organization();
    const key = `signed-copy:${randomUUID()}:${randomUUID()}`;
    expect(await queueAndSendEmail(organizationId, message(), key)).toBe("done");
    expect(await queueAndSendEmail(organizationId, message(), key)).toBe("duplicate");
    expect(mail.sent).toHaveLength(1);
    expect(await rowsOf(organizationId)).toHaveLength(1);
  });

  it("une tâche rejouée, même en même temps, n'envoie qu'un e-mail", async () => {
    const organizationId = await organization();
    const jobId = (await enqueueEmail(organizationId, message()))!;
    const outcomes = await Promise.all([runJob(organizationId, jobId), runJob(organizationId, jobId), runJob(organizationId, jobId)]);
    expect(outcomes.filter((outcome) => outcome === "done")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === "skipped")).toHaveLength(2);
    expect(await runJob(organizationId, jobId)).toBe("skipped");
    expect(mail.sent).toHaveLength(1);
  });

  it("un serveur d'envoi injoignable donne une reprise plus tard, puis un seul envoi", async () => {
    const organizationId = await organization();
    const start = new Date("2026-11-18T09:00:00Z");
    const jobId = (await enqueueEmail(organizationId, message(), undefined, start))!;
    mail.failNext(1);
    expect(await runJob(organizationId, jobId, start)).toBe("retry");
    let [row] = await rowsOf(organizationId);
    expect(row).toMatchObject({ state: "pending", attempts: 1, lastError: "Error" });
    expect(row?.payload).not.toBeNull();
    expect(row?.runAfter.getTime()).toBe(start.getTime() + retryDelay(1));
    // Pas encore l'heure : rien ne part.
    expect((await runDueJobs(organizationId, new Date(start.getTime() + 30_000))).done).toBe(0);
    expect((await runDueJobs(organizationId, new Date(start.getTime() + retryDelay(1)))).done).toBe(1);
    [row] = await rowsOf(organizationId);
    expect(row).toMatchObject({ state: "done", payload: null, attempts: 2 });
    expect(mail.sent).toHaveLength(1);
  });

  it(`après ${JOB_MAX_ATTEMPTS} échecs, la tâche s'arrête et son contenu s'efface`, async () => {
    const organizationId = await organization();
    let now = new Date("2026-11-18T09:00:00Z");
    const jobId = (await enqueueEmail(organizationId, message(), undefined, now))!;
    mail.failNext(JOB_MAX_ATTEMPTS);
    for (let attempt = 1; attempt <= JOB_MAX_ATTEMPTS; attempt += 1) {
      expect(await runJob(organizationId, jobId, now)).toBe(attempt < JOB_MAX_ATTEMPTS ? "retry" : "failed");
      now = new Date(now.getTime() + retryDelay(attempt));
    }
    const [row] = await rowsOf(organizationId);
    expect(row).toMatchObject({ state: "failed", payload: null, attempts: JOB_MAX_ATTEMPTS });
    expect(mail.sent).toHaveLength(0);
  });

  it("une tâche interrompue en plein envoi n'est pas renvoyée : au plus une fois", async () => {
    const organizationId = await organization();
    const start = new Date("2026-11-18T09:00:00Z");
    const jobId = (await enqueueEmail(organizationId, message(), undefined, start))!;
    // Le processus s'arrête après avoir pris la tâche : elle reste « en cours », verrou expiré.
    await withOrganization(db, organizationId, (tx) => tx.update(jobs).set({ state: "running", attempts: 1, lockedUntil: new Date(start.getTime() + 60_000) }).where(eq(jobs.id, jobId)));
    const pass = await runDueJobs(organizationId, new Date(start.getTime() + 10 * 60_000));
    expect(pass).toMatchObject({ interrupted: 1, done: 0 });
    const [row] = await rowsOf(organizationId);
    expect(row).toMatchObject({ state: "interrupted", payload: null });
    expect(mail.sent).toHaveLength(0);
  });

  it(`les lignes terminées sont purgées après ${JOB_RETENTION_DAYS} jours, pas avant`, async () => {
    const organizationId = await organization();
    const start = new Date("2026-11-18T09:00:00Z");
    const jobId = (await enqueueEmail(organizationId, message(), undefined, start))!;
    await runJob(organizationId, jobId, start);
    const day = 24 * 60 * 60 * 1000;
    expect((await runDueJobs(organizationId, new Date(start.getTime() + JOB_RETENTION_DAYS * day - 1000))).purged).toBe(0);
    expect((await runDueJobs(organizationId, new Date(start.getTime() + JOB_RETENTION_DAYS * day + 1000))).purged).toBe(1);
    expect(await rowsOf(organizationId)).toHaveLength(0);
  });

  it("RGPD : un e-mail en attente se retrouve par la personne qu'il vise, plus une fois parti", async () => {
    const organizationId = await organization();
    const to = `ines-${randomUUID()}@example.test`;
    mail.failNext(1);
    await queueAndSendEmail(organizationId, message(to));
    expect((await findPendingEmailsByTerms(organizationId, { email: to })).map((entry) => entry.fields.to)).toEqual([to]);
    await runDueJobs(organizationId, new Date(Date.now() + retryDelay(1) + 1000));
    expect(await findPendingEmailsByTerms(organizationId, { email: to })).toEqual([]);
  });
});

describe("ARC-10 — Isolation de la file entre organisations", () => {
  it("une organisation ne lit ni ne prend les tâches d'une autre", async () => {
    const a = await organization();
    const b = await organization();
    mail.failNext(1);
    await queueAndSendEmail(a, message());
    expect(await rowsOf(b)).toEqual([]);
    const [row] = await rowsOf(a);
    expect(await runJob(b, row!.id, new Date(Date.now() + retryDelay(1) + 1000))).toBe("skipped");
    expect((await runDueJobs(b, new Date(Date.now() + retryDelay(1) + 1000))).done).toBe(0);
    expect(mail.sent).toHaveLength(0);
    await expect(withOrganization(db, b, (tx) => tx.insert(jobs).values({ organizationId: a, kind: "email", idempotencyKey: "intrus", payload: {} }))).rejects.toThrow();
  });

  it("le contenu n'existe que tant que la tâche est à faire ou en cours (contrainte de la base)", async () => {
    const organizationId = await organization();
    await expect(withOrganization(db, organizationId, (tx) => tx.insert(jobs).values({ organizationId, kind: "email", idempotencyKey: "sans-contenu", state: "pending", payload: null }))).rejects.toThrow();
    await expect(withOrganization(db, organizationId, (tx) => tx.insert(jobs).values({ organizationId, kind: "email", idempotencyKey: "fini-avec-contenu", state: "done", payload: { to: "x" } }))).rejects.toThrow();
  });
});
