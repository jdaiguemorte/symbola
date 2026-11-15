// Lot 35a (HUB-13, DAT-13 ; décisions D2 à D5 ; ADR 0068) — export complet d'une organisation,
// contre de vrais modules (PostgreSQL et stockage réels) : la Propriétaire le demande, il se
// prépare en arrière-plan, l'archive contient toutes les données de l'organisation (JSON, CSV,
// schémas, fichiers, manifeste aux empreintes justes), rien d'une autre organisation, ni ses
// essais, ni ses secrets ; une Planner ne l'obtient pas ; un seul export se prépare à la fois ;
// l'archive expire puis est effacée (horloge simulée) ; une préparation interrompue est reprise.
import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { exportManifestSchema } from "@symbola/contracts";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { eventDocuments, eventLinks, eventLinkSessions, eventTaskAttachments, events, eventClients, eventTasks } from "@symbola/db/schema/events";
import { quotes, quoteSigners, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { vendors } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, PrivateObjectNotFoundError, readPrivateObject, uploadPrivateObject } from "@symbola/files";
import { ZipArchive } from "@symbola/import-engine";
import { addEventTask, createProspect, createProspectSource } from "@/modules/events/service";
import {
  claimOrganizationExport,
  createContact,
  failOrganizationExport,
  getOrganizationExportRetentionDays,
  listOrganizationExports,
  openOrganizationExportArchive,
  ORGANIZATION_EXPORT_STALE_MS,
  OrganizationExportForbiddenError,
  OrganizationExportNotFoundError,
  purgeExpiredOrganizationExports,
  requestOrganizationExport,
} from "@/modules/hub/service";
import { runOrganizationExport } from "./organization-export-jobs";
import { exportEntitySchemas } from "./schemas";

const { sql, db } = createAppConnection();
const DAY_MS = 86_400_000;
const MAILPIT_API = "http://localhost:8025/api/v1";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

afterAll(async () => {
  await sql.end();
});

async function createAtelier(name = `Atelier ${randomUUID()}`) {
  const organization = await createOrganization(db, name);
  const ownerEmail = `camille-${randomUUID()}@symbola.test`;
  const owner = await createUser(db, { organizationId: organization.id, email: ownerEmail, password: "mot-de-passe-export", role: "owner" });
  const planner = await createUser(db, { organizationId: organization.id, email: `planner-${randomUUID()}@symbola.test`, password: "mot-de-passe-export", role: "member" });
  return { organizationId: organization.id, name, ownerId: owner.id, ownerEmail, plannerId: planner.id };
}

type Atelier = Awaited<ReturnType<typeof createAtelier>>;

// Un mariage réel (client, tâche, document, pièce jointe absente du stockage, lien personnel et sa
// session, devis et signataire), un essai (événement is_demo et ce qui s'y rattache), et une fiche
// de prestataire réelle et une d'essai. Les chaînes témoins ne doivent jamais sortir de l'archive
// quand elles sont secrètes, ou qu'elles sont à une autre organisation.
async function seedAtelier(atelier: Atelier, marker: string) {
  const { organizationId } = atelier;
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({
    organizationId,
    createdByUserId: atelier.ownerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Léa", lastName: `Martin ${marker}` }],
    eventDate: "2027-06-12",
  });
  const task = await addEventTask(organizationId, eventId, { label: `Livrer les fleurs ${marker}`, dueDate: "2027-06-11", responsible: "planner" });
  const storage = createStorageClient();
  const documentKey = `${organizationId}/${randomUUID()}.pdf`;
  await uploadPrivateObject(storage, { key: documentKey, body: PDF, contentType: "application/pdf" });
  const secrets = { linkToken: `jeton-${randomUUID()}`, sessionToken: `session-${randomUUID()}`, signingUrl: `https://signature.invalid/s/${randomUUID()}` };
  const demo = { client: `Client Démo ${randomUUID()}`, vendor: `Prestataire Démo ${randomUUID()}` };
  const demoContact = await createContact(organizationId, { firstName: demo.client }, { isDemo: true });
  await withOrganization(db, organizationId, async (tx) => {
    await tx.insert(eventDocuments).values({ organizationId, eventId, label: "Plan de table", fileKey: documentKey, mime: "application/pdf", sizeBytes: PDF.byteLength, uploadedByUserId: atelier.ownerId });
    await tx.insert(eventTaskAttachments).values({
      organizationId,
      eventId,
      taskId: task.id,
      label: "Plan d'accès",
      fileKey: `${organizationId}/${randomUUID()}.pdf`,
      mime: "application/pdf",
      sizeBytes: 10,
      uploadedByUserId: atelier.ownerId,
    });
    const [link] = await tx
      .insert(eventLinks)
      .values({ organizationId, eventId, audience: "client", personName: "Léa", email: `lea-${randomUUID()}@symbola.test`, tokenHash: secrets.linkToken })
      .returning();
    await tx.insert(eventLinkSessions).values({ organizationId, linkId: link!.id, tokenHash: secrets.sessionToken, expiresAt: new Date(Date.now() + DAY_MS) });
    const [quote] = await tx.insert(quotes).values({ organizationId, eventId, number: `D-2027-${randomUUID().slice(0, 6)}`, status: "sent", createdByUserId: atelier.ownerId }).returning();
    const [version] = await tx.insert(quoteVersions).values({ organizationId, quoteId: quote!.id, version: 1 }).returning();
    const [request] = await tx.insert(signatureRequests).values({ organizationId, versionId: version!.id, provider: "fake", externalId: randomUUID(), status: "pending" }).returning();
    await tx.insert(quoteSigners).values({ organizationId, requestId: request!.id, name: "Léa Martin", email: `lea-${randomUUID()}@symbola.test`, billingAddress: "1 rue des Lilas, 60300 Senlis", signingUrl: secrets.signingUrl });
    // L'essai guidé : un événement is_demo, son client et sa tâche, et une fiche d'essai.
    const [demoEvent] = await tx.insert(events).values({ organizationId, isDemo: true, eventDate: "2027-09-01" }).returning();
    // Lot 36a : le client d'essai est un contact d'essai du hub.
    await tx.insert(eventClients).values({ organizationId, eventId: demoEvent!.id, contactId: demoContact.id });
    await tx.insert(eventTasks).values({ organizationId, eventId: demoEvent!.id, label: `Tâche ${demo.client}`, dueDate: "2027-08-01", responsible: "planner" });
    await tx.insert(vendors).values({ organizationId, name: `Fleurs de Lys ${marker}` });
    await tx.insert(vendors).values({ organizationId, name: demo.vendor, isDemo: true });
  });
  return { eventId, documentKey, secrets, demo };
}

async function downloadArchive(atelier: Atelier, exportId: string, now?: Date): Promise<Buffer> {
  const archive = await openOrganizationExportArchive(db, { organizationId: atelier.organizationId, userId: atelier.ownerId, exportId, ...(now ? { now } : {}) });
  expect(archive.fileName).toMatch(/^symbola-export-\d{4}-\d{2}-\d{2}\.zip$/);
  return Buffer.from(await new Response(archive.stream).arrayBuffer());
}

function entries(bytes: Buffer): Map<string, Uint8Array> {
  const zip = new ZipArchive(bytes, 200 * 1024 * 1024);
  return new Map(zip.names().map((name) => [name, zip.read(name)!]));
}

function rowsOf(content: Map<string, Uint8Array>, entity: string): Record<string, unknown>[] {
  return JSON.parse(new TextDecoder().decode(content.get(`json/${entity}.json`)!)) as Record<string, unknown>[];
}

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

async function exportNow(atelier: Atelier, now: Date) {
  const requested = await requestOrganizationExport(db, { organizationId: atelier.organizationId, userId: atelier.ownerId, now });
  expect(requested.outcome).toBe("requested");
  expect(await runOrganizationExport(atelier.organizationId, () => now)).toBe(true);
  const [view] = await listOrganizationExports(db, atelier.organizationId, now);
  return view!;
}

describe("HUB-13 — Export complet en libre-service : données en CSV et JSON, documents en archive", () => {
  it("la Propriétaire demande l'export, il se prépare en arrière-plan ; l'archive contient toutes les données de l'organisation, ses documents, et un manifeste aux empreintes justes", async () => {
    const atelier = await createAtelier();
    const other = await createAtelier();
    const marker = randomUUID();
    const foreign = `Organisation B ${randomUUID()}`;
    const seeded = await seedAtelier(atelier, marker);
    await seedAtelier(other, foreign);

    const now = new Date();
    const requested = await requestOrganizationExport(db, { organizationId: atelier.organizationId, userId: atelier.ownerId, now });
    expect(requested.export.status).toBe("pending");
    expect(await runOrganizationExport(atelier.organizationId)).toBe(true);
    // Plus rien à préparer ensuite.
    expect(await runOrganizationExport(atelier.organizationId)).toBe(false);
    const [view] = await listOrganizationExports(db, atelier.organizationId);
    expect(view).toMatchObject({ id: requested.export.id, status: "ready", downloadable: true, missingFiles: 1, filesTotal: 2 });

    const bytes = await downloadArchive(atelier, view!.id);
    const content = entries(bytes);
    const manifest = exportManifestSchema.parse(JSON.parse(new TextDecoder().decode(content.get("manifest.json")!)));
    expect(manifest.organization).toEqual({ id: atelier.organizationId, name: atelier.name });
    // Chaque entrée annoncée est là, avec son empreinte.
    for (const [name, digest] of Object.entries(manifest.checksums)) expect(sha256(content.get(name)!), name).toBe(digest);
    for (const file of manifest.files) expect(sha256(content.get(file.path)!), file.path).toBe(file.sha256);
    expect(content.has("LISEZMOI.txt")).toBe(true);
    // Chaque entité du format a son JSON, son CSV et son schéma, même vide.
    expect(manifest.entities.map((entity) => `${entity.module}/${entity.name}`).sort()).toEqual(exportEntitySchemas().map((entity) => `${entity.module}/${entity.name}`).sort());
    for (const entity of manifest.entities) {
      expect(content.has(entity.json) && content.has(entity.csv) && content.has(entity.schema), entity.name).toBe(true);
      expect(rowsOf(content, `${entity.module}/${entity.name}`)).toHaveLength(entity.rows);
    }

    // Les données de l'organisation : son événement réel, son client, sa tâche, sa fiche, son équipe, son journal.
    expect(rowsOf(content, "events/events").map((row) => row.id)).toEqual([seeded.eventId]);
    // Lot 36a (CRM-03) : le client est un contact du hub ; event_clients n'est que le lien.
    expect(rowsOf(content, "hub/contacts").map((row) => row.lastName)).toEqual([`Martin ${marker}`]);
    expect(rowsOf(content, "events/event_clients").map((row) => row.contactId)).toEqual([rowsOf(content, "hub/contacts")[0]!.id]);
    expect(rowsOf(content, "events/event_tasks").map((row) => row.label)).toEqual([`Livrer les fleurs ${marker}`]);
    expect(rowsOf(content, "vendors/vendors").map((row) => row.name)).toEqual([`Fleurs de Lys ${marker}`]);
    expect(rowsOf(content, "hub/team_members").map((row) => row.role).sort()).toEqual(["member", "owner"]);
    expect(rowsOf(content, "hub/activity_journal").some((row) => row.action === "hub.organization_export.requested")).toBe(true);
    // Le document est dans l'archive, à la place de sa clé de stockage ; la pièce jointe absente est signalée.
    const [document] = rowsOf(content, "events/event_documents");
    expect(document!.fileKey).toMatch(/^fichiers\/events\/event_documents\/.+-file\.pdf$/);
    expect(Buffer.from(content.get(String(document!.fileKey))!).equals(PDF)).toBe(true);
    expect(manifest.missingFiles).toEqual([expect.objectContaining({ entity: "events/event_task_attachments", field: "fileKey" })]);
    // Le CSV : point-virgule, une ligne par ligne, mêmes colonnes que le schéma.
    const csv = new TextDecoder().decode(content.get("csv/hub/contacts.csv")!);
    expect(csv.split("\r\n")[0]).toContain("firstName;lastName");
    expect(csv).toContain(`Martin ${marker}`);

    // Rien d'une autre organisation, aucun essai, aucun secret, aucune clé de stockage.
    const everything = [...content.entries()].filter(([name]) => !name.startsWith("fichiers/")).map(([, data]) => new TextDecoder().decode(data)).join("\n");
    for (const forbidden of [foreign, other.organizationId, seeded.demo.client, seeded.demo.vendor, seeded.secrets.linkToken, seeded.secrets.sessionToken, seeded.secrets.signingUrl, seeded.documentKey]) {
      expect(everything.includes(forbidden), forbidden).toBe(false);
    }

    // Journal : demandé, préparé (par le système), téléchargé.
    const journal = await withOrganization(db, atelier.organizationId, (tx) =>
      tx.select({ action: auditEntries.action, actorKind: auditEntries.actorKind }).from(auditEntries).where(and(eq(auditEntries.organizationId, atelier.organizationId), eq(auditEntries.objectId, view!.id))),
    );
    expect(journal.map((row) => row.action).sort()).toEqual(["hub.organization_export.downloaded", "hub.organization_export.ready", "hub.organization_export.requested"]);
    expect(journal.find((row) => row.action === "hub.organization_export.ready")?.actorKind).toBe("system");

    // La Propriétaire est prévenue par e-mail, sans l'archive.
    const search = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${atelier.ownerEmail}`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string; Subject: string; Attachments: number }[] };
    const ready = messages.find((message) => message.Subject === "Votre export Symbola est prêt");
    expect(ready).toBeDefined();
    expect(ready!.Attachments).toBe(0);
  });

  it("DAT-13 — chaque ligne exportée suit le schéma publié de son entité", async () => {
    const atelier = await createAtelier();
    await seedAtelier(atelier, randomUUID());
    const view = await exportNow(atelier, new Date());
    const content = entries(await downloadArchive(atelier, view.id));
    for (const entity of exportEntitySchemas()) {
      for (const row of rowsOf(content, `${entity.module}/${entity.name}`)) {
        const parsed = entity.schema.safeParse(row);
        expect(parsed.success, `${entity.module}/${entity.name} : ${parsed.success ? "" : parsed.error.message}`).toBe(true);
      }
    }
  });

  it("D5 — une Planner ne demande ni ne télécharge un export ; une autre organisation n'en voit rien", async () => {
    const atelier = await createAtelier();
    const other = await createAtelier();
    await expect(requestOrganizationExport(db, { organizationId: atelier.organizationId, userId: atelier.plannerId })).rejects.toBeInstanceOf(OrganizationExportForbiddenError);
    const view = await exportNow(atelier, new Date());
    await expect(openOrganizationExportArchive(db, { organizationId: atelier.organizationId, userId: atelier.plannerId, exportId: view.id })).rejects.toBeInstanceOf(OrganizationExportForbiddenError);
    // La Propriétaire d'une autre organisation : ni dans sa liste, ni téléchargeable chez elle (objet inexistant).
    expect((await listOrganizationExports(db, other.organizationId)).map((item) => item.id)).not.toContain(view.id);
    await expect(openOrganizationExportArchive(db, { organizationId: other.organizationId, userId: other.ownerId, exportId: view.id })).rejects.toBeInstanceOf(OrganizationExportNotFoundError);
    // Ni par son contexte d'organisation : la RLS ne laisse rien voir.
    await expect(claimOrganizationExport(db, other.organizationId)).resolves.toBeNull();
    // Une Propriétaire d'une autre organisation n'est pas Propriétaire de celle-ci.
    await expect(requestOrganizationExport(db, { organizationId: atelier.organizationId, userId: other.ownerId })).rejects.toBeInstanceOf(OrganizationExportForbiddenError);
  });

  it("un seul export se prépare à la fois, même demandé deux fois ensemble ; un export en échec n'empêche pas d'en demander un autre", async () => {
    const atelier = await createAtelier();
    const input = { organizationId: atelier.organizationId, userId: atelier.ownerId };
    const outcomes = await Promise.all([requestOrganizationExport(db, input), requestOrganizationExport(db, input)]);
    expect(outcomes.map((outcome) => outcome.outcome).sort()).toEqual(["already_active", "requested"]);
    expect(new Set(outcomes.map((outcome) => outcome.export.id)).size).toBe(1);
    expect((await requestOrganizationExport(db, input)).outcome).toBe("already_active");
    const claimed = await claimOrganizationExport(db, atelier.organizationId);
    await failOrganizationExport(db, { organizationId: atelier.organizationId, exportId: claimed!.id, error: "failed" });
    const [failed] = await listOrganizationExports(db, atelier.organizationId);
    expect(failed).toMatchObject({ status: "failed", error: "failed", downloadable: false });
    expect((await requestOrganizationExport(db, input)).outcome).toBe("requested");
  });

  it("D4 — l'archive se télécharge jusqu'à son expiration (la veille oui, le jour même non), puis la purge l'efface ; la trace reste", async () => {
    const atelier = await createAtelier();
    await seedAtelier(atelier, randomUUID());
    const readyAt = new Date("2026-11-15T10:00:00.000Z");
    const view = await exportNow(atelier, readyAt);
    const retention = await getOrganizationExportRetentionDays(db);
    expect(view.expiresAt!.getTime()).toBe(readyAt.getTime() + retention * DAY_MS);
    const dayBefore = new Date(view.expiresAt!.getTime() - DAY_MS);
    const expiry = view.expiresAt!;
    expect((await downloadArchive(atelier, view.id, dayBefore)).length).toBeGreaterThan(0);
    await expect(openOrganizationExportArchive(db, { organizationId: atelier.organizationId, userId: atelier.ownerId, exportId: view.id, now: expiry })).rejects.toBeInstanceOf(OrganizationExportNotFoundError);

    const key = `organization-exports/${atelier.organizationId}/${view.id}.zip`;
    expect((await readPrivateObject(createStorageClient(), key)).data.length).toBeGreaterThan(0);
    expect(await purgeExpiredOrganizationExports(db, [atelier.organizationId], dayBefore)).toBe(0);
    expect(await purgeExpiredOrganizationExports(db, [atelier.organizationId], expiry)).toBe(1);
    await expect(readPrivateObject(createStorageClient(), key)).rejects.toBeInstanceOf(PrivateObjectNotFoundError);
    const [trace] = await listOrganizationExports(db, atelier.organizationId, expiry);
    expect(trace).toMatchObject({ id: view.id, status: "ready", downloadable: false });
    expect(trace!.rowCount).toBeGreaterThan(0);
  });

  it("une préparation interrompue (serveur redémarré) est reprise quand son battement s'arrête, pas avant", async () => {
    const atelier = await createAtelier();
    const start = new Date("2026-11-15T10:00:00.000Z");
    await requestOrganizationExport(db, { organizationId: atelier.organizationId, userId: atelier.ownerId, now: start });
    const first = await claimOrganizationExport(db, atelier.organizationId, start);
    expect(first).not.toBeNull();
    // Le serveur s'arrête : la ligne reste « en préparation ».
    expect(await claimOrganizationExport(db, atelier.organizationId, new Date(start.getTime() + ORGANIZATION_EXPORT_STALE_MS - 1000))).toBeNull();
    const resumedAt = new Date(start.getTime() + ORGANIZATION_EXPORT_STALE_MS + 1000);
    expect(await runOrganizationExport(atelier.organizationId, () => resumedAt)).toBe(true);
    const [view] = await listOrganizationExports(db, atelier.organizationId, resumedAt);
    expect(view).toMatchObject({ id: first!.id, status: "ready", downloadable: true });
  });
});
