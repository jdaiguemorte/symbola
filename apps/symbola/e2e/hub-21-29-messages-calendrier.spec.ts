// Lot 38b (HUB-21, HUB-29, MSG-02 ; décisions D8, D10 à D12 ; ADR 0072) — les modèles de messages
// de la planner (modèles de départ, version à chaque modification, restauration, duplication) ;
// « Écrire au client » depuis la fiche (modèle rempli, destinataires, valeur manquante, messagerie
// ouverte par un lien mailto) ; Mon calendrier (adresse montrée une fois, flux ICS lu, adresse
// régénérée) et le programme d'un évènement dans l'agenda. En taille ordinateur et en 375 px,
// axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addProgramItem, createProspect, createProspectSource } from "../modules/events/service";
import { feedback, openSettingsTab, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// Atelier prêt, sa titulaire, et le mariage de Léa et Maxime (leurs adresses, une séquence du
// programme avec une note interne).
async function atelier() {
  const email = `planner-hub21-${randomUUID()}@symbola.test`;
  const name = `Atelier ${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, name);
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    const lea = `lea-${randomUUID()}@symbola.test`;
    const maxime = `maxime-${randomUUID()}@symbola.test`;
    const event = await createProspect({
      organizationId: organization.id,
      createdByUserId: owner.id,
      prospectSourceId: source.id,
      clients: [
        { firstName: "Léa", lastName: "Martin", email: lea },
        { firstName: "Maxime", lastName: "Durand", email: maxime },
      ],
      eventDate: "2027-06-12",
    });
    await addProgramItem(organization.id, event.id, { startTime: "15:30", endTime: "16:15", label: "Cérémonie laïque", internalNote: "Alliances chez le témoin", vendorSlotIds: [], freeParticipants: [] });
    return { email, name, organizationId: organization.id, eventId: event.id, lea, maxime };
  } finally {
    await sql.end();
  }
}

test("HUB-21 — Modèles de messages : modèles de départ, une version à chaque modification, restauration, duplication", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await openSettingsTab(page, "Modèles de messages");
  await expect(page.getByRole("heading", { name: "Modèles de messages", level: 1 })).toBeVisible();
  await expect(page.getByText("Aucun modèle de message pour l'instant.")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter les modèles de départ" }).click();
  // Lot 45 (CRM-05) : la brochure s'ajoute aux deux modèles du lot 38b.
  await expect(page.getByRole("status")).toContainText("3 modèles ajoutés.");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole("link", { name: "Proposer un rendez-vous" }).click();
  await expect(page.getByRole("heading", { name: "Proposer un rendez-vous", level: 1 })).toBeVisible();
  const form = page.getByRole("form", { name: "Modifier « Proposer un rendez-vous »" });
  const original = await form.getByLabel("Texte").inputValue();
  await form.getByLabel("Texte").fill(`${original}\n\nPS : apportez vos envies, {{prénom}} !`);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form.getByRole("status")).toContainText("Enregistré : version 2.");
  await expectNoAxeViolation(page);

  // Les versions se relisent ; la première se restaure et devient la troisième.
  await page.locator("details.settings-block > summary").click();
  await expect(page.getByRole("list", { name: "2 versions" }).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: "Restaurer la version 1" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Version restaurée" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Modifier « Proposer un rendez-vous »" }).getByLabel("Texte")).toHaveValue(original);
  await expect(page.getByText("Tous les évènements · Français · version 3")).toBeVisible();

  // Dupliquer, puis supprimer la copie (lot 39a : à la corbeille, « Annuler » proposé, sans confirmation).
  await page.getByRole("button", { name: "Dupliquer le modèle" }).click();
  await expect(page.getByRole("heading", { name: "Copie de Proposer un rendez-vous", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Supprimer le modèle" }).click();
  await expect(feedback(page).filter({ hasText: "Modèle mis à la corbeille." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Modèles de messages", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Copie de Proposer un rendez-vous" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("HUB-21 / MSG-02 — « Écrire au client » : le modèle rempli avec la fiche, les destinataires, une valeur manquante bloque, la messagerie s'ouvre", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await openSettingsTab(page, "Modèles de messages");
  await page.getByRole("button", { name: "Ajouter les modèles de départ" }).click();
  // Lot 45 (CRM-05) : la brochure s'ajoute aux deux modèles du lot 38b.
  await expect(page.getByRole("status")).toContainText("3 modèles ajoutés.");

  await page.goto(`/events/${setup.eventId}`);
  await page.getByRole("link", { name: "Écrire au client" }).first().click();
  await expect(page.getByRole("heading", { name: "Écrire au client", level: 1 })).toBeVisible();
  await page.getByLabel("Modèle", { exact: true }).selectOption({ label: "Réponse à une première demande" });
  await page.getByRole("button", { name: "Mettre à jour l'aperçu" }).click();
  // Lot 45 (CRM-05, D1) : le texte rempli se relit et se modifie avant l'envoi.
  const text = page.getByRole("textbox", { name: "Texte" });
  await expect(text).toHaveValue(/^Bonjour Léa & Maxime,/);
  await expect(text).toHaveValue(new RegExp(setup.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByRole("heading", { name: "Ce message part à 2 personnes" })).toBeVisible();
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
  // Lot 65d (ADR 0110) : par défaut, la planner envoie de sa messagerie. « Préparer l'e-mail » ouvre le
  // message prêt (ouvrir, copier), « J'ai envoyé » le note dans l'activité.
  await page.getByRole("button", { name: "Préparer l'e-mail" }).click();
  const prepared = page.getByRole("dialog", { name: "Préparer l'e-mail" });
  await expect(prepared.getByLabel("Message", { exact: true })).toHaveValue(/^Bonjour Léa & Maxime,/);
  await prepared.getByRole("button", { name: "J'ai envoyé" }).click();
  await expect(prepared.getByRole("status").filter({ hasText: "Envoi noté" })).toBeVisible();

  // Seulement Léa : un destinataire, sans liste.
  await page.goto(`/events/${setup.eventId}/ecrire`);
  await page.getByLabel("Modèle", { exact: true }).selectOption({ label: "Réponse à une première demande" });
  await page.getByRole("group", { name: "Destinataires" }).getByLabel(`Maxime Durand — ${setup.maxime}`).uncheck();
  await page.getByRole("button", { name: "Mettre à jour l'aperçu" }).click();
  await expect(page.getByRole("textbox", { name: "Texte" })).toHaveValue(/^Bonjour Léa,/);
  await expect(page.getByRole("button", { name: "Préparer l'e-mail", exact: true })).toBeVisible();

  // Un modèle qui emploie le lieu, absent de la fiche : le message ne s'ouvre pas.
  await openSettingsTab(page, "Modèles de messages");
  const form = page.getByRole("form", { name: "Nouveau modèle" });
  await form.getByLabel("Nom du modèle").fill("Visite du lieu");
  await form.getByLabel("Objet").fill("Visite pour {{évènement}}");
  await form.getByLabel("Texte").fill("Bonjour {{prénom}},\n\nRendez-vous au {{lieu}}.");
  await form.getByRole("button", { name: "Créer le modèle" }).click();
  await expect(page.getByRole("heading", { name: "Visite du lieu", level: 1 })).toBeVisible();
  await page.goto(`/events/${setup.eventId}/ecrire`);
  await page.getByLabel("Modèle", { exact: true }).selectOption({ label: "Visite du lieu" });
  await page.getByRole("button", { name: "Mettre à jour l'aperçu" }).click();
  await expect(page.getByRole("alert")).toContainText("Ces variables n'ont pas de valeur : {{lieu}}.");
  await expect(page.getByRole("button", { name: /Préparer l'e-mail|Ouvrir dans ma messagerie|Envoyer depuis Symbola/ })).toHaveCount(0);
  await expectNoAxeViolation(page);
});

test("HUB-29 — Mon calendrier : l'adresse montrée une fois, le flux lu par l'agenda, une nouvelle adresse remplace l'ancienne ; le programme d'un évènement", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);
  await page.goto("/profil");
  const calendar = page.getByRole("region", { name: "Mon calendrier" });
  await expect(calendar).toContainText("Aucune adresse pour l'instant.");
  await calendar.getByRole("button", { name: "Créer mon adresse" }).click();
  const address = calendar.getByLabel("Adresse de votre calendrier");
  await expect(address).toHaveValue(/\/calendrier\/[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}\.ics$/);
  const first = await address.inputValue();
  const ics = await page.request.get(new URL(first).pathname);
  expect([ics.status(), ics.headers()["content-type"]]).toEqual([200, "text/calendar; charset=utf-8"]);
  // Lot 64 (ADR 0109) : l'évènement est sa plage occupée (règle des évènements sans type, 8 h à
  // 22 h, heure d'été) ; en option, il reste provisoire et ne bloque pas.
  const feed = await ics.text();
  expect(feed).toContain("DTSTART:20270612T060000Z");
  expect(feed).toContain("TRANSP:TRANSPARENT");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  await calendar.getByRole("button", { name: "Nouvelle adresse" }).click();
  await expect(address).not.toHaveValue(first);
  expect((await page.request.get(new URL(first).pathname)).status()).toBe(404);
  expect((await page.request.get(new URL(await address.inputValue()).pathname)).status()).toBe(200);

  // Le programme de l'évènement, sans note interne.
  await page.goto(`/events/${setup.eventId}?onglet=programme`);
  const program = page.getByRole("form", { name: "Ajouter le programme à mon agenda" });
  await program.getByRole("button", { name: "Ajouter le programme à mon agenda" }).click();
  const programAddress = await program.getByLabel("Adresse de votre calendrier").inputValue();
  const programIcs = await (await page.request.get(new URL(programAddress).pathname)).text();
  expect(programIcs).toContain("SUMMARY:Cérémonie laïque");
  expect(programIcs).toContain("DTSTART:20270612T133000Z");
  expect(programIcs).not.toContain("Alliances");
  await expectNoAxeViolation(page);

  // Retirée depuis le profil, l'adresse du programme ne répond plus.
  await page.goto("/profil");
  await page.getByRole("button", { name: "Retirer le programme de Léa & Maxime" }).click();
  await expect(page.getByText("Aucun programme suivi.")).toBeVisible();
  expect((await page.request.get(new URL(programAddress).pathname)).status()).toBe(404);
});
