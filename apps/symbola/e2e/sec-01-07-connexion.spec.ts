// Lot 33 (SEC-01, SEC-07, HUB-01, HUB-02, D4 ; ADR 0067) — connexion par le fournisseur
// d'identité, comme une personne : inscription par la seule adresse, lien magique scellé et à
// usage unique, double authentification de la titulaire, plusieurs organisations. Ordinateur et
// 375 px, axe-core sur chaque écran de Symbola.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addMembership, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";
import { crossIdentityProvider, latestMagicLink, openMenu, provisionTestMfa, readyOrganization, signIn } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function askForLink(page: Page, email: string, button = "Recevoir un lien de connexion"): Promise<string> {
  const after = Date.now() - 1000;
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByRole("status")).toContainText("vient de partir");
  return latestMagicLink(email, after);
}

test("HUB-01, SEC-07 — inscription par la seule adresse : le lien crée le compte et son organisation, ouvre le démarrage ; rejoué, il est refusé", async ({ page }) => {
  const email = `inscription-${randomUUID()}@symbola.test`;
  await page.goto("/inscription");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Créer votre espace Symbola");
  await expectNoAxeViolation(page);
  const link = await askForLink(page, email, "Recevoir mon lien");
  // Le lien est scellé : l'adresse n'y paraît pas.
  expect(link).not.toContain(email.split("@")[0]);
  await page.goto(link);
  await crossIdentityProvider(page, null);
  await expect(page).toHaveURL(/\/demarrage$/);

  // Rejoué, le lien est refusé par le fournisseur (usage unique).
  await page.goto(link);
  await expect(page.locator("body")).toContainText("Le jeton a été consommé");
});

test("SEC-07 — la page de connexion : même réponse pour une adresse inconnue, renvoi vers le fournisseur et l'inscription", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Se connecter");
  await expectNoAxeViolation(page);
  await page.getByLabel("Adresse e-mail").fill(`inconnu-${randomUUID()}@symbola.test`);
  await page.getByRole("button", { name: "Recevoir un lien de connexion" }).click();
  await expect(page.getByRole("status")).toHaveText("Un lien de connexion vient de partir à cette adresse. Il est valable quinze minutes.");
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Se connecter avec un mot de passe ou une clé d'accès" })).toHaveAttribute("href", "/auth/connexion");
  await expect(page.getByRole("link", { name: "Créer mon espace" })).toHaveAttribute("href", "/inscription");
  // Un lien altéré ramène à la connexion, avec un message.
  await page.goto("/auth/lien/lien-altere");
  await expect(page).toHaveURL(/\/login\?lien=invalide$/);
  await expect(page.locator("main").getByRole("alert")).toHaveText("Ce lien de connexion n'est plus valable. Demandez-en un nouveau.");
  await expectNoAxeViolation(page);
});

test("D4 — une titulaire sans second facteur : « Sécurisez votre compte », puis le fournisseur le demande ; elle arrive dans son espace", async ({ page }) => {
  const email = `titulaire-d4-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier D4 ${randomUUID()}`);
    // Une titulaire existante : son compte a plus d'une minute (la séance d'inscription seule est
    // dispensée). La date se pose à l'insertion : core.stamp_row la protège ensuite.
    const [owner] = await db.insert(users).values({ email, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) }).returning({ id: users.id });
    await addMembership(db, { userId: owner!.id, organizationId: organization.id, role: "owner" });
  } finally {
    await sql.end();
  }
  await page.goto("/login");
  await page.goto(await askForLink(page, email));
  await crossIdentityProvider(page, null);
  await expect(page).toHaveURL(/\/securite$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sécurisez votre compte");
  await expectNoAxeViolation(page);
  // Son second facteur, installé chez le fournisseur (ici par l'assistant des parcours).
  const secret = await provisionTestMfa(email);
  const after = Date.now() - 1000;
  await page.getByRole("button", { name: "Recevoir un lien de connexion" }).click();
  await expect(page.getByRole("status")).toContainText("Un lien de connexion vient de partir à votre adresse");
  await page.goto(await latestMagicLink(email, after));
  await crossIdentityProvider(page, secret);
  await expect(page).toHaveURL(/\/$/);
});

test("HUB-02 — plusieurs organisations : passer de l'une à l'autre, en créer une autre", async ({ page }) => {
  const email = `deux-ateliers-${randomUUID()}@symbola.test`;
  const first = `Premier atelier ${randomUUID().slice(0, 8)}`;
  const second = `Second atelier ${randomUUID().slice(0, 8)}`;
  const { sql, db } = createAppConnection();
  try {
    const one = await readyOrganization(db, first);
    const two = await readyOrganization(db, second);
    const user = await createUser(db, { organizationId: one.id, email, role: "member" });
    await addMembership(db, { userId: user.id, organizationId: two.id, role: "member" });
  } finally {
    await sql.end();
  }
  await signIn(page, email, /\/$/);
  await openMenu(page);
  const select = page.getByLabel("Organisation");
  await expect(select.locator("option")).toHaveText([first, second].sort());
  await select.selectOption({ label: second });
  await page.getByRole("button", { name: "Ouvrir" }).click();
  // On était déjà sur l'accueil : attendre ce qui change, l'organisation ouverte.
  await openMenu(page);
  await expect(page.getByLabel("Organisation").locator("option:checked")).toHaveText(second);
  await expect(page).toHaveURL(/\/$/);
  // Envoi du formulaire puis redirection : deux navigations ; analyser une fois la page posée.
  await page.waitForLoadState("networkidle");
  await expectNoAxeViolation(page);

  await openMenu(page);
  await page.getByRole("button", { name: "Créer une autre organisation" }).click();
  await expect(page).toHaveURL(/\/demarrage$/);
});
