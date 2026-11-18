// Lot 45 (CRM-07 ; D4, D5 ; ADR 0090) — doublons de contacts et leur fusion, dans le hub. Exposé
// seulement par service.ts (ADR 0011).
//
// - Détection à la saisie (création et modification d'une fiche, formulaire de contact du lot 44)
//   et chaque nuit : les paires suspectes vont dans « Contacts › Doublons possibles », jamais
//   fusionnées seules. « Ce ne sont pas les mêmes » écarte une paire pour toujours.
// - Fusion par la planner, champ par champ : la fiche gardée prend les valeurs choisies, les notes et
//   les appartenances de la fiche absorbée ; la fiche absorbée disparaît ; la fusion est tracée (qui,
//   quand, quelles fiches, noms des champs repris) et publiée (hub.contact.merged) : chaque module
//   repointe ses références par son propre service (ARC-01, ARC-05).
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { emitDomainEvent } from "@symbola/db/events/emit";
import { withOrganization } from "@symbola/db/with-organization";
import { contactDuplicates, contactMembers, contactMerges, contactNotes, contacts } from "@symbola/db/schema/hub";
import { ANONYMIZED } from "@symbola/privacy";
import { HUB_CONTACT_MERGED, HUB_CONTACT_MERGED_VERSION, type Contact } from "@symbola/contracts";
import { ContactMergeRefusedError, findDuplicatePairs, mergeContactValues, type DuplicateCandidate, type MergeChoices, type MergeableField } from "./contact-duplicate-rules";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

async function candidates(tx: Tx): Promise<DuplicateCandidate[]> {
  const rows = await tx
    .select({ id: contacts.id, email: contacts.email, phone: contacts.phone, isDemo: contacts.isDemo, firstName: contacts.firstName, name: contacts.name })
    .from(contacts);
  return rows
    .filter((row) => row.firstName !== ANONYMIZED && row.name !== ANONYMIZED && (row.email || row.phone))
    .map((row) => ({ id: row.id, email: row.email, phone: row.phone, isDemo: row.isDemo }));
}

// Range les paires trouvées ; une paire déjà connue (même écartée) ne revient pas.
async function storePairs(tx: Tx, organizationId: string, pairs: ReturnType<typeof findDuplicatePairs>, now: Date): Promise<number> {
  if (pairs.length === 0) return 0;
  const inserted = await tx
    .insert(contactDuplicates)
    .values(pairs.map((pair) => ({ organizationId, ...pair, detectedAt: now })))
    .onConflictDoNothing()
    .returning({ id: contactDuplicates.id });
  return inserted.length;
}

// À la saisie : les ressemblances d'une fiche avec les autres.
export async function detectDuplicatesOf(organizationId: string, contactId: string, now: Date = new Date()): Promise<number> {
  if (!UUID.test(contactId)) return 0;
  return inOrganization(organizationId, async (tx) => storePairs(tx, organizationId, findDuplicatePairs(await candidates(tx), contactId), now));
}

// Chaque nuit : toutes les ressemblances de l'organisation.
export async function detectAllDuplicates(organizationId: string, now: Date = new Date()): Promise<number> {
  return inOrganization(organizationId, async (tx) => storePairs(tx, organizationId, findDuplicatePairs(await candidates(tx)), now));
}

export type DuplicatePairView = { id: string; reason: "email" | "phone"; detectedAt: string; first: Contact; second: Contact };

// « Doublons possibles » : les paires non écartées dont les deux fiches existent encore.
export async function listDuplicatePairs(organizationId: string, toContact: (ids: string[]) => Promise<Map<string, Contact>>): Promise<DuplicatePairView[]> {
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(contactDuplicates).where(isNull(contactDuplicates.dismissedAt)).orderBy(contactDuplicates.detectedAt));
  const byId = await toContact(rows.flatMap((row) => [row.firstContactId, row.secondContactId]));
  return rows.flatMap((row) => {
    const first = byId.get(row.firstContactId);
    const second = byId.get(row.secondContactId);
    if (!first || !second || first.anonymized || second.anonymized) return [];
    return [{ id: row.id, reason: row.reason, detectedAt: row.detectedAt.toISOString(), first, second }];
  });
}

export async function countDuplicatePairs(organizationId: string): Promise<number> {
  const rows = await inOrganization(organizationId, (tx) => tx.select({ id: contactDuplicates.id }).from(contactDuplicates).where(isNull(contactDuplicates.dismissedAt)));
  return rows.length;
}

export async function getDuplicatePair(organizationId: string, pairId: string): Promise<{ id: string; firstContactId: string; secondContactId: string; reason: "email" | "phone" } | null> {
  if (!UUID.test(pairId)) return null;
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(contactDuplicates).where(and(eq(contactDuplicates.id, pairId), isNull(contactDuplicates.dismissedAt))));
  return row ? { id: row.id, firstContactId: row.firstContactId, secondContactId: row.secondContactId, reason: row.reason } : null;
}

export class DuplicatePairNotFoundError extends Error {
  constructor() {
    super("paire de doublons introuvable");
    this.name = "DuplicatePairNotFoundError";
  }
}

// « Ce ne sont pas les mêmes » : la paire est écartée, elle ne revient pas.
export async function dismissDuplicatePair(organizationId: string, pairId: string, userId: string, now: Date = new Date()): Promise<void> {
  if (!UUID.test(pairId)) throw new DuplicatePairNotFoundError();
  const updated = await inOrganization(organizationId, (tx) =>
    tx.update(contactDuplicates).set({ dismissedAt: now, dismissedBy: userId, updatedAt: now }).where(and(eq(contactDuplicates.id, pairId), isNull(contactDuplicates.dismissedAt))).returning({ id: contactDuplicates.id }),
  );
  if (updated.length === 0) throw new DuplicatePairNotFoundError();
}

// —— Fusion (D4, D5) ———————————————————————————————————————————————————————————————————————

export async function mergeContacts(input: { organizationId: string; keptContactId: string; absorbedContactId: string; choices: MergeChoices; userId: string; now?: Date }): Promise<{ mergeId: string; fieldsFromAbsorbed: MergeableField[] }> {
  if (!UUID.test(input.keptContactId) || !UUID.test(input.absorbedContactId)) throw new ContactMergeRefusedError("not_found");
  if (input.keptContactId === input.absorbedContactId) throw new ContactMergeRefusedError("same");
  const now = input.now ?? new Date();
  return inOrganization(input.organizationId, async (tx) => {
    const rows = await tx.select().from(contacts).where(inArray(contacts.id, [input.keptContactId, input.absorbedContactId])).for("update");
    const kept = rows.find((row) => row.id === input.keptContactId);
    const absorbed = rows.find((row) => row.id === input.absorbedContactId);
    if (!kept || !absorbed) throw new ContactMergeRefusedError("not_found");
    if ([kept, absorbed].some((row) => row.firstName === ANONYMIZED || row.name === ANONYMIZED)) throw new ContactMergeRefusedError("anonymized");
    const { values, fromAbsorbed } = mergeContactValues(kept, absorbed, input.choices);
    // L'adresse e-mail est unique : la fiche absorbée la rend d'abord.
    await tx.update(contacts).set({ email: null }).where(eq(contacts.id, absorbed.id));
    await tx.update(contacts).set({ ...values, updatedAt: now }).where(eq(contacts.id, kept.id));
    // Notes et appartenances (foyer, entreprise) passent à la fiche gardée ; un lien en double, ou de
    // la fiche avec elle-même, disparaît.
    await tx.update(contactNotes).set({ contactId: kept.id }).where(eq(contactNotes.contactId, absorbed.id));
    const memberships = await tx.select().from(contactMembers).where(or(eq(contactMembers.groupContactId, absorbed.id), eq(contactMembers.memberContactId, absorbed.id)));
    for (const membership of memberships) {
      const group = membership.groupContactId === absorbed.id ? kept.id : membership.groupContactId;
      const member = membership.memberContactId === absorbed.id ? kept.id : membership.memberContactId;
      const [twin] = await tx.select({ id: contactMembers.id }).from(contactMembers).where(and(eq(contactMembers.groupContactId, group), eq(contactMembers.memberContactId, member)));
      if (group === member || twin) await tx.delete(contactMembers).where(eq(contactMembers.id, membership.id));
      else await tx.update(contactMembers).set({ groupContactId: group, memberContactId: member }).where(eq(contactMembers.id, membership.id));
    }
    const [merge] = await tx
      .insert(contactMerges)
      .values({ organizationId: input.organizationId, keptContactId: kept.id, absorbedContactId: absorbed.id, fieldsFromAbsorbed: fromAbsorbed, mergedByUserId: input.userId, mergedAt: now })
      .returning({ id: contactMerges.id });
    // Une fusion faite avant une autre : ce qui visait la fiche absorbée vise désormais la gardée.
    await tx.update(contactMerges).set({ keptContactId: kept.id }).where(eq(contactMerges.keptContactId, absorbed.id));
    await tx.delete(contacts).where(eq(contacts.id, absorbed.id));
    await emitDomainEvent(tx, { organizationId: input.organizationId, name: HUB_CONTACT_MERGED, version: HUB_CONTACT_MERGED_VERSION, payload: { mergeId: merge!.id, keptContactId: kept.id, absorbedContactId: absorbed.id } });
    await appendAudit(tx, { organizationId: input.organizationId, action: "hub.contact.merged", objectId: kept.id, details: { absorbedContactId: absorbed.id, fields: fromAbsorbed.join(",") } });
    return { mergeId: merge!.id, fieldsFromAbsorbed: fromAbsorbed };
  });
}

// Pendant que les modules repointent (événement traité en arrière-plan), un identifiant absorbé
// désigne la fiche gardée.
export async function resolveMergedContactIds(organizationId: string, ids: readonly string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids)].filter((id) => UUID.test(id));
  if (wanted.length === 0) return new Map();
  const rows = await inOrganization(organizationId, (tx) => tx.select({ absorbed: contactMerges.absorbedContactId, kept: contactMerges.keptContactId }).from(contactMerges).where(inArray(contactMerges.absorbedContactId, wanted)));
  return new Map(rows.map((row) => [row.absorbed, row.kept]));
}

export async function listContactMerges(organizationId: string, contactId: string): Promise<{ id: string; absorbedContactId: string; fields: string[]; mergedAt: string; mergedByUserId: string | null }[]> {
  if (!UUID.test(contactId)) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(contactMerges).where(eq(contactMerges.keptContactId, contactId)).orderBy(contactMerges.mergedAt));
  return rows.map((row) => ({ id: row.id, absorbedContactId: row.absorbedContactId, fields: [...row.fieldsFromAbsorbed], mergedAt: row.mergedAt.toISOString(), mergedByUserId: row.mergedByUserId }));
}
