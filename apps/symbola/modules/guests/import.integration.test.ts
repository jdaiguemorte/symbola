// Lot 49 — INV-02 : import d'une liste d'invités depuis un tableur ; l'import signale les doublons
// avant d'écrire. Contre un vrai PostgreSQL et l'antivirus du socle : 120 lignes avec doublons,
// formules neutralisées, colonne de régime ignorée et signalée, annulation, isolation.
import { describe, expect, it } from "vitest";
import { households } from "@symbola/db/schema/guests";
import { withOrganization } from "@symbola/db/with-organization";
import { EICAR_TEST_STRING } from "@symbola/files";
import { importGuests, listGuestImports, listHouseholds, undoGuestImport, GuestEventNotFoundError, GuestImportNotFoundError } from "./service";
import { household, readyOrganization, weddingEvent, withDb } from "./test-fixtures";

// 120 lignes : 60 foyers de deux personnes ; la ligne 10 répète la ligne 4 (même nom, même e-mail),
// la ligne 21 répète un invité déjà dans l'évènement (même nom, même téléphone) ; une formule.
function guestList(): Uint8Array {
  const lines = ["Foyer;Prénom;Nom;E-mail;Téléphone;Enfant;Régime alimentaire"];
  for (let index = 0; index < 60; index += 1) {
    const family = `Famille ${index}`;
    lines.push(`${family};Adulte${index};Nom${index};adulte${index}@example.test;06000000${String(index).padStart(2, "0")};;végétarien`);
    lines.push(`${family};Enfant${index};;;;oui;`);
  }
  // Ligne 10 du fichier (en-tête = ligne 1) : doublon de la ligne 4.
  lines[9] = "Famille 1;Adulte1;Nom1;ADULTE1@example.test;;;";
  lines[20] = "Famille Existante;Luc;Martin;;+33 6 12 34 56 78;;";
  lines[30] = "Famille 14;=HYPERLINK(\"https://exemple.invalid\");Pirate;pirate@example.test;;;";
  return new TextEncoder().encode(`${lines.join("\n")}\n`);
}

describe("INV-02 — Import depuis un tableur : doublons signalés avant d'écrire", () => {
  it("l'aperçu signale doublons, colonne de régime ignorée et formule neutralisée, sans rien écrire ; puis applique les lignes gardées et s'annule", async () => {
    const { organizationId, ownerId } = await readyOrganization();
    const { eventId } = await weddingEvent(organizationId, ownerId);
    await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Luc", lastName: "Martin", phone: "06 12 34 56 78" }] });
    const bytes = guestList();
    const preview = await importGuests({ organizationId, eventId, bytes, channel: "planner" });
    if (preview.status !== "preview") throw new Error(`aperçu refusé : ${preview.status}`);
    expect(preview.preview.rows).toHaveLength(120);
    expect(preview.preview.duplicates).toEqual([
      { line: 10, with: { kind: "file", line: 4 } },
      { line: 21, with: { kind: "event", name: "Luc Martin" } },
    ]);
    expect(preview.preview.ignoredDietColumns).toEqual(["Régime alimentaire"]);
    // La ligne 10 a remplacé l'adulte de la « Famille 4 » : son enfant reste seul, sans contact.
    expect(preview.preview.problems).toContainEqual({ line: 11, problem: "household_without_contact" });
    expect(preview.preview.neutralizedCells).toBeGreaterThanOrEqual(1);
    expect(preview.preview.rows.find((row) => row.line === 31)!.firstName.startsWith("=")).toBe(false);
    // Rien n'est écrit avant le choix.
    expect(await listHouseholds(organizationId, eventId, { kind: "owner" })).toHaveLength(1);

    const applied = await importGuests({ organizationId, eventId, bytes, channel: "planner", apply: { skipLines: [10, 21] } });
    if (applied.status !== "applied") throw new Error("import refusé");
    // Les deux doublons écartés, et l'enfant seul de la « Famille 4 » (INV-01 : un contact par foyer).
    expect(applied).toMatchObject({ skipped: 3 });
    const list = await listHouseholds(organizationId, eventId, { kind: "owner" });
    expect(list.length).toBe(1 + applied.households);
    // Un enfant importé n'a ni contact ni nom de famille ; aucun régime n'est importé.
    const family0 = list.find((candidate) => candidate.displayName === "Famille 0")!;
    expect(family0.people.find((person) => person.kind === "child")).toMatchObject({ email: null, phone: null, lastName: null, diet: null });
    expect(list.flatMap((candidate) => candidate.people).every((person) => person.diet === null)).toBe(true);

    expect((await listGuestImports(organizationId, eventId))[0]).toMatchObject({ channel: "planner", households: applied.households, undoneAt: null });
    expect(await undoGuestImport(organizationId, eventId, applied.importId)).toBe(applied.households);
    expect(await listHouseholds(organizationId, eventId, { kind: "owner" })).toHaveLength(1);
    await expect(undoGuestImport(organizationId, eventId, applied.importId)).rejects.toBeInstanceOf(GuestImportNotFoundError);
  });

  it("refuse un fichier infecté, vide ou sans colonne de prénom ; une autre organisation n'importe pas dans l'évènement", async () => {
    const { organizationId, ownerId } = await readyOrganization();
    const { eventId } = await weddingEvent(organizationId, ownerId);
    expect(await importGuests({ organizationId, eventId, bytes: new TextEncoder().encode(EICAR_TEST_STRING), channel: "client" })).toEqual({ status: "rejected", reason: "infected" });
    expect(await importGuests({ organizationId, eventId, bytes: new Uint8Array(), channel: "client" })).toEqual({ status: "rejected", reason: "empty" });
    expect(await importGuests({ organizationId, eventId, bytes: new TextEncoder().encode("Couleur;Taille\nbleu;M\n"), channel: "client" })).toEqual({ status: "rejected", reason: "no_name_column" });
    const other = await readyOrganization();
    await expect(importGuests({ organizationId: other.organizationId, eventId, bytes: guestList(), channel: "planner" })).rejects.toBeInstanceOf(GuestEventNotFoundError);
    const rows = await withDb((db) => withOrganization(db, other.organizationId, (tx) => tx.select().from(households)));
    expect(rows).toEqual([]);
  });
});
