// PRD-EVT-04 — rétroplanning : modèles (dont le modèle de départ), application
// à un évènement daté, évènement sans date, recalcul proposé au changement
// de date, ajout, coche et réordonnancement des tâches. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { feedback, openEventTab, readyOrganization, signIn as signInByLink, openEventInfo, saveEventInfo } from "./helpers";
import { createEventByForm } from "./new-event";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("PRD-EVT-04 — modèle de rétroplanning appliqué, recalcul des échéances et gestion des tâches", async ({ page }) => {
  const email = `planner-evt04-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-evt04-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Modèles : le modèle de départ se charge, un modèle se compose à la main.
  await page.goto("/events");
  // Lot 20 (décision 1) : par « Réglages », puis la rubrique.
  await page.getByRole("link", { name: /^Réglages/ }).click();
  // Lot 63c (ADR 0107) : les réglages s'ouvrent dans le panneau ; ses autres rubriques sont sur la page complète.
  await page.getByRole("link", { name: "Ouvrir tous les réglages" }).click();
  await page.getByRole("navigation", { name: "Rubriques des paramètres" }).getByRole("link", { name: "Rétroplanning", exact: true }).click();
  await expect(page).toHaveURL(/\/events\/modeles$/);
  await page.waitForLoadState("networkidle");

  // Lot 21 (L21-EVT-22) : la liste des modèles, puis le détail d'un modèle.
  await page.getByRole("link", { name: "Nouveau modèle" }).click();
  await page.getByRole("complementary", { name: "Nouveau modèle" }).getByLabel("Nom du modèle").fill("Mariage court");
  await page.getByRole("button", { name: "Créer le modèle" }).click();
  await expect(page).toHaveURL(/\/events\/modeles\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Mariage court", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Ajouter une tâche" }).click();
  const addItem = page.getByRole("complementary", { name: "Nouvelle tâche" });
  await addItem.getByLabel("Intitulé de la tâche").fill("Réserver le lieu");
  await addItem.getByLabel(/Décalage en jours/).fill("-365");
  await addItem.getByRole("button", { name: "Ajouter la tâche au modèle" }).click();
  await expect(page.getByRole("row", { name: /J-365 Réserver le lieu Planner/ })).toBeVisible();
  await addItem.getByLabel("Intitulé de la tâche").fill("Envoyer les faire-part");
  await addItem.getByLabel(/Décalage en jours/).fill("-120");
  await addItem.getByLabel("Responsable").selectOption("clients");
  await addItem.getByRole("button", { name: "Ajouter la tâche au modèle" }).click();
  await expect(page.getByRole("row", { name: /J-120 Envoyer les faire-part Mariés/ })).toBeVisible();
  await expectNoAxeViolation(page);
  // Le modèle de départ se charge à côté. Lot 63a : un modèle sans type ne s'applique pas de lui-même.
  await page.goto("/events/modeles");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByRole("link", { name: /^Rétroplanning mariage \(modèle de départ\)/ })).toBeVisible();

  // Un prospect sans date : l'app indique qu'un modèle demande une date.
  await page.goto("/events/parametres/sources");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await createEventByForm(page, { name: "Inès", clientFirstName: "Inès" });
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  // Lot 34a : le rétroplanning est ouvert dès la demande. Lot 72e (E5) : l'évènement reste une demande, dont la
  // date se change dans « Modifier les informations » (un évènement signé se reporte).
  await page.waitForLoadState("networkidle");
  await openEventTab(page, "Tâches");
  await expect(page.getByText("Ajoutez une date à l'évènement pour appliquer un modèle de rétroplanning.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Appliquer le modèle" })).toHaveCount(0);

  // Lot 34a (EVT-01, D8) puis lot 63a : à sa première date (onglet Synthèse, « Modifier les
  // informations »), seul un modèle rattaché au type de l'évènement s'appliquerait de lui-même.
  // Ces modèles n'ont pas de type : la planner applique « Mariage court » à la main.
  await openEventTab(page, "Synthèse");
  await page.waitForLoadState("networkidle");
  let info = await openEventInfo(page, "Date et lieux");
  await info.getByLabel("Date de l'évènement", { exact: true }).fill("2027-06-12");
  await saveEventInfo(page);
  await openEventTab(page, "Tâches");
  await expect(page.getByRole("heading", { name: /^juin 2026/ })).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Modèle à appliquer").selectOption({ label: "Mariage court" });
  await page.getByRole("button", { name: "Appliquer le modèle" }).click();
  await expect(page.getByText("Modèle appliqué : les tâches ont été créées.")).toBeVisible();
  // Lot 70c : la ligne type ; l'onglet montre aussi les tâches faites (État « Toutes »).
  const row = (label: string) => page.locator(".task-line").filter({ has: page.getByRole("link", { name: label, exact: true }) });
  await page.getByLabel("État").selectOption({ label: "Toutes" });
  await expect(page).toHaveURL(/etat=toutes/);
  await expect(page.getByRole("heading", { name: /^juin 2026/ })).toBeVisible();
  await expect(row("Réserver le lieu")).toContainText("ven. 12 juin");
  // Lot 70a (A3) : une tâche créée par un modèle est à qui l'applique : « Vous ».
  await expect(row("Réserver le lieu")).toContainText("Vous");
  await expect(page.getByRole("heading", { name: /^février 2027/ })).toBeVisible();
  await expect(row("Envoyer les faire-part")).toContainText("ven. 12 févr.");
  await expect(row("Envoyer les faire-part")).toContainText("Les mariés");
  await expectNoAxeViolation(page);

  // Une tâche faite n'est pas décalée ; les autres le sont si la planner accepte.
  await row("Réserver le lieu").getByRole("button", { name: /^Fait/ }).click();
  await expect(row("Réserver le lieu").getByRole("button", { name: /^Rouvrir/ })).toBeVisible();
  await openEventTab(page, "Synthèse");
  info = await openEventInfo(page, "Date et lieux");
  await info.getByLabel("Date de l'évènement", { exact: true }).fill("2027-06-19");
  await saveEventInfo(page);
  await openEventTab(page, "Tâches");
  await page.getByLabel("État").selectOption({ label: "Toutes" });
  await expect(page).toHaveURL(/etat=toutes/);
  const proposal = page.getByRole("region", { name: "Recalcul des échéances" });
  await expect(proposal).toContainText("repoussée de 7 jours. Décaler d'autant la tâche non faite ?");
  await expectNoAxeViolation(page);
  await proposal.getByRole("button", { name: "Décaler les échéances" }).click();
  await expect(proposal).toHaveCount(0);
  await expect(row("Envoyer les faire-part")).toContainText("ven. 19 févr.");
  await expect(row("Réserver le lieu")).toContainText("ven. 12 juin");

  // Ajout d'une tâche des mariés (panneau unique en création, lot 70c), puis réordonnancement dans le mois.
  await page.getByRole("link", { name: "Nouvelle tâche" }).click();
  const newTask = page.getByRole("dialog", { name: "Nouvelle tâche" });
  await newTask.getByLabel(/^Tâche/).fill("Essayage");
  await newTask.getByLabel(/^Échéance/).fill("2027-02-25");
  await newTask.getByLabel("Qui s'en charge").selectOption("clients");
  await newTask.getByRole("button", { name: "Créer la tâche" }).click();
  await expect(feedback(page).getByText(/^Tâche créée : /)).toBeVisible();
  const order = async () => (await page.locator(".task-title-link").allTextContents()).filter((text) => ["Essayage", "Envoyer les faire-part"].includes(text));
  await expect.poll(order).toEqual(["Envoyer les faire-part", "Essayage"]);
  await page.getByRole("link", { name: "Essayage", exact: true }).click();
  const window = page.getByRole("dialog", { name: "Essayage" });
  await window.getByRole("button", { name: "Monter « Essayage »" }).click();
  await expect.poll(order).toEqual(["Essayage", "Envoyer les faire-part"]);
  await expect(row("Essayage")).toContainText("jeu. 25 févr.");
  await expectNoAxeViolation(page);
});
