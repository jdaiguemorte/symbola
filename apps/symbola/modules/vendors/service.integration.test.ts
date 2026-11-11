// Lot 11 (L11-PRE-01 à L11-PRE-07, L11-PRE-09) — carnet de prestataires contre un vrai
// PostgreSQL (RLS) et le stockage privé, par la porte d'entrée du module.
// Géocodeur simulé (GEOCODER non défini hors production, ADR 0031).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { vendorsPrivacy } from "./privacy";
import {
  addDefaultVendorSlots,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  listEventVendorSlots,
  selectVendorCandidate,
  updateVendorCandidate,
} from "@/modules/events/service";
import {
  addVendorTypeField,
  archiveVendor,
  attachVendorFile,
  createVendor,
  createVendorTag,
  createVendorType,
  findVendors,
  getVendor,
  getVendorFile,
  getVendorHistory,
  InvalidVendorFieldValueError,
  InvalidVendorLinkError,
  listVendorTypes,
  removeDemoVendors,
  removeVendorTag,
  saveVendorSettings,
  searchVendorBook,
  setVendorLocation,
  updateVendor,
  VendorFileRejectedError,
} from "./service";

const plannerId = randomUUID();
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function newOrganization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

async function hotelType(organizationId: string) {
  const type = await createVendorType(organizationId, "Hôtel", "#2F5D7C");
  const beds = await addVendorTypeField(organizationId, type.id, { label: "Couchages", kind: "number", isFilter: true });
  const price = await addVendorTypeField(organizationId, type.id, { label: "Tarif par nuit", kind: "amount", isFilter: true });
  const shuttle = await addVendorTypeField(organizationId, type.id, { label: "Navette", kind: "boolean", isFilter: true });
  return { type, beds, price, shuttle };
}

describe("L11-PRE-01 — Fiche d'un prestataire", () => {
  it("enregistre coordonnées, type, champs, étiquettes et note ; l'adresse est placée sur la carte", async () => {
    const organizationId = await newOrganization();
    const { type, beds, price } = await hotelType(organizationId);
    const tag = await createVendorTag(organizationId, "navette");

    const { vendor, geocoding } = await createVendor(organizationId, {
      name: "  Hôtel du Beffroi ",
      typeId: type.id,
      contactName: "Claire",
      email: "contact@beffroi.example",
      addressLine: "1 place du Théâtre",
      postalCode: "59000",
      city: "Lille",
      internalNote: "Tarif groupe dès 20 chambres",
      fieldValues: { [beds.id]: 62, [price.id]: 11800 },
      tagIds: [tag.id, randomUUID()],
    });

    expect(geocoding).toBe("placed");
    expect(vendor).toMatchObject({
      name: "Hôtel du Beffroi",
      typeId: type.id,
      city: "Lille",
      location: { latitude: 50.6292, longitude: 3.0573, source: "geocoded" },
      fieldValues: { [beds.id]: 62, [price.id]: 11800 },
      tagIds: [tag.id],
    });
    expect((await getVendor(organizationId, vendor.id))?.internalNote).toBe("Tarif groupe dès 20 chambres");
  });

  it("refuse une valeur de champ mal formée", async () => {
    const organizationId = await newOrganization();
    const { type, price } = await hotelType(organizationId);
    await expect(createVendor(organizationId, { name: "X", typeId: type.id, fieldValues: { [price.id]: 12.5 } })).rejects.toBeInstanceOf(InvalidVendorFieldValueError);
  });

  it("L11-PRE-03 — adresse introuvable : fiche enregistrée sans point ; point corrigé à la main gardé tant que l'adresse ne change pas", async () => {
    const organizationId = await newOrganization();
    const { vendor, geocoding } = await createVendor(organizationId, { name: "Gîte", typeId: null, addressLine: "lieu-dit introuvable" });
    expect(geocoding).toBe("not_found");
    expect(vendor.location).toBeNull();

    await setVendorLocation(organizationId, vendor.id, 50.5, 3.1);
    const unchanged = await updateVendor(organizationId, vendor.id, { name: "Gîte des Prés", typeId: null, addressLine: "lieu-dit introuvable" });
    expect(unchanged.geocoding).toBe("unchanged");
    expect(unchanged.vendor.location).toEqual({ latitude: 50.5, longitude: 3.1, source: "manual" });

    const moved = await updateVendor(organizationId, vendor.id, { name: "Gîte des Prés", typeId: null, city: "Arras" });
    expect(moved.vendor.location).toEqual({ latitude: 50.291, longitude: 2.7775, source: "geocoded" });
  });

  it("plaquettes et RIB : fichiers privés vérifiés ; un autre format est refusé", async () => {
    const organizationId = await newOrganization();
    const { vendor } = await createVendor(organizationId, { name: "Maison Verdier", typeId: null });

    const rib = await attachVendorFile({ organizationId, vendorId: vendor.id, kind: "rib", fileName: "RIB Verdier.pdf", content: TINY_PDF, uploadedByUserId: plannerId });
    expect((await getVendorFile(organizationId, rib.id)).fileName).toBe("RIB Verdier.pdf");
    expect((await getVendor(organizationId, vendor.id))?.files.map((file) => file.kind)).toEqual(["rib"]);
    await expect(
      attachVendorFile({ organizationId, vendorId: vendor.id, kind: "brochure", fileName: "x.html", content: Buffer.from("<html></html>"), uploadedByUserId: plannerId }),
    ).rejects.toBeInstanceOf(VendorFileRejectedError);
  });

  it("une autre organisation ne voit pas la fiche ni ses fichiers", async () => {
    const organizationId = await newOrganization();
    const otherId = await newOrganization();
    const { vendor } = await createVendor(organizationId, { name: "Maison Verdier", typeId: null, city: "Lille" });
    const file = await attachVendorFile({ organizationId, vendorId: vendor.id, kind: "rib", fileName: "rib.pdf", content: TINY_PDF, uploadedByUserId: plannerId });

    expect(await getVendor(otherId, vendor.id)).toBeNull();
    expect(await findVendors({ organizationId: otherId })).toEqual([]);
    await expect(getVendorFile(otherId, file.id)).rejects.toMatchObject({ name: "VendorFileNotFoundError" });
    await expect(updateVendor(otherId, vendor.id, { name: "Intrus", typeId: null })).rejects.toMatchObject({ name: "VendorNotFoundError" });
  });
});

describe("L11-PRE-02 — Types, champs et étiquettes", () => {
  it("types et champs sont propres à l'organisation ; une liste de choix demande des choix", async () => {
    const organizationId = await newOrganization();
    const { type } = await hotelType(organizationId);
    await expect(addVendorTypeField(organizationId, type.id, { label: "Cuisine", kind: "choice", choices: [] })).rejects.toBeInstanceOf(RangeError);
    const listed = await listVendorTypes(organizationId);
    expect(listed.map((entry) => [entry.label, entry.fields.map((field) => field.kind)])).toEqual([["Hôtel", ["number", "amount", "boolean"]]]);
    expect(await listVendorTypes(await newOrganization())).toEqual([]);
  });

  it("une étiquette supprimée disparaît des fiches", async () => {
    const organizationId = await newOrganization();
    const tag = await createVendorTag(organizationId, "bio");
    expect((await createVendorTag(organizationId, "BIO")).id).toBe(tag.id);
    const { vendor } = await createVendor(organizationId, { name: "Ferme", typeId: null, tagIds: [tag.id] });
    await removeVendorTag(organizationId, tag.id);
    expect((await getVendor(organizationId, vendor.id))?.tagIds).toEqual([]);
  });
});

describe("L11-PRE-04 à L11-PRE-07 — Recherche, filtres, cercle et trajet estimé", () => {
  it("combine type, champs-filtres, étiquettes et texte (sans accents)", async () => {
    const organizationId = await newOrganization();
    const { type, beds, price, shuttle } = await hotelType(organizationId);
    const tag = await createVendorTag(organizationId, "groupe");
    await createVendor(organizationId, { name: "Hôtel du Beffroi", typeId: type.id, city: "Lille", fieldValues: { [beds.id]: 62, [price.id]: 11800, [shuttle.id]: true }, tagIds: [tag.id] });
    await createVendor(organizationId, { name: "Les Chambres de la Deûle", typeId: type.id, city: "Lille", fieldValues: { [beds.id]: 44, [price.id]: 9600 } });
    await createVendor(organizationId, { name: "Château de Marcq", typeId: type.id, city: "Roubaix", fieldValues: { [beds.id]: 80, [price.id]: 13900 } });
    await createVendor(organizationId, { name: "Traiteur Deûle", typeId: null, city: "Lille" });

    const names = async (input: Omit<Parameters<typeof findVendors>[0], "organizationId">) => (await findVendors({ organizationId, ...input })).map((vendor) => vendor.name);

    expect(await names({ typeIds: [type.id], fieldFilters: [{ fieldId: beds.id, op: "gte", value: 50 }] })).toEqual(["Château de Marcq", "Hôtel du Beffroi"]);
    expect(await names({ fieldFilters: [{ fieldId: price.id, op: "lte", value: 12000 }] })).toEqual(["Hôtel du Beffroi", "Les Chambres de la Deûle"]);
    expect(await names({ fieldFilters: [{ fieldId: shuttle.id, op: "eq", value: true }] })).toEqual(["Hôtel du Beffroi"]);
    expect(await names({ tagIds: [tag.id] })).toEqual(["Hôtel du Beffroi"]);
    expect(await names({ text: "deule" })).toEqual(["Les Chambres de la Deûle", "Traiteur Deûle"]);
    // Un filtre qui ne convient pas au champ est ignoré, pas en erreur.
    expect(await names({ fieldFilters: [{ fieldId: shuttle.id, op: "gte", value: true }] })).toHaveLength(4);
  });

  it("cercle de N km autour d'un point : trié par distance, avec un trajet estimé selon les paramètres", async () => {
    const organizationId = await newOrganization();
    await createVendor(organizationId, { name: "Lille centre", typeId: null, city: "Lille" });
    await createVendor(organizationId, { name: "Roubaix", typeId: null, city: "Roubaix" });
    await createVendor(organizationId, { name: "Arras", typeId: null, city: "Arras" });
    await createVendor(organizationId, { name: "Sans adresse", typeId: null });
    await saveVendorSettings(organizationId, { detourFactorPermille: 1500, averageSpeedKmh: 50 });

    const found = await findVendors({ organizationId, around: { latitude: 50.6292, longitude: 3.0573, radiusKm: 20 } });

    expect(found.map((vendor) => vendor.name)).toEqual(["Lille centre", "Roubaix"]);
    expect(found[0]?.travel).toEqual({ distanceKm: 0, minutes: 1 });
    // Lille → Roubaix ≈ 11,0 km à vol d'oiseau × 1,5 = 16,5 km, à 50 km/h ≈ 20 min.
    expect(found[1]?.travel).toEqual({ distanceKm: 16.5, minutes: 20 });
  });

  it("« déjà travaillé avec » : seulement les fiches retenues au moins une fois ; les fiches archivées sont masquées", async () => {
    const organizationId = await newOrganization();
    const { vendor: worked } = await createVendor(organizationId, { name: "Déjà retenu", typeId: null });
    const { vendor: archived } = await createVendor(organizationId, { name: "Archivé", typeId: null });
    await createVendor(organizationId, { name: "Jamais", typeId: null });
    await addDefaultVendorSlots(organizationId, ["Traiteur"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }] });
    const [slot] = await listEventVendorSlots(organizationId, event.id);
    const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: slot!.id, vendorName: worked.name, vendorId: worked.id });
    await selectVendorCandidate({ organizationId, candidateId: candidate.id, changedByUserId: plannerId });
    await archiveVendor(organizationId, archived.id);

    expect((await findVendors({ organizationId, workedWith: true })).map((vendor) => vendor.name)).toEqual(["Déjà retenu"]);
    expect((await findVendors({ organizationId })).map((vendor) => vendor.name)).toEqual(["Déjà retenu", "Jamais"]);
  });
});

describe("L11-PRE-09 — Historique avec la planner", () => {
  it("événements, issue, prix devisé, prix final (réel du budget) et prix moyen", async () => {
    const organizationId = await newOrganization();
    const { vendor } = await createVendor(organizationId, { name: "Maison Verdier", typeId: null });
    await addDefaultVendorSlots(organizationId, ["Traiteur"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }] });
    const [slot] = await listEventVendorSlots(organizationId, event.id);
    const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: slot!.id, vendorName: vendor.name, vendorId: vendor.id });
    await updateVendorCandidate({ organizationId, candidateId: candidate.id, quoteAmountCents: 348000 });
    await selectVendorCandidate({ organizationId, candidateId: candidate.id, changedByUserId: plannerId });

    // Sans budget confirmé, pas de prix final.
    const history = await getVendorHistory(organizationId, vendor.id);
    expect(history.entries).toEqual([
      { eventId: event.id, eventNames: "Léa", eventDate: null, slotLabel: "Traiteur", outcome: "selected", quotedCents: 348000, finalCents: null },
    ]);
    expect(history.averageFinalCents).toBeNull();
  });
});

describe("AIDE-08 et RGPD — recherche globale, contrat privacy/v1, exemples", () => {
  it("la recherche globale trouve une fiche par son nom ou sa ville, jamais une fiche d'exemple", async () => {
    const organizationId = await newOrganization();
    await createVendor(organizationId, { name: "Hôtel du Beffroi", typeId: null, city: "Lille" });
    const { vendor: demo } = await createVendor(organizationId, { name: "Hôtel exemple", typeId: null, city: "Lille" }, { isDemo: true });

    expect((await searchVendorBook(organizationId, ["hotel"], 6)).map((result) => result.name)).toEqual(["Hôtel du Beffroi"]);
    await removeDemoVendors(organizationId, [demo.id]);
    expect(await getVendor(organizationId, demo.id)).toBeNull();
  });

  it("trouve la personne par son e-mail ou son nom, et l'oubli efface tout ce qui la désigne", async () => {
    const organizationId = await newOrganization();
    const { vendor } = await createVendor(organizationId, {
      name: "Studio Lumière",
      typeId: null,
      contactName: "Jeanne Martin",
      email: "jeanne@studio.example",
      city: "Lille",
      website: "www.jeanne-martin.example",
      socialLinks: [{ network: "instagram", url: "https://www.instagram.com/jeanne.martin" }],
      siret: "123 456 789 00011",
    });
    // Lot 14 (décision M) : adresse web complétée, SIRET réduit à ses chiffres.
    expect(vendor).toMatchObject({ website: "https://www.jeanne-martin.example", siret: "12345678900011" });
    await attachVendorFile({ organizationId, vendorId: vendor.id, kind: "rib", fileName: "rib.pdf", content: TINY_PDF, uploadedByUserId: plannerId });

    const records = await vendorsPrivacy.find({ organizationId, terms: { email: "JEANNE@studio.example" } });
    expect(records.map((record) => record.recordId)).toEqual([vendor.id]);
    expect(records[0]!.fields).toMatchObject({ website: "https://www.jeanne-martin.example", siret: "12345678900011" });
    expect((await vendorsPrivacy.find({ organizationId, terms: { name: "12345678900011" } })).length).toBe(1);
    expect(await vendorsPrivacy.find({ organizationId: await newOrganization(), terms: { name: "Jeanne Martin" } })).toEqual([]);

    const input = { organizationId, records: [{ kind: "vendor", recordId: vendor.id }], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 }, today: "2026-11-04" };
    expect(await vendorsPrivacy.planErasure(input)).toEqual([{ kind: "vendor", recordId: vendor.id, fate: "anonymized", legalBasis: null, keptUntil: null }]);
    await vendorsPrivacy.erase(input);
    const erased = await getVendor(organizationId, vendor.id);
    expect(erased).toMatchObject({ name: "[anonymisé]", contactName: null, email: null, location: null, archived: true, files: [], website: null, socialLinks: [], siret: null, importedFields: null });
  });

  it("lot 14 (décision M) : une adresse web ou un SIRET illisibles sont refusés", async () => {
    const organizationId = await newOrganization();
    await expect(createVendor(organizationId, { name: "X", typeId: null, website: "pas un site" })).rejects.toThrow(InvalidVendorLinkError);
    await expect(createVendor(organizationId, { name: "X", typeId: null, siret: "1234" })).rejects.toThrow(InvalidVendorLinkError);
    const { vendor } = await createVendor(organizationId, { name: "X", typeId: null, socialLinks: [{ network: "facebook", url: "illisible" }] });
    expect(vendor.socialLinks).toEqual([]);
  });
});
