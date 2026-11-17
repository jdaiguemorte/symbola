// Lot 39b (UX-09 ; D7, D8 ; ADR 0074) — rien ne se perd en saisissant, contre un vrai PostgreSQL (RLS) :
// un brouillon par personne et par formulaire, repris sur tout appareil, jamais lu par une autre
// personne ni une autre organisation, purgé après 30 jours (horloge simulée), trouvé et effacé par une
// demande RGPD ; une fiche modifiée par deux personnes fusionne ou montre le conflit.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { withActor } from "@symbola/db/actor";
import { createContact, discardFormDraft, getContact, getContactStamp, getFormDraft, hubPrivacy, purgeFormDrafts, saveFormDraft, updateContact } from "@/modules/hub/service";
import { runAutosave, versionOf } from "./autosave-server";

const DAY = 24 * 60 * 60 * 1000;

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function atelier() {
  return withDb(async (db) => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const camille = await createUser(db, { organizationId: organization.id, email: `camille-${randomUUID()}@exemple.test`, role: "owner" });
    const nadia = await createUser(db, { organizationId: organization.id, email: `nadia-${randomUUID()}@exemple.test`, role: "member" });
    return { organizationId: organization.id, camille: camille.id, nadia: nadia.id };
  });
}

describe("UX-09 — Brouillon restauré après fermeture, sur tout appareil", () => {
  it("le brouillon d'une personne se reprend tel quel, s'efface à l'enregistrement, et n'est pas lu par une autre", async () => {
    const { organizationId, camille, nadia } = await atelier();
    const content = { eventTypeId: randomUUID(), firstName1: "Léa", firstName2: "Maxime", eventDate: "2027-06-12" };
    await saveFormDraft(organizationId, camille, "event-first", content);
    expect((await getFormDraft(organizationId, camille, "event-first"))?.content).toEqual(content);
    expect(await getFormDraft(organizationId, nadia, "event-first")).toBeNull();

    await saveFormDraft(organizationId, camille, "event-first", { ...content, firstName2: "Max" });
    expect((await getFormDraft(organizationId, camille, "event-first"))?.content.firstName2).toBe("Max");
    await discardFormDraft(organizationId, camille, "event-first");
    expect(await getFormDraft(organizationId, camille, "event-first")).toBeNull();
  });

  it("un formulaire vide n'est pas un brouillon ; une clé ou un contenu hors règle est refusé", async () => {
    const { organizationId, camille } = await atelier();
    await saveFormDraft(organizationId, camille, "contact-new", { firstName: "Rose" });
    expect(await saveFormDraft(organizationId, camille, "contact-new", { firstName: "  " })).toBeNull();
    expect(await getFormDraft(organizationId, camille, "contact-new")).toBeNull();
    await expect(saveFormDraft(organizationId, camille, "../autre", { firstName: "Rose" })).rejects.toThrow();
    await expect(saveFormDraft(organizationId, camille, "contact-new", { firstName: "x".repeat(25_000) })).rejects.toThrow();
  });

  it("abus — une autre organisation ne lit jamais le brouillon, même avec l'identifiant de la personne", async () => {
    const owner = await atelier();
    const other = await atelier();
    await saveFormDraft(owner.organizationId, owner.camille, "contact-new", { firstName: "Rose" });
    expect(await getFormDraft(other.organizationId, owner.camille, "contact-new")).toBeNull();
  });

  it("un brouillon laissé 30 jours est purgé (la veille, il reste)", async () => {
    const { organizationId, camille } = await atelier();
    await saveFormDraft(organizationId, camille, "contact-new", { firstName: "Rose" });
    const savedAt = (await getFormDraft(organizationId, camille, "contact-new"))!.updatedAt;
    expect(await purgeFormDrafts(organizationId, new Date(savedAt.getTime() - DAY))).toBe(0);
    expect(await getFormDraft(organizationId, camille, "contact-new")).not.toBeNull();
    expect(await purgeFormDrafts(organizationId, new Date(savedAt.getTime() + 1))).toBe(1);
    expect(await getFormDraft(organizationId, camille, "contact-new")).toBeNull();
  });

  it("RGPD — un brouillon qui mentionne la personne est trouvé, puis effacé", async () => {
    const { organizationId, camille } = await atelier();
    await saveFormDraft(organizationId, camille, "contact-new", { firstName: "Hortense", lastName: "Delmas", email: "hortense.delmas@exemple.test" });
    const records = await hubPrivacy.find({ organizationId, terms: { name: "Hortense Delmas", email: "hortense.delmas@exemple.test" } });
    const draft = records.find((record) => record.kind === "form_draft");
    expect(draft?.fields).toMatchObject({ firstName: "Hortense", lastName: "Delmas" });
    const plan = await hubPrivacy.erase({ organizationId, records: [{ kind: "form_draft", recordId: draft!.recordId }], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 }, today: "2026-11-17" });
    expect(plan).toEqual([expect.objectContaining({ kind: "form_draft", fate: "deleted" })]);
    expect(await getFormDraft(organizationId, camille, "contact-new")).toBeNull();
  });
});

describe("UX-09 — Conflit d'édition signalé, jamais écrasé en silence", () => {
  const FIELDS = ["firstName", "lastName", "phone", "city"] as const;

  async function autosave(organizationId: string, userId: string, contactId: string, form: Record<string, string>, baseline: Record<string, string>, version: string) {
    const data = new FormData();
    for (const [key, value] of Object.entries(form)) data.set(key, value);
    data.set("version", version);
    data.set("baseline", JSON.stringify(baseline));
    return withActor({ kind: "member", id: userId }, () =>
      runAutosave({
        organizationId,
        userId,
        formData: data,
        fields: FIELDS,
        read: async () => {
          const [contact, stamp] = await Promise.all([getContact(organizationId, contactId), getContactStamp(organizationId, contactId)]);
          if (!contact || !stamp) return null;
          return { values: Object.fromEntries(FIELDS.map((field) => [field, String(contact[field] ?? "")])), version: versionOf(stamp.updatedAt), updatedBy: stamp.updatedBy };
        },
        write: async (values) => {
          await updateContact(organizationId, contactId, { kind: "person", ...values });
        },
        knownError: async () => null,
        notFound: "introuvable",
      }),
    );
  }

  it("ce que l'autre a changé, et que je n'ai pas touché, est gardé ; un champ changé des deux côtés est un conflit, montré avec l'auteur", async () => {
    const { organizationId, camille, nadia } = await atelier();
    const contact = await createContact(organizationId, { firstName: "Léa", lastName: "Martin", phone: "06 00 00 00 01", city: "Lille" });
    const start = { firstName: "Léa", lastName: "Martin", phone: "06 00 00 00 01", city: "Lille" };
    const version = versionOf((await getContactStamp(organizationId, contact.id))!.updatedAt);

    // Nadia change la ville ; Camille, partie de la même version, change le téléphone : les deux restent.
    const nadiaSaved = await autosave(organizationId, nadia, contact.id, { ...start, city: "Roubaix" }, start, version);
    expect(nadiaSaved.status).toBe("saved");
    const merged = await autosave(organizationId, camille, contact.id, { ...start, phone: "06 00 00 00 02" }, start, version);
    expect(merged).toMatchObject({ status: "saved", values: { phone: "06 00 00 00 02", city: "Roubaix" } });

    // Puis les deux changent la ville, différemment : rien n'est écrit, le conflit nomme Nadia.
    const after = (merged as { values: Record<string, string>; version: string });
    await autosave(organizationId, nadia, contact.id, { ...after.values, city: "Tourcoing" }, after.values, after.version);
    const conflict = await autosave(organizationId, camille, contact.id, { ...after.values, city: "Lens" }, after.values, after.version);
    expect(conflict).toMatchObject({ status: "conflict", conflicts: [{ field: "city", theirs: "Tourcoing", mine: "Lens" }] });
    expect((conflict as { by: string | null }).by).toMatch(/^nadia-/);
    expect((await getContact(organizationId, contact.id))?.city).toBe("Tourcoing");
  });
});
