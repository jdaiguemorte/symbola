import { describe, expect, it } from "vitest";
import { findPersonalData, redactPersonalData } from "./log-redaction";

describe("SEC-20 — Repérer les données personnelles dans un journal", () => {
  it("repère et masque une adresse e-mail, y compris dans une erreur de base", () => {
    const line = 'duplicate key value violates unique constraint "users_email_unique": Key (email)=(ines.martin+mariage@exemple.fr) already exists.';
    expect(findPersonalData(line).map((finding) => finding.kind)).toEqual(["email"]);
    expect(redactPersonalData(line)).toBe('duplicate key value violates unique constraint "users_email_unique": Key (email)=([e-mail]) already exists.');
  });

  it("repère un numéro de téléphone français, quel que soit son format", () => {
    for (const phone of ["06 12 34 56 78", "06.12.34.56.78", "06-12-34-56-78", "0612345678", "+33 6 12 34 56 78", "+33612345678", "+33 (0)6 12 34 56 78"]) {
      expect(findPersonalData(`rappeler le ${phone} demain`), phone).toEqual([{ kind: "phone", index: 12 }]);
      expect(redactPersonalData(`rappeler le ${phone} demain`), phone).toBe("rappeler le [téléphone] demain");
    }
  });

  it("repère un numéro étranger écrit avec son indicatif", () => {
    expect(redactPersonalData("témoin : +44 20 7946 0958, +32 470 12 34 56")).toBe("témoin : [téléphone], [téléphone]");
  });

  it("ne prend pas pour une donnée personnelle un identifiant, une date, une durée ou une adresse technique", () => {
    const technical = [
      "organisation 550e8400-e29b-41d4-a716-061234567890 : 3 anomalie(s)",
      "demande 0612345678ab traitée",
      "horodatage 1731360000000, durée 1234567890 ms",
      "le 2026-11-11T10:00:00.000Z à 06:12:34",
      "connexion postgres://symbola_app:secret@localhost:5432/symbola",
      "module @symbola/db chargé",
      "version 1.06.12.34.56",
    ];
    for (const line of technical) expect(findPersonalData(line), line).toEqual([]);
  });

  it("donne la position de chaque donnée, dans l'ordre du texte", () => {
    expect(findPersonalData("0612345678 puis a@b.fr")).toEqual([
      { kind: "phone", index: 0 },
      { kind: "email", index: 16 },
    ]);
  });
});
