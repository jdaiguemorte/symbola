// Lot 35c (RGP-11 ; décision D8 de Julien du 18/11/2026 ; ADR 0100) — fermeture d'un espace, contre de
// vrais modules (PostgreSQL et stockage réels), à l'horloge simulée.
// - Seule la Propriétaire, avec la double authentification et le nom de l'espace, ferme l'espace.
// - Pendant les 30 jours : liens des tiers refusés, aucun envoi (sauf ceux de la fermeture),
//   traitements de fond qui l'ignorent ; la fermeture s'annule (rouvrir) avant la date.
// - Préavis sept jours avant ; la veille, rien n'est effacé ; le jour même, tout l'est, fichiers et
//   comptes compris ; la base refuse avant l'heure, même si l'horloge de l'app se trompe, et refuse
//   une fermeture antidatée ; une autre organisation reste intacte ; seule reste la trace.
// - Rejeu après une restauration : un espace supprimé qui revient est effacé de nouveau.
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { organizationClosures, organizations, users } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, listPrivateObjectKeys, PrivateObjectNotFoundError, readPrivateObject } from "@symbola/files";
import { seedFullAtelier } from "@/lib/test-fixtures/atelier-complet";
import { collectOrganizationData } from "@/lib/export/organization-export";
import { openEventLink } from "@/modules/events/service";
import {
  closeOrganization,
  closureSchedule,
  enqueueEmail,
  getOrganizationClosure,
  listOrganizations,
  listOrganizationsIncludingClosed,
  OrganizationClosureConfirmationError,
  OrganizationClosureForbiddenError,
  OrganizationClosureMfaRequiredError,
  OrganizationNotReopenableError,
  reopenOrganization,
  sendClosureNotice,
} from "@/modules/hub/service";
import { eraseClosedOrganization } from "./organization-closure";
import { replayOrganizationErasures, runOrganizationClosuresOnce } from "./organization-closure-jobs";

const db = appDatabase();
const DAY_MS = 86_400_000;
const admin = postgres({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "symbola",
  username: process.env.POSTGRES_ADMIN_USER ?? "postgres",
  password: process.env.POSTGRES_ADMIN_PASSWORD ?? "",
  max: 1,
  onnotice: () => {},
});
const erasedIdentities: string[] = [];
const fakeIdentityEraser = async (subject: string) => {
  erasedIdentities.push(subject);
};

afterAll(async () => {
  await admin.end();
});

async function nameOf(organizationId: string): Promise<string> {
  const [row] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, organizationId));
  return row!.name;
}

async function plannerOf(organizationId: string): Promise<string> {
  return (await createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-fermeture", role: "member" })).id;
}

async function close(atelier: { organizationId: string; ownerId: string }, now?: Date) {
  return closeOrganization(db, { organizationId: atelier.organizationId, userId: atelier.ownerId, mfaVerified: true, confirmation: await nameOf(atelier.organizationId), ...(now ? { now } : {}) });
}

// Ce qu'une restauration ou le temps qui passe font (rôle d'administration) : la fermeture date d'il
// y a 31 jours, sa date de suppression est passée d'une heure.
async function ageClosure(organizationId: string): Promise<void> {
  const closedAt = new Date(Date.now() - 31 * DAY_MS);
  await admin`update hub.organizations set closed_at = ${closedAt}, deletion_due_at = ${new Date(Date.now() - 3_600_000)} where id = ${organizationId}`;
  await admin`update hub.organization_closures set closed_at = ${closedAt}, deletion_due_at = ${new Date(Date.now() - 3_600_000)} where organization_id = ${organizationId} and reopened_at is null`;
}

function linkToken(url: string): string {
  return url.slice(url.indexOf("#") + 1);
}

async function rowCount(organizationId: string): Promise<number> {
  return (await collectOrganizationData(organizationId)).flatMap((module) => module.entities).reduce((sum, entity) => sum + entity.rows.length, 0);
}

let atelier: Awaited<ReturnType<typeof seedFullAtelier>>;
let witness: Awaited<ReturnType<typeof seedFullAtelier>>;

describe("RGP-11 — Fermeture d'un espace et suppression au 30e jour (lot 35c)", { timeout: 240_000 }, () => {
  beforeAll(async () => {
    atelier = await seedFullAtelier();
    witness = await seedFullAtelier();
  }, 120_000);

  it("seule la Propriétaire, avec la double authentification et le nom de l'espace, ferme l'espace ; la suppression est fixée au 30e jour", async () => {
    const other = await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: other.id, email: `owner-${randomUUID()}@example.test`, password: "mot-de-passe-fermeture", role: "owner" });
    const planner = await plannerOf(other.id);
    const input = { organizationId: other.id, confirmation: other.name };
    await expect(closeOrganization(db, { ...input, userId: planner, mfaVerified: true })).rejects.toBeInstanceOf(OrganizationClosureForbiddenError);
    // La Propriétaire d'une autre organisation n'y peut rien.
    await expect(closeOrganization(db, { ...input, userId: atelier.ownerId, mfaVerified: true })).rejects.toBeInstanceOf(OrganizationClosureForbiddenError);
    await expect(closeOrganization(db, { ...input, userId: owner.id, mfaVerified: false })).rejects.toBeInstanceOf(OrganizationClosureMfaRequiredError);
    await expect(closeOrganization(db, { ...input, userId: owner.id, mfaVerified: true, confirmation: "Autre nom" })).rejects.toBeInstanceOf(OrganizationClosureConfirmationError);
    expect(await getOrganizationClosure(db, other.id)).toBeNull();
    const now = new Date();
    const closure = await closeOrganization(db, { ...input, userId: owner.id, mfaVerified: true, confirmation: `  ${other.name} `, now });
    expect(closure.deletionDueAt).toEqual(closureSchedule(now).deletionDueAt);
    const [trace] = await db.select().from(organizationClosures).where(eq(organizationClosures.organizationId, other.id));
    expect(trace).toMatchObject({ closedAt: now, deletionDueAt: closure.deletionDueAt, erasedAt: null });
    // L'e-mail de fermeture part (seul envoi permis d'un espace fermé).
    const mails = (await withOrganization(db, other.id, (tx) => tx.execute(sql`select idempotency_key from hub.jobs where organization_id = ${other.id}`))) as unknown as { idempotency_key: string }[];
    expect(mails.map((mail) => mail.idempotency_key)).toEqual([expect.stringMatching(/^closure:.*:closed:/)]);
  });

  it("pendant la fermeture : liens des tiers refusés, aucun envoi, traitements de fond qui l'ignorent ; rouvrir avant la date rétablit tout", async () => {
    const token = linkToken(atelier.links[0]!.url);
    expect((await openEventLink(token)).outcome).not.toBe("invalid");
    await close(atelier);
    expect((await openEventLink(token)).outcome).toBe("invalid");
    expect(await enqueueEmail(atelier.organizationId, { to: "client@example.test", subject: "Rappel", text: "Rappel" })).toBeNull();
    expect((await listOrganizations(db)).some((organization) => organization.id === atelier.organizationId)).toBe(false);
    expect((await listOrganizationsIncludingClosed(db)).some((organization) => organization.id === atelier.organizationId)).toBe(true);
    // Une Planner ne rouvre pas ; la Propriétaire, si.
    const planner = await plannerOf(atelier.organizationId);
    await expect(reopenOrganization(db, { organizationId: atelier.organizationId, userId: planner, mfaVerified: true })).rejects.toBeInstanceOf(OrganizationClosureForbiddenError);
    await reopenOrganization(db, { organizationId: atelier.organizationId, userId: atelier.ownerId, mfaVerified: true });
    expect(await getOrganizationClosure(db, atelier.organizationId)).toBeNull();
    expect((await openEventLink(token)).outcome).not.toBe("invalid");
    expect(await enqueueEmail(atelier.organizationId, { to: "client@example.test", subject: "Rappel", text: "Rappel" })).not.toBeNull();
    const [trace] = await db.select().from(organizationClosures).where(eq(organizationClosures.organizationId, atelier.organizationId));
    expect(trace!.reopenedAt).not.toBeNull();
  });

  it("préavis sept jours avant, une seule fois ; la veille, rien n'est effacé ; la base refuse avant l'heure, même si l'horloge de l'app se trompe, et refuse une fermeture antidatée", async () => {
    const closedAt = new Date();
    const closure = await close(atelier, closedAt);
    expect(await sendClosureNotice(db, { organizationId: atelier.organizationId, now: new Date(closure.noticeAt.getTime() - 1) })).toBe(false);
    expect(await sendClosureNotice(db, { organizationId: atelier.organizationId, now: closure.noticeAt })).toBe(true);
    expect(await sendClosureNotice(db, { organizationId: atelier.organizationId, now: new Date(closure.noticeAt.getTime() + DAY_MS) })).toBe(false);
    const before = await rowCount(atelier.organizationId);
    // La veille de la suppression : rien.
    expect(await runOrganizationClosuresOnce({ now: new Date(closure.deletionDueAt.getTime() - DAY_MS), eraseIdentity: fakeIdentityEraser, organizationIds: [atelier.organizationId] })).toMatchObject({ erased: 0 });
    expect(await rowCount(atelier.organizationId)).toBe(before);
    // L'horloge de l'app dit « jour même », celle de la base non : refusé, rien n'est effacé.
    await expect(eraseClosedOrganization({ organizationId: atelier.organizationId, now: closure.deletionDueAt, eraseIdentity: fakeIdentityEraser })).rejects.toThrow();
    expect(await rowCount(atelier.organizationId)).toBe(before);
    // Le rôle applicatif ne peut ni antidater une fermeture, ni avancer la suppression.
    await expect(db.update(organizations).set({ closedAt: new Date(Date.now() - 40 * DAY_MS), deletionDueAt: new Date(Date.now() - 10 * DAY_MS) }).where(eq(organizations.id, atelier.organizationId))).rejects.toThrow();
    await expect(db.update(organizations).set({ deletionDueAt: new Date(closure.deletionDueAt.getTime() - DAY_MS) }).where(eq(organizations.id, atelier.organizationId))).rejects.toThrow();
    // Ni effacer directement une pièce comptable.
    await expect(withOrganization(db, atelier.organizationId, (tx) => tx.execute(sql`delete from quotes.invoices where organization_id = ${atelier.organizationId}`))).rejects.toThrow();
  });

  it("le jour même, tout est effacé, fichiers et comptes compris ; seule reste la trace ; une autre organisation reste intacte", async () => {
    const witnessBefore = await collectOrganizationData(witness.organizationId);
    const storage = createStorageClient();
    expect((await listPrivateObjectKeys(storage, `${atelier.organizationId}/`)).length).toBeGreaterThan(0);
    const team = (await db.execute(sql`select user_id from hub.memberships where organization_id = ${atelier.organizationId}`)) as unknown as { user_id: string }[];
    await ageClosure(atelier.organizationId);
    const pass = await runOrganizationClosuresOnce({ eraseIdentity: fakeIdentityEraser, organizationIds: [atelier.organizationId] });
    expect(pass.erased).toBe(1);
    expect(await db.select().from(organizations).where(eq(organizations.id, atelier.organizationId))).toEqual([]);
    for (const schema of ["hub", "events", "budget", "quotes", "vendors", "guests", "appointments", "floorplans", "core"]) {
      const tables = (await admin`
        select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped
        where n.nspname = ${schema} and c.relkind = 'r' and not (n.nspname = 'hub' and c.relname = 'organization_closures')`) as { name: string }[];
      for (const table of tables) {
        const [left] = await admin.unsafe(`select count(*)::int as count from "${schema}"."${table.name}" where organization_id = $1`, [atelier.organizationId]);
        expect(left!.count, `${schema}.${table.name}`).toBe(0);
      }
    }
    expect(await listPrivateObjectKeys(storage, `${atelier.organizationId}/`)).toEqual([]);
    await expect(readPrivateObject(storage, atelier.documentKey)).rejects.toBeInstanceOf(PrivateObjectNotFoundError);
    // Les comptes de l'équipe, sans autre adhésion, sont effacés.
    for (const member of team) expect(await db.select().from(users).where(eq(users.id, member.user_id))).toEqual([]);
    const [trace] = await db.select().from(organizationClosures).where(and(eq(organizationClosures.organizationId, atelier.organizationId), isNull(organizationClosures.reopenedAt)));
    expect(trace!.erasedAt).not.toBeNull();
    expect(trace!.filesErasedAt).not.toBeNull();
    expect(trace!.erasedRows).toBeGreaterThan(100);
    // La trace ne porte aucune donnée personnelle : des identifiants, des dates et des nombres.
    expect(Object.keys(trace!).sort()).toEqual(["closedAt", "createdAt", "createdBy", "deletionDueAt", "erasedAt", "erasedFiles", "erasedRows", "filesErasedAt", "id", "organizationId", "reopenedAt", "replayedAt", "updatedAt", "updatedBy"]);
    expect(await collectOrganizationData(witness.organizationId)).toEqual(witnessBefore);
    await readPrivateObject(storage, witness.documentKey);
  });

  it("rejeu après une restauration : un espace supprimé qui revient (sauvegarde d'avant sa fermeture) est effacé de nouveau", async () => {
    // La « restauration » : l'organisation et une donnée réapparaissent, ouvertes.
    await admin`insert into hub.organizations (id, name) values (${atelier.organizationId}, 'Atelier restauré')`;
    await admin`insert into events.events (organization_id) values (${atelier.organizationId})`;
    const traces = (await db.select().from(organizationClosures).where(eq(organizationClosures.organizationId, atelier.organizationId))).map((trace) => ({ organizationId: trace.organizationId, closedAt: trace.closedAt, deletionDueAt: trace.deletionDueAt, erasedAt: trace.erasedAt }));
    const result = await replayOrganizationErasures({
      traces,
      eraseIdentity: fakeIdentityEraser,
      restoreClosure: async (trace) => {
        await admin`update hub.organizations set closed_at = ${trace.closedAt}, deletion_due_at = ${trace.deletionDueAt} where id = ${trace.organizationId}`;
      },
    });
    expect(result.replayed).toEqual([atelier.organizationId]);
    expect(await db.select().from(organizations).where(eq(organizations.id, atelier.organizationId))).toEqual([]);
    const [left] = await admin`select count(*)::int as count from events.events where organization_id = ${atelier.organizationId}`;
    expect(left!.count).toBe(0);
    // Une organisation présente qui n'a jamais été supprimée n'est pas touchée.
    expect((await replayOrganizationErasures({ traces: [{ organizationId: witness.organizationId, closedAt: new Date(), deletionDueAt: new Date(), erasedAt: null }], restoreClosure: async () => undefined })).replayed).toEqual([]);
  });

  it("rouvrir après la date de suppression est refusé", async () => {
    const late = await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const owner = await createUser(db, { organizationId: late.id, email: `owner-${randomUUID()}@example.test`, password: "mot-de-passe-fermeture", role: "owner" });
    await closeOrganization(db, { organizationId: late.id, userId: owner.id, mfaVerified: true, confirmation: late.name });
    const closure = await getOrganizationClosure(db, late.id);
    await expect(reopenOrganization(db, { organizationId: late.id, userId: owner.id, mfaVerified: true, now: closure!.deletionDueAt })).rejects.toBeInstanceOf(OrganizationNotReopenableError);
  });
});
