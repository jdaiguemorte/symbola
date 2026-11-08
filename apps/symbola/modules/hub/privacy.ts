// Contrat privacy/v1 du hub (lot 6, ADR 0023). Données personnelles du hub
// qui peuvent concerner une personne suivie par la planner : compte d'accès
// d'un marié (e-mail), lignes d'un import en cours (le fichier d'origine), et
// valeurs gardées pour annuler un import confirmé. Les comptes de l'équipe de
// la planner ne relèvent pas de ce traitement.
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { helpProgress, importItems, imports, sessions, trustedDevices, users, userTourSeen } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import {
  ANONYMIZED,
  hasTerms,
  idsOfKind,
  prepareTerms,
  recordMatches,
  type ErasureInput,
  type ErasurePlanItem,
  type PrivacyContractV1,
  type PrivacyRecord,
} from "@symbola/privacy";

const MODULE = "hub";

function texts(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(texts);
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [key, ...texts(item)]);
  return [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RGPD-03 — oubli dans le hub (registre de données, décision de Julien du
// 02/11/2026) :
// - compte d'un marié : supprimé, sessions et visites vues comprises ;
// - ligne d'un import en cours (« import:ligne ») : tout l'import en cours
//   est abandonné, ses lignes effacées, nom de fichier et intitulés de
//   colonnes anonymisés ;
// - élément d'un import confirmé : valeurs gardées pour l'annulation
//   effacées (l'élément n'est plus annulable).
async function hubErasure(input: ErasureInput, execute: boolean): Promise<ErasurePlanItem[]> {
  const accountIds = idsOfKind(input.records, "client_account");
  const rowRefs = input.records.filter((record) => record.kind === "import_row" && UUID.test(record.recordId.split(":")[0] ?? ""));
  const itemIds = idsOfKind(input.records, "import_item");
  const items: ErasurePlanItem[] = [];
  const db = appDatabase();
  if (accountIds.length > 0) {
    // Table d'identité sans RLS : filtrée par organisation et rôle ici (ADR 0013).
    const accounts = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.organizationId, input.organizationId), eq(users.role, "client"), inArray(users.id, accountIds)));
    const ids = accounts.map((account) => account.id);
    if (execute && ids.length > 0) {
      await db.transaction(async (tx) => {
        await tx.delete(sessions).where(inArray(sessions.userId, ids));
        // SEC-03 : appareils de confiance (aussi effacés en cascade).
        await tx.delete(trustedDevices).where(inArray(trustedDevices.userId, ids));
        await tx.delete(userTourSeen).where(inArray(userTourSeen.userId, ids));
        await tx.delete(helpProgress).where(inArray(helpProgress.userId, ids));
        await tx.delete(users).where(inArray(users.id, ids));
      });
    }
    for (const id of ids) items.push({ kind: "client_account", recordId: id, fate: "deleted", legalBasis: null, keptUntil: null });
  }

  await withOrganization(db, input.organizationId, async (tx) => {
    const importIds = [...new Set(rowRefs.map((record) => record.recordId.split(":")[0]!))];
    if (importIds.length > 0) {
      const drafts = await tx.select({ id: imports.id, headers: imports.headers }).from(imports).where(inArray(imports.id, importIds));
      const known = new Set(drafts.map((draft) => draft.id));
      for (const record of rowRefs) {
        if (known.has(record.recordId.split(":")[0]!)) items.push({ kind: "import_row", recordId: record.recordId, fate: "deleted", legalBasis: null, keptUntil: null });
      }
      if (execute) {
        for (const draft of drafts) {
          await tx
            .update(imports)
            .set({
              status: "cancelled",
              rows: null,
              sourceLineNumbers: null,
              fileName: ANONYMIZED,
              headers: draft.headers.map((_, index) => `#${index + 1}`),
              updatedAt: new Date(),
            })
            .where(and(eq(imports.id, draft.id), eq(imports.status, "draft")));
        }
      }
    }
    if (itemIds.length > 0) {
      const rows = await tx.select({ id: importItems.id }).from(importItems).where(inArray(importItems.id, itemIds));
      if (execute && rows.length > 0) await tx.update(importItems).set({ previous: null, written: null }).where(inArray(importItems.id, rows.map((row) => row.id)));
      for (const row of rows) items.push({ kind: "import_item", recordId: row.id, fate: "anonymized", legalBasis: null, keptUntil: null });
    }
  });
  return items;
}

export const hubPrivacy: PrivacyContractV1 = {
  module: MODULE,

  planErasure: (input) => hubErasure(input, false),
  erase: (input) => hubErasure(input, true),

  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    const db = appDatabase();
    const records: PrivacyRecord[] = [];
    // Table d'identité sans RLS : filtrée par organisation ici (ADR 0013).
    const accounts = await db
      .select({ id: users.id, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.role, "client")));
    for (const account of accounts) {
      if (recordMatches([account.email], terms)) {
        records.push({ module: MODULE, kind: "client_account", recordId: account.id, label: account.email, fields: { email: account.email }, eventId: null });
      }
    }

    await withOrganization(db, organizationId, async (tx) => {
      for (const draft of await tx.select().from(imports).where(and(eq(imports.status, "draft"), isNotNull(imports.rows)))) {
        (draft.rows ?? []).forEach((row, rowIndex) => {
          if (!recordMatches(row, terms)) return;
          records.push({
            module: MODULE,
            kind: "import_row",
            recordId: `${draft.id}:${rowIndex}`,
            label: `${draft.fileName} — ${(draft.sourceLineNumbers ?? [])[rowIndex] ?? rowIndex + 1}`,
            fields: Object.fromEntries(row.map((cell, column) => [draft.headers[column] || `#${column + 1}`, cell]).filter(([, cell]) => cell !== "")),
            eventId: null,
          });
        });
      }
      for (const item of await tx.select().from(importItems).where(isNotNull(importItems.written))) {
        const values = [...texts(item.previous), ...texts(item.written)];
        if (!recordMatches(values, terms)) continue;
        records.push({
          module: MODULE,
          kind: "import_item",
          recordId: item.id,
          label: item.kind,
          fields: Object.fromEntries(texts(item.written).map((value, index) => [`value${index + 1}`, value])),
          eventId: item.kind === "event" ? item.elementId : null,
        });
      }
    });
    return records;
  },

  async related() {
    return [];
  },
};
