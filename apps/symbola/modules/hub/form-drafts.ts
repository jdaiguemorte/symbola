// Lot 39b (UX-09 ; D7 ; ADR 0074) — brouillons des formulaires : ce qu'une personne a commencé à
// saisir (nouvel évènement, nouveau contact, note, ligne de devis, modèle…), gardé côté serveur à
// chaque pause de frappe, par personne et par formulaire, et repris sur tout appareil. Effacé quand
// le formulaire est enregistré, purgé au bout de 30 jours. La base garantit l'organisation (RLS) ;
// la personne est celle de la session, vérifiée ici. Exposé seulement par service.ts (ADR 0011).
import { and, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { formDrafts } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { hasTerms, prepareTerms, recordMatches, type PersonTerms } from "@symbola/privacy";

// « event-new », « contact-note:<identifiant> »… (même règle que la contrainte de la base).
export const FORM_DRAFT_KEY = /^[a-z][a-z0-9-]{0,40}(:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/;
const FIELD_MAX = 80;
const VALUE_MAX = 20_000;
const FIELDS_MAX = 60;
const CONTENT_MAX = 60_000;

const contentSchema = z
  .record(z.string().min(1).max(FIELD_MAX), z.string().max(VALUE_MAX))
  .refine((content) => Object.keys(content).length <= FIELDS_MAX)
  .refine((content) => JSON.stringify(content).length <= CONTENT_MAX);

export type FormDraft = { formKey: string; content: Record<string, string>; updatedAt: Date };

export class FormDraftInvalidError extends Error {
  constructor() {
    super("brouillon invalide");
    this.name = "FormDraftInvalidError";
  }
}

export function isFormDraftKey(formKey: string): boolean {
  return FORM_DRAFT_KEY.test(formKey);
}

// Un formulaire vide n'est pas un brouillon : rien à reprendre, l'éventuel brouillon est effacé.
export async function saveFormDraft(organizationId: string, userId: string, formKey: string, content: unknown): Promise<Date | null> {
  const parsed = contentSchema.safeParse(content);
  if (!isFormDraftKey(formKey) || !parsed.success) throw new FormDraftInvalidError();
  if (!Object.values(parsed.data).some((value) => value.trim() !== "")) {
    await discardFormDraft(organizationId, userId, formKey);
    return null;
  }
  const now = new Date();
  await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .insert(formDrafts)
      .values({ organizationId, userId, formKey, content: parsed.data, updatedAt: now })
      .onConflictDoUpdate({ target: [formDrafts.organizationId, formDrafts.userId, formDrafts.formKey], set: { content: parsed.data, updatedAt: now } }),
  );
  return now;
}

export async function getFormDraft(organizationId: string, userId: string, formKey: string): Promise<FormDraft | null> {
  if (!isFormDraftKey(formKey)) return null;
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(formDrafts)
      .where(and(eq(formDrafts.userId, userId), eq(formDrafts.formKey, formKey))),
  );
  return row ? { formKey: row.formKey, content: row.content, updatedAt: row.updatedAt } : null;
}

export async function discardFormDraft(organizationId: string, userId: string, formKey: string): Promise<void> {
  if (!isFormDraftKey(formKey)) return;
  await withOrganization(appDatabase(), organizationId, (tx) => tx.delete(formDrafts).where(and(eq(formDrafts.userId, userId), eq(formDrafts.formKey, formKey))));
}

// Purge : brouillons laissés en l'état depuis la date donnée (30 jours, tâche horaire).
export async function purgeFormDrafts(organizationId: string, before: Date): Promise<number> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.delete(formDrafts).where(lt(formDrafts.updatedAt, before)).returning({ id: formDrafts.id }));
  return rows.length;
}

// RGPD (privacy/v1) : un brouillon qui mentionne la personne, quel que soit son auteur dans
// l'organisation ; l'effacer le supprime.
export async function findFormDraftsByTerms(organizationId: string, rawTerms: PersonTerms): Promise<{ id: string; formKey: string; content: Record<string, string> }[]> {
  const terms = prepareTerms(rawTerms);
  if (!hasTerms(terms)) return [];
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(formDrafts));
  return rows.filter((row) => recordMatches(Object.values(row.content), terms)).map((row) => ({ id: row.id, formKey: row.formKey, content: row.content }));
}

export async function eraseFormDrafts(organizationId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.delete(formDrafts).where(inArray(formDrafts.id, ids)).returning({ id: formDrafts.id }));
  return rows.map((row) => row.id);
}

export async function listFormDraftIds(organizationId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ id: formDrafts.id }).from(formDrafts).where(inArray(formDrafts.id, ids)));
  return rows.map((row) => row.id);
}
