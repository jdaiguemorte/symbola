// Lot 66c (HUB-18, MSG-01 ; D5, D6 ; ADR 0113 ; maquettes M19 et M20) — la signature et la marque des
// e-mails : Mon compte › Ma signature (aperçu en direct, enregistrement), Paramètres › Modèles d'e-mails
// › Marque et signature (police, ligne de pied, nom affiché), le libellé du bouton d'un modèle, puis
// l'essai reçu dans Mailpit à la marque de la planner, sans « Envoyé avec Symbola ». En taille
// ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { readyOrganization, signIn } from "./helpers";

const MAILPIT = "http://localhost:8025/api/v1";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

type Mail = { Subject: string; Text: string; HTML: string; From: { Name: string } };

async function mailTo(to: string, subject: RegExp): Promise<Mail> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const { messages } = (await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string; Subject: string }[] };
    const found = messages.find((message) => subject.test(message.Subject));
    if (found) return (await (await fetch(`${MAILPIT}/message/${found.ID}`)).json()) as Mail;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("e-mail non reçu");
}

async function atelier() {
  const email = `planner-sig-${randomUUID()}@symbola.test`;
  const name = `Atelier Lumière ${randomUUID().slice(0, 6)}`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, name);
    await createUser(db, { organizationId: organization.id, email, role: "owner" });
    return { email, name };
  } finally {
    await sql.end();
  }
}

test("HUB-18 / MSG-01 — ma signature, la marque des e-mails et le libellé du bouton, jusqu'à l'essai reçu", async ({ page }) => {
  test.setTimeout(180_000);
  const setup = await atelier();
  await signIn(page, setup.email, /\/$/);

  // Mon compte › Ma signature : l'aperçu suit la saisie.
  await page.goto("/profil");
  await page.getByRole("link", { name: "Remplir ma signature" }).click();
  await expect(page.getByRole("heading", { name: "Ma signature", level: 1 })).toBeVisible();
  const preview = page.getByRole("region", { name: "Aperçu de ma signature" });
  await expect(preview).toContainText("Saisissez votre nom affiché");
  await page.getByLabel("Nom affiché").fill("Camille Morel");
  await page.getByLabel("Fonction").fill("Wedding planner");
  await page.getByLabel("Téléphone").fill("06 12 34 56 78");
  await page.getByLabel("Site", { exact: true }).fill("atelier-lumiere.fr");
  await page.getByLabel("Nom du lien 1").fill("Instagram");
  await page.getByLabel("Adresse du lien 1").fill("instagram.com/atelierlumiere");
  await expect(preview).toContainText("Camille Morel");
  await expect(preview).toContainText(`Wedding planner · ${setup.name}`);
  await expect(preview).toContainText("06 12 34 56 78 · atelier-lumiere.fr");
  await expect(preview).toContainText("Instagram");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Enregistrer ma signature" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Signature enregistrée." })).toBeVisible();

  // Paramètres › Modèles d'e-mails › Marque et signature.
  await page.goto("/parametres/emails");
  await page.getByRole("link", { name: "Marque et signature des e-mails" }).click();
  await expect(page.getByRole("heading", { name: "Marque et signature des e-mails", level: 1 })).toBeVisible();
  await page.getByText("Avec empattement", { exact: true }).click();
  await page.getByLabel("Nom affiché de l'expéditeur (facultatif)").fill("Camille — Atelier Lumière");
  await page.getByLabel("Ligne libre du pied (facultative)").fill("Wedding planner à Lyon depuis 2015");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Marque des e-mails enregistrée." })).toBeVisible();
  const brandPreview = page.getByRole("region", { name: "Aperçu de l'e-mail" });
  await expect(brandPreview).toContainText("Camille — Atelier Lumière");
  await expect(brandPreview).toContainText("Wedding planner à Lyon depuis 2015");
  await expect(brandPreview).toContainText("Camille Morel");
  await expect(brandPreview).not.toContainText("Envoyé avec Symbola");

  // Le libellé du bouton d'un modèle, puis l'essai.
  await page.goto("/parametres/emails/client_link?langue=fr");
  await page.getByLabel("Libellé du bouton").fill("Voir votre espace");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /enregistré/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Aperçu de l'e-mail" })).toContainText("Voir votre espace");
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "M'envoyer un essai" }).click();
  const mail = await mailTo(setup.email, /^\[Essai\]/);
  expect(mail.From.Name).toBe("Camille — Atelier Lumière");
  expect(mail.HTML).toContain(">Voir votre espace</a>");
  expect(mail.HTML).toContain("Georgia, 'Times New Roman'");
  // Le texte arrive avec des fins de ligne SMTP (CRLF).
  const text = mail.Text.replace(/\r\n/g, "\n");
  expect(text).toContain(`Camille Morel\nWedding planner · ${setup.name}`);
  expect(text).toContain("Wedding planner à Lyon depuis 2015");
  expect(mail.HTML).not.toContain("Envoyé avec Symbola");
  expect(mail.HTML).not.toContain("Ouvrir Symbola");
});
