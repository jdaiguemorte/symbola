// Lot 62b (UX-12) — la fiche de l'entreprise s'enregistre d'un seul geste (identité, adresse,
// coordonnées imprimées). Contre un vrai PostgreSQL.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization } from "@symbola/auth";
import { getOrganizationProfile, getSellerDetails, InvalidDocumentDetailsError, InvalidSellerAddressError, saveCompanySheet, type CompanySheetInput } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

const SHEET: CompanySheetInput = {
  siren: "123456789",
  legalForm: "sasu",
  metier: "wedding_planner",
  metierPrecision: null,
  address: { address: " 12 rue des Lilas ", postalCode: "59000", city: "Lille", countryCode: "fr" },
  details: { siret: "123 456 789 00012", contactEmail: "bonjour@atelier.example", contactPhone: "03 20 00 00 00", website: "atelier.example", vatNumber: "fr40123456789", registration: "RCS Lille 123 456 789", shareCapitalCents: 1_000_000 },
};

describe("UX-12 — Entreprise et TVA : un seul « Enregistrer la fiche » (lot 62b)", () => {
  it("enregistre l'identité, l'adresse et les coordonnées imprimées d'un seul geste, nettoyées", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await saveCompanySheet(db, organization.id, SHEET);

    const profile = await getOrganizationProfile(db, organization.id);
    expect(profile).toMatchObject({ siren: "123456789", legalForm: "sasu", metier: "wedding_planner", address: "12 rue des Lilas", postalCode: "59000", city: "Lille", countryCode: "FR" });
    const details = await getSellerDetails(db, organization.id);
    expect(details).toMatchObject({ siret: "12345678900012", contactEmail: "bonjour@atelier.example", vatNumber: "FR40123456789", registration: "RCS Lille 123 456 789", shareCapitalCents: 1_000_000 });
  });

  it("une coordonnée refusée n'enregistre rien : ni l'identité, ni l'adresse", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await expect(saveCompanySheet(db, organization.id, { ...SHEET, details: { ...SHEET.details, siret: "1234" } })).rejects.toBeInstanceOf(InvalidDocumentDetailsError);

    const profile = await getOrganizationProfile(db, organization.id);
    expect(profile.siren).toBeNull();
    expect(profile.city).toBeNull();
    expect((await getSellerDetails(db, organization.id)).contactEmail).toBeNull();
  });

  it("une adresse refusée n'enregistre rien : ni l'identité, ni les coordonnées", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await expect(saveCompanySheet(db, organization.id, { ...SHEET, address: { ...SHEET.address, countryCode: "France" } })).rejects.toBeInstanceOf(InvalidSellerAddressError);

    expect((await getOrganizationProfile(db, organization.id)).siren).toBeNull();
    expect((await getSellerDetails(db, organization.id)).siret).toBeNull();
  });

  it("vider un champ l'efface ; les réglages hors de la fiche (régime de TVA, mentions) ne bougent pas", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await saveCompanySheet(db, organization.id, SHEET);
    await saveCompanySheet(db, organization.id, { ...SHEET, siren: null, details: { ...SHEET.details, website: null } });

    const profile = await getOrganizationProfile(db, organization.id);
    expect(profile.siren).toBeNull();
    expect(profile.vatRegime).toBeNull();
    expect((await getSellerDetails(db, organization.id)).website).toBeNull();
  });

  it("la fiche d'une organisation ne change pas celle d'une autre", async () => {
    const first = await createOrganization(db, `Org ${randomUUID()}`);
    const second = await createOrganization(db, `Org ${randomUUID()}`);
    await saveCompanySheet(db, first.id, SHEET);
    await saveCompanySheet(db, second.id, { ...SHEET, siren: "987654321", details: { ...SHEET.details, siret: "98765432100019" } });

    expect((await getOrganizationProfile(db, first.id)).siren).toBe("123456789");
    expect((await getSellerDetails(db, first.id)).siret).toBe("12345678900012");
    expect((await getSellerDetails(db, second.id)).siret).toBe("98765432100019");
  });
});
