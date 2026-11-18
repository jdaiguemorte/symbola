// Lot 48a (DAT-08 ; D5, ADR 0093) — IBAN et BIC de la planner chiffrés au niveau du champ : la base n'en
// garde aucune valeur en clair, les réglages et l'export les rendent, et une organisation d'avant la
// migration (valeur en clair) se lit encore, puis se chiffre à l'enregistrement suivant.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { quoteSettings } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { exportQuotesData, getDocumentSettings, updateDocumentSettings } from "./service";

const { sql, db } = createAppConnection();
const IBAN = "FR7630006000011234567890189";

afterAll(async () => {
  await sql.end();
});

describe("DAT-08 — IBAN et BIC de la planner chiffrés (lot 48a, D5)", () => {
  it("la base ne contient aucun IBAN en clair ; les réglages et l'export le rendent", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const organizationId = organization.id;
    await updateDocumentSettings(organizationId, { ...(await getDocumentSettings(organizationId)), iban: IBAN, bic: "AGRIFRPP" });
    const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(quoteSettings));
    expect(row).toMatchObject({ iban: null, bic: null });
    expect(JSON.stringify(row)).not.toContain("30006000011234567890189");
    expect(row!.ibanSealed).toMatch(/^f1:/);
    expect(await getDocumentSettings(organizationId)).toMatchObject({ iban: IBAN, bic: "AGRIFRPP" });
    const exported = await exportQuotesData(organizationId, { excludedEventIds: new Set() });
    const settings = exported.entities.find((entity) => entity.name === "quote_settings")!.rows[0]!;
    expect(settings).toMatchObject({ iban: IBAN, bic: "AGRIFRPP" });
    expect(settings).not.toHaveProperty("ibanSealed");
  });

  it("une valeur encore en clair (étape de données pas passée) se lit, puis se chiffre au prochain enregistrement", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const organizationId = organization.id;
    await withOrganization(db, organizationId, (tx) => tx.insert(quoteSettings).values({ organizationId, iban: IBAN, bic: "AGRIFRPP" }));
    expect(await getDocumentSettings(organizationId)).toMatchObject({ iban: IBAN, bic: "AGRIFRPP" });
    await updateDocumentSettings(organizationId, { ...(await getDocumentSettings(organizationId)), color: "#112233" });
    const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(quoteSettings).where(eq(quoteSettings.organizationId, organizationId)));
    expect(row).toMatchObject({ iban: null, bic: null });
    expect(await getDocumentSettings(organizationId)).toMatchObject({ iban: IBAN, bic: "AGRIFRPP", color: "#112233" });
  });
});
