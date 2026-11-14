// Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) — la planner demande au
// client de choisir entre deux traiteurs ; le marié répond depuis son portail
// (trois prochaines actions, « À décider ») ; la réponse est horodatée et à son
// nom, des deux côtés ; la planner retient le prestataire d'un geste et la
// décision passe au fil d'activité. En taille ordinateur et en 375 px (360 px
// vérifié), axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addEventVendorSlot, addProgramItem, addVendorCandidate, createEventLink, createProspect, createProspectSource, updateVendorCandidate } from "../modules/events/service";
import { openEventTab, readyOrganization, signIn as signInByLink } from "./helpers";

const PASSWORD = "mot-de-passe-por03-e2e";

async function loginAndSetupMfa(page: Page, email: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function wedding() {
  const email = `planner-por03-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
    const organizationId = organization.id;
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }], eventDate: "2027-06-12" });
    const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
    for (const [name, cents] of [["Maison Haddad", 960000], ["Saveurs du Sud", 880000]] as const) {
      const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: name });
      await updateVendorCandidate({ organizationId, candidateId: candidate.id, shownToClients: true, quoteAmountCents: cents });
    }
    await addProgramItem(organizationId, event.id, { startTime: "15:30", label: "Cérémonie", vendorSlotIds: [], freeParticipants: [] });
    const couple = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: user.id,
      audience: "client",
      locale: "fr",
      link: { personName: "Inès", email: `${randomUUID()}@symbola.test`, rights: { rubrics: ["tasks", "program", "vendor_options"], budgetScope: "all", sharedSlotIds: [] } },
    });
    return { email, eventId: event.id, coupleUrl: couple.url };
  } finally {
    await sql.end();
  }
}

test("POR-03 / EVT-09 — la planner demande un choix ; le marié répond depuis son portail ; réponse horodatée, nominative, des deux côtés ; la planner retient le prestataire", async ({ page: planner, browser }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await loginAndSetupMfa(planner, setup.email);
  await planner.goto(`/events/${setup.eventId}`);
  await openEventTab(planner, "Mariés");
  const section = planner.getByRole("region", { name: "Décisions du client" });
  await section.getByLabel("Sorte de décision").selectOption({ label: "Choisir entre des options d'un poste" });
  await section.getByLabel("Poste").selectOption({ label: "Traiteur (2 options montrées)" });
  await section.getByLabel("Message au client (facultatif)").fill("Après la dégustation de samedi");
  await section.getByRole("button", { name: "Demander la décision" }).click();
  await expect(section.getByRole("status")).toHaveText("Décision demandée : elle apparaît dans le portail.");
  const decisions = section.getByRole("list", { name: "Décisions du client" });
  await expect(decisions).toContainText("Choisir : Traiteur");
  await expect(decisions).toContainText("En attente de réponse depuis le");
  await expectNoAxeViolation(planner);

  // Le marié : la décision est dans ses prochaines actions, puis il choisit.
  const coupleContext = await browser.newContext({ locale: "fr-FR", viewport: planner.viewportSize() });
  const couple = await coupleContext.newPage();
  await couple.goto(setup.coupleUrl);
  await expect(couple).toHaveURL(/\/portail$/);
  await expect(couple.getByRole("region", { name: "Accueil" })).toContainText("Choisir : Traiteur");
  const toDecide = couple.getByRole("region", { name: "À décider" });
  await expect(toDecide).toContainText("Après la dégustation de samedi");
  await expectNoAxeViolation(couple);
  await toDecide.getByLabel("Maison Haddad — 9 600,00 €").check();
  await toDecide.getByLabel("Un commentaire (facultatif)").fill("Le menu du sud-ouest");
  await toDecide.getByRole("button", { name: "Valider mon choix : Choisir : Traiteur" }).click();
  const answered = toDecide.getByRole("list", { name: "Vos décisions" });
  await expect(answered).toContainText(/Choisir : Traiteur : Maison Haddad, choisi par Inès le .*/);
  await expect(answered).toContainText("Commentaire : Le menu du sud-ouest");
  await expect(couple.getByRole("region", { name: "Accueil" })).not.toContainText("Choisir : Traiteur");
  await couple.setViewportSize({ width: 360, height: 800 });
  await couple.reload();
  expect(await couple.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectNoAxeViolation(couple);

  // La planner : la même réponse, puis « Retenir Maison Haddad » ; au fil d'activité.
  await planner.reload();
  await expect(decisions).toContainText(/Maison Haddad, choisi par Inès le .*/);
  await expect(decisions).toContainText("Commentaire : Le menu du sud-ouest");
  await decisions.getByRole("button", { name: "Retenir Maison Haddad" }).click();
  await expect(decisions.getByRole("button", { name: "Retenir Maison Haddad" })).toHaveCount(0);
  await expect(decisions.getByRole("button", { name: "Demander une nouvelle décision : Choisir : Traiteur" })).toBeVisible();
  await openEventTab(planner, "Synthèse");
  await expect(planner.getByRole("list", { name: "Fil d'activité" })).toContainText("Inès a répondu : « Traiteur ».");
  await expectNoAxeViolation(planner);
  await coupleContext.close();
});
