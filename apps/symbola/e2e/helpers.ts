// Aides communes aux parcours e2e (ADR 0025).
import { createHash } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Secret, TOTP } from "otpauth";
import { createManagementClient, createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { memberships, users } from "@symbola/db/schema/hub";
import { completeSetup } from "../modules/hub/service";
import { fillRequiredMentions } from "../lib/test-fixtures/legal-mentions";

// Lot 70b (UX-07, M5) — le message de retour unique du gabarit (app/ui/feedback.tsx) : une zone
// `aria-live`, pas un `status`, pour ne pas se confondre avec les messages des formulaires.
export function feedback(page: Page): Locator {
  return page.locator(".feedback-region .feedback");
}

// Sur téléphone, le menu latéral est replié derrière un bouton qui le commande (`aria-controls`) : pour
// l'équipe, « Plus » de la barre du bas (lot 70f), qui l'ouvre en panneau du bas ; pour l'Administration et
// le Comptable, « Menu ». L'ouvrir avant de cliquer un lien du menu ; sur ordinateur, le bouton est masqué
// et le menu toujours visible : rien à faire.
export async function openMenu(page: Page): Promise<void> {
  // Le libellé change (« Menu » / « Fermer le menu », « Plus ») : cibler le bouton par ce qu'il commande.
  const toggle = page.locator('button[aria-controls="app-menu"]');
  if ((await toggle.count()) === 0 || !(await toggle.isVisible())) return;
  if ((await toggle.getAttribute("aria-expanded")) === "true") return;
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

// Lot 70f : « Plus » se pose au-dessus de la page ; le refermer (Échap) avant d'agir sur la page.
export async function closeMenu(page: Page): Promise<void> {
  const toggle = page.locator('button[aria-controls="app-menu"]');
  if ((await toggle.count()) === 0 || !(await toggle.isVisible())) return;
  if ((await toggle.getAttribute("aria-expanded")) !== "true") return;
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
}

// Le menu latéral (navigation), pour cibler ses liens sans confusion avec un lien de même nom dans la
// page. Sur téléphone, c'est aussi le panneau « Plus » : il porte toutes les entrées, celles de la barre
// du bas y sont masquées.
export function mainMenu(page: Page) {
  return page.locator("#app-menu");
}

// Lot 70f : la barre du bas du téléphone (quatre entrées et « Plus »), masquée sur ordinateur.
export function tabBar(page: Page) {
  return page.locator(".app-tabbar");
}

// Clique le lien du menu portant exactement ce nom : sur téléphone, dans la barre du bas s'il y est, sinon
// dans « Plus » ; sur ordinateur, dans le menu latéral.
export async function clickMenuLink(page: Page, name: string): Promise<void> {
  const inTabBar = tabBar(page).getByRole("link", { name, exact: true });
  if ((await inTabBar.count()) > 0 && (await inTabBar.isVisible())) {
    await inTabBar.click();
    return;
  }
  await openMenu(page);
  await mainMenu(page).getByRole("link", { name, exact: true }).click();
}

// Lot 70f : sur téléphone, la recherche du haut s'ouvre en page entière par la loupe ; sur ordinateur, le
// champ est déjà là.
export async function openSearch(page: Page): Promise<void> {
  const opener = page.locator(".app-topbar .search-box-open");
  if ((await opener.count()) > 0 && (await opener.isVisible())) await opener.click();
}

// Ouvre le menu du compte : sous le prénom dans la barre du haut (lot 70e) ; sur téléphone, le compte est
// en bas de « Plus » (lot 70f), déjà visible une fois « Plus » ouvert.
export async function openAccountMenu(page: Page): Promise<void> {
  const account = page.locator(".account-menu-button");
  if ((await account.count()) > 0 && (await account.isVisible())) {
    if ((await account.getAttribute("aria-expanded")) !== "true") await account.click();
    return;
  }
  await openMenu(page);
}

// Ouvre le menu si besoin puis se déconnecte. Lot 33 : la déconnexion passe par le fournisseur
// d'identité, qui ramène sur /login ; attendre ce retour, sinon la navigation suivante du parcours
// est interrompue par lui.
// Lot 70e (M7) : pour l'équipe, « Se déconnecter » est dans le menu du compte, sous le prénom, dans la
// barre du haut ; l'Administration et le Comptable le gardent dans leur menu latéral. Lot 70f : sur
// téléphone, il est en dernier dans « Plus ».
export async function logout(page: Page): Promise<void> {
  await openMenu(page);
  const account = page.locator(".account-menu-button");
  if ((await account.count()) > 0 && (await account.isVisible())) await account.click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL((url) => url.origin === APP_ORIGIN && url.pathname === "/login", { timeout: 30_000 });
}

// Fiche évènement en onglets (lot 8) : ouvre l'onglet dont le nom commence
// par `name` (« Budget 1/3 », « Rétroplanning 2 en retard »…).
export async function openEventTab(page: Page, name: string): Promise<void> {
  // Lot 72d (C-23, E3) : des onglets (role tab, aria-selected) ; à l'ordinateur étroit, ceux qui ne tiennent
  // pas sont dans « Plus ▾ » ; sur téléphone, les noms se raccourcissent (« Budget », « Devis »).
  const tabs = page.getByRole("tablist", { name: "Sections de l'évènement" });
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const short = escaped.split(" ")[0]!;
  const pattern = new RegExp(`^(?:${escaped}|${short}(?: |$))`);
  const tab = tabs.getByRole("tab", { name: pattern });
  if (!(await tab.isVisible())) {
    const more = page.getByRole("button", { name: "Plus de sections de l'évènement" });
    if (await more.isVisible()) {
      await more.click();
      await page.getByRole("menu", { name: "Plus de sections de l'évènement" }).getByRole("menuitem", { name: pattern }).click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      return;
    }
  }
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

// Lot 72d (EVT-05 ; E1, E2) : la frise se lit ; une commande de la fiche est dans l'en-tête ou au menu « ⋯ »
// (sur téléphone, toujours au menu ; « Ouvrir le Jour J » prend la place de l'action à l'approche du jour J).
export async function eventCommand(page: Page, name: string | RegExp): Promise<void> {
  const header = page.locator("#event-header");
  await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
  const direct = header.locator(".object-header-actions").getByRole("link", typeof name === "string" ? { name, exact: true } : { name });
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  await header.getByRole("button", { name: /^Plus d'actions pour / }).click();
  const pattern = typeof name === "string" ? new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) : name;
  await page.locator(".event-menu").getByRole("menuitem", { name: pattern }).first().click();
}

// L'étape en cours de la frise (sur téléphone, dans la ligne « … · étape 2 sur 4 »).
export async function expectEventStep(page: Page, step: "Une demande en cours" | "Signé, en préparation" | "Jour J" | "Clôturé"): Promise<void> {
  const header = page.locator("#event-header");
  await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
  const wide = header.getByRole("list", { name: "Où en est l'évènement" });
  if (await wide.isVisible()) await expect(wide.getByRole("listitem").filter({ hasText: step })).toHaveAttribute("aria-current", "step");
  else await expect(header.locator(".event-timeline-compact strong")).toHaveText(step);
}

// Réglages regroupés sous « Paramètres » (lot 13 : menu latéral par rubrique).
export async function openSettingsTab(page: Page, name: string): Promise<void> {
  await clickMenuLink(page, "Paramètres");
  // Lot 62b : attendre l'arrivée sur les Paramètres. Partie d'un autre écran de réglage, la rubrique
  // visée pouvait être visible un instant, puis repliée avec son groupe.
  await page.waitForURL((url) => url.pathname === "/parametres");
  await openSettingsRubric(page, name);
}

// Lot 62b (UX-13, D2) : les groupes du menu des Paramètres se replient, seul celui de la rubrique
// ouverte est déplié. Une rubrique d'un autre groupe s'atteint par « Chercher un réglage ».
export async function openSettingsRubric(page: Page, name: string): Promise<void> {
  const rubrics = page.getByRole("navigation", { name: "Rubriques des paramètres" });
  const link = rubrics.getByRole("link", { name, exact: true });
  await expect(async () => {
    if (!(await link.isVisible())) await rubrics.getByRole("searchbox", { name: "Chercher un réglage" }).fill(name);
    await link.click({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
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

// Lot 72d (E2) : « Clôturer l'évènement… », au bout de la frise (sur téléphone, dans « Les étapes »).
export async function closeEventFromTimeline(page: Page): Promise<void> {
  const header = page.locator("#event-header");
  await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
  const wide = header.locator(".event-timeline-wide").getByRole("link", { name: "Clôturer l'évènement…" });
  if (await wide.isVisible()) {
    await wide.click();
    return;
  }
  await header.getByRole("button", { name: "Les étapes" }).click();
  await page.locator(".event-steps-sheet").getByRole("link", { name: "Clôturer l'évènement…" }).click();
}

// Lot 13 (L13-EVT-19), revu au lot 72d (E1, E2) : la frise se lit ; une demande passe en « Signé, en
// préparation » par « Le contrat est signé… » (sur téléphone, dans « Les étapes »), à la date du jour.
export async function changeEventStatus(page: Page, status: "Confirmé"): Promise<void> {
  if (status !== "Confirmé") throw new Error("seule la signature se pose depuis la fiche");
  const header = page.locator("#event-header");
  await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
  const phone = !(await header.getByRole("list", { name: "Où en est l'évènement" }).isVisible());
  if (phone) await header.getByRole("button", { name: "Les étapes" }).click();
  const scope = phone ? page.locator(".event-steps-sheet") : header;
  await scope.getByRole("button", { name: "Le contrat est signé…" }).click();
  await scope.getByRole("button", { name: "Passer en signé" }).click();
  await expect(feedback(page)).toContainText("Contrat signé");
  if (phone) await page.keyboard.press("Escape");
  await expectEventStep(page, "Signé, en préparation");
}

// Lot 13 (AIDE-11), revu au lot 63f (ADR 0104) — tiroir de l'aide d'un écran (« Aide : <écran> »),
// ouvert par le « ? ».
export function helpPanel(page: Page, screen: string) {
  return page.getByRole("complementary", { name: `Aide : ${screen}` });
}

// Ferme le tiroir de l'aide.
export async function closeHelp(page: Page, screen: string): Promise<void> {
  const panel = helpPanel(page, screen);
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Fermer l'aide" }).click();
  await expect(panel).toHaveCount(0);
}

// Lot 63f (HUB-11, ADR 0104) — la visite guidée d'un écran (« Visite : <écran> »), lancée d'office
// à la première ouverture.
export function tourDialog(page: Page, screen: string) {
  return page.getByRole("dialog", { name: `Visite : ${screen}` });
}

// Passe la visite lancée d'office.
export async function skipTour(page: Page, screen: string): Promise<void> {
  const dialog = tourDialog(page, screen);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Passer la visite" }).click();
  await expect(dialog).toHaveCount(0);
}

// Lot 13 (L13-HUB-17) — lien du menu de la console d'Administration (replié sur téléphone).
export async function clickAdminMenuLink(page: Page, name: string): Promise<void> {
  await openMenu(page);
  await page.getByRole("navigation", { name: "Menu de l'Exploitation" }).getByRole("link", { name, exact: true }).click();
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
    const owners = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, user.id), inArray(memberships.role, ["owner", "accountant"]), isNull(memberships.disabledAt)));
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

// Lot 40c (NFR-18) : le WebKit de Playwright sous Linux (CI) n'a pas WebAuthn, que Safari a ; Logto
// y remplace la proposition de clé d'accès (« Passer ») par un refus sans issue. On donne à la page
// l'interface que Safari expose (PublicKeyCredential, navigator.credentials), sans authentificateur,
// puis on la recharge : la proposition redevient passable. Sans effet là où WebAuthn existe.
async function offerSafariWebAuthn(page: Page): Promise<void> {
  if (await page.evaluate(() => typeof window.PublicKeyCredential === "function" && !!navigator.credentials)) return;
  await page.context().addInitScript(() => {
    if (typeof window.PublicKeyCredential === "function" && navigator.credentials) return;
    const refuse = () => Promise.reject(new DOMException("Aucun authentificateur", "NotAllowedError"));
    const credential = Object.assign(function PublicKeyCredential() {}, {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => false,
      isConditionalMediationAvailable: async () => false,
    });
    Object.defineProperty(window, "PublicKeyCredential", { value: credential, configurable: true });
    Object.defineProperty(navigator, "credentials", { value: { create: refuse, get: refuse, store: refuse, preventSilentAccess: async () => undefined }, configurable: true });
  });
  await page.reload();
}

// Écrans du fournisseur entre le lien et le retour dans l'app.
export async function crossIdentityProvider(page: Page, secret: string | null): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    await page.waitForURL((url) => url.origin === APP_ORIGIN ? !url.pathname.startsWith("/auth/") : /\/(create-passkey|mfa-verification|mfa-binding)/.test(url.pathname), { timeout: 30_000 });
    const url = new URL(page.url());
    if (url.origin === APP_ORIGIN) return;
    if (url.pathname.includes("/create-passkey")) {
      await offerSafariWebAuthn(page);
      await page.getByRole("button", { name: "Passer" }).click();
    } else if (url.pathname.includes("/mfa-binding/BackupCode")) await page.getByRole("button", { name: "Continuer" }).click();
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

// Lot 65b (PRE-02, ADR 0111, maquette M14) : la fenêtre d'un poste de « Budget et prestataires ».
// Modale : l'écran derrière est inerte, on la ferme avant de lire le tableau.
function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slotWindow(page: Page, slot: string) {
  return page.getByRole("dialog", { name: new RegExp(`^${escapeForRegExp(slot)} · poste \\d+ sur \\d+`) });
}

export async function openSlotWindow(page: Page, slot: string, rubric?: "Prestataires" | "Montants" | "Échéancier" | "Documents" | "Réglages du poste") {
  await page.getByRole("button", { name: `Ouvrir le poste « ${slot} »` }).click();
  const window = slotWindow(page, slot);
  await expect(window).toBeVisible();
  if (rubric) await openSlotRubric(page, slot, rubric);
  return window;
}

export async function openSlotRubric(page: Page, slot: string, rubric: "Prestataires" | "Montants" | "Échéancier" | "Documents" | "Réglages du poste") {
  await slotWindow(page, slot).getByRole("navigation", { name: "Rubriques du poste" }).getByRole("button", { name: rubric }).click();
}

// Le détail des prestataires du poste (statut, devis, notes), sous la comparaison.
export async function openSlotDetails(page: Page, slot: string) {
  const window = slotWindow(page, slot);
  const details = window.locator("details.slot-window-details");
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await details.locator("summary").click();
  return window.getByRole("region", { name: `Prestataires consultés — ${slot}` });
}

export async function closeSlotWindow(page: Page, slot: string) {
  const window = slotWindow(page, slot);
  await window.locator(".window-actions").getByRole("button", { name: "Fermer" }).click();
  await expect(window).toHaveCount(0);
}

// Lot 71c (HUB-14 ; C-64) : l'étape « Questions » d'une fiche d'un logiciel — « Où en est-il ? », et la
// source si elle est donnée ; puis « Continuer » jusqu'à « Vérifier et confirmer ».
export async function answerSheetQuestions(page: Page, options: { source?: string } = {}): Promise<void> {
  await expect(page).toHaveURL(/\/questions$/, { timeout: 30_000 });
  await page.getByRole("radio", { name: /Signé, en préparation/ }).check();
  const type = page.getByRole("group", { name: "Quel type d'évènement ?" });
  if ((await type.count()) > 0) await type.getByRole("radio").first().check();
  if (options.source) await page.getByLabel("Comment ce couple vous a-t-il connue ? (facultatif)").selectOption({ label: options.source });
  await page.getByRole("group", { name: "Actions de l'étape" }).getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/confirmation$/, { timeout: 30_000 });
}

// Lot 72e (EVT-03 ; C-26) — « Modifier les informations » : une fenêtre à cinq rubriques et un seul
// « Enregistrer », ouverte depuis « Informations » de la Synthèse.
export function eventInfoWindow(page: Page): Locator {
  return page.getByRole("dialog", { name: /^Les informations de « / });
}

export type EventInfoRubric = "Date et lieux" | "Mariés" | "Invités et budget" | "Style et notes" | "Type et origine";

export async function openEventInfo(page: Page, rubric?: EventInfoRubric): Promise<Locator> {
  await page.locator("#event-tab-panel").getByRole("link", { name: "Modifier les informations" }).click();
  const window = eventInfoWindow(page);
  await expect(window).toBeVisible();
  if (rubric) await window.getByRole("navigation", { name: "Rubriques des informations" }).getByRole("button", { name: rubric, exact: true }).click();
  return window;
}

export async function openEventInfoRubric(page: Page, rubric: EventInfoRubric): Promise<void> {
  await eventInfoWindow(page).getByRole("navigation", { name: "Rubriques des informations" }).getByRole("button", { name: rubric, exact: true }).click();
}

export async function saveEventInfo(page: Page): Promise<void> {
  const window = eventInfoWindow(page);
  await window.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(window).toBeHidden();
}
