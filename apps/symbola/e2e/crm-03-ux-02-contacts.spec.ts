// Lot 36a (CRM-03, DAT-12, UX-02 ; D7, D8) — le contact unique, sans ressaisie : Léa revient pour un
// second évènement ; sa fiche montre son historique et reçoit une note ; « Créer un évènement » la
// choisit d'emblée ; à l'envoi en signature, nom, e-mail et adresse sont préremplis, et l'adresse
// corrigée est gardée sur sa fiche. Le choix d'un contact existant par la recherche. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { clickMenuLink, openEventTab, readyOrganization, signIn } from "./helpers";
import { openQuoteForm, openQuoteRubric } from "./devis-rubriques";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// L'atelier de Camille : Léa, cliente d'un premier mariage, avec son adresse.
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID()}`);
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-contacts-e2e", role: "owner" });
    await saveOnboardingStep(db, organization.id, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, address: "1 rue des Lilas" });
    const source = await createProspectSource(organization.id, "Salon");
    const lastName = `Martin${randomUUID().slice(0, 4)}`;
    const leaEmail = `lea-${randomUUID()}@symbola.test`;
    await createProspect({
      organizationId: organization.id,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [{ firstName: "Léa", lastName, email: leaEmail, addressLine: "12 rue des Lilas", postalCode: "60300", city: "Senlis" }],
      eventDate: "2027-06-12",
    });
    return { email, lastName, leaEmail };
  } finally {
    await sql.end();
  }
}

test("CRM-03 / UX-02 — Léa revient : sa fiche, son second évènement sans ressaisie, l'adresse de signature préremplie et gardée", async ({ page }) => {
  test.setTimeout(120_000);
  const { email, lastName, leaEmail } = await atelier();
  await signIn(page, email, /\/$/);

  // La liste des contacts : Léa, cliente du premier mariage.
  await clickMenuLink(page, "Contacts");
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();
  const list = page.getByRole("region", { name: "Liste des contacts" });
  await expect(list).toContainText(`Léa ${lastName}`);
  await expect(list).toContainText(leaEmail);
  await expectNoAxeViolation(page);

  // Sa fiche : son évènement, une note de l'équipe.
  await list.getByRole("link", { name: `Léa ${lastName}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Léa ${lastName}` })).toBeVisible();
  const history = page.getByRole("region", { name: "Historique" });
  await expect(history.getByRole("heading", { name: "Évènements" })).toBeVisible();
  await expect(history.getByRole("link", { name: "12 juin 2027" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const notes = page.getByRole("region", { name: "Notes de l'équipe" });
  await notes.getByLabel("Votre note").fill("Préfère être appelée le soir");
  await notes.getByRole("button", { name: "Ajouter la note" }).click();
  await expect(notes.getByRole("status").filter({ hasText: "Note ajoutée." })).toBeVisible();
  await expect(notes).toContainText("Préfère être appelée le soir");
  await expectNoAxeViolation(page);

  // Un second évènement pour elle, sans ressaisir son nom.
  await page.getByRole("link", { name: "Créer un évènement" }).click();
  await expect(page.getByText(`Contact choisi : Léa ${lastName}`)).toBeVisible();
  await expect(page.getByLabel(/^Prénom du premier marié/)).toHaveCount(0);
  await expectNoAxeViolation(page);
  // Lot 70e : « Nouvel évènement », une seule forme ; le client choisi reste le premier client.
  await page.getByRole("radio", { name: /^Une demande en cours/ }).check();
  await page.getByLabel(/^Nom de l'évènement/).fill("Léa");
  await page.getByRole("button", { name: "Créer l'évènement" }).click();
  await expect(page.getByRole("heading", { name: "Léa" })).toBeVisible();

  // À l'envoi en signature : nom, e-mail et adresse de sa fiche ; l'adresse corrigée y est gardée.
  await page.waitForLoadState("networkidle");
  await openEventTab(page, "Mes devis et factures");
  await page.getByRole("button", { name: "Créer un devis" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");
  // Lot 62d : les formulaires d'ajout s'ouvrent sous le tableau des lignes, un à la fois.
  const freeLine = await openQuoteForm(page, "Ajouter une ligne libre");
  await freeLine.getByLabel("Intitulé").fill("Coordination");
  await freeLine.getByLabel("Unité").fill("forfait");
  await freeLine.getByLabel("Prix unitaire HT (€)").fill("1800");
  await freeLine.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(freeLine.getByText("Ligne ajoutée.")).toBeVisible();
  await openQuoteRubric(page, "contrat");
  const send = page.getByRole("form", { name: "Faire signer" });
  const first = send.getByRole("group", { name: "Signataire 1" });
  await expect(first.getByLabel("Nom et prénom")).toHaveValue(`Léa ${lastName}`);
  await expect(first.getByLabel("E-mail")).toHaveValue(leaEmail);
  await expect(first.getByLabel("Adresse de facturation")).toHaveValue("12 rue des Lilas\n60300 Senlis");
  await expect(first.getByLabel("Garder cette adresse sur la fiche du contact")).toBeChecked();
  await first.getByLabel("Adresse de facturation").fill("Domaine des Tilleuls, 60300 Senlis");
  await expectNoAxeViolation(page);
  await send.getByRole("button", { name: "Faire signer" }).click();
  await expect(page.getByText("En attente de signature.")).toBeVisible();

  // Sa fiche : deux évènements, et l'adresse de facturation gardée.
  await clickMenuLink(page, "Contacts");
  await page.getByRole("region", { name: "Liste des contacts" }).getByRole("link", { name: `Léa ${lastName}` }).click();
  await expect(page.getByRole("region", { name: "Historique" }).getByRole("list").first().getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Identité et coordonnées" })).toContainText("Domaine des Tilleuls, 60300 Senlis");
});

test("UX-02 / DAT-12 — un client déjà connu se choisit par la recherche ; une adresse déjà prise est refusée sur un autre contact", async ({ page }) => {
  const { email, lastName, leaEmail } = await atelier();
  await signIn(page, email, /\/$/);

  // Le choix d'un contact existant, à la création d'un évènement.
  await page.goto("/events/new");
  await page.waitForLoadState("networkidle");
  const picker = page.getByRole("group", { name: "Client" });
  await picker.getByLabel(/chercher dans vos contacts/).fill(lastName);
  await picker.getByRole("button", { name: `Choisir Léa ${lastName}` }).click();
  await expect(picker).toContainText(`Contact choisi : Léa ${lastName}`);
  await expectNoAxeViolation(page);

  // DAT-12 : la même adresse sur un nouveau contact est refusée, avec un lien vers celui qui la porte.
  await page.goto("/contacts");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Ajouter un contact" }).first().click();
  const form = page.getByRole("form", { name: "Ajouter un contact" });
  await form.getByLabel("Prénom").fill("Autre");
  await form.getByLabel("E-mail").fill(leaEmail.toUpperCase());
  await form.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(form.getByRole("alert")).toContainText("déjà celle d'un autre contact");
  await form.getByRole("link", { name: "Ouvrir ce contact" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Léa ${lastName}` })).toBeVisible();
});
