// Lot 40b (ARC-10, décision D9, ADR 0076) — file des tâches de fond d'une organisation. Un e-mail
// s'y inscrit (avec sa clé d'unicité), est tenté aussitôt, puis repris par le worker si le serveur
// d'envoi ne répond pas (délais croissants, cinq tentatives). Garanties :
// - une tâche inscrite deux fois avec la même clé, ou rejouée, n'envoie qu'un e-mail ;
// - une tâche n'est prise que par un seul passage (UPDATE … WHERE state = 'pending') ;
// - une tâche interrompue en plein envoi (processus arrêté) n'est pas renvoyée : « interrupted »,
//   l'envoi a pu partir ou non ; au plus une fois plutôt qu'en double ;
// - le contenu (destinataire, message) s'efface dès la fin, réussie ou non ; la ligne garde le
//   genre, l'état et les dates 30 jours. Aucune donnée personnelle au journal : le nom de l'erreur.
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { jobs } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { currentMailTransport, type SendMailInput } from "@symbola/mail";
import { hasTerms, prepareTerms, recordMatches, type PersonTerms } from "@symbola/privacy";
import { CLOSURE_EMAIL_KEY_PREFIX, isOrganizationClosed } from "./organization-closures";

export const JOB_MAX_ATTEMPTS = 5;
// Délai avant la tentative suivante, après la 1re, 2e, 3e et 4e.
export const JOB_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;
const LOCK_MS = 5 * 60_000;

export function retryDelay(attempts: number): number {
  return JOB_RETRY_DELAYS_MS[Math.min(Math.max(attempts, 1), JOB_RETRY_DELAYS_MS.length) - 1] ?? 60 * 60_000;
}
const BATCH = 50;
export const JOB_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type StoredAttachment = { filename: string; contentType: string; contentBase64: string; cid?: string };
type StoredEmail = Omit<SendMailInput, "attachments"> & { attachments?: StoredAttachment[] };

function store(message: SendMailInput): StoredEmail {
  const { attachments, ...rest } = message;
  return {
    ...rest,
    ...(attachments ? { attachments: attachments.map((attachment) => ({ filename: attachment.filename, contentType: attachment.contentType, contentBase64: attachment.content.toString("base64"), ...(attachment.cid ? { cid: attachment.cid } : {}) })) } : {}),
  };
}

function restore(stored: StoredEmail): SendMailInput {
  const { attachments, ...rest } = stored;
  return {
    ...rest,
    ...(attachments ? { attachments: attachments.map((attachment) => ({ filename: attachment.filename, contentType: attachment.contentType, content: Buffer.from(attachment.contentBase64, "base64"), ...(attachment.cid ? { cid: attachment.cid } : {}) })) } : {}),
  };
}

// Clé par défaut : unique, l'e-mail n'est dédoublonné que contre lui-même (un rejeu). Une clé
// donnée par l'appelant ne doit porter aucune donnée personnelle (des identifiants).
export function newJobKey(): string {
  return `email:${randomUUID()}`;
}

export async function jobKeyExists(organizationId: string, idempotencyKey: string): Promise<boolean> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.idempotencyKey, idempotencyKey)).limit(1));
  return rows.length > 0;
}

// Inscrit l'e-mail ; null si la clé est déjà inscrite (rien de plus ne part).
export async function enqueueEmail(organizationId: string, message: SendMailInput, idempotencyKey: string = newJobKey(), now: Date = new Date()): Promise<string | null> {
  // Lot 35c (RGP-11, ADR 0100) : un espace fermé n'envoie plus rien, sauf les e-mails de sa fermeture.
  if (!idempotencyKey.startsWith(CLOSURE_EMAIL_KEY_PREFIX) && (await isOrganizationClosed(appDatabase(), organizationId))) return null;
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .insert(jobs)
      .values({ organizationId, kind: "email", idempotencyKey, state: "pending", payload: store(message), runAfter: now, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: [jobs.organizationId, jobs.idempotencyKey] })
      .returning({ id: jobs.id }),
  );
  return rows[0]?.id ?? null;
}

export type JobOutcome = "done" | "retry" | "failed" | "skipped";

// Prend la tâche (si elle est due et libre), l'envoie, puis la termine ou la replanifie.
export async function runJob(organizationId: string, jobId: string, now: Date = new Date()): Promise<JobOutcome> {
  const db = appDatabase();
  // Lot 35c : un e-mail inscrit avant la fermeture attend (il part si l'espace est rouvert).
  if (await isOrganizationClosed(db, organizationId)) {
    const [pending] = await withOrganization(db, organizationId, (tx) => tx.select({ key: jobs.idempotencyKey }).from(jobs).where(eq(jobs.id, jobId)));
    if (!pending?.key.startsWith(CLOSURE_EMAIL_KEY_PREFIX)) return "skipped";
  }
  const [claimed] = await withOrganization(db, organizationId, (tx) =>
    tx
      .update(jobs)
      .set({ state: "running", lockedUntil: new Date(now.getTime() + LOCK_MS), attempts: sql`${jobs.attempts} + 1`, updatedAt: now })
      .where(and(eq(jobs.id, jobId), eq(jobs.state, "pending"), lte(jobs.runAfter, now)))
      .returning({ payload: jobs.payload, attempts: jobs.attempts }),
  );
  if (!claimed?.payload) return "skipped";
  try {
    await currentMailTransport().send(restore(claimed.payload as StoredEmail));
  } catch (error) {
    const errorName = (error instanceof Error ? error.name : "Error").slice(0, 200);
    const last = claimed.attempts >= JOB_MAX_ATTEMPTS;
    console.error("tâche de fond : envoi d'e-mail en échec", { jobId, attempts: claimed.attempts, error: errorName, final: last });
    await withOrganization(db, organizationId, (tx) =>
      tx
        .update(jobs)
        .set(
          last
            ? { state: "failed", payload: null, lockedUntil: null, lastError: errorName, finishedAt: now, updatedAt: now }
            : { state: "pending", lockedUntil: null, lastError: errorName, runAfter: new Date(now.getTime() + retryDelay(claimed.attempts)), updatedAt: now },
        )
        .where(and(eq(jobs.id, jobId), eq(jobs.state, "running"))),
    );
    return last ? "failed" : "retry";
  }
  await withOrganization(db, organizationId, (tx) =>
    tx
      .update(jobs)
      .set({ state: "done", payload: null, lockedUntil: null, lastError: null, finishedAt: now, updatedAt: now })
      .where(and(eq(jobs.id, jobId), eq(jobs.state, "running"))),
  );
  return "done";
}

// Inscrit puis tente aussitôt : l'e-mail part comme avant, et repart plus tard si le serveur
// d'envoi ne répond pas. Rien ne part si la clé est déjà inscrite.
export async function queueAndSendEmail(organizationId: string, message: SendMailInput, idempotencyKey?: string): Promise<JobOutcome | "duplicate"> {
  const jobId = await enqueueEmail(organizationId, message, idempotencyKey);
  if (!jobId) return "duplicate";
  return runJob(organizationId, jobId);
}

export type JobsPass = { done: number; retried: number; failed: number; interrupted: number; purged: number };

// Passage du worker pour une organisation : tâches interrompues, tâches dues, purge.
export async function runDueJobs(organizationId: string, now: Date = new Date()): Promise<JobsPass> {
  const db = appDatabase();
  const pass: JobsPass = { done: 0, retried: 0, failed: 0, interrupted: 0, purged: 0 };
  const interrupted = await withOrganization(db, organizationId, (tx) =>
    tx
      .update(jobs)
      .set({ state: "interrupted", payload: null, lockedUntil: null, finishedAt: now, updatedAt: now })
      .where(and(eq(jobs.state, "running"), lt(jobs.lockedUntil, now)))
      .returning({ id: jobs.id }),
  );
  for (const { id } of interrupted) console.error("tâche de fond : envoi interrompu, non renvoyé", { jobId: id });
  pass.interrupted = interrupted.length;

  const due = await withOrganization(db, organizationId, (tx) =>
    tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.state, "pending"), lte(jobs.runAfter, now)))
      .orderBy(asc(jobs.runAfter))
      .limit(BATCH),
  );
  for (const { id } of due) {
    const outcome = await runJob(organizationId, id, now);
    if (outcome === "done") pass.done += 1;
    else if (outcome === "retry") pass.retried += 1;
    else if (outcome === "failed") pass.failed += 1;
  }

  const purged = await withOrganization(db, organizationId, (tx) =>
    tx
      .delete(jobs)
      .where(and(inArray(jobs.state, ["done", "failed", "interrupted"]), lt(jobs.finishedAt, new Date(now.getTime() - JOB_RETENTION_DAYS * DAY_MS))))
      .returning({ id: jobs.id }),
  );
  pass.purged = purged.length;
  return pass;
}

// RGPD (privacy/v1) : un e-mail encore en attente qui vise la personne (destinataire ou contenu) ;
// l'effacer le supprime de la file (il ne partira pas).
export async function findPendingEmailsByTerms(organizationId: string, rawTerms: PersonTerms): Promise<{ id: string; subject: string; fields: Record<string, string> }[]> {
  const terms = prepareTerms(rawTerms);
  if (!hasTerms(terms)) return [];
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ id: jobs.id, payload: jobs.payload }).from(jobs).where(inArray(jobs.state, ["pending", "running"])));
  return rows.flatMap((row) => {
    const email = row.payload as StoredEmail | null;
    if (!email) return [];
    const fields = { to: email.to, subject: email.subject, text: email.text };
    return recordMatches(Object.values(fields), terms) ? [{ id: row.id, subject: email.subject, fields }] : [];
  });
}

export async function listPendingEmailIds(organizationId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ id: jobs.id }).from(jobs).where(and(inArray(jobs.id, ids), inArray(jobs.state, ["pending", "running"]))));
  return rows.map((row) => row.id);
}

export async function erasePendingEmails(organizationId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.delete(jobs).where(inArray(jobs.id, ids)).returning({ id: jobs.id }));
  return rows.map((row) => row.id);
}
