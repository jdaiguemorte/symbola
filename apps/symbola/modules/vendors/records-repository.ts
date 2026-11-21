// Lot 48a (PRE-05, PRE-06, PRE-10, SEC-27, DAT-08 ; ADR 0093) — accès aux données des pièces, des
// changements d'IBAN, de la note confidentielle et des champs de lieu. Jamais importé hors de
// modules/vendors/ (ADR 0011). Chaque requête passe par withOrganization (RLS, CLAUDE.md § 5). Les
// valeurs chiffrées arrivent déjà chiffrées : ce fichier ne voit jamais un IBAN en clair.
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { vendorBankChanges, vendorDocumentKinds, vendorDocuments, vendors, vendorSettings, vendorTypeFields, vendorTypeLinks, vendorTypes } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";

export type VendorDocumentKindRow = typeof vendorDocumentKinds.$inferSelect;
export type VendorDocumentRow = typeof vendorDocuments.$inferSelect;
export type VendorBankChangeRow = typeof vendorBankChanges.$inferSelect;
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return await withOrganization(appDatabase(), organizationId, fn);
}

// PRE-05 — natures de pièces, posées une fois depuis les données de départ.

export function seedDocumentKindRows(organizationId: string, kinds: { key: string; label: string; expires: boolean }[]): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`vendors.document_kinds:${organizationId}`}))`);
    const [settings] = await tx.select({ seededAt: vendorSettings.documentKindsSeededAt }).from(vendorSettings);
    if (settings?.seededAt) return;
    const existing = await tx.select({ starterKey: vendorDocumentKinds.starterKey }).from(vendorDocumentKinds);
    const known = new Set(existing.map((row) => row.starterKey));
    for (const [position, kind] of kinds.entries()) {
      if (known.has(kind.key)) continue;
      await tx.insert(vendorDocumentKinds).values({ organizationId, label: kind.label, expires: kind.expires, starterKey: kind.key, position });
    }
    const now = new Date();
    await tx
      .insert(vendorSettings)
      .values({ organizationId, documentKindsSeededAt: now })
      .onConflictDoUpdate({ target: vendorSettings.organizationId, set: { documentKindsSeededAt: now, updatedAt: now } });
  });
}

export function findDocumentKindRows(organizationId: string): Promise<VendorDocumentKindRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx.select().from(vendorDocumentKinds).where(isNull(vendorDocumentKinds.archivedAt)).orderBy(asc(vendorDocumentKinds.position), asc(vendorDocumentKinds.createdAt)),
  );
}

export function insertDocumentKindRow(organizationId: string, values: { label: string; expires: boolean }): Promise<VendorDocumentKindRow> {
  return inOrganization(organizationId, async (tx) => {
    const [{ next } = { next: 0 }] = await tx.select({ next: sql<number>`coalesce(max(${vendorDocumentKinds.position}) + 1, 0)::int` }).from(vendorDocumentKinds);
    const [row] = await tx.insert(vendorDocumentKinds).values({ organizationId, ...values, position: next }).returning();
    if (!row) throw new Error("insertion de la nature de pièce échouée");
    return row;
  });
}

export function archiveDocumentKindRow(organizationId: string, kindId: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) =>
    (await tx.update(vendorDocumentKinds).set({ archivedAt: new Date() }).where(eq(vendorDocumentKinds.id, kindId)).returning({ id: vendorDocumentKinds.id })).length > 0,
  );
}

// PRE-05 — délai d'alerte (jours avant la fin de validité).

export function findDocumentAlertDays(organizationId: string): Promise<number | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select({ days: vendorSettings.documentAlertDays }).from(vendorSettings);
    return row?.days ?? null;
  });
}

export function saveDocumentAlertDays(organizationId: string, days: number): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx
      .insert(vendorSettings)
      .values({ organizationId, documentAlertDays: days })
      .onConflictDoUpdate({ target: vendorSettings.organizationId, set: { documentAlertDays: days, updatedAt: new Date() } });
  });
}

// PRE-05 — pièces.

export type DocumentWithKind = { document: VendorDocumentRow; kindLabel: string; vendorName: string };

export function findDocumentRows(organizationId: string, filter: { vendorIds?: string[]; documentId?: string } = {}): Promise<DocumentWithKind[]> {
  return inOrganization(organizationId, async (tx) => {
    const conditions = [
      ...(filter.vendorIds ? [inArray(vendorDocuments.vendorId, filter.vendorIds.length > 0 ? filter.vendorIds : ["00000000-0000-0000-0000-000000000000"])] : []),
      ...(filter.documentId ? [eq(vendorDocuments.id, filter.documentId)] : []),
    ];
    const rows = await tx
      .select({ document: vendorDocuments, kindLabel: vendorDocumentKinds.label, vendorName: vendors.name })
      .from(vendorDocuments)
      .innerJoin(vendorDocumentKinds, eq(vendorDocumentKinds.id, vendorDocuments.kindId))
      .innerJoin(vendors, eq(vendors.id, vendorDocuments.vendorId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(vendorDocumentKinds.position), desc(vendorDocuments.createdAt));
    return rows;
  });
}

export function insertDocumentRow(
  organizationId: string,
  values: Omit<typeof vendorDocuments.$inferInsert, "organizationId" | "id">,
  audit?: { action: "vendors.document.requested" | "vendors.document.received" },
): Promise<VendorDocumentRow> {
  return inOrganization(organizationId, async (tx) => {
    const [vendor] = await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, values.vendorId));
    const [kind] = await tx.select({ id: vendorDocumentKinds.id }).from(vendorDocumentKinds).where(eq(vendorDocumentKinds.id, values.kindId));
    if (!vendor || !kind) throw new Error("fiche ou nature de pièce introuvable");
    const [row] = await tx.insert(vendorDocuments).values({ organizationId, ...values }).returning();
    if (!row) throw new Error("insertion de la pièce échouée");
    if (audit) await appendAudit(tx, { organizationId, action: audit.action, objectId: values.vendorId, details: { documentId: row.id } });
    return row;
  });
}

export function updateDocumentRow(
  organizationId: string,
  documentId: string,
  values: Partial<Omit<typeof vendorDocuments.$inferInsert, "organizationId" | "id" | "vendorId">>,
  options: { onlyIfStatus?: VendorDocumentRow["status"]; vendorId?: string; audit?: "vendors.document.received" | "vendors.document.verified" } = {},
): Promise<VendorDocumentRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .update(vendorDocuments)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(vendorDocuments.id, documentId),
          ...(options.onlyIfStatus ? [eq(vendorDocuments.status, options.onlyIfStatus)] : []),
          ...(options.vendorId ? [eq(vendorDocuments.vendorId, options.vendorId)] : []),
        ),
      )
      .returning();
    if (row && options.audit) await appendAudit(tx, { organizationId, action: options.audit, objectId: row.vendorId, details: { documentId: row.id } });
    return row ?? null;
  });
}

export function deleteDocumentRow(organizationId: string, documentId: string): Promise<VendorDocumentRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.delete(vendorDocuments).where(eq(vendorDocuments.id, documentId)).returning())[0] ?? null);
}

// PRE-10, SEC-27, DAT-08 — IBAN chiffré et journal de ses changements.

export type VendorBankRow = { id: string; name: string; ibanSealed: string | null; bicSealed: string | null; ibanMasked: string | null };

export function findVendorBankRow(organizationId: string, vendorId: string): Promise<VendorBankRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .select({ id: vendors.id, name: vendors.name, ibanSealed: vendors.ibanSealed, bicSealed: vendors.bicSealed, ibanMasked: vendors.ibanMasked })
      .from(vendors)
      .where(eq(vendors.id, vendorId));
    return row ?? null;
  });
}

// Écrit l'IBAN chiffré et, s'il change, la ligne du journal, dans la même transaction. Verrou de la
// fiche : deux changements en même temps ne s'écrasent pas sans trace.
export function writeVendorBankRow(
  organizationId: string,
  vendorId: string,
  next: { ibanSealed: string | null; bicSealed: string | null; ibanMasked: string | null },
  change: { previousMasked: string | null; nextMasked: string | null; byUserId: string | null; byLinkId: string | null } | null,
): Promise<VendorBankChangeRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [locked] = await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, vendorId)).for("update");
    if (!locked) throw new Error("fiche introuvable");
    await tx.update(vendors).set({ ...next, updatedAt: new Date() }).where(eq(vendors.id, vendorId));
    if (!change) return null;
    const [row] = await tx
      .insert(vendorBankChanges)
      .values({
        organizationId,
        vendorId,
        previousMasked: change.previousMasked,
        nextMasked: change.nextMasked,
        changedByUserId: change.byUserId,
        changedByLinkId: change.byLinkId,
      })
      .returning();
    // SEC-20 : identifiants seulement, jamais l'IBAN (même masqué) au journal d'audit.
    await appendAudit(tx, { organizationId, action: "vendors.bank_details.changed", objectId: vendorId, details: { changeId: row!.id, by: change.byLinkId ? "vendor" : "planner" } });
    return row ?? null;
  });
}

export function findBankChangeRows(organizationId: string, filter: { vendorIds?: string[]; pendingOnly?: boolean }): Promise<VendorBankChangeRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(vendorBankChanges)
      .where(
        and(
          ...(filter.vendorIds ? [inArray(vendorBankChanges.vendorId, filter.vendorIds.length > 0 ? filter.vendorIds : ["00000000-0000-0000-0000-000000000000"])] : []),
          ...(filter.pendingOnly ? [isNull(vendorBankChanges.verifiedAt)] : []),
        ),
      )
      .orderBy(desc(vendorBankChanges.changedAt), desc(vendorBankChanges.createdAt)),
  );
}

// « J'ai vérifié par téléphone » : lève tous les changements en attente de la fiche, horodaté et
// nominatif. Renvoie le nombre de changements levés.
export function verifyBankChangeRows(organizationId: string, vendorId: string, userId: string, now: Date): Promise<number> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx
      .update(vendorBankChanges)
      .set({ verifiedAt: now, verifiedByUserId: userId, updatedAt: now })
      .where(and(eq(vendorBankChanges.vendorId, vendorId), isNull(vendorBankChanges.verifiedAt)))
      .returning({ id: vendorBankChanges.id });
    if (rows.length > 0) await appendAudit(tx, { organizationId, action: "vendors.bank_details.verified", objectId: vendorId, details: { changes: rows.length } });
    return rows.length;
  });
}

// DAT-08 — note confidentielle de la fiche.

export type VendorNoteRow = { id: string; internalNote: string | null; internalNoteSealed: string | null; internalNoteConfidentialBy: string | null };

export function findVendorNoteRow(organizationId: string, vendorId: string): Promise<VendorNoteRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .select({ id: vendors.id, internalNote: vendors.internalNote, internalNoteSealed: vendors.internalNoteSealed, internalNoteConfidentialBy: vendors.internalNoteConfidentialBy })
      .from(vendors)
      .where(eq(vendors.id, vendorId));
    return row ?? null;
  });
}

export function writeVendorNoteRow(organizationId: string, vendorId: string, values: Omit<VendorNoteRow, "id">): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await tx.update(vendors).set({ ...values, updatedAt: new Date() }).where(eq(vendors.id, vendorId)).returning({ id: vendors.id })).length > 0);
}

// PRE-06 — champs de lieu porteurs d'une règle, posés une fois sur les types de départ « venue ».

export function seedVenueRuleFieldRows(
  organizationId: string,
  fields: { rule: string; label: string; labels: string[]; kind: "number" | "text" | "time" | "amount" | "choice" | "boolean"; isFilter: boolean; choices?: string[] }[],
): Promise<number> {
  return inOrganization(organizationId, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`vendors.venue_fields:${organizationId}`}))`);
    const [settings] = await tx.select({ seededAt: vendorSettings.venueFieldsSeededAt }).from(vendorSettings);
    if (settings?.seededAt) return 0;
    const types = await tx.select({ id: vendorTypes.id }).from(vendorTypes).where(eq(vendorTypes.starterKey, "venue"));
    let changed = 0;
    for (const type of types) {
      const existing = await tx.select().from(vendorTypeFields).where(eq(vendorTypeFields.typeId, type.id)).orderBy(asc(vendorTypeFields.position));
      let position = existing.reduce((max, field) => Math.max(max, field.position + 1), 0);
      for (const field of fields) {
        if (existing.some((candidate) => candidate.ruleKey === field.rule)) continue;
        const folded = new Set(field.labels.map((label) => label.trim().toLocaleLowerCase("fr")));
        const same = existing.find((candidate) => candidate.ruleKey === null && candidate.kind === field.kind && folded.has(candidate.label.trim().toLocaleLowerCase("fr")));
        if (same) {
          await tx.update(vendorTypeFields).set({ ruleKey: field.rule }).where(eq(vendorTypeFields.id, same.id));
        } else {
          await tx.insert(vendorTypeFields).values({ organizationId, typeId: type.id, label: field.label, kind: field.kind, choices: field.choices ?? [], isFilter: field.isFilter, ruleKey: field.rule, position: position++ });
        }
        changed++;
      }
    }
    const now = new Date();
    await tx
      .insert(vendorSettings)
      .values({ organizationId, venueFieldsSeededAt: now })
      .onConflictDoUpdate({ target: vendorSettings.organizationId, set: { venueFieldsSeededAt: now, updatedAt: now } });
    return changed;
  });
}

// Fiches (nom, valeurs des champs, champs à règle de leurs métiers, clés des types de départ). Lot 63e
// (ADR 0105) : une fiche a plusieurs métiers ; les règles de chacun valent.
export function findVenueRows(
  organizationId: string,
  vendorIds: string[],
): Promise<{ id: string; name: string; fieldValues: Record<string, string | number | boolean>; typeStarterKeys: string[]; ruleFields: { id: string; ruleKey: string }[] }[]> {
  if (vendorIds.length === 0) return Promise.resolve([]);
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select({ id: vendors.id, name: vendors.name, fieldValues: vendors.fieldValues }).from(vendors).where(inArray(vendors.id, vendorIds));
    const links = await tx
      .select({ vendorId: vendorTypeLinks.vendorId, typeId: vendorTypeLinks.typeId, starterKey: vendorTypes.starterKey })
      .from(vendorTypeLinks)
      .innerJoin(vendorTypes, eq(vendorTypes.id, vendorTypeLinks.typeId))
      .where(inArray(vendorTypeLinks.vendorId, vendorIds))
      .orderBy(desc(vendorTypeLinks.isPrimary), asc(vendorTypeLinks.position));
    const typeIds = [...new Set(links.map((link) => link.typeId))];
    const fields =
      typeIds.length > 0
        ? await tx
            .select({ id: vendorTypeFields.id, typeId: vendorTypeFields.typeId, ruleKey: vendorTypeFields.ruleKey })
            .from(vendorTypeFields)
            .where(and(inArray(vendorTypeFields.typeId, typeIds), sql`${vendorTypeFields.ruleKey} is not null`))
        : [];
    return rows.map((row) => {
      const own = links.filter((link) => link.vendorId === row.id);
      return {
        id: row.id,
        name: row.name,
        fieldValues: row.fieldValues,
        typeStarterKeys: own.flatMap((link) => (link.starterKey ? [link.starterKey] : [])),
        ruleFields: fields.filter((field) => own.some((link) => link.typeId === field.typeId)).map((field) => ({ id: field.id, ruleKey: field.ruleKey! })),
      };
    });
  });
}
