// Aides communes aux parcours e2e (ADR 0025).
import { createHash } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { and, eq, isNull } from "drizzle-orm";
import { Secret, TOTP } from "otpauth";
import { createManagementClient, createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { memberships, users } from "@symbola/db/schema/hub";
import { completeSetup } from "../modules/hub/service";
import { fillRequiredMentions } from "../lib/test-fixtures/legal-mentions";

// Sur téléphone, le menu latéral est replié derrière le bouton « Menu » :
// l'ouvrir avant de cliquer un lien du menu ou « Se déconnecter ». Sur
// ordinateur, le bouton est masqué et le menu toujours visible : rien à faire.
export async function openMenu(page: Page): Promise<void> {
  // Le libellé change (« Menu » / « Fermer le menu ») : cibler le bouton par
  // ce qu'il commande.
  const toggle = page.locator('button[aria-controls="app-menu"]');
  if ((await toggle.count()) === 0 || !(await toggle.isVisible())) return;
  if ((await toggle.getAttribute("aria-expanded")) === "true") return;
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

// Le menu latéral (navigation et compte), pour cibler ses liens sans
// confusion avec un lien de même nom dans la page.
export function mainMenu(page: Page) {
  return page.locator("#app-menu");
}

// Ouvre le menu si besoin puis clique le lien du menu portant exactement ce nom.
export async function clickMenuLink(page: Page, name: string): Promise<void> {
  await openMenu(page);
  await mainMenu(page).getByRole("link", { name, exact: true }).click();
}

// Ouvre le menu si besoin puis se déconnecte.
export async function logout(page: Page): Promise<void> {
  await openMenu(page);
  await page.getByRole("button", { name: "Se déconnecter" }).click();
}

// Fiche événement en onglets (lot 8) : ouvre l'onglet dont le nom commence
// par `name` (« Budget 1/3 », « Rétroplanning 2 en retard »…).
export async function openEventTab(page: Page, name: string): Promise<void> {
  const tabs = page.getByRole("navigation", { name: "Sections de l'événement" });
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await tabs.getByRole("link", { name: new RegExp(`^${escaped}`) }).click();
  await expect(tabs.getByRole("link", { name: new RegExp(`^${escaped}`) })).toHaveAttribute("aria-current", "page");
}

// Réglages regroupés sous « Paramètres » (lot 13 : menu latéral par rubrique).
export async function openSettingsTab(page: Page, name: string): Promise<void> {
  await clickMenuLink(page, "Paramètres");
  await page.getByRole("navigation", { name: "Rubriques des paramètres" }).getByRole("link", { name, exact: true }).click();
}

// Lot 12 (ONB-03) : une organisation dont l'assistant de démarrage est déjà
// terminé, pour les parcours qui ne testent pas le démarrage lui-même.
export async function readyOrganization(db: Parameters<typeof createOrganization>[0], name: string) {
  const organization = await createOrganization(db, name);
  await completeSetup(db, organization.id);
  // Lot 31a (FAC-07, D4) : une organisation prête a ses mentions requises remplies.
  await fillRequiredMentions(organization.id);
  return organization;
}

// Lot 13 (L13-EVT-19) : frise du statut ; un clic sur l'étape, puis « Confirmer ».
export async function changeEventStatus(page: Page, status: string): Promise<void> {
  await page.getByRole("button", { name: `Passer en ${status}` }).click();
  await page.getByRole("form", { name: "Confirmer le changement de statut" }).getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByRole("list", { name: "Statut de l'événement" }).getByRole("listitem").filter({ hasText: status })).toHaveAttribute("aria-current", "step");
}

// Lot 13 (AIDE-11) — panneau des repères d'un écran (« Aide : <écran> »).
export function landmarksPanel(page: Page, screen: string) {
  return page.getByRole("complementary", { name: `Aide : ${screen}` });
}

// Ferme le panneau des repères s'il est ouvert (affiché d'office une fois).
export async function closeLandmarks(page: Page, screen: string): Promise<void> {
  const panel = landmarksPanel(page, screen);
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Fermer l'aide" }).click();
  await expect(panel).toHaveCount(0);
}

// Lot 13 (L13-HUB-17) — lien du menu de la console d'Administration (replié sur téléphone).
export async function clickAdminMenuLink(page: Page, name: string): Promise<void> {
  await openMenu(page);
  await page.getByRole("navigation", { name: "Menu de l'Administration" }).getByRole("link", { name, exact: true }).click();
}

// Lot 30b (UX-05, décision D9) — aide commune : chaque bouton, sommaire, lien hors d'une
// phrase et case à cocher (par son libellé, qui la porte) visible mesure au moins `min`
// pixels de côté. Un lien dans une phrase est exempté (WCAG 2.5.8, « en ligne »).
export async function expectTouchTargets(page: Page, min: number): Promise<void> {
  const small = await page.evaluate((size) => {
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const words = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
    const inSentence = (link: HTMLElement) => getComputedStyle(link).display === "inline" && words(link.parentElement).length > words(link).length;
    const targets = new Set<Element>();
    for (const element of document.querySelectorAll<HTMLElement>("button, summary, a[href]")) {
      if (element.tagName === "A" && inSentence(element)) continue;
      targets.add(element);
    }
    for (const input of document.querySelectorAll<HTMLInputElement>("input[type=checkbox], input[type=radio]")) {
      targets.add(input.closest("label") ?? input);
    }
    return [...targets]
      .filter(visible)
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width < size || box.height < size)
      .map(({ element, box }) => `${element.tagName} « ${words(element).slice(0, 40)} » ${Math.round(box.width)}×${Math.round(box.height)}`);
  }, min);
  expect(small).toEqual([]);
}

// Lot 33 (SEC-01, SEC-07, D4 ; ADR 0067) — connexion des parcours, comme une personne : lien
// demandé sur /login, lu dans Mailpit, ouvert ; écrans du fournisseur d'identité traversés (clé
// d'accès proposée, code de double authentification, codes de secours). Une titulaire ou
// l'Exploitation a, chez le fournisseur, un second facteur dont le secret se déduit de son
// adresse (parcours seulement), et la double authentification obligatoire.
const MAILPIT = "http://localhost:8025/api/v1";
const APP_ORIGIN = "http://localhost:3000";

function management() {
  return createManagementClient({
    endpoint: process.env.LOGTO_ENDPOINT ?? "http://localhost:3001",
    m2mAppId: process.env.LOGTO_M2M_APP_ID ?? "symbola-bootstrap",
    m2mSecret: process.env.LOGTO_M2M_SECRET ?? "",
  });
}

export function totpSecretFor(email: string): string {
  // Copie des 20 premiers octets : le condensat de Node peut vivre dans un tampon partagé plus grand.
  const bytes = Uint8Array.from(createHash("sha256").update(`symbola-e2e:${email}`).digest().subarray(0, 20));
  return new Secret({ buffer: bytes.buffer }).base32;
}

async function needsMfa(email: string): Promise<boolean> {
  const { sql, db } = createAppConnection();
  try {
    const [user] = await db.select({ id: users.id, operator: users.operator }).from(users).where(eq(users.email, email.toLowerCase()));
    if (!user) return false;
    if (user.operator) return true;
    const owners = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, user.id), eq(memberships.role, "owner"), isNull(memberships.disabledAt)));
    return owners.length > 0;
  } finally {
    await sql.end();
  }
}

// Second facteur connu et double authentification obligatoire chez le fournisseur.
export async function provisionTestMfa(email: string): Promise<string> {
  const client = management();
  const user = (await client.findUserByEmail(email)) ?? (await client.createUser(email));
  for (const verification of await client.listMfaVerifications(user.id)) await client.deleteMfaVerification(user.id, verification.id);
  const secret = totpSecretFor(email);
  await client.request("POST", `/api/users/${user.id}/mfa-verifications`, { type: "Totp", secret });
  await client.requireMfa(user.id);
  return secret;
}

export async function latestMagicLink(email: string, after: number): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const list = (await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()) as { messages?: { ID: string; Created: string }[] };
    const fresh = (list.messages ?? []).filter((message) => new Date(message.Created).getTime() >= after);
    if (fresh.length > 0) {
      const { Text } = (await (await fetch(`${MAILPIT}/message/${fresh[0]!.ID}`)).json()) as { Text: string };
      const link = Text.match(/https?:\/\/[^\s]+\/auth\/lien\/[A-Za-z0-9_-]+/)?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("aucun lien de connexion reçu");
}

// Écrans du fournisseur entre le lien et le retour dans l'app.
export async function crossIdentityProvider(page: Page, secret: string | null): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    await page.waitForURL((url) => url.origin === APP_ORIGIN ? !url.pathname.startsWith("/auth/") : /\/(create-passkey|mfa-verification|mfa-binding)/.test(url.pathname), { timeout: 30_000 });
    const url = new URL(page.url());
    if (url.origin === APP_ORIGIN) return;
    if (url.pathname.includes("/create-passkey")) await page.getByRole("button", { name: "Passer" }).click();
    else if (url.pathname.includes("/mfa-binding/BackupCode")) await page.getByRole("button", { name: "Continuer" }).click();
    else if (url.pathname.includes("/mfa-verification")) {
      if (!secret) throw new Error("double authentification demandée sans secret connu");
      await page.locator("input").first().click();
      await page.keyboard.type(new TOTP({ secret: Secret.fromBase32(secret) }).generate());
    } else throw new Error(`écran du fournisseur inattendu : ${url.pathname}`);
    await page.waitForURL((next) => next.href !== url.href, { timeout: 30_000 });
  }
  throw new Error("connexion inachevée");
}

// Demande le lien, l'ouvre et traverse le fournisseur, sans juger de l'arrivée.
export async function followSignInLink(page: Page, email: string): Promise<void> {
  const secret = (await needsMfa(email)) ? await provisionTestMfa(email) : null;
  const after = Date.now() - 1000;
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir un lien de connexion" }).click();
  await expect(page.getByRole("status")).toContainText("Un lien de connexion vient de partir");
  await page.goto(await latestMagicLink(email, after));
  await crossIdentityProvider(page, secret);
}

export async function signIn(page: Page, email: string, landing?: RegExp | string): Promise<void> {
  await followSignInLink(page, email);
  if (landing) await expect(page).toHaveURL(landing);
  else await expect(page).not.toHaveURL(/\/(login|securite)(\?|$)/);
}
