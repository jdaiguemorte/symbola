// Lot 51 (JRJ-05 à JRJ-09, ARC-09, EVT-04, CHR-08, PAR-08 ; SC-08 étapes 4 à 7 ; ADR 0091) — le jour
// J de terrain, en taille ordinateur et en 375 px. 16 h 20, la cérémonie a vingt minutes de retard et
// il n'y a pas de réseau : Camille pointe, accepte le décalage (la navette reste fixe), dicte un
// incident avec photo, coche une case et la photographie en deux touchers. Le réseau revient avec une
// session expirée : rien n'est perdu ; puis une réponse se perd : rien n'est doublé. Les prestataires
// concernés sont prévenus une fois, Hugo voit le pointage au rafraîchissement suivant. Remise pointée,
// bilan du lendemain, import d'un chrono ; tests d'abus (autre organisation, lien, autre origine).
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import {
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  changeEventStatus,
  createDayChecklist,
  createEventLink,
  createProspect,
  createProspectSource,
  getDayState,
  getEventProgram,
  listDayChecklistTemplates,
  updateVendorCandidate,
} from "../modules/events/service";
import { addVendorPayment, listBudgetLines, setVendorPaymentHandover, updateBudgetLine } from "../modules/budget/service";
import { parisMidnight } from "../lib/offline/day-copy";
import { readyOrganization, signIn as signInByLink } from "./helpers";

const PASSWORD = "mot-de-passe-jrj05-e2e";
const MAILPIT_API = "http://localhost:8025/api/v1";
// Une image PNG d'un pixel : le téléphone la réduit (canvas), le serveur la reconnaît par son contenu.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function parisTime(date: string, hours: number, minutes: number): Date {
  return new Date(parisMidnight(date).getTime() + (hours * 60 + minutes) * 60_000);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Contraste renforcé (WCAG AAA, 7:1) sur l'écran principal du terrain.
async function expectEnhancedContrast(page: Page) {
  const result = await new AxeBuilder({ page }).withRules(["color-contrast-enhanced"]).include("#maintenant").include(".field-bar").analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function programMailsTo(to: string): Promise<number> {
  const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
  const { messages } = (await response.json()) as { messages: { Subject: string }[] };
  return messages.filter((message) => /^(Programme|Schedule)/.test(message.Subject)).length;
}

// Mariage aujourd'hui (ou au jour dit) : cérémonie (officiante), vin d'honneur et dîner (traiteur),
// navette (autocariste), chacun retenu avec son lien ; une liste d'installation ; un solde à remettre.
async function wedding(options: { eventDate?: string } = {}) {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    const email = `camille-${randomUUID()}@symbola.test`;
    const hugoEmail = `hugo-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    await createUser(db, { organizationId, email: hugoEmail, password: PASSWORD, role: "member" });
    const source = await createProspectSource(organizationId, "Salon");
    const eventDate = options.eventDate ?? parisToday();
    const event = await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Hugo" }], eventDate });
    await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: owner.id, toStatus: "confirmed" });
    const slot = async (label: string, vendorName: string) => {
      const created = await addEventVendorSlot(organizationId, event.id, label);
      const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: created.id, vendorName });
      await updateVendorCandidate({ organizationId, candidateId: candidate.id, status: "retained", changedByUserId: owner.id });
      const vendorEmail = `${label.toLowerCase()}-${randomUUID()}@example.test`;
      await createEventLink({ organizationId, eventId: event.id, createdByUserId: owner.id, audience: "vendor", vendorCandidateId: candidate.id, locale: "fr", link: { personName: vendorName, email: vendorEmail, rights: { rubrics: ["program"], budgetScope: "all", sharedSlotIds: [] } } });
      return { id: created.id, email: vendorEmail };
    };
    const officiant = await slot("Officiante", "Claire Officiante");
    const caterer = await slot("Traiteur", "Maison Ruche");
    const coach = await slot("Autocar", "Autocars du Val");
    await addProgramItem(organizationId, event.id, { startTime: "16:00", endTime: "16:45", label: "Cérémonie", location: "Jardin", vendorSlotIds: [officiant.id], freeParticipants: [] });
    await addProgramItem(organizationId, event.id, { startTime: "17:00", endTime: "19:00", label: "Vin d'honneur", vendorSlotIds: [caterer.id], freeParticipants: [] });
    await addProgramItem(organizationId, event.id, { startTime: "19:15", label: "Navette", vendorSlotIds: [coach.id], freeParticipants: [] });
    await addProgramItem(organizationId, event.id, { startTime: "20:00", endTime: "23:30", label: "Dîner", vendorSlotIds: [caterer.id], freeParticipants: [] });
    const templates = await listDayChecklistTemplates(organizationId, "fr");
    await createDayChecklist({ organizationId, eventId: event.id, keyMomentId: null, templateId: templates.find((template) => template.starterKey === "reception_setup")!.id });
    await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: caterer.id, field: "committed", amountCents: 900000, changedByUserId: owner.id });
    const line = (await listBudgetLines(organizationId, event.id)).lines.find((entry) => entry.eventVendorSlotId === caterer.id)!;
    await addVendorPayment({ organizationId, eventId: event.id, lineId: line.id, label: "Solde", fixedAmountCents: 300000, dueOn: eventDate, changedByUserId: owner.id });
    const paymentId = (await listBudgetLines(organizationId, event.id)).lines.flatMap((entry) => entry.payments).find((payment) => payment.label === "Solde")!.id;
    await setVendorPaymentHandover({ organizationId, eventId: event.id, paymentId, onDay: true, method: "Chèque", by: "Camille", changedByUserId: owner.id });
    const client = await createEventLink({ organizationId, eventId: event.id, createdByUserId: owner.id, audience: "client", locale: "fr", link: { personName: "Léa", email: `lea-${randomUUID()}@symbola.test`, rights: { rubrics: ["program", "budget"], budgetScope: "all", sharedSlotIds: [] } } });
    return { organizationId, email, hugoEmail, eventId: event.id, eventDate, officiant, caterer, coach, clientLinkUrl: client.url };
  } finally {
    await sql.end();
  }
}

test("SC-08 étapes 4 à 7 / JRJ-05 à JRJ-08 / ARC-09 — sans réseau : pointage, décalage validé, incident dicté avec photo, case photographiée ; au retour du réseau, aucune perte, aucun doublon", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const setup = await wedding();
  await signInByLink(page, setup.email, /\/$/);
  await page.clock.setFixedTime(parisTime(setup.eventDate, 16, 20));
  await page.goto(`/jour-j/${setup.eventId}`);
  const sync = page.locator("p.field-sync");
  await expect(sync).toHaveAttribute("role", "status");
  await expect(sync).toHaveText("À jour");
  const now = page.getByRole("region", { name: "Maintenant et ensuite" }).getByRole("article", { name: "Maintenant" });
  await expect(now.locator(".field-now")).toHaveText("Cérémonie");
  await expectNoAxeViolation(page);
  await expectEnhancedContrast(page);

  // Hugo, en renfort, a le jour J ouvert sur son téléphone.
  const hugoContext = await browser.newContext({ locale: "fr-FR", viewport: { width: 375, height: 812 } });
  const hugo = await hugoContext.newPage();
  await signInByLink(hugo, setup.hugoEmail, /\/$/);
  await hugo.clock.setFixedTime(parisTime(setup.eventDate, 16, 20));
  await hugo.goto(`/jour-j/${setup.eventId}`);
  await expect(hugo.locator("p.field-sync")).toHaveText("À jour");

  // 16 h 20, plus de réseau. Camille pointe le début : vingt minutes de retard.
  await page.context().setOffline(true);
  await now.getByRole("button", { name: "Commencé : Cérémonie" }).click();
  const shift = page.getByRole("dialog", { name: "Retard de 20 min" });
  await expect(shift).toBeVisible();
  await expectNoAxeViolation(page);
  // La navette est fixe : décochée, l'autocariste n'est plus prévenu.
  await shift.getByRole("checkbox", { name: "19:15 · Navette" }).uncheck();
  await expect(shift.getByRole("checkbox", { name: "Autocars du Val" })).toHaveCount(0);
  await expect(shift.getByRole("checkbox", { name: "Claire Officiante" })).toBeChecked();
  await expect(shift.getByRole("checkbox", { name: "Maison Ruche" })).toBeChecked();
  await shift.getByRole("button", { name: "Valider et prévenir 2 prestataires" }).click();
  await expect(page.getByText("Décalage validé : 2 prestataires seront prévenus dès que le réseau revient.")).toBeVisible();
  await expect(sync).toContainText("2 actions en attente");
  // Rien n'est parti : ni pointage au serveur, ni e-mail.
  expect((await getDayState(setup.organizationId, setup.eventId))!.checkpoints).toEqual([]);
  expect(await programMailsTo(setup.officiant.email)).toBe(0);

  // JRJ-07 : un incident dicté (le clavier du téléphone écrit dans le champ) avec photo, en moins de 10 s.
  const started = Date.now();
  await page.getByRole("navigation", { name: "Jour J" }).getByRole("button", { name: "Incident" }).click();
  const sheet = page.getByRole("dialog", { name: "Noter un incident" });
  await expect(sheet.getByLabel("Ce qui se passe")).toBeFocused();
  await page.keyboard.type("Le traiteur arrive par l'entrée de service, portail bloqué");
  await sheet.getByLabel("Joindre une photo à l'incident").setInputFiles({ name: "portail.png", mimeType: "image/png", buffer: PNG });
  await sheet.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Incident noté à 16:20.")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(10_000);
  await expect(page.getByRole("region", { name: "Main courante" })).toContainText("portail bloqué");
  await expect(sync).toContainText("4 actions en attente");

  // JRJ-06 : une case cochée d'un toucher ; sa photo en deux touchers (« Photo », le déclencheur).
  const lists = page.getByRole("region", { name: "Listes de contrôle" });
  await lists.getByRole("checkbox", { name: "Tables dressées selon le plan" }).click();
  await expect(lists.getByRole("checkbox", { name: "Tables dressées selon le plan" })).toHaveAttribute("aria-checked", "true");
  let gestures = 0;
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), lists.locator("label.field-photo").filter({ has: page.getByLabel("Photo de : Tables dressées selon le plan") }).click().then(() => (gestures += 1))]);
  await chooser.setFiles({ name: "tables.png", mimeType: "image/png", buffer: PNG });
  gestures += 1;
  expect(gestures).toBe(2);
  await expect(sync).toContainText("6 actions en attente");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Le réseau revient, mais la session a expiré : la file est gardée, l'écran invite à se reconnecter.
  const expired = async (route: import("@playwright/test").Route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "session" }) });
  await page.route(`**/jour-j/${setup.eventId}/actions`, expired);
  await page.route(`**/jour-j/${setup.eventId}/photos`, expired);
  await page.context().setOffline(false);
  await expect(sync).toContainText("Votre session a expiré : 6 actions attendent sur ce téléphone.");
  expect((await getDayState(setup.organizationId, setup.eventId))!.checkpoints).toEqual([]);
  await page.unroute(`**/jour-j/${setup.eventId}/actions`);
  await page.unroute(`**/jour-j/${setup.eventId}/photos`);

  // Reconnectée, la file part ; une réponse se perd en route : le lot est reçu, mais le téléphone
  // le croit perdu et le rejoue. Le serveur l'ignore : rien n'est doublé.
  let lost = false;
  await page.route(`**/jour-j/${setup.eventId}/actions`, async (route) => {
    if (lost) return route.continue();
    lost = true;
    await route.fetch();
    await route.abort("failed");
  });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => lost).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(sync).toHaveText("À jour", { timeout: 20_000 });

  const state = (await getDayState(setup.organizationId, setup.eventId))!;
  expect(state.checkpoints).toHaveLength(1);
  expect(state.shifts).toHaveLength(1);
  expect(state.shifts[0]).toMatchObject({ minutes: 20, outcome: "applied", notifiedCount: 2 });
  expect(state.incidents).toHaveLength(1);
  expect(state.incidents[0]!.photos.map((photo) => photo.state)).toEqual(["stored"]);
  const box = state.checklists[0]!.items.find((item) => item.label === "Tables dressées selon le plan")!;
  expect(box.checkedAt).not.toBeNull();
  expect(box.photos.map((photo) => photo.state)).toEqual(["stored"]);
  const times = Object.fromEntries((await getEventProgram(setup.organizationId, setup.eventId)).items.map((item) => [item.label, item.startTime]));
  expect(times).toEqual({ Cérémonie: "16:20", "Vin d'honneur": "17:20", Navette: "19:15", Dîner: "20:20" });
  // JRJ-05 : seuls les prestataires concernés, une seule fois.
  await expect.poll(() => programMailsTo(setup.officiant.email)).toBe(1);
  await expect.poll(() => programMailsTo(setup.caterer.email)).toBe(1);
  expect(await programMailsTo(setup.coach.email)).toBe(0);

  // JRJ-08 : Hugo voit le pointage de Camille au rafraîchissement suivant (15 s).
  await expect(hugo.getByRole("region", { name: "Programme du jour" })).toContainText(`Commencé à 16:20 (${setup.email})`, { timeout: 25_000 });
  await expect(hugo.getByRole("region", { name: "Main courante" })).toContainText("portail bloqué");
  await expectNoAxeViolation(hugo);
  await hugoContext.close();
});

test("JRJ-09 / PAR-08 — la remise se pointe ; le lendemain, le bilan est prêt sur la fiche, interne à l'équipe", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const setup = await wedding({ eventDate: addDays(parisToday(), -1) });
  await signInByLink(page, setup.email, /\/$/);
  await page.goto(`/jour-j/${setup.eventId}`);
  const handovers = page.getByRole("region", { name: "Remises du jour" });
  await expect(handovers).toContainText("Maison Ruche · 3 000,00 €");
  await expect(handovers).toContainText("Solde · Chèque · remis par Camille");
  await handovers.getByRole("button", { name: "Remis : Maison Ruche" }).click();
  await expect(page.locator("p.field-sync")).toHaveText("À jour");
  await expect(handovers).toContainText(/Remis à \d\d:\d\d \(vous\)/);
  await expectNoAxeViolation(page);

  // Le bilan du lendemain sur la fiche, et son PDF.
  await page.goto(`/events/${setup.eventId}`);
  const report = page.getByRole("region", { name: "Bilan du jour J" });
  await expect(report).toContainText("Interne à votre équipe");
  await expect(report).toContainText("Cérémonie : prévu 16:00 – 16:45, réel non pointé");
  await expect(report).toContainText(/Maison Ruche — 3\s000,00\s€ \(Chèque\) remis à/);
  await expect(report).toContainText("Tables dressées selon le plan");
  const pdf = await page.request.get(`/events/${setup.eventId}/bilan`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await expectNoAxeViolation(page);

  // Le client, par son lien, voit l'échéance remise, mais ni le bilan ni l'état du jour J.
  const clientContext = await browser.newContext({ locale: "fr-FR" });
  const client = await clientContext.newPage();
  await client.goto(setup.clientLinkUrl);
  await expect(client).toHaveURL(/\/portail$/);
  expect((await client.request.get(`/events/${setup.eventId}/bilan`)).status()).toBe(401);
  expect((await client.request.get(`/jour-j/${setup.eventId}/etat`)).status()).toBe(401);
  await clientContext.close();
});

test("SEC-36 — abus : une autre organisation, un lien ou une autre origine ne pointent ni ne lisent rien", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const mine = await wedding();
  const other = await wedding();
  await signInByLink(page, other.email, /\/$/);
  const action = { actionId: randomUUID(), deviceAt: new Date().toISOString(), kind: "incident", body: "intrusion", severity: null, keyMomentId: null };
  const headers = { Origin: "http://localhost:3000" };
  // Une autre organisation : même réponse qu'un évènement inexistant.
  const missing = await page.request.post(`/jour-j/${randomUUID()}/actions`, { data: { actions: [action] }, headers });
  const foreign = await page.request.post(`/jour-j/${mine.eventId}/actions`, { data: { actions: [action] }, headers });
  expect(foreign.status()).toBe(404);
  expect(await foreign.text()).toBe(await missing.text());
  expect((await page.request.get(`/jour-j/${mine.eventId}/etat`)).status()).toBe(404);
  expect((await page.request.get(`/jour-j/${mine.eventId}/photos/${randomUUID()}`)).status()).toBe(404);
  // Une autre origine (formulaire d'un site tiers) : refusée, même pour son propre évènement.
  expect((await page.request.post(`/jour-j/${other.eventId}/actions`, { data: { actions: [action] }, headers: { Origin: "https://pirate.example" } })).status()).toBe(403);
  // Une action mal formée : refusée.
  expect((await page.request.post(`/jour-j/${other.eventId}/actions`, { data: { actions: [{ ...action, kind: "delete" }] }, headers })).status()).toBe(400);
  expect((await getDayState(mine.organizationId, mine.eventId))!.incidents).toEqual([]);

  // Un prestataire par son lien n'écrit pas dans le jour J.
  const vendorContext = await browser.newContext({ locale: "fr-FR" });
  const vendor = await vendorContext.newPage();
  expect((await vendor.request.post(`/jour-j/${mine.eventId}/actions`, { data: { actions: [action] }, headers })).status()).toBe(401);
  await vendorContext.close();
});

test("CHR-08 — un chrono s'importe d'un tableur : écran de contrôle, puis séquences et temps forts créés", async ({ page }) => {
  test.setTimeout(120_000);
  const setup = await wedding({ eventDate: addDays(parisToday(), 30) });
  await signInByLink(page, setup.email, /\/$/);
  await page.goto(`/events/${setup.eventId}?onglet=programme`);
  const importer = page.locator("details.program-import");
  await page.getByText("Importer un chrono (tableur ou PDF)").click();
  const csv = ["Temps fort;Date;Début;Fin;Séquence;Note", `Brunch;${addDays(setup.eventDate, 1)};11h;14h;Brunch des mariés;=1+1`, ";;midi;;Déjeuner;"].join("\n");
  await importer.getByLabel("Fichier CSV ou XLSX").setInputFiles({ name: "chrono.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await importer.getByRole("button", { name: "Voir avant d'importer" }).click();
  await expect(importer).toContainText("1 séquence lue");
  await expect(importer).toContainText("Ligne 3 : heure de début illisible");
  await expect(importer).toContainText("Temps forts créés : Brunch");
  await expect(importer).toContainText("1 cellule commençant par =, +, - ou @ a été gardée en texte.");
  expect((await getEventProgram(setup.organizationId, setup.eventId)).items).toHaveLength(4);
  await expectNoAxeViolation(page);
  await importer.getByRole("button", { name: "Importer 1 séquence" }).click();
  await expect(importer).toContainText("1 séquence importée, 1 temps fort créé.");
  const brunch = (await getEventProgram(setup.organizationId, setup.eventId)).items.find((item) => item.label === "Brunch des mariés")!;
  expect(brunch).toMatchObject({ startTime: "11:00", endTime: "14:00", internalNote: "'=1+1" });
  await expect(page.getByRole("region", { name: /^Brunch — / })).toContainText("Brunch des mariés");
});
