// Lot 34b (EVT-03, CHR-02 ; D10 à D13) — fiche d'identité et tâches : la planner remplit les
// invités, le style et les notes, complète le lieu de réception (horaires, contact), confie une
// tâche au fleuriste retenu, la commente et y joint un plan ; le fleuriste la voit et la coche
// dans son espace. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { addEventVendorSlot, addVendorCandidate, createEventLink, createProspect, createProspectSource, updateVendorCandidate } from "../modules/events/service";
import { readyOrganization, signIn } from "./helpers";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Atelier de Camille : le mariage de Léa et Hugo au Domaine des Tilleuls, un fleuriste retenu et
// son lien personnel (sans code).
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-fiche-e2e", role: "owner" });
    const source = await createProspectSource(organizationId, "Salon");
    const clients = [
      { firstName: "Léa", lastName: "Martin" },
      { firstName: "Hugo", lastName: "Durand" },
    ];
    const eventId = (await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients, eventDate: "2027-06-12", venueName: "Domaine des Tilleuls", venueCity: "Senlis" })).id;
    const slot = await addEventVendorSlot(organizationId, eventId, "Fleuriste");
    const florist = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot.id, vendorName: "Fleurs de Lys" });
    await updateVendorCandidate({ organizationId, candidateId: florist.id, status: "retained", changedByUserId: owner.id });
    const link = await createEventLink({
      organizationId,
      eventId,
      createdByUserId: owner.id,
      audience: "vendor",
      vendorCandidateId: florist.id,
      locale: "fr",
      link: { personName: "Lys", email: `lys-${randomUUID()}@symbola.test`, rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] } },
    });
    return { email, eventId, vendorUrl: link.url };
  } finally {
    await sql.end();
  }
}

test("EVT-03 / CHR-02 — fiche d'identité, lieu complet, tâche confiée au fleuriste, commentée et jointe ; il la coche dans son espace", async ({ page, browser }) => {
  const { email, eventId, vendorUrl } = await atelier();
  await signIn(page, email, /\/$/);

  // EVT-03 (D11) : invités, style et notes, dans « Modifier les informations ».
  await page.goto(`/events/${eventId}`);
  const identity = page.getByRole("region", { name: "Fiche d'identité" });
  await expect(identity).toContainText("— estimés · — confirmés");
  await expect(identity).toContainText("Domaine des Tilleuls");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Modifier les informations" }).click();
  const identityForm = page.getByRole("form", { name: "Fiche d'identité" });
  await identityForm.getByLabel("Invités estimés").fill("120");
  await identityForm.getByLabel("Invités confirmés").fill("98");
  await identityForm.getByLabel("Style").fill("Bohème chic");
  await identityForm.getByLabel("Notes").fill("Allergie aux fruits à coque");
  await identityForm.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await expect(identityForm.getByRole("status")).toHaveText("Fiche enregistrée.");
  await page.reload();
  await expect(identity).toContainText("120 estimés · 98 confirmés");
  await expect(identity).toContainText("Bohème chic");
  await expectNoAxeViolation(page);

  // EVT-03 (D10) : le lieu de réception, premier lieu de la liste, reçoit horaires et contact.
  await page.goto(`/events/${eventId}?onglet=programme`);
  const places = page.getByRole("region", { name: "Lieux de l'évènement" });
  await expect(places).toContainText("Lieu de réception");
  await page.waitForLoadState("networkidle");
  await places.locator("summary", { hasText: "Modifier « Domaine des Tilleuls »" }).click();
  await places.getByLabel("Début").fill("14:30");
  await places.getByLabel("Contact sur place").fill("Hélène Vasseur");
  await places.getByRole("button", { name: "Enregistrer le lieu" }).click();
  await expect(places.getByRole("status").filter({ hasText: "Lieu enregistré." })).toBeVisible();
  await expect(places).toContainText("À partir de 14:30");
  await expect(places).toContainText("Contact : Hélène Vasseur");
  await expectNoAxeViolation(page);

  // CHR-02 (D12) : une tâche confiée au fleuriste retenu.
  await page.goto(`/events/${eventId}?onglet=retroplanning`);
  await page.waitForLoadState("networkidle");
  const newTask = page.getByRole("group", { name: "Nouvelle tâche" });
  await newTask.getByLabel("Intitulé de la tâche").fill("Livrer les fleurs");
  await newTask.getByLabel("Échéance").fill("2027-06-11");
  await newTask.getByLabel("Responsable").selectOption({ label: "Prestataire : Fleurs de Lys" });
  await newTask.getByRole("button", { name: "Ajouter la tâche" }).click();
  await expect(page.getByRole("status").getByText(/^Tâche ajoutée : /)).toBeVisible();

  // D13 : commentaire et pièce jointe, dans la fenêtre de la tâche (lot 63d).
  await page.getByRole("link", { name: "Livrer les fleurs", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Modifier la tâche" });
  await page.waitForLoadState("networkidle");
  await panel.getByLabel("Votre commentaire").fill("Accès par le portail nord");
  await panel.getByRole("button", { name: "Commenter" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Commentaire ajouté." })).toBeVisible();
  await expect(panel.getByRole("region", { name: "Commentaires de l'équipe" })).toContainText("Accès par le portail nord");
  await panel.getByLabel("Intitulé", { exact: true }).fill("Plan d'accès");
  await panel.getByLabel(/^Fichier/).setInputFiles({ name: "plan.pdf", mimeType: "application/pdf", buffer: PDF });
  await panel.getByRole("button", { name: "Joindre le fichier" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Pièce jointe ajoutée." })).toBeVisible();
  await page.reload();
  await expect(panel.getByRole("link", { name: "Plan d'accès" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Le fleuriste ouvre son lien : sa tâche, qu'il coche ; ni commentaire ni pièce jointe.
  const vendorContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const vendor = await vendorContext.newPage();
  await vendor.goto(vendorUrl);
  await expect(vendor).toHaveURL(/\/prestataire$/);
  const tasks = vendor.getByRole("region", { name: "Vos tâches" });
  await expect(tasks).toContainText("Livrer les fleurs");
  await expect(vendor.getByText("Accès par le portail nord")).toHaveCount(0);
  await expect(vendor.getByText("Plan d'accès")).toHaveCount(0);
  await expectNoAxeViolation(vendor);
  await tasks.getByRole("button", { name: "Cocher la tâche Livrer les fleurs" }).click();
  await expect(tasks.getByRole("button", { name: "Décocher la tâche Livrer les fleurs" })).toBeVisible();
  await vendorContext.close();

  // La planner la voit faite.
  await page.goto(`/events/${eventId}?onglet=retroplanning`);
  await expect(page.getByRole("button", { name: "Marquer « Livrer les fleurs » comme à faire" })).toBeVisible();
});
