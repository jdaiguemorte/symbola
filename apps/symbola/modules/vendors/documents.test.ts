import { describe, expect, it } from "vitest";
import { documentAlert, documentsLapsingBefore } from "./documents";

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
