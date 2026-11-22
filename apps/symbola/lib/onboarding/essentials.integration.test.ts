// Lot 63f (HUB-09, HUB-18 ; ADR 0103) — assistant « L'essentiel » contre un vrai PostgreSQL : chaque
// étape écrit dans les réglages existants sans effacer les autres champs, une valeur mal formée
// n'écrit rien, et une organisation ne touche jamais la fiche d'une autre.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  changeVatRegime,
  getOrganizationProfile,
  getSellerDetails,
  InvalidDocumentDetailsError,
  InvalidOrganizationNameError,
  recordHelpProgress,
  saveCompanyEssentials,
  saveCompanySheet,
} from "@/modules/hub/service";
import { essentialsDone, loadEssentials, ESSENTIALS_PROGRESS_KEY } from "./essentials";

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

async function organization() {
  const created = await createOrganization(db, `Org essentiel ${randomUUID()}`);
  const user = await createUser(db, { organizationId: created.id, email: `essentiel-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: created.id, userId: user.id };
}

describe("HUB-09, HUB-18 — Assistant « L'essentiel » : écrit dans les réglages existants", () => {
  it("l'étape « Votre société » règle la raison sociale et le SIRET sans toucher l'adresse ni le site", async () => {
    const { organizationId } = await organization();
    await saveCompanySheet(db, organizationId, {
      siren: null,
      legalForm: null,
      metier: "wedding_planner",
      metierPrecision: null,
      address: { address: "4 place Bellecour", postalCode: "69002", city: "Lyon", countryCode: "FR" },
      details: { siret: null, contactEmail: null, contactPhone: null, website: "atelier.example", vatNumber: null, registration: null, shareCapitalCents: null },
    });

    await saveCompanyEssentials(db, organizationId, { organizationName: "  Atelier   Lumière ", legalForm: "sasu", siret: "732 829 320 00074" });

    const details = await getSellerDetails(db, organizationId);
    expect(details.organizationName).toBe("Atelier Lumière");
    expect(details.siret).toBe("73282932000074");
    expect(details.legalForm).toBe("sasu");
    expect(details.address).toBe("4 place Bellecour");
    expect(details.city).toBe("Lyon");
    expect(details.website).toBe("atelier.example");
    expect((await getOrganizationProfile(db, organizationId)).metier).toBe("wedding_planner");
  });

  it("un SIRET mal formé est refusé et rien n'est écrit, pas même la raison sociale", async () => {
    const { organizationId } = await organization();
    const before = (await getSellerDetails(db, organizationId)).organizationName;
    await expect(saveCompanyEssentials(db, organizationId, { organizationName: "Nouveau nom", siret: "123" })).rejects.toBeInstanceOf(InvalidDocumentDetailsError);
    const details = await getSellerDetails(db, organizationId);
    expect(details.organizationName).toBe(before);
    expect(details.siret).toBeNull();
  });

  it("une raison sociale vide est refusée (elle est imprimée sur chaque document)", async () => {
    const { organizationId } = await organization();
    await expect(saveCompanyEssentials(db, organizationId, { organizationName: "   " })).rejects.toBeInstanceOf(InvalidOrganizationNameError);
  });

  it("aucun champ bloquant : l'étape « Adresse et contact » s'enregistre vide", async () => {
    const { organizationId } = await organization();
    await saveCompanyEssentials(db, organizationId, { address: { address: "", postalCode: "", city: "", countryCode: "FR" }, contactEmail: null, contactPhone: null });
    const details = await getSellerDetails(db, organizationId);
    expect(details.address).toBeNull();
  });

  it("isolation : régler la fiche de l'organisation A ne change pas celle de B", async () => {
    const a = await organization();
    const b = await organization();
    const nameB = (await getSellerDetails(db, b.organizationId)).organizationName;
    await saveCompanyEssentials(db, a.organizationId, { organizationName: "Org A renommée", siret: "73282932000074" });
    const detailsB = await getSellerDetails(db, b.organizationId);
    expect(detailsB.organizationName).toBe(nameB);
    expect(detailsB.siret).toBeNull();
  });

  it("l'étape atteinte est gardée par compte, et l'essentiel est réglé quand rien ne manque pour un devis", async () => {
    const { organizationId, userId } = await organization();
    await recordHelpProgress(db, { userId, itemKey: ESSENTIALS_PROGRESS_KEY, status: "started", step: 2 });
    await saveCompanyEssentials(db, organizationId, {
      organizationName: "Atelier Lumière",
      siret: "73282932000074",
      address: { address: "12 rue des Tilleuls", postalCode: "69002", city: "Lyon", countryCode: "FR" },
    });
    let snapshot = await loadEssentials(organizationId, userId);
    expect(snapshot.reached).toBe(2);
    expect(essentialsDone(snapshot)).toBe(false);
    // Le régime de TVA, dernier obligatoire.
    await saveCompanySheet(db, organizationId, {
      siren: null,
      legalForm: null,
      metier: null,
      metierPrecision: null,
      address: { address: "12 rue des Tilleuls", postalCode: "69002", city: "Lyon", countryCode: "FR" },
      details: { siret: "73282932000074", contactEmail: null, contactPhone: null, website: null, vatNumber: null, registration: null, shareCapitalCents: null },
    });
    await changeVatRegime(db, { organizationId, userId, newRegime: "franchise", effectiveDate: "2026-11-21" });
    snapshot = await loadEssentials(organizationId, userId);
    expect(essentialsDone(snapshot)).toBe(true);
  });
});
