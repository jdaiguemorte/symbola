// Lot 46 (RDV-01 à RDV-04, EVT-10, HUB-08 ; SC-02 étapes 2 et 3 ; ADR 0082) — Camille crée un type
// de rendez-vous en moins d'une minute et ouvre sa page ; Léa réserve sans compte, au clavier, reçoit
// la confirmation avec l'invitation .ics, puis reporte par son lien ; Camille rattache le rendez-vous
// au mariage, écrit son compte rendu et en tire une tâche en un geste. En taille ordinateur et en
// 375 px, axe-core (WCAG 2.2) sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createProspect, createProspectSource } from "../modules/events/service";
import { setModuleEnabled } from "../modules/hub/service";
import { clickMenuLink, readyOrganization, signIn } from "./helpers";

const MAILPIT_API = "http://localhost:8025/api/v1";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId: organization.id, moduleKey: "appointments", enabled: true });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    await createProspect({ organizationId: organization.id, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-09-18" });
    return { email, slug: `atelier-${randomUUID().slice(0, 8)}` };
  } finally {
    await sql.end();
  }
}

async function latestMail(to: string): Promise<{ Subject: string; Text: string; Attachments: { FileName: string }[] }> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages } = (await (await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
    if (messages[0]) return (await (await fetch(`${MAILPIT_API}/message/${messages[0].ID}`)).json()) as { Subject: string; Text: string; Attachments: { FileName: string }[] };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("e-mail attendu");
}

test("RDV-01 à RDV-04, EVT-10 — un type en moins d'une minute, une réservation sans compte, un report par le lien, un compte rendu devenu tâche", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const { email, slug } = await atelier();
  await signIn(page, email, /\/$/);

  // RDV-01 : le type se crée avec deux champs, en moins d'une minute.
  const started = Date.now();
  await clickMenuLink(page, "Rendez-vous");
  await expect(page.getByRole("heading", { level: 1, name: "Rendez-vous" })).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("link", { name: "Commencer" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Premier rendez-vous");
  // Le libellé englobe la liste : son texte comprend celui des options ; le nom accessible, non.
  await page.getByRole("combobox", { name: "Durée" }).selectOption("60");
  await page.getByRole("button", { name: "Créer le type" }).click();
  await expect(page.getByRole("status")).toContainText("Type créé");
  expect(Date.now() - started).toBeLessThan(60_000);
  await page.getByLabel("Adresse de la page").fill(slug);
  await page.getByRole("button", { name: "Enregistrer la page" }).click();
  await expect(page.getByRole("status")).toContainText("Page de réservation enregistrée.");
  await expectNoAxeViolation(page);

  // RDV-02 : Léa réserve, sans compte, au clavier.
  const visitor = await browser.newContext({ viewport: page.viewportSize(), locale: "fr-FR" });
  const lea = await visitor.newPage();
  const leaEmail = `lea-${randomUUID()}@symbola.test`;
  await lea.goto(`/reserver/${slug}`);
  await expect(lea.getByRole("heading", { level: 1, name: "Premier rendez-vous" })).toBeVisible();
  await expectNoAxeViolation(lea);
  const firstSlot = lea.getByRole("radio").first();
  await firstSlot.focus();
  await lea.keyboard.press("Space");
  await expect(firstSlot).toBeChecked();
  await lea.keyboard.press("Tab");
  await expect(lea.getByLabel("Votre nom")).toBeFocused();
  await lea.keyboard.type("Léa Martin");
  await lea.keyboard.press("Tab");
  await lea.keyboard.type(leaEmail);
  await lea.getByRole("button", { name: "Réserver ce rendez-vous" }).focus();
  await lea.keyboard.press("Enter");
  await expect(lea.getByRole("heading", { name: "Votre rendez-vous est confirmé" })).toBeVisible();
  await expectNoAxeViolation(lea);

  // RDV-03 : la confirmation porte l'invitation et le lien ; le report ne demande aucun compte.
  const confirmation = await latestMail(leaEmail);
  expect(confirmation.Subject).toContain("Rendez-vous confirmé");
  expect(confirmation.Attachments.map((attachment) => attachment.FileName)).toContain("invitation.ics");
  const link = /https?:\/\/\S+\/rdv#\S+/.exec(confirmation.Text)![0];
  await lea.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(lea).toHaveURL(/\/rdv$/);
  await lea.getByRole("button", { name: "Reporter" }).click();
  await lea.getByRole("radio").nth(1).check();
  await lea.getByRole("button", { name: "Confirmer le report" }).click();
  await expect(lea.getByRole("status")).toContainText("votre rendez-vous est déplacé");
  await expectNoAxeViolation(lea);
  await visitor.close();

  // HUB-08 : Camille voit le rendez-vous dans « Aujourd'hui ».
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Rendez-vous déplacé : Premier rendez-vous avec Léa Martin/ }).first()).toBeVisible();

  // RDV-04, EVT-10 : rattacher au mariage, compte rendu, action devenue tâche en un geste.
  await page.goto("/rendez-vous");
  await page.getByRole("link", { name: /Premier rendez-vous/ }).first().click();
  await page.getByRole("button", { name: "Rattacher" }).click();
  await expect(page.getByRole("status")).toContainText("Rendez-vous rattaché à l'évènement.");
  await page.getByLabel("Notes").fill("Budget autour de 30 000 €, cérémonie laïque.");
  await page.getByRole("button", { name: "Enregistrer le compte rendu" }).click();
  await expect(page.getByRole("status")).toContainText("Compte rendu enregistré.");
  await page.getByLabel("Quoi").fill("Envoyer trois lieux");
  await page.getByLabel("Pour quand").fill("2027-03-10");
  await page.getByRole("button", { name: "Ajouter l'action" }).click();
  await page.getByRole("button", { name: "Faire de « Envoyer trois lieux » une tâche de l'évènement" }).click();
  await expect(page.getByRole("status")).toContainText("Tâche créée dans le rétroplanning de l'évènement.");
  await expect(page.getByRole("link", { name: "Tâche créée" })).toBeVisible();
  await expectNoAxeViolation(page);
});
