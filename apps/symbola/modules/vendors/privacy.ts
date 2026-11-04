// Contrat privacy/v1 du module vendors (lot 11, ADR 0031). Champs personnels
// (privacy.registry.yaml) : nom d'un prestataire indépendant, nom, e-mail
// et téléphone du contact, adresse, note interne ; fichiers (plaquettes,
// RIB). Une fiche n'est rattachée à aucun événement : `related` ne renvoie
// rien. Les fiches d'exemple (essais, tutoriels) ne sont jamais trouvées.
import { and, eq, inArray } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { vendorFiles, vendors } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject } from "@symbola/files";
import { ANONYMIZED, hasTerms, idsOfKind, prepareTerms, recordMatches, type ErasurePlanItem, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";

const MODULE = "vendors";
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await sql.end();
  }
}

function compact(fields: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
}

async function existing(tx: Tx, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  return (await tx.select({ id: vendors.id }).from(vendors).where(and(inArray(vendors.id, ids), eq(vendors.isDemo, false)))).map((row) => row.id);
}

const plan = (ids: string[]): ErasurePlanItem[] => ids.map((recordId) => ({ kind: "vendor", recordId, fate: "anonymized", legalBasis: null, keptUntil: null }));

export const vendorsPrivacy: PrivacyContractV1 = {
  module: MODULE,

  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    return inOrganization(organizationId, async (tx) => {
      const records: PrivacyRecord[] = [];
      for (const vendor of await tx.select().from(vendors).where(eq(vendors.isDemo, false))) {
        if (!recordMatches([vendor.name, vendor.contactName, vendor.email, vendor.phone, vendor.internalNote], terms)) continue;
        records.push({
          module: MODULE,
          kind: "vendor",
          recordId: vendor.id,
          label: vendor.contactName ? `${vendor.name} — ${vendor.contactName}` : vendor.name,
          fields: compact({
            name: vendor.name,
            contactName: vendor.contactName,
            email: vendor.email,
            phone: vendor.phone,
            address: [vendor.addressLine, vendor.postalCode, vendor.city].filter(Boolean).join(" ") || null,
            internalNote: vendor.internalNote,
          }),
          eventId: null,
        });
      }
      return records;
    });
  },

  async related() {
    return [];
  },

  async planErasure(input) {
    return inOrganization(input.organizationId, async (tx) => plan(await existing(tx, idsOfKind(input.records, "vendor"))));
  },

  // La fiche reste (l'historique des événements garde son identifiant) mais
  // sans rien qui désigne la personne ; ses fichiers sont supprimés.
  async erase(input) {
    const { ids, keys } = await inOrganization(input.organizationId, async (tx) => {
      const ids = await existing(tx, idsOfKind(input.records, "vendor"));
      if (ids.length === 0) return { ids, keys: [] as string[] };
      const files = await tx.select({ key: vendorFiles.fileKey }).from(vendorFiles).where(inArray(vendorFiles.vendorId, ids));
      await tx.delete(vendorFiles).where(inArray(vendorFiles.vendorId, ids));
      await tx
        .update(vendors)
        .set({
          name: ANONYMIZED,
          contactName: null,
          email: null,
          phone: null,
          addressLine: null,
          postalCode: null,
          internalNote: null,
          latitude: null,
          longitude: null,
          locationSource: null,
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(vendors.id, ids));
      return { ids, keys: files.map((file) => file.key) };
    });
    const storage = keys.length > 0 ? createStorageClient() : null;
    for (const key of keys) await deletePrivateObject(storage!, key).catch(() => undefined);
    return plan(ids);
  },
};
