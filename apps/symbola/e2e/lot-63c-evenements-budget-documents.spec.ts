// Lot 63c (EVT-01, EVT-07, CHR-01, BUD-01, BUD-03, BUD-04, DOC-01, UX-09, UX-13 ; ADR 0106, 0107 ;
// maquettes M7, M8, M9, M12) — retours de la recette de la planner du 21/11 : « Nouveau » et ses
// trois choix, rétroplanning proposé à la création, un seul en-tête pour les trois vues, « Budget et
// prestataires » en une vue (échéancier dépliable, grande fenêtre, « Choisir un prestataire… »),
// zone de dépôt typée et « Déplacer vers… », réglages dans le panneau latéral. Chaque parcours tourne
// en taille ordinateur et en 375 px, avec axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { addDefaultVendorSlots, addVendorCandidate, createEventType, createProspect, createProspectSource, createTaskTemplate, listEventTasks, listEventVendorSlots, listEvents } from "../modules/events/service";
import { addVendorPayment, listBudgetLines, updateBudgetLine } from "../modules/budget/service";
import { createVendor, createVendorType } from "../modules/vendors/service";
import { closeSlotWindow, openSlotWindow, readyOrganization, signIn } from "./helpers";

const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

async function planner() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    const email = `planner-63c-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: "mot-de-passe-lot-63c", role: "owner" });
    await addDefaultVendorSlots(organizationId, ["Traiteur", "Fleurs"]);
    const source = await createProspectSource(organizationId, "Salon");
    return { organizationId, userId: owner.id, email, sourceId: source.id };
  } finally {
    await sql.end();
  }
}

async function wedding() {
  const setup = await planner();
  const { organizationId, userId } = setup;
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: setup.sourceId, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Dubois" }], eventDate: "2027-06-12" });
  const slots = await listEventVendorSlots(organizationId, event.id);
  const caterer = slots.find((slot) => slot.label === "Traiteur")!;
  const florist = slots.find((slot) => slot.label === "Fleurs")!;
  const saveurs = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Les Saveurs", vendorId: null });
  for (const [field, amountCents] of [["estimated", 800000], ["quoted", 840000]] as const) {
    await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: caterer.id, field, amountCents, changedByUserId: userId });
  }
  await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: florist.id, field: "estimated", amountCents: 180000, changedByUserId: userId });
  const line = (await listBudgetLines(organizationId, event.id)).lines.find((entry) => entry.eventVendorSlotId === caterer.id)!;
  await addVendorPayment({ organizationId, eventId: event.id, lineId: line.id, label: "Acompte", fixedAmountCents: 252000, dueOn: "2026-10-02", changedByUserId: userId });
  await addVendorPayment({ organizationId, eventId: event.id, lineId: line.id, label: "Solde", fixedAmountCents: 588000, dueOn: "2027-06-14", changedByUserId: userId });
  const floristType = await createVendorType(organizationId, "Fleuriste", "#2f6f5e");
  await createVendor(organizationId, { name: "Atelier Floréal", typeId: floristType.id, city: "Lyon" });
  return { ...setup, eventId: event.id, saveursId: saveurs.id };
}

test("EVT-01, EVT-07, CHR-01 — « Nouvel évènement » sur les trois vues ; un mariage signé part de son rétroplanning, un shooting sans modèle n'en reçoit pas (ADR 0106, lot 70e)", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await planner();
  expect(await listEvents({ organizationId: setup.organizationId })).toEqual([]);
  // Deux types : « Mariage », dont le modèle est rattaché au type, et « Shooting photo », sans modèle.
  const weddingTypeId = (await createEventType(setup.organizationId, { label: "Mariage", audience: "couple" })).id;
  const shootingTypeId = (await createEventType(setup.organizationId, { label: "Shooting photo", audience: "clients" })).id;
  await signIn(page, setup.email);

  // Un seul en-tête sur les trois vues, avec « Nouvel évènement » au même endroit, une seule entrée (D8).
  // Lot 72f (C-81) : sur téléphone, la liste et le calendrier laissent « Nouvel évènement » à « Créer » de la barre du
  // haut, et les vues au menu « ⋯ » ; la vue « Colonnes » garde son en-tête.
  const phone = (page.viewportSize()?.width ?? 1280) < 640;
  for (const [view, path] of [["Liste", "/events"], ["Colonnes", "/events/pipeline"], ["Calendrier", "/events?affichage=calendrier"]] as const) {
    await page.goto(path);
    if (phone && view !== "Colonnes") continue;
    await expect(page.getByRole("heading", { level: 1, name: "Évènements" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: view })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Nouvel évènement", exact: true })).toBeVisible();
  }
  await page.goto(phone ? "/events/pipeline" : "/events");
  await page.getByRole("link", { name: "Nouvel évènement", exact: true }).click();
  await expect(page).toHaveURL(/\/events\/new$/);
  await expectNoAxeViolation(page);

  // Le type a un modèle : un évènement signé, daté, le reçoit d'emblée (lot 70e, A10).
  await createTaskTemplate(setup.organizationId, "Mariage — 12 mois", [
    { label: "Réserver le lieu", offsetDays: -365, responsible: "planner" },
    { label: "Plan de table", offsetDays: -14, responsible: "clients" },
  ], weddingTypeId);
  await page.reload();
  // Sans nom ni réponse : les deux erreurs, sous leurs champs ; le focus va à la première (lot 70b, UX-10).
  await page.getByRole("button", { name: "Créer l'évènement" }).click();
  const eventName = page.getByLabel(/^Nom de l'évènement/);
  await expect(eventName).toHaveAttribute("aria-invalid", "true");
  await expect(eventName).toHaveAccessibleDescription(/Donnez un nom à l'évènement, par exemple « Léa & Maxime »\./);
  await expect(page.getByText("Choisissez où en est cet évènement.")).toBeVisible();
  await page.locator('select[name="eventTypeId"]').selectOption({ value: weddingTypeId });
  await page.getByRole("radio", { name: /^Signé, en préparation/ }).check();
  await eventName.fill("Mariage Bernard");
  await page.getByLabel(/^Date/).fill("2027-06-12");
  await page.getByRole("button", { name: "Créer l'évènement" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/, { timeout: 20_000 });
  const eventId = /\/events\/([0-9a-f-]{36})/.exec(page.url())![1]!;
  expect((await listEventTasks(setup.organizationId, eventId)).map((task) => task.label).sort()).toEqual(["Plan de table", "Réserver le lieu"]);
  await expect(page.getByRole("heading", { level: 1, name: /Mariage Bernard/ })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Le shooting n'a pas de modèle : aucune tâche n'est posée ; une demande en cours reste une Option.
  await page.goto("/events/new");
  await page.locator('select[name="eventTypeId"]').selectOption({ value: shootingTypeId });
  await page.getByRole("radio", { name: /^Une demande en cours/ }).check();
  await page.getByLabel(/^Nom de l'évènement/).fill("Shooting Léa");
  await page.getByLabel(/^Date/).fill("2027-07-03");
  await page.getByRole("button", { name: "Créer l'évènement" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/, { timeout: 20_000 });
  const shootingId = /\/events\/([0-9a-f-]{36})/.exec(page.url())![1]!;
  expect(await listEventTasks(setup.organizationId, shootingId)).toEqual([]);
});

test("BUD-01, BUD-03, BUD-04 — Budget et prestataires : réel, écart, réglé, reste, prochaine échéance, échéancier, engagé, grande fenêtre", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await signIn(page, setup.email);
  await page.goto(`/events/${setup.eventId}?onglet=budget`);
  const table = page.getByRole("region", { name: "Budget et prestataires, par poste" });
  const caterer = table.getByRole("row").filter({ hasText: "Traiteur" }).first();
  // Prévu 8 000, réel 8 400, écart + 400, réglé 0, reste 8 400, prochaine échéance : l'acompte, en retard.
  await expect(caterer).toContainText("8 000,00 €");
  await expect(caterer).toContainText("8 400,00 €");
  await expect(caterer).toContainText("+ 400,00 €");
  await expect(caterer).toContainText("En retard");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // L'échéancier se déplie ; « Marquer payée » l'acompte.
  await caterer.getByRole("button", { name: "Voir l'échéancier de « Traiteur »" }).click();
  const schedule = page.getByRole("region", { name: "Échéancier de « Traiteur »" });
  await schedule.getByRole("button", { name: "Marquer payée Acompte" }).click();
  await expect(schedule.getByText(/payée le/i)).toBeVisible({ timeout: 20_000 });
  await expect(caterer).not.toContainText("En retard");

  // « Ouvrir » ouvre la fenêtre du poste (lot 65b, M14) ; rubrique « Montants » : l'engagé se pose,
  // « Engagé » s'affiche et le sous-total suit.
  const window = await openSlotWindow(page, "Traiteur", "Montants");
  await expect(window).toHaveAccessibleName(/Traiteur · poste 1 sur 2/);
  await window.getByLabel("Engagé", { exact: true }).fill("8400");
  await expectNoAxeViolation(page);
  await window.getByRole("button", { name: "Enregistrer, poste suivant : Fleurs ›" }).click();
  await expect(page.getByRole("dialog", { name: /Fleurs · poste 2 sur 2/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(caterer.getByText("Engagé", { exact: true })).toBeVisible();
  await expect(table.getByRole("row", { name: /dont engagé/ })).toContainText("8 400,00 €");
  // Lot 67c (BUD-02 ; recette du 24/11/2026, R06) : les totaux se lisent aussi en tête de l'onglet.
  const totals = page.getByRole("definition").filter({ hasText: "dont engagé : 8 400,00 €" });
  await expect(totals).toBeVisible();
  await expect(page.getByLabel("Totaux du budget").getByText("Reste à payer")).toBeVisible();

  // « + Ajouter des prestataires » sur la ligne des fleurs (lot 65b, M14 C ; lot 73c, panneau du poste) :
  // le fleuriste du carnet, sans rien taper ; « Mettre en comparaison » ne le retient pas.
  const flowers = table.getByRole("row").filter({ hasText: "Fleurs" }).first();
  await flowers.getByRole("button", { name: /\+ Ajouter des prestataires/ }).click();
  const results = page.getByRole("group", { name: "Ajouter un prestataire à « Fleurs »" });
  await expect(results.getByRole("listitem").first()).toContainText("Atelier Floréal");
  await expect(results.getByRole("link", { name: /Chercher dans tout le carnet \(\d+ fiches?\)/ })).toBeVisible();
  await results.getByRole("button", { name: "Mettre en comparaison — Atelier Floréal", exact: true }).click();
  await expect(results.getByRole("listitem").first()).toContainText("Dans la comparaison");
  await page.keyboard.press("Escape");
  await expect(flowers).toContainText("1 en comparaison");
  await expect(flowers).not.toContainText("Atelier Floréal");

  // La fenêtre du poste : la comparaison, « Retenir », puis « Ne plus retenir » (sans supprimer la ligne).
  const floristWindow = await openSlotWindow(page, "Fleurs");
  const comparison = floristWindow.getByRole("table", { name: "Comparaison des prestataires de « Fleurs »" });
  await comparison.getByRole("button", { name: "Retenir — Atelier Floréal", exact: true }).click();
  await expect(comparison.getByRole("columnheader", { name: /Atelier Floréal Retenu/ })).toBeVisible();
  await expectNoAxeViolation(page);
  await comparison.getByRole("button", { name: "Ne plus retenir — Atelier Floréal", exact: true }).click();
  await expect(comparison.getByRole("button", { name: "Retenir — Atelier Floréal", exact: true })).toBeVisible();
  await comparison.getByRole("button", { name: "Retenir — Atelier Floréal", exact: true }).click();
  await expect(comparison.getByRole("columnheader", { name: /Atelier Floréal Retenu/ })).toBeVisible();
  await closeSlotWindow(page, "Fleurs");
  await expect(flowers).toContainText("Atelier Floréal");

  // /budget/<id> mène à cet onglet.
  await page.goto(`/budget/${setup.eventId}`);
  await expect(page).toHaveURL(new RegExp(`/events/${setup.eventId}\\?onglet=budget$`));
});

test("DOC-01, BUD-04 — Une zone de dépôt typée ; le devis d'un prestataire se rattache à sa ligne ; « Déplacer vers… »", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding();
  await signIn(page, setup.email);
  await page.goto(`/events/${setup.eventId}?onglet=documents`);
  await page.getByRole("radio", { name: "Devis d'un prestataire" }).check();
  await page.getByLabel("Prestataire concerné").selectOption({ value: setup.saveursId });
  await expect(page.getByText("Rattaché à la ligne « Traiteur » du budget.")).toBeVisible();
  await page.getByLabel("Fichier (PDF ou image, 20 Mo au plus)").setInputFiles({ name: "devis-traiteur-v2.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
  await page.getByRole("button", { name: "Envoyer le document" }).click();
  await expect(page.getByRole("status").filter({ hasText: "rattaché à la ligne « Traiteur » du budget" })).toBeVisible({ timeout: 20_000 });
  const quotes = page.getByRole("region", { name: "Devis des prestataires", exact: true });
  await expect(quotes).toContainText("Traiteur · Les Saveurs");
  await expectNoAxeViolation(page);
  await expectNoHorizontalScroll(page);

  // « Déplacer vers… » : la pièce devient une facture, toujours sur sa ligne.
  await quotes.locator("summary", { hasText: "Déplacer vers…" }).click();
  await quotes.getByRole("button", { name: "Factures des prestataires" }).click();
  await expect(page.getByRole("region", { name: "Factures des prestataires", exact: true })).toContainText("Traiteur · Les Saveurs");
  expect((await listBudgetLines(setup.organizationId, setup.eventId)).lines.flatMap((line) => line.attachments.map((attachment) => attachment.kind))).toEqual(["invoice"]);
  // L'aide mène à l'article des documents.
  await expect(page.getByRole("link", { name: "Aide : ranger les documents d'un évènement" })).toHaveAttribute("href", "/aide/ecrans/eventDocuments");
});

test("UX-09, UX-13 — Les réglages d'un écran s'ouvrent dans le panneau ; le fermer laisse l'écran tel quel (ADR 0107)", async ({ page }) => {
  test.setTimeout(90_000);
  const setup = await planner();
  await signIn(page, setup.email);
  await page.goto("/events?tab=termines");
  // Lot 72f (G14) : les réglages de la liste des évènements sont au menu « ⋯ », section « Réglages ».
  await page.getByRole("button", { name: /^Autres actions/ }).click();
  await page.getByRole("menuitem", { name: "Paramètres des évènements" }).click();
  const panel = page.getByRole("complementary", { name: "Réglages" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expectNoAxeViolation(page);
  await panel.getByRole("button", { name: isPhone(page) ? /Retour aux évènements/ : "Fermer le panneau" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/events\?tab=termines$/);
  // Ouverte directement, l'adresse mène à la page complète des réglages.
  await page.goto("/reglages/evenements");
  await expect(page).toHaveURL(/\/events\/parametres$/);
});
