// Lot 72b (HUB-08, UX-01, UX-06, UX-13, HUB-11, AIDE-04, PAR-03 ; spécification du lot 72, § 5.2 ; maquettes
// 13 et 14 du lot 68) — l'écran « Aujourd'hui » dans ses trois états, à 1 280 et à 375 px (projets
// « desktop » et « mobile-375 »), plus 360 px pour le premier écran ; axe-core sur chaque état. Un `test`
// par critère du paquet.
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import AxeBuilder from "./axe";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { createOrganization, createUser, setUserNames } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";
import { addEventTask, addEventVendorSlot, addVendorCandidate, changeEventStatus, createProspect, createProspectSource, updateVendorCandidate } from "../modules/events/service";
import { completeSetup, saveOnboardingStep } from "../modules/hub/service";
import { createVendor } from "../modules/vendors/service";
import { feedback, signIn } from "./helpers";

// Une action serveur suivie d'un rafraîchissement : le premier passage compile l'écran en développement.
const expect = baseExpect.configure({ timeout: 20_000 });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

// Critère 7 : à 375 px, aucune commande de l'écran sous 44 px (un lien dans une phrase est exclu), aucun
// défilement de côté.
async function expectPhoneRules(page: Page) {
  if (!isPhone(page)) return;
  const small = await page.evaluate(() => {
    const words = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
    const inSentence = (link: HTMLElement) => getComputedStyle(link).display === "inline" && words(link.parentElement).length > words(link).length;
    return [...document.querySelectorAll<HTMLElement>("main button, main summary, main a[href]")]
      .filter((element) => !(element.tagName === "A" && inSentence(element)))
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ element, box }) => box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden")
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ element, box }) => `${element.tagName} « ${words(element).slice(0, 40)} » ${Math.round(box.width)}×${Math.round(box.height)}`);
  });
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

function parisDay(offsetDays = 0): string {
  const day = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
}

type Space = { organizationId: string; userId: string; email: string; colleagueId: string };

// Une agence dont l'assistant est fini mais pas « L'essentiel » (société, adresse, TVA) : « Pour bien démarrer »
// a encore une étape. Sa titulaire Camille et un collègue.
async function space(options: { tools?: string[] } = {}): Promise<Space> {
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Atelier 72b ${randomUUID()}`);
    await completeSetup(db, organization.id);
    await saveOnboardingStep(db, organization.id, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner", ...(options.tools ? { replacedTools: options.tools } : {}) });
    const email = `camille-72b-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    await setUserNames(db, owner.id, { firstName: "Camille", lastName: "Roussel" });
    const colleague = await createUser(db, { organizationId: organization.id, email: `bastien-72b-${randomUUID()}@symbola.test`, role: "member" });
    return { organizationId: organization.id, userId: owner.id, email, colleagueId: colleague.id };
  } finally {
    await sql.end();
  }
}

async function wedding(context: Space, first: string, second: string, days: number, options: { confirmed?: boolean; phone?: string } = {}) {
  const source = await createProspectSource(context.organizationId, `Salon ${randomUUID().slice(0, 6)}`);
  const event = await createProspect({
    organizationId: context.organizationId,
    createdByUserId: context.userId,
    prospectSourceId: source.id,
    clients: [{ firstName: first, lastName: "Martin", phone: options.phone ?? null, email: null }, { firstName: second }],
    eventDate: parisDay(days),
  });
  if (options.confirmed ?? true) await changeEventStatus({ organizationId: context.organizationId, eventId: event.id, changedByUserId: context.userId, toStatus: "confirmed" });
  return event.id;
}

// L'Atelier Roussel rempli (maquette 13) : deux retards, des tâches à venir dont une des mariés, un contrat de
// prestataire attendu, avec les contacts à appeler. `extra` tâches de plus pour dépasser les sept lignes.
async function filled(context: Space, extra = 0) {
  const lea = await wedding(context, "Léa", "Maxime", 199, { phone: "06 00 00 18 52" });
  const ines = await wedding(context, "Inès", "Paul", 297, { confirmed: false });
  const task = (eventId: string, label: string, days: number, responsible: "planner" | "clients" = "planner") =>
    addEventTask(context.organizationId, eventId, { label, dueDate: parisDay(days), responsible, ...(responsible === "planner" ? { assigneeUserId: context.userId } : {}) });
  await task(lea, "Faire signer le contrat du photographe", -5);
  await task(lea, "Confirmer la voiture des mariés", -4);
  await task(lea, "Choisir le fleuriste", 4, "clients");
  await task(ines, "Organiser la dégustation finale", 5);
  for (let index = 0; index < extra; index += 1) await task(lea, `Préparer le point ${index + 1}`, 6 + index);
  const { vendor } = await createVendor(context.organizationId, { name: "Maison Haddad", typeId: null, contactName: "Karim Haddad", phone: "06 00 00 41 27", email: `haddad-${randomUUID()}@exemple.test` });
  const slot = await addEventVendorSlot(context.organizationId, lea, "Traiteur");
  const candidate = await addVendorCandidate({ organizationId: context.organizationId, eventId: lea, vendorSlotId: slot.id, vendorName: "Maison Haddad", vendorId: vendor.id });
  await updateVendorCandidate({ organizationId: context.organizationId, candidateId: candidate.id, status: "retained", changedByUserId: context.userId });
  return { lea, ines };
}

const card = (page: Page) => page.getByRole("region", { name: /^À traiter en premier/ });
const primaries = (page: Page) => page.locator("main .button-primary, main .button-link-primary");

test.describe("HUB-08, UX-01 — L'écran « Aujourd'hui » (lot 72b)", () => {
  // La connexion passe par le lien et le fournisseur d'identité.
  test.describe.configure({ timeout: 120_000 });

  test("critère 1 — espace neuf, « je pars de zéro » : un seul bouton plein, « Nouvel évènement », la reprise en ligne ; ni calendrier, ni « tout est à jour »", async ({ page }) => {
    const context = await space();
    await signIn(page, context.email);
    await page.goto("/");
    const empty = page.getByRole("region", { name: "Commencez par votre premier mariage" });
    await expect(empty).toContainText("Symbola part de vos évènements");
    await expect(primaries(page)).toHaveCount(1);
    await expect(primaries(page)).toHaveText("Nouvel évènement");
    await expect(primaries(page)).toHaveAttribute("href", "/events/new");
    await expect(empty.getByRole("link", { name: "Reprendre ses fichiers" })).toHaveAttribute("href", "/reprise");
    await expect(page.locator("#calendrier")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Mes évènements" })).toHaveCount(0);
    await expect(card(page)).toHaveCount(0);
    await expect(page.getByText(/tout est à jour|rien ne presse/i)).toHaveCount(0);
    // Ni le bandeau de la fiche entreprise, ni « Risques » : « Pour bien démarrer » porte l'étape.
    await expect(page.getByText("Votre fiche entreprise n'est pas encore complète.")).toHaveCount(0);
    await expect(page.getByRole("region", { name: /^Pour bien démarrer/ })).toContainText("0 sur 2");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);
  });

  test("critère 1 — espace neuf, « je suis dans un tableur » : « Reprendre un mariage » en bouton plein, « Nouvel évènement » en ligne", async ({ page }) => {
    const context = await space({ tools: ["spreadsheet"] });
    await signIn(page, context.email);
    await page.goto("/");
    const empty = page.getByRole("region", { name: "Commencez par reprendre un mariage en cours" });
    await expect(empty).toContainText("Ses prestataires, son budget, ses tâches et son programme arrivent tels qu'ils sont.");
    await expect(primaries(page)).toHaveCount(1);
    await expect(primaries(page)).toHaveText("Reprendre un mariage");
    await expect(primaries(page)).toHaveAttribute("href", "/reprise");
    await expect(empty).toContainText("Un mariage qui commence ?");
    await expect(empty.getByRole("link", { name: "Nouvel évènement" })).toHaveAttribute("href", "/events/new");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);
  });

  test("critère 2 — espace rempli : rien entre le compte et « À traiter en premier » ; ni bandeau fiche entreprise, ni « Risques »", async ({ page }) => {
    const context = await space();
    await filled(context);
    await signIn(page, context.email);
    await page.goto("/");
    await expect(page.getByText(/2 évènements en cours/)).toBeVisible();
    const count = page.locator(".today-count");
    await expect(count).toHaveText(/^5 points (à traiter )?d'ici 14 jours, dont 2 en retard$/);
    // Le compte, puis aussitôt la carte : seules des alertes qui bloquent peuvent passer entre les deux.
    const between = await page.evaluate(() => {
      const head = document.querySelector(".today-header")!;
      const first = document.querySelector(".today-first")!;
      const nodes: string[] = [];
      for (let node = head.nextElementSibling; node && node !== first; node = node.nextElementSibling) {
        if (node.getBoundingClientRect().height > 0) nodes.push(node.className || node.tagName);
      }
      return nodes;
    });
    expect(between).toEqual([]);
    await expect(page.getByRole("heading", { name: "Risques" })).toHaveCount(0);
    await expect(page.getByText("Aucun risque détecté ce matin.")).toHaveCount(0);
    await expect(page.getByText("Votre fiche entreprise n'est pas encore complète.")).toHaveCount(0);
    // L'ordre des blocs : la carte, « Mes évènements », le calendrier, « Pour bien démarrer » en bas.
    const order = await page.evaluate(() => ["today-first", "today-my-events", "calendrier", "first-steps-line"].map((name) => document.querySelector(`.${name}, #${name}`)?.getBoundingClientRect().top ?? -1));
    expect(order.every((top) => top >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // § 6 de la synthèse : les retards en tête, « Vous » ou « Attend … » sur chaque ligne.
    const lines = card(page).getByRole("listitem");
    await expect(lines.nth(0)).toContainText("Faire signer le contrat du photographe");
    await expect(lines.nth(0)).toContainText("En retard de 5 jours");
    await expect(lines.nth(0)).toContainText("Vous");
    const contract = card(page).getByRole("listitem").filter({ hasText: "Contrat de Maison Haddad (Traiteur) à faire signer" });
    await expect(contract).toContainText("Attend Maison Haddad");
    // Le contact à appeler, sous le titre ; « Noter une relance », la seule action de la ligne.
    await expect(contract).toContainText("Karim Haddad · 06 00 00 41 27");
    await expect(contract.getByRole("button", { name: /Noter une relance/ })).toBeVisible();
    await expect(contract.getByRole("link", { name: "Ouvrir" })).toHaveCount(0);
    // Une tâche des mariés porte le contact du premier client.
    await expect(card(page).getByRole("listitem").filter({ hasText: "Choisir le fleuriste" })).toContainText("Léa Martin · 06 00 00 18 52");
    // « Mes évènements » répartit le même total : 4 points, dont 2 en retard, pour Léa et Maxime.
    const mine = page.getByRole("region", { name: "Mes évènements" });
    await expect(mine).toContainText("2 en cours");
    await expect(mine.getByRole("listitem").filter({ hasText: "Léa & Maxime" })).toContainText("4 points, dont 2 en retard");
    await expect(mine.getByRole("listitem").filter({ hasText: "Inès & Paul" })).toContainText("1 point");
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);
  });

  test("critère 3 — le titre d'une tâche ouvre son panneau sur l'accueil ; « Fermer » rend la ligne à la même place ; le nom du mariage mène à la fiche", async ({ page }) => {
    const context = await space();
    const { lea } = await filled(context, 6);
    await signIn(page, context.email);
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 520 });
    await page.goto("/");
    const line = card(page).getByRole("listitem").filter({ hasText: "Organiser la dégustation finale" });
    await line.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    const top = (await line.boundingBox())!.y;
    await line.getByRole("link", { name: "Organiser la dégustation finale" }).click();
    await expect(page).toHaveURL(/\/\?tache=/);
    const panel = page.getByRole("dialog", { name: /Organiser la dégustation finale/ });
    await expect(panel).toBeVisible();
    await expectNoAxeViolation(page);
    await (isPhone(page) ? panel.getByRole("button", { name: /Aujourd'hui/ }) : panel.getByRole("button", { name: "Fermer", exact: true })).click();
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(2);
    expect(Math.abs((await line.boundingBox())!.y - top)).toBeLessThanOrEqual(2);
    await card(page).getByRole("listitem").filter({ hasText: "Faire signer le contrat du photographe" }).getByRole("link", { name: "Léa & Maxime" }).click();
    // La fiche du mariage, à son onglet « Tâches » (lien de la ligne type, lot 70c).
    await expect(page).toHaveURL(new RegExp(`/events/${lea}(\\?onglet=taches)?$`));
  });

  test("critère 4 — plus de sept points : « 7 sur 11 », « Tâches 6 sur 10 », puis « Tout afficher » allonge la carte sur place, 7 + 4 = 11", async ({ page }) => {
    const context = await space();
    await filled(context, 6);
    await signIn(page, context.email);
    await page.goto("/");
    await expect(page.locator(".today-count")).toHaveText(/^11 points (à traiter )?d'ici 14 jours, dont 2 en retard$/);
    await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("À traiter en premier · 7 sur 11");
    await expect(card(page).getByRole("listitem")).toHaveCount(7);
    await expect(card(page).getByRole("heading", { name: /^Tâches/ })).toHaveText("Tâches 6 sur 10");
    await expect(card(page).getByRole("link", { name: "Voir les 10 dans Tâches" })).toHaveAttribute("href", "/taches");
    await expect(card(page)).toContainText("4 autres points d'ici 14 jours");
    const url = page.url();
    await card(page).getByRole("button", { name: "Tout afficher" }).click();
    await expect(card(page).getByRole("listitem")).toHaveCount(11);
    await expect(page).toHaveURL(/\?tout=1$/);
    expect(new URL(page.url()).pathname).toBe(new URL(url).pathname);
    await expect(card(page).getByRole("heading", { name: /^Tâches/ })).toHaveText("Tâches 10");
    await expect(card(page).getByRole("button", { name: "Tout afficher" })).toHaveCount(0);
    await expectNoAxeViolation(page);
    // L'adresse garde « ?tout=1 » : rouverte, la carte est entière.
    await page.reload();
    await expect(card(page).getByRole("listitem")).toHaveCount(11);
    await expectPhoneRules(page);
  });

  test("critère 5 — « Masquer » retire « Pour bien démarrer » pour cette personne, pas pour ses collègues ; « Annuler » le rend", async ({ page }) => {
    const context = await space();
    await filled(context);
    await signIn(page, context.email);
    await page.goto("/");
    const line = page.getByRole("region", { name: /^Pour bien démarrer/ });
    await expect(line).toContainText(/\d sur 2/);
    await expect(line).toContainText("reste :");
    await line.getByRole("button", { name: "Masquer" }).click();
    await expect(line).toHaveCount(0);
    const undo = feedback(page).filter({ hasText: "« Pour bien démarrer » est masqué" });
    await expect(undo).toBeVisible();
    await undo.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByRole("region", { name: /^Pour bien démarrer/ })).toBeVisible();
    // Masquée pour de bon : gardée en base pour la personne, sur tous ses appareils ; le collègue la garde.
    await page.getByRole("region", { name: /^Pour bien démarrer/ }).getByRole("button", { name: "Masquer" }).click();
    await expect(page.getByRole("region", { name: /^Pour bien démarrer/ })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("region", { name: /^Pour bien démarrer/ })).toHaveCount(0);
    const { sql, db } = createAppConnection();
    try {
      const rows = await db.select({ id: users.id, hidden: users.firstStepsHidden }).from(users).where(inArray(users.id, [context.userId, context.colleagueId]));
      expect(Object.fromEntries(rows.map((row) => [row.id, row.hidden]))).toEqual({ [context.userId]: true, [context.colleagueId]: false });
    } finally {
      await sql.end();
    }
  });

  test("critère 6 — au lendemain d'une reprise : « 0 point » avec sa raison, « Pas encore de tâches » dans « Mes évènements », aucune fausse urgence", async ({ page }) => {
    const context = await space({ tools: ["spreadsheet"] });
    const juliette = await wedding(context, "Juliette", "Romain", 115);
    await wedding(context, "Léa", "Hugo", 199);
    await signIn(page, context.email);
    await page.goto("/");
    await expect(page.locator(".today-count")).toHaveText("Aucun point à traiter d'ici 14 jours : vos 2 mariages n'ont pas encore de tâches.");
    await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("À traiter en premier · 0 point");
    await expect(card(page)).toContainText("Rien d'ici 14 jours. Les échéances arriveront avec les tâches");
    await expect(card(page).getByRole("link", { name: "reprendre la liste de votre tableur" })).toHaveAttribute("href", `/events/${juliette}?onglet=taches`);
    await expect(card(page).getByRole("link", { name: "partir d'un modèle" })).toHaveAttribute("href", `/events/${juliette}?onglet=taches`);
    await expect(page.getByText(/tout est à jour/i)).toHaveCount(0);
    const mine = page.getByRole("region", { name: "Mes évènements" });
    await expect(mine.getByText("Pas encore de tâches")).toHaveCount(2);
    await expect(mine.getByText("À jour")).toHaveCount(0);
    await expectNoAxeViolation(page);
    await expectPhoneRules(page);
  });

  test("critère 7 — à 375 et 360 px : la première ligne arrive à 260 px au plus, sous aucune barre fixe ; un toucher sur le téléphone ouvre l'appel", async ({ page }) => {
    test.skip(!isPhone(page), "téléphone seulement");
    const context = await space();
    await filled(context);
    await signIn(page, context.email);
    for (const width of [375, 360]) {
      await page.setViewportSize({ width, height: 780 });
      await page.goto("/");
      const first = card(page).getByRole("listitem").first();
      const box = (await first.boundingBox())!;
      expect(box.y).toBeLessThanOrEqual(260);
      // Rien ne la recouvre : le point du titre appartient à la ligne (barre du haut, barre du bas).
      const covered = await first.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + 24, rect.top + 12);
        return hit ? !element.contains(hit) : true;
      });
      expect(covered).toBe(false);
      const contract = card(page).getByRole("listitem").filter({ hasText: "Contrat de Maison Haddad" });
      await expect(contract.getByRole("link", { name: /06 00 00 41 27/ })).toHaveAttribute("href", "tel:0600004127");
      await expectPhoneRules(page);
    }
    await expectNoAxeViolation(page);
  });
});
