// Contrat privacy/v1 du hub (lot 6, ADR 0023). Données personnelles du hub
// qui peuvent concerner une personne suivie par la planner : compte d'accès
// d'un marié (e-mail), lignes d'un import en cours (le fichier d'origine), et
// valeurs gardées pour annuler un import confirmé. Les comptes de l'équipe de
// la planner ne relèvent pas de ce traitement.
import { and, eq, isNotNull } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { importItems, imports, users } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { hasTerms, prepareTerms, recordMatches, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";

const MODULE = "hub";

function texts(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(texts);
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [key, ...texts(item)]);
  return [];
}

export const hubPrivacy: PrivacyContractV1 = {
  module: MODULE,

  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    const { sql, db } = createAppConnection();
    try {
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
    } finally {
      await sql.end();
    }
  },

  async related() {
    return [];
  },
};
