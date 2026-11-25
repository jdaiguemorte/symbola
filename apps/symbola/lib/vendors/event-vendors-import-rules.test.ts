// Lot 67e (HUB-14, PRE-02, BUD-04 ; recette du 24/11/2026, R07) — règles de l'aperçu de la reprise
// des prestataires retenus d'un évènement.
import { describe, expect, it } from "vitest";
import type { EventVendorsExportRow } from "@symbola/import-engine";
import { importHeaderCheck, importedVendorInput, matchCarnetVendor, matchImportVendorType, proposeImportSlot, resolveImportChoice } from "./event-vendors-import-rules";

const row = (values: Partial<EventVendorsExportRow>): EventVendorsExportRow => ({ line: 1, type: "Photographe", name: "Studio Lumière", contact: null, email: null, phone: null, instagram: null, planner: false, ...values });
const slots = [
  { id: "s-lieu", label: "Lieu de réception", vendorNames: [] },
  { id: "s-traiteur", label: "Traiteur", vendorNames: [] },
  { id: "s-photo", label: "Photographe", vendorNames: [] },
  { id: "s-fleurs", label: "Fleurs", vendorNames: ["Pétales & Compagnie"] },
];
const synonyms = [["Fleuriste", "Fleurs"]];

describe("BUD-04 — La ligne du budget proposée pour un prestataire du fichier (lot 67e)", () => {
  it("propose la ligne au même libellé que son métier", () => {
    expect(proposeImportSlot(row({ type: "Photographe" }), slots)).toBe("s-photo");
  });

  it("propose la ligne où ce prestataire est déjà, quel que soit le métier écrit", () => {
    expect(proposeImportSlot(row({ type: "Décoration florale", name: "Pétales et Compagnie" }), slots)).toBe("s-fleurs");
  });

  it("un mot voisin ne suffit pas : « Photobooth » ne va pas sur « Photographe »", () => {
    expect(proposeImportSlot(row({ type: "Photobooth", name: "FlashBooth" }), slots)).toBeNull();
    expect(proposeImportSlot(row({ type: "Robe de mariée", name: "Atelier de Margot" }), slots)).toBeNull();
  });

  it("reconnaît un synonyme du métier (données de départ) et un libellé qui commence par le métier", () => {
    expect(proposeImportSlot(row({ type: "Fleuriste", name: "Fleurs du Clain" }), slots, synonyms)).toBe("s-fleurs");
    expect(proposeImportSlot(row({ type: "Lieu", name: "Domaine des Tilleuls" }), slots)).toBe("s-lieu");
  });

  it("ne propose rien quand aucune ligne ne convient, ou quand deux conviennent autant", () => {
    expect(proposeImportSlot(row({ type: "Baby-Sitter", name: "Les P'tits Loups" }), slots)).toBeNull();
    expect(proposeImportSlot(row({ type: "Photographe" }), [...slots, { id: "s-photo-2", label: "Photographe", vendorNames: [] }])).toBeNull();
  });
});

describe("PRE-02 — La fiche du carnet rapprochée d'une ligne du fichier (lot 67e)", () => {
  const carnet = [
    { id: "v1", name: "Studio Lumière", city: "Tours" },
    { id: "v2", name: "Nuit Blanche Sono", city: null },
  ];

  it("retrouve la fiche au même nom, aux accents et à la casse près", () => {
    expect(matchCarnetVendor(row({ name: "STUDIO LUMIERE" }), carnet)?.id).toBe("v1");
  });

  it("ne rapproche pas un nom seulement voisin, ni deux fiches qui se valent", () => {
    expect(matchCarnetVendor(row({ name: "Studio Photo Martin" }), carnet)).toBeNull();
    expect(matchCarnetVendor(row({ name: "Studio Lumière" }), [...carnet, { id: "v3", name: "Studio Lumière", city: "Poitiers" }])).toBeNull();
  });

  it("le métier d'une fiche à créer est celui du carnet au même libellé ou synonyme, sinon aucun", () => {
    const types = [
      { id: "t-photo", label: "Photographe" },
      { id: "t-fleurs", label: "Fleurs" },
    ];
    expect(matchImportVendorType("photographe", types)).toBe("t-photo");
    expect(matchImportVendorType("Fleuriste", types, synonyms)).toBe("t-fleurs");
    expect(matchImportVendorType("Baby-Sitter", types, synonyms)).toBeNull();
  });

  it("la fiche créée reprend le contact, l'e-mail, le téléphone nettoyé et l'Instagram", () => {
    expect(importedVendorInput(row({ contact: "Maud SERVAIS", email: "a@exemple.invalid", phone: "06.39.98.01.04.", instagram: "@au.fildesdetails" }), "t-photo")).toEqual({
      name: "Studio Lumière",
      typeIds: ["t-photo"],
      primaryTypeId: "t-photo",
      contactName: "Maud SERVAIS",
      email: "a@exemple.invalid",
      phone: "06.39.98.01.04",
      socialLinks: [{ network: "instagram", url: "https://www.instagram.com/au.fildesdetails/" }],
    });
  });

  it("un Instagram qui n'a pas la forme d'un identifiant n'est pas repris ; sans métier, la fiche est à classer", () => {
    expect(importedVendorInput(row({ instagram: "voir site : https://exemple.invalid" }), null)).toEqual({ name: "Studio Lumière", contactName: null, email: null, phone: null });
  });
});

describe("HUB-14 — Contrôle de l'en-tête et choix de la planner (lot 67e)", () => {
  it("compare la date du fichier à celle de l'évènement ; sans date, on ne sait pas", () => {
    expect(importHeaderCheck({ eventDate: "2027-06-12" }, { eventDate: "2027-06-12" })).toBe("same");
    expect(importHeaderCheck({ eventDate: "2027-06-12" }, { eventDate: "2027-09-04" })).toBe("different");
    expect(importHeaderCheck({ eventDate: null }, { eventDate: "2027-09-04" })).toBe("unknown");
    expect(importHeaderCheck({ eventDate: "2027-06-12" }, { eventDate: null })).toBe("unknown");
  });

  const valid = { vendorIds: new Set(["v1"]), slotIds: new Set(["s-photo"]) };

  it("sans choix, la proposition s'applique ; sans proposition, une fiche et une ligne sont créées", () => {
    expect(resolveImportChoice({ planner: false, vendorId: "v1", slotId: "s-photo" }, undefined, valid)).toEqual({ skip: false, vendor: "v1", slot: "s-photo" });
    expect(resolveImportChoice({ planner: false, vendorId: null, slotId: null }, undefined, valid)).toEqual({ skip: false, vendor: "new", slot: "new" });
  });

  it("le choix de la planner l'emporte ; une fiche ou une ligne inconnue est ignorée", () => {
    expect(resolveImportChoice({ planner: false, vendorId: "v1", slotId: "s-photo" }, { vendor: "new", slot: "new" }, valid)).toEqual({ skip: false, vendor: "new", slot: "new" });
    expect(resolveImportChoice({ planner: false, vendorId: null, slotId: null }, { vendor: "d-une-autre-organisation", slot: "d-un-autre-evenement" }, valid)).toEqual({ skip: false, vendor: "new", slot: "new" });
  });

  it("la ligne de la planner n'est jamais reprise, même cochée par erreur", () => {
    expect(resolveImportChoice({ planner: true, vendorId: null, slotId: null }, { skip: false }, valid).skip).toBe(true);
  });
});
