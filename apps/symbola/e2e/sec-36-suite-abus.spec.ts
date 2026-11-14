// Lot 24b — SEC-36 : suite de tests d'abus, qui rejoue les scénarios de
// sécurité SC-S1 à SC-S6 du cahier des charges (§ 17), joués par « Rex », tiers
// malveillant. SC-S1 est rejoué en entier par sec-13-inexistant-interdit.spec.ts ;
// SC-S3 depuis le lot 26b (liens personnels des prestataires). En taille
// ordinateur et en 375 px, axe-core sur les écrans touchés.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { consumeOrganizationMailQuota } from "@symbola/db/mail-quota";
import { EICAR_TEST_STRING } from "@symbola/files";
import { expect, test, type Page } from "@playwright/test";
import { addEventVendorSlot, addProgramItem, addVendorCandidate, createEventLink, createProspect, createProspectSource } from "../modules/events/service";
import { createVendor } from "../modules/vendors/service";
import { readyOrganization, signIn as signInByLink, followSignInLink } from "./helpers";

const PASSWORD = "mot-de-passe-e2e-de-test";

async function loginAndSetupMfa(page: Page, email: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function organization(label: string) {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${label} ${randomUUID()}`)).id;
    const account = async (role: "owner" | "member") => {
      const email = `${role}-sec36-${randomUUID()}@symbola.test`;
      return { email, id: (await createUser(db, { organizationId, email, password: PASSWORD, role })).id };
    };
    const owner = await account("owner");
    const member = await account("member");
    const source = await createProspectSource(organizationId, "Salon");
    const event = (clientName: string) =>
      createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: clientName }], eventDate: "2027-06-12" });
    return { organizationId, owner, member, event };
  } finally {
    await sql.end();
  }
}

test("SC-S1 — un identifiant d'une autre organisation répond comme un identifiant inexistant", async ({ page }) => {
  const mine = await organization("A");
  const other = await organization("B");
  const eventOfB = await other.event("Bérénice");
  await loginAndSetupMfa(page, mine.owner.email);
  const ofB = await page.goto(`/events/${eventOfB.id}`);
  const ofBText = await page.locator("main").innerText();
  const missing = await page.goto(`/events/${randomUUID()}`);
  expect(ofB!.status()).toBe(404);
  expect([ofB!.status(), ofBText]).toEqual([missing!.status(), await page.locator("main").innerText()]);
  expect(ofBText).not.toContain("Bérénice");
});

test("SC-S2 — un collaborateur retiré il y a deux minutes rejoue une requête avec sa session encore ouverte : refusée", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const { member, owner } = await organization("S2");
  const rex = await browser.newPage();
  await loginAndSetupMfa(rex, member.email);
  await rex.goto("/events");
  await expect(rex).toHaveURL(/\/events$/);

  await loginAndSetupMfa(page, owner.email);
  await page.goto("/parametres/equipe");
  await expect(page.getByRole("heading", { level: 1, name: "Équipe" })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("link", { name: `Retirer l'accès de ${member.email}` }).click();
  await expect(page.getByRole("heading", { name: `Retirer l'accès de ${member.email} ?` })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Retirer l'accès" }).click();
  await expect(page.getByRole("status")).toHaveText("Accès retiré. Les sessions de ce compte sont fermées.");
  await expect(page.getByRole("row").filter({ hasText: member.email })).toContainText("Retiré le");

  await rex.goto("/events");
  await expect(rex).toHaveURL(/\/login$/);
  // Lot 33 : le fournisseur l'authentifie encore, mais Symbola refuse, sans détail.
  await followSignInLink(rex, member.email);
  await expect(rex).toHaveURL(/\/login\?acces=refuse$/);
  await expect(rex.locator("main").getByRole("alert")).toHaveText("Cet accès n'est plus ouvert. Rapprochez-vous de la titulaire de votre organisation.");
  await rex.close();
});

// Lot 26b (UX-11 ; ADR 0053, décision D9) : liens personnels des prestataires.
test("SC-S3 — avec le lien d'un prestataire, il demande le budget, les devis des autres et le portail du client : refus", async ({ page }) => {
  const { organizationId, owner, event } = await organization("S3");
  const wedding = await event("Inès");
  const caterer = await addEventVendorSlot(organizationId, wedding.id, "Traiteur");
  const photographer = await addEventVendorSlot(organizationId, wedding.id, "Photographe");
  const rex = await addVendorCandidate({ organizationId, eventId: wedding.id, vendorSlotId: caterer.id, vendorName: "Rex Réceptions" });
  const studio = await addVendorCandidate({ organizationId, eventId: wedding.id, vendorSlotId: photographer.id, vendorName: "Studio Lumière" });
  await addProgramItem(organizationId, wedding.id, { startTime: "18:00", label: "Cocktail", internalNote: "Marge de 20 % sur le champagne", vendorSlotIds: [caterer.id], freeParticipants: [] });
  await addProgramItem(organizationId, wedding.id, { startTime: "16:00", label: "Photos de groupe", vendorSlotIds: [photographer.id], freeParticipants: [] });
  const link = await createEventLink({
    organizationId,
    eventId: wedding.id,
    createdByUserId: owner.id,
    audience: "vendor",
    vendorCandidateId: rex.id,
    locale: "fr",
    link: { personName: "Rex", email: `rex-${randomUUID()}@symbola.test`, rights: { rubrics: ["budget", "quotes", "vendor_options"], budgetScope: "all", sharedSlotIds: [] } },
  });

  // Son espace : la date, ses horaires, rien d'autre.
  await page.goto(link.url);
  await expect(page).toHaveURL(/\/prestataire$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inès");
  await expect(page.getByRole("list", { name: "Vos horaires" })).toContainText("18:00 — Cocktail");
  const space = page.locator("main");
  for (const hidden of ["Marge", "Photos de groupe", "Studio Lumière", "Budget"]) await expect(space).not.toContainText(hidden);
  await expectNoAxeViolation(page);

  // Le portail du client, le budget, les devis et le RIB des autres : comme inexistants.
  const portal = await page.goto("/portail");
  expect(portal!.status()).toBe(404);
  await expect(page.locator("main")).not.toContainText("Inès");
  for (const path of [`/portail/options/${studio.id}/devis`, `/portail/options/${studio.id}/rib`, "/portail/programme/pdf"]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
  expect((await page.request.get(`/budget/${wedding.id}/export?format=xlsx`)).status()).toBe(401);
  await page.goto(`/budget/${wedding.id}`);
  await expect(page).toHaveURL(/\/login$/);
  // Son lien n'a pas été retiré pour autant.
  await page.goto("/prestataire");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inès");
});

// Lot 26a (SEC-14, SEC-15, SEC-17 ; ADR 0053) : liens personnels.
test("SC-S4 — un lien de marié expiré, puis le lien d'un autre événement : refus, nouveau lien proposé, rien de révélé", async ({ page }) => {
  const { organizationId, owner, event } = await organization("S4");
  const theirs = await event("Inès");
  const another = await event("Bérénice");
  const everything = { rubrics: ["tasks", "program", "vendor_options", "budget", "quotes"] as const, budgetScope: "all" as const, sharedSlotIds: [] };
  const link = (customExpiresOn: string | null) =>
    createEventLink({
      organizationId,
      eventId: theirs.id,
      createdByUserId: owner.id,
      audience: "client",
      locale: "fr",
      link: { personName: "Rex", email: `rex-${randomUUID()}@symbola.test`, rights: { ...everything, rubrics: [...everything.rubrics] }, customExpiresOn },
    });

  // Lien expiré (dernier jour valable : avant-hier).
  const expired = await link(new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10));
  await page.goto(expired.url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ce lien n'est plus valable");
  expect(page.url()).not.toContain("#");
  await expect(page.locator("main")).not.toContainText("Inès");
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Demander un nouveau lien" }).click();
  await expect(page.getByRole("status")).toContainText("Votre demande est transmise");
  await expect(page.locator("main")).not.toContainText("Inès");

  // Un lien valable n'ouvre que son événement : le portail ne lit aucun
  // identifiant dans l'adresse, et les écrans de la planner restent fermés.
  const valid = await link(null);
  await page.goto(valid.url);
  await expect(page).toHaveURL(/\/portail$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inès");
  await page.goto(`/portail?evenement=${another.id}`);
  await expect(page.locator("main")).not.toContainText("Bérénice");
  await page.goto(`/events/${another.id}`);
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get(`/budget/${another.id}/export?format=xlsx`)).status()).toBe(401);
  expect((await page.request.get(`/portail/options/${randomUUID()}/devis`)).status()).toBe(404);
});

test("SC-S5 — le fichier de test antivirus, puis un fichier au type falsifié : refus et message clair", async ({ page }) => {
  const { organizationId, owner } = await organization("S5");
  const { vendor } = await createVendor(organizationId, { name: "Maison Verdier", typeId: null, city: "Lille" });
  await loginAndSetupMfa(page, owner.email);
  await page.goto(`/prestataires/${vendor.id}`);
  const file = page.getByLabel("Fichier", { exact: true });
  await file.setInputFiles({ name: "plaquette.pdf", mimeType: "application/pdf", buffer: Buffer.from(EICAR_TEST_STRING) });
  await page.getByRole("button", { name: "Joindre" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(/Fichier refusé par l'antivirus|Format non supporté/);
  await file.setInputFiles({ name: "rib.pdf", mimeType: "application/pdf", buffer: Buffer.from("ceci n'est pas un PDF") });
  await page.getByRole("button", { name: "Joindre" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Format non supporté : PDF ou image uniquement.");
  await expect(page.getByText("Aucun fichier.")).toBeVisible();
});

test("SC-S6 — demandes de lien en rafale, puis envoi au-delà du plafond : limitation, plafond, alerte au planner", async ({ page }) => {
  test.setTimeout(90_000);
  const { organizationId, owner, event } = await organization("S6");
  const theirs = await event("Inès");

  // Demandes de lien de connexion en rafale pour une même adresse : limitées, avec le délai
  // (lot 33 : une autre adresse que celle de la titulaire, qui se connecte ensuite).
  const burst = `rafale-${randomUUID()}@symbola.test`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(burst);
    await page.getByRole("button", { name: "Recevoir un lien de connexion" }).click();
    await expect(page.getByRole("status")).toBeVisible();
  }
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(burst);
  await page.getByRole("button", { name: "Recevoir un lien de connexion" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Trop de tentatives. Réessayez dans 15 minutes.");

  // L'organisation a déjà envoyé ses 100 e-mails de l'heure.
  const { sql, db } = createAppConnection();
  try {
    for (let sent = 0; sent < 100; sent += 1) await consumeOrganizationMailQuota(db, organizationId);
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, owner.email);
  await expect(page.locator("main").getByRole("alert").filter({ hasText: "Plafond d'envois atteint" })).toContainText("100 e-mails envoyés dans l'heure (plafond : 100)");
  await expectNoAxeViolation(page);
  // Lot 26a : un lien personnel s'envoie par e-mail ; au-delà du plafond, rien n'est créé.
  await page.goto(`/events/${theirs.id}?onglet=maries`);
  await page.getByLabel("Nom de la personne").fill("Marie");
  await page.getByLabel("E-mail de la personne").fill(`marie-${randomUUID()}@symbola.test`);
  await page.getByRole("button", { name: "Créer le lien et l'envoyer" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Plafond d'envois atteint");
  await expect(page.getByRole("list", { name: "Liens personnels" })).not.toContainText("@symbola.test");
});
