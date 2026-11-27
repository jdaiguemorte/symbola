import { describe, expect, it } from "vitest";
import { compareDocumentStates, documentAlert, documentState, documentStateNeedsAction, documentsLapsingBefore } from "./documents";

// Horloge simulée : « aujourd'hui » est passé en paramètre (jour calendaire de Paris).
describe("PRE-05 — Pièces à échéance et alertes", () => {
  const alertDays = 30;

  it("alerte à J-30 : rien la veille de la fenêtre, alerte le jour même", () => {
    expect(documentAlert({ validUntil: "2027-06-30" }, "2027-05-30", alertDays)).toBe("valid");
    expect(documentAlert({ validUntil: "2027-06-30" }, "2027-05-31", alertDays)).toBe("expiring");
    expect(documentAlert({ validUntil: "2027-06-30" }, "2027-06-30", alertDays)).toBe("expiring");
  });

  it("une pièce dont le dernier jour est passé est expirée ; sans date, aucune alerte", () => {
    expect(documentAlert({ validUntil: "2027-06-30" }, "2027-07-01", alertDays)).toBe("expired");
    expect(documentAlert({ validUntil: null }, "2027-07-01", alertDays)).toBe("no_expiry");
  });

  it("compte en jours calendaires, passage à l'heure d'été compris", () => {
    // Fin mars 2027 : la nuit du 27 au 28 n'a que 23 heures.
    expect(documentAlert({ validUntil: "2027-04-26" }, "2027-03-27", alertDays)).toBe("expiring");
    expect(documentAlert({ validUntil: "2027-04-26" }, "2027-03-26", alertDays)).toBe("valid");
  });

  it("une pièce qui expire avant la date de l'évènement est signalée ; le jour même, elle vaut encore", () => {
    const documents = [
      { id: "a", validUntil: "2027-06-19", status: "verified" as const },
      { id: "b", validUntil: "2027-06-20", status: "verified" as const },
      { id: "c", validUntil: null, status: "verified" as const },
      { id: "d", validUntil: null, status: "requested" as const },
    ];
    expect(documentsLapsingBefore(documents, "2027-06-20").map((document) => document.id)).toEqual(["a"]);
  });
});

// Lot 73a (PRE-05 ; spécification du lot 73, § 5.1, critères 1 à 3 ; P3) — l'état résumé des pièces
// d'une fiche, pour le carnet, la fiche et le budget. Horloge simulée (« today »).
describe("PRE-05 — L'état résumé des pièces d'une fiche (lot 73a)", () => {
  const insurance = { kindId: "k-ins", label: "Attestation d'assurance responsabilité civile", shortLabel: "Assurance" };
  const kbis = { kindId: "k-kbis", label: "Extrait Kbis ou avis de situation Insee", shortLabel: "Kbis" };
  const plan = { kindId: "k-plan", label: "Plan du lieu", shortLabel: null };
  type Doc = Parameters<typeof documentState>[0]["documents"][number];
  const doc = (id: string, kind: typeof insurance, values: Partial<Doc>): Doc => ({
    documentId: id,
    ...kind,
    status: "verified",
    validUntil: null,
    requestedAt: null,
    uploadedAt: null,
    ...values,
  });
  const state = (documents: Doc[], today: string, options: { alertDays?: number; retainedEvents?: { eventId: string; eventDate: string; couple: string | null }[] } = {}) =>
    documentState({ documents, today, alertDays: options.alertDays ?? 30, retainedEvents: options.retainedEvents ?? [] });

  it("critère 1 — l'ordre : à renouveler, bientôt, à recevoir, à vérifier, à jour, aucune demandée", () => {
    const expired = doc("a", insurance, { validUntil: "2027-05-31" });
    const soon = doc("b", kbis, { validUntil: "2027-06-20" });
    const requested = doc("c", kbis, { status: "requested", requestedAt: "2027-06-01T09:00:00.000Z" });
    const toVerify = doc("d", kbis, { status: "to_verify", uploadedAt: "2027-06-02T09:00:00.000Z" });
    const valid = doc("e", plan as unknown as typeof insurance, { validUntil: "2028-01-01" });
    const today = "2027-06-10";
    expect(state([valid, toVerify, requested, soon, expired], today).state).toBe("expired");
    expect(state([valid, toVerify, requested, soon], today).state).toBe("expiring");
    expect(state([valid, toVerify, requested], today).state).toBe("requested");
    expect(state([valid, toVerify], today).state).toBe("to_verify");
    expect(state([valid], today).state).toBe("up_to_date");
    expect(state([], today).state).toBe("none_requested");
    // La plus pressante en tête, avec son nom court ; « + 3 » pour les autres à régler.
    const summary = state([valid, toVerify, requested, soon, expired], today);
    expect(summary.document).toMatchObject({ documentId: "a", shortLabel: "Assurance", validUntil: "2027-05-31" });
    expect(summary.othersToSettle).toBe(3);
    expect(summary.reason).toEqual({ code: "valid_until", date: "2027-05-31", upcomingRetained: 0 });
  });

  it("critère 1 — la veille de la fin, le jour de la fin (encore valable), le lendemain (expirée)", () => {
    const insuranceDoc = doc("a", insurance, { validUntil: "2027-06-30" });
    expect(state([insuranceDoc], "2027-06-29").state).toBe("expiring");
    expect(state([insuranceDoc], "2027-06-30").state).toBe("expiring");
    expect(state([insuranceDoc], "2027-07-01").state).toBe("expired");
    expect(state([insuranceDoc], "2027-06-29").reason).toEqual({ code: "expires_on", date: "2027-06-30" });
  });

  it("critère 1 — trentième et trente et unième jour avant la fin ; délai d'alerte réglé à 15 jours", () => {
    const insuranceDoc = doc("a", insurance, { validUntil: "2027-06-30" });
    expect(state([insuranceDoc], "2027-05-31").state).toBe("expiring");
    expect(state([insuranceDoc], "2027-05-30").state).toBe("up_to_date");
    expect(state([insuranceDoc], "2027-06-15", { alertDays: 15 }).state).toBe("expiring");
    expect(state([insuranceDoc], "2027-06-14", { alertDays: 15 }).state).toBe("up_to_date");
  });

  it("critère 1 — compte en jours calendaires, passage à l'heure d'été compris", () => {
    // La nuit du 27 au 28 mars 2027 n'a que 23 heures.
    const insuranceDoc = doc("a", insurance, { validUntil: "2027-04-26" });
    expect(state([insuranceDoc], "2027-03-27").state).toBe("expiring");
    expect(state([insuranceDoc], "2027-03-26").state).toBe("up_to_date");
  });

  it("critère 2 — valable mais finie avant un mariage où il est retenu : bientôt, « avant le mariage de … »", () => {
    const insuranceDoc = doc("a", insurance, { validUntil: "2027-09-30" });
    const events = [
      { eventId: "e2", eventDate: "2027-12-04", couple: "Inès & Hugo" },
      { eventId: "e1", eventDate: "2027-10-16", couple: "Léa & Maxime" },
      { eventId: "e0", eventDate: "2027-09-30", couple: "Le jour même" },
    ];
    const summary = state([insuranceDoc], "2027-06-10", { retainedEvents: events });
    expect(summary.state).toBe("expiring");
    // Le plus proche des mariages qui tombent après sa fin ; le jour même, elle vaut encore.
    expect(summary.reason).toEqual({ code: "before_event", eventId: "e1", eventDate: "2027-10-16", couple: "Léa & Maxime" });
    // Sans accès à ce mariage : « avant un mariage » (aucun nom).
    const hidden = state([insuranceDoc], "2027-06-10", { retainedEvents: [{ eventId: "e1", eventDate: "2027-10-16", couple: null }] });
    expect(hidden.reason).toEqual({ code: "before_event", eventId: "e1", eventDate: "2027-10-16", couple: null });
    // Un mariage passé ne compte pas.
    expect(state([insuranceDoc], "2027-06-10", { retainedEvents: [{ eventId: "old", eventDate: "2027-06-01", couple: "Passé" }] }).state).toBe("up_to_date");
  });

  it("critère 2 — expirée : « fin de validité le … », avec le nombre de mariages à venir où il est retenu", () => {
    const insuranceDoc = doc("a", insurance, { validUntil: "2027-05-31" });
    const events = [
      { eventId: "e1", eventDate: "2027-10-16", couple: null },
      { eventId: "e2", eventDate: "2027-12-04", couple: null },
    ];
    expect(state([insuranceDoc], "2027-06-10", { retainedEvents: events }).reason).toEqual({ code: "valid_until", date: "2027-05-31", upcomingRetained: 2 });
  });

  it("critère 3 — sans pièce, ou avec des pièces seulement demandées, jamais « À jour »", () => {
    expect(state([], "2027-06-10").state).toBe("none_requested");
    expect(state([], "2027-06-10").document).toBeNull();
    expect(state([doc("c", kbis, { status: "requested", requestedAt: "2027-06-01T09:00:00.000Z" })], "2027-06-10").state).toBe("requested");
    expect(state([doc("d", kbis, { status: "to_verify" })], "2027-06-10").state).toBe("to_verify");
    // Une pièce vérifiée sans date de fin vaut « À jour ».
    expect(state([doc("p", insurance, { validUntil: null })], "2027-06-10").state).toBe("up_to_date");
  });

  it("une pièce expirée remplacée par une pièce valable de la même nature ne compte plus", () => {
    const old = doc("old", insurance, { validUntil: "2026-12-31" });
    const renewed = doc("new", insurance, { validUntil: "2028-12-31" });
    expect(state([old, renewed], "2027-06-10").state).toBe("up_to_date");
  });

  it("à recevoir : la raison est la date de la demande ; à vérifier : le dépôt par son lien", () => {
    expect(state([doc("c", kbis, { status: "requested", requestedAt: "2027-06-01T09:00:00.000Z" })], "2027-06-10").reason).toEqual({ code: "requested_on", date: "2027-06-01T09:00:00.000Z" });
    expect(state([doc("d", kbis, { status: "to_verify", uploadedAt: "2027-06-02T09:00:00.000Z" })], "2027-06-10").reason).toEqual({ code: "uploaded_by_link", at: "2027-06-02T09:00:00.000Z" });
  });

  it("le rang de l'état et sa date ordonnent « Pièces à régler » (critère 4 du 73a)", () => {
    const today = "2027-06-10";
    const a = state([doc("a", insurance, { validUntil: "2027-06-01" })], today);
    const b = state([doc("b", insurance, { validUntil: "2027-05-01" })], today);
    const c = state([doc("c", kbis, { status: "requested", requestedAt: "2027-06-01T09:00:00.000Z" })], today);
    const sorted = [c, a, b].sort(compareDocumentStates);
    expect(sorted.map((entry) => entry.document?.documentId)).toEqual(["b", "a", "c"]);
    expect(documentStateNeedsAction(a)).toBe(true);
    expect(documentStateNeedsAction(state([], today))).toBe(false);
  });
});
