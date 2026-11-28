// Lot 71f (EVT-02, EVT-07, HUB-08, UX-01, UX-06, BUD-01 ; spécification du lot 71, § 5.6 ; maquette 09 du
// lot 68) — la fiche d'un mariage repris et ses reflets, à 1 440 et à 375 px (projets « desktop » et
// « mobile-375 »), axe-core sur chaque écran. Chaque parcours regarde un mariage repris (« Léa & Hugo »)
// et un mariage créé dans Symbola (« Léa & Maxime ») pour montrer la différence. Un `test` par critère du
// paquet, plus l'abus : le portail des mariés ne montre ni « À compléter » ni la provenance.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import AxeBuilder from "./axe";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventVendorCandidates } from "@symbola/db/schema/events";
import { importItems, imports } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { setUnallocatedTotals, updateBudgetLine } from "../modules/budget/service";
import { addEventVendorSlot, addProgramItem, addVendorCandidate, createProspect, setEventIdentity, updateVendorCandidate } from "../modules/events/service";
import { markTakeoverStepImported, settleTakeoverStep } from "../modules/hub/service";
import { enterTakeoverEvent, type TakeoverActor } from "../lib/takeover/flow";
import { readyOrganization, signIn } from "./helpers";
import { reportMeasure } from "./mesure";

const expect = baseExpect.configure({ timeout: 20_000 });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;

// À 375 px : aucun défilement de côté.
async function expectNoSideScroll(page: Page) {
  if (!isPhone(page)) return;
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

type Agency = TakeoverActor & { lea: { takeoverId: string; eventId: string; venueSlotId: string }; maxime: string };

// Une agence prête, sa titulaire connectée ; « Léa & Hugo » repris le lendemain d'hier (saisi sur la page,
// prestataires retenus et programme repris, ni budget par poste ni tâches) ; « Léa & Maxime » créé ici.
async function agency(page: Page): Promise<Agency> {
  const email = `planner-71f-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org 71f ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const actor: TakeoverActor = { organizationId: organization.id, userId: user.id, viewer: { userId: user.id, role: "owner", allPlannersSeeAll: true } };
    const { takeoverId, eventId } = await enterTakeoverEvent(actor, { takeoverId: null, name: "", eventDate: "2027-06-12", clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }] });
    const retain = async (label: string, vendorName: string, contract: "signed" | "unsigned" | "unknown") => {
      const slot = await addEventVendorSlot(organization.id, eventId, label);
      const candidate = await addVendorCandidate({ organizationId: organization.id, eventId, vendorSlotId: slot.id, vendorName });
      await updateVendorCandidate({ organizationId: organization.id, candidateId: candidate.id, status: contract === "signed" ? "contract_signed" : "retained", changedByUserId: user.id });
      await withOrganization(db, organization.id, (tx) => tx.update(eventVendorCandidates).set({ takeoverContract: contract }).where(eq(eventVendorCandidates.id, candidate.id)));
      return slot.id;
    };
    const venueSlotId = await retain("Domaine", "Domaine des Tilleuls", "signed");
    await retain("Baby-sitting", "Les P'tits Loups", "unsigned");
    await retain("Voiture des mariés", "Belles Carrosseries", "unknown");
    await setUnallocatedTotals(organization.id, { eventId, committedCents: 2_165_050, paidCents: 320_000 });
    await addProgramItem(organization.id, eventId, { startTime: "15:30", label: "Cérémonie laïque", vendorSlotIds: [], freeParticipants: [] });
    const base = { organizationId: organization.id, userId: user.id, takeoverId, viewer: actor.viewer };
    await settleTakeoverStep(db, { ...base, kind: "vendor_book", state: "no_file" });
    await settleTakeoverStep(db, { ...base, kind: "budget", state: "no_file" });
    await markTakeoverStepImported(db, { ...base, kind: "event_vendors", eventId });
    await settleTakeoverStep(db, { ...base, kind: "tasks", state: "no_file" });
    await markTakeoverStepImported(db, { ...base, kind: "program", eventId });
    const { id: maxime } = await createProspect({ organizationId: organization.id, createdByUserId: user.id, clients: [{ firstName: "Léa", lastName: "Dubois" }, { firstName: "Maxime", lastName: "Petit" }], prospectSourceId: null, eventDate: "2027-01-30" });
    await signIn(page, email);
    return { ...actor, lea: { takeoverId, eventId, venueSlotId }, maxime };
  } finally {
    await sql.end();
  }
}

const checklist = (page: Page) => page.getByRole("region", { name: "À compléter après la reprise" });
const point = (page: Page, key: string) => page.locator(`[data-point="${key}"]`);

test.describe("EVT-02 — La fiche d'un mariage repris (lot 71f)", () => {
  test.describe.configure({ timeout: 150_000 });

  test("critères 1 et 7 — repris : « Repris le … », « À compléter », ni « tout est à jour » ni « Bon » ni « Champs importés » ; créé : rien ne change", async ({ page }) => {
    const setup = await agency(page);
    await page.goto(`/events/${setup.lea.eventId}`);
    const main = page.getByRole("main");
    await expect(main.locator(".takeover-origin")).toContainText(/Repris le .+ de 2 fichiers/);
    await expect(main.locator(".takeover-origin").getByRole("link", { name: "Voir la reprise" })).toHaveAttribute("href", `/reprise/${setup.lea.takeoverId}`);
    await expect(checklist(page)).toBeVisible();
    await expect(checklist(page)).toContainText("6 points · 0 fait");
    await expect(point(page, "amounts")).toContainText("Montants de 3 prestataires");
    await expect(point(page, "amounts")).toContainText(/21\s650,50\s€ à répartir sur les postes/);
    await expect(point(page, "contracts")).toContainText("2 contrats non signés");
    await expect(point(page, "contracts")).toContainText("Aucune relance n'est créée");
    await expect(point(page, "endTimes")).toContainText("1 heure de fin dans le programme");
    await expect(point(page, "tasks").getByRole("link", { name: /Reprendre une liste/ })).toHaveAttribute("href", `/reprise?evenement=${setup.lea.eventId}&ligne=tasks`);
    await expect(main).not.toContainText("tout est à jour");
    await expect(main).not.toContainText("Champs importés");
    await expect(main).not.toContainText(/0,00\s€ de réel/);
    await expect(page.getByRole("heading", { name: "Prochaine action" })).toHaveCount(0);
    const health = page.getByRole("region", { name: "Santé de l'évènement" });
    await expect(health).toContainText("Pas encore de tâches : pas d'avis");
    await expect(health.locator("[data-health='good']")).toHaveCount(0);
    await expect(health).toContainText(/21\s650,50\s€ de réel/);
    await expect(health).toContainText("Selon votre fichier");
    await expect(health).toContainText("3 retenus · 1 contrat signé");
    const identity = page.getByRole("region", { name: "Fiche d'identité" });
    await expect(identity).toContainText("Signé le");
    await expect(identity).toContainText("non renseigné");
    await expect(identity).toContainText("non renseignée");
    await expectNoSideScroll(page);
    await expectNoAxeViolation(page);

    // Critère 7 : le mariage créé dans Symbola n'a ni marque, ni bloc, ni interrupteur.
    await page.goto(`/events/${setup.maxime}`);
    await expect(page.getByRole("heading", { name: "Prochaine action" })).toBeVisible();
    await expect(page.locator(".takeover-origin")).toHaveCount(0);
    await expect(checklist(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "D'où viennent ces valeurs ?" })).toHaveCount(0);
    await expectNoAxeViolation(page);
  });

  test("critère 2 — un point fait passe en bas, coché, sans recharger la page", async ({ page }) => {
    const setup = await agency(page);
    await page.goto(`/events/${setup.lea.eventId}`);
    await point(page, "guests").getByRole("link", { name: /Saisir/ }).click();
    const panel = page.getByRole("dialog").or(page.locator(".side-panel")).first();
    await panel.getByLabel("Invités estimés").fill("120");
    await panel.getByRole("button", { name: "Enregistrer la fiche" }).click();
    await expect(panel.getByText("Fiche enregistrée.")).toBeVisible();
    // La fiche se relit sans rechargement : le point passe en bas, coché.
    await expect(checklist(page)).toContainText("6 points · 1 fait");
    await expect(page.locator(".takeover-point").last()).toHaveAttribute("data-point", "guests");
    await expect(point(page, "guests")).toContainText("Fait");
    await expectNoAxeViolation(page);
  });

  test("critère 3 — « D'où viennent ces valeurs ? » : le fichier de chaque valeur reprise, rien sur une valeur modifiée", async ({ page }) => {
    const setup = await agency(page);
    const { sql, db } = createAppConnection();
    try {
      await setEventIdentity(setup.organizationId, setup.lea.eventId, { guestsEstimated: null, guestsConfirmed: null, style: null, notes: "Cérémonie laïque" });
      await withOrganization(db, setup.organizationId, async (tx) => {
        const [row] = await tx
          .insert(imports)
          .values({ organizationId: setup.organizationId, createdByUserId: setup.userId, entityType: "event_sheets", status: "applied", fileName: "fiche-lea-hugo.pdf", fileFormat: "pdf", fileSizeBytes: 10, headerRowIndex: 0, headers: [], rowCount: 1, expiresAt: new Date(Date.now() + 86_400_000), appliedAt: new Date(), takeoverId: setup.lea.takeoverId })
          .returning({ id: imports.id });
        await tx.insert(importItems).values({ organizationId: setup.organizationId, importId: row!.id, position: 0, module: "events", kind: "event", elementId: setup.lea.eventId, action: "updated", previous: {}, written: { notes: "Cérémonie laïque" }, fields: ["notes"] });
      });
    } finally {
      await sql.end();
    }
    await page.goto(`/events/${setup.lea.eventId}`);
    const identity = page.getByRole("region", { name: "Fiche d'identité" });
    await expect(identity.locator(".provenance-mark")).toHaveCount(0);
    await identity.getByRole("link", { name: "D'où viennent ces valeurs ?" }).click();
    await expect(identity.locator(".provenance-mark")).toHaveText(["vous, à la reprise", "Fichier : fiche-lea-hugo.pdf"]);
    await expectNoSideScroll(page);
    await expectNoAxeViolation(page);
    await setEventIdentity(setup.organizationId, setup.lea.eventId, { guestsEstimated: null, guestsConfirmed: null, style: null, notes: "Cérémonie laïque, puis vin d'honneur" });
    await page.reload();
    await expect(identity.locator(".provenance-mark")).toHaveText(["vous, à la reprise"]);
  });

  test("critère 4 — le budget : le total du fichier « à répartir », les contrats en mots ; à zéro, le bandeau disparaît", async ({ page }) => {
    const setup = await agency(page);
    await page.goto(`/events/${setup.lea.eventId}?onglet=budget`);
    const banner = page.locator(".takeover-unallocated");
    await expect(banner).toContainText(/À compléter : 21\s650,50\s€ de réel selon votre fichier, dont 3\s200,00\s€ réglés\./);
    await expect(page.getByRole("main")).toContainText("Aucun poste complet sur 3");
    await expect(page.getByRole("row", { name: /^Domaine/ })).toContainText("contrat signé");
    await expect(page.getByRole("row", { name: /^Baby-sitting/ })).toContainText("contrat non signé");
    await expect(page.getByRole("row", { name: /^Voiture des mariés/ })).toContainText("contrat non renseigné");
    await expect(page.getByRole("row", { name: /^Baby-sitting/ })).toContainText("non renseigné");
    await expectNoSideScroll(page);
    await expectNoAxeViolation(page);
    await updateBudgetLine({ organizationId: setup.organizationId, eventId: setup.lea.eventId, eventVendorSlotId: setup.lea.venueSlotId, field: "committed", amountCents: 2_165_050, changedByUserId: setup.userId });
    await page.reload();
    await expect(banner).toHaveCount(0);
  });

  test("critère 5 — la liste : la marque mène à la reprise, le filtre « Origine » sépare repris et créés", async ({ page }) => {
    const setup = await agency(page);
    await page.goto("/events");
    const lea = page.getByRole("row", { name: /Léa & Hugo/ });
    await expect(lea.getByRole("link", { name: /Repris · 6 points à compléter/ })).toHaveAttribute("href", `/reprise/${setup.lea.takeoverId}`);
    await expect(page.getByRole("row", { name: /Léa & Maxime/ }).locator(".takeover-mark")).toHaveCount(0);
    // Le filtre s'applique dès le choix.
    await page.getByLabel("Origine").selectOption("repris");
    await expect(page).toHaveURL(/origine=repris/);
    await expect(page.getByRole("row", { name: /Léa & Hugo/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Léa & Maxime/ })).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectNoAxeViolation(page);
    await page.goto("/events?origine=crees");
    await expect(page.getByRole("row", { name: /Léa & Maxime/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Léa & Hugo/ })).toHaveCount(0);
  });

  test("critère 6 — « Aujourd'hui » : aucune ligne née de la reprise, la section « Reprises en cours »", async ({ page }) => {
    const setup = await agency(page);
    await page.goto("/");
    const section = page.getByRole("region", { name: "Reprises en cours" });
    await expect(section).toContainText("Léa & Hugo");
    await expect(section).toContainText("6 points à compléter");
    await expect(section.getByRole("link", { name: "Léa & Hugo", exact: true })).toHaveAttribute("href", `/events/${setup.lea.eventId}`);
    await expect(section.getByRole("link", { name: "Voir ce qui reste pour Léa & Hugo" })).toHaveAttribute("href", `/events/${setup.lea.eventId}#a-completer`);
    await expect(page.getByRole("main")).not.toContainText("à faire signer");
    await expectNoSideScroll(page);
    await expectNoAxeViolation(page);
  });

  // NFR-02 (ADR 0115) : la liste d'une agence de 200 évènements, dont cinq repris, avec la marque et le
  // filtre « Origine » : la médiane des 95e centiles de trois séries reste sous 300 ms.
  test("NFR-02 — la liste de 200 évènements, marque et filtre « Origine », sous 300 ms", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "une mesure du serveur, une seule fois");
    test.setTimeout(300_000);
    const setup = await agency(page);
    for (let index = 0; index < 196; index += 1) {
      await createProspect({ organizationId: setup.organizationId, createdByUserId: setup.userId, clients: [{ firstName: `Client ${index}`, lastName: "Fictif" }], prospectSourceId: null, eventDate: `2027-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}` });
    }
    for (let index = 0; index < 3; index += 1) {
      await enterTakeoverEvent(setup, { takeoverId: null, name: "", eventDate: "2027-05-15", clients: [{ firstName: `Repris ${index}`, lastName: "Fictif" }] });
    }
    const urls = ["/events", "/events?origine=repris", "/events?origine=crees"];
    // Les 200 créations viennent de lancer leurs traitements de fond (événements internes) : on attend
    // qu'ils soient passés, comme le premier passage du parcours NFR-02, qui ne compte pas.
    for (let warm = 0; warm < 40; warm += 1) {
      const start = performance.now();
      await (await page.request.get(urls[warm % urls.length]!)).body();
      if (warm >= 6 && performance.now() - start < 200) break;
      await page.waitForTimeout(500);
    }
    const series: number[] = [];
    for (let round = 0; round < 3; round += 1) {
      const times: number[] = [];
      for (let repeat = 0; repeat < 8; repeat += 1) {
        for (const url of urls) {
          const start = performance.now();
          const response = await page.request.get(url);
          await response.body();
          times.push(performance.now() - start);
          expect(response.status(), url).toBe(200);
        }
      }
      times.sort((a, b) => a - b);
      series.push(Math.round(times[Math.ceil(times.length * 0.95) - 1]!));
    }
    const median = [...series].sort((a, b) => a - b)[1]!;
    reportMeasure(testInfo, { mesure: "Lot 71f — NFR-02, liste de 200 évènements, marque et filtre « Origine » (médiane des 95e centiles de 3 séries)", valeur: median, seuil: 300, detail: `séries : ${series.join(", ")} ms` });
    expect(median, `95e centiles : ${series.join(", ")} ms`).toBeLessThan(300);
  });
});
