// Lot 26a (RGP-03) — mention d'information des pages à lien personnel, au nom
// de l'organisation, contre un vrai PostgreSQL : texte de départ, contact,
// texte propre à l'organisation, retour au texte de départ.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getLinkPrivacyNotice, linkPrivacyNoticeFor, updateLinkPrivacyNotice } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("RGP-03 — Information des personnes sur les pages à lien", () => {
  it("texte de départ au nom de l'organisation, avec l'e-mail de la titulaire faute d'adresse de contact", async () => {
    const organization = await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)} R.`);
    const ownerEmail = `titulaire-${randomUUID()}@example.test`;
    await createUser(db, { organizationId: organization.id, email: ownerEmail, password: "mot-de-passe-titulaire", role: "owner" });

    const notice = await linkPrivacyNoticeFor(db, organization.id, "fr");
    expect(notice).toContain(`${organization.name} utilise les informations de cette page`);
    expect(notice).toContain(`en écrivant à ${ownerEmail}`);
    expect(notice).toContain("CNIL");
    expect(notice).not.toMatch(/R\.\.(?!\.)/);
    expect(notice).not.toContain("{organization}");
    expect(await linkPrivacyNoticeFor(db, organization.id, "en")).toContain(`by writing to ${ownerEmail}`);
  });

  it("le texte de l'organisation remplace celui de départ ; vide, le texte de départ revient", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await updateLinkPrivacyNotice(db, organization.id, "  {organization} protège vos données.  ");
    expect(await getLinkPrivacyNotice(db, organization.id)).toBe("{organization} protège vos données.");
    expect(await linkPrivacyNoticeFor(db, organization.id, "en")).toBe(`${organization.name} protège vos données.`);
    await updateLinkPrivacyNotice(db, organization.id, "   ");
    expect(await getLinkPrivacyNotice(db, organization.id)).toBeNull();
    expect(await linkPrivacyNoticeFor(db, organization.id, "fr")).toContain("Symbola héberge ces données");
  });

  it("une organisation ne lit jamais la mention d'une autre", async () => {
    const mine = await createOrganization(db, `Org ${randomUUID()}`);
    const other = await createOrganization(db, `Org ${randomUUID()}`);
    await updateLinkPrivacyNotice(db, other.id, "Texte de l'autre organisation.");
    expect(await getLinkPrivacyNotice(db, mine.id)).toBeNull();
  });
});
