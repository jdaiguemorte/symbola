// Lot 34a (EVT-01, EVT-05, CHR-01, FAC-13 ; D3, D4, D6, D8) — cycle de vie sur la fiche évènement :
// l'option naît avec le rétroplanning de son modèle ; confirmée puis reportée, la fiche liste la
// tâche qui tomberait dans le passé avant la confirmation du report, puis les échéances suivent la
// nouvelle date. Annuler demande un motif et nomme l'évènement ; la facture déjà émise reçoit la
// proposition d'un avoir ; réactivé, l'évènement repasse en Option. En taille ordinateur et en
// 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { formatCalendarDate, parisToday } from "@symbola/i18n";
import { expect, test, type Page } from "@playwright/test";
import { addLossReasons, createEventType, createProspect, createProspectSource, createTaskTemplate, listEventTasks } from "../modules/events/service";
import { saveOnboardingStep } from "../modules/hub/service";
import { actOnFakeSignature, addQuoteLine, addScheduleItem, createQuote, issueDepositInvoice, sendQuote, sendQuoteForSignature } from "../modules/quotes/service";
import { changeEventStatus, readyOrganization, signIn } from "./helpers";
import { minimalPdf } from "../lib/test-fixtures/pdf";

const PASSWORD = "mot-de-passe-cycle-e2e";
// Lot 41 (FAC-10) : un PDF lisible, que l'émission complète en Factur-X.
const PDF = minimalPdf("evt-05");

const WEDDING = [
  { label: "Réserver le lieu", offsetDays: -365, responsible: "planner" as const },
  { label: "Dégustation chez le traiteur", offsetDays: -90, responsible: "planner" as const },
  { label: "Plan de table", offsetDays: -14, responsible: "clients" as const },
];

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Atelier de Camille : un modèle de rétroplanning, un motif d'annulation, le mariage de Léa et Hugo
// (créé en Option, son rétroplanning avec lui). Avec `invoice`, son devis signé (la signature le
// confirme) et la facture d'acompte émise.
async function atelier(eventDate: string, options: { invoice?: boolean } = {}) {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await readyOrganization(db, `Atelier ${randomUUID()}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
    const email = `camille-${randomUUID()}@symbola.test`;
    const owner = await createUser(db, { organizationId, email, password: PASSWORD, role: "owner" });
    // Lot 63a : le modèle est celui du type de l'évènement ; lot 63c (ADR 0106) : il s'applique parce
    // qu'il est choisi à la création, jamais d'office.
    const wedding = await createEventType(organizationId, { label: "Mariage", audience: "couple" });
    const template = await createTaskTemplate(organizationId, "Mariage — 12 mois", WEDDING, wedding.id);
    await addLossReasons(organizationId, [{ label: "Séparation", isFreeText: false }]);
    const source = await createProspectSource(organizationId, "Salon");
    const clients = [
      { firstName: "Léa", lastName: "Martin" },
      { firstName: "Hugo", lastName: "Durand" },
    ];
    const eventId = (await createProspect({ organizationId, createdByUserId: owner.id, prospectSourceId: source.id, clients, eventDate, eventTypeId: wedding.id, taskTemplateId: template.id })).id;
    if (!options.invoice) return { email, organizationId, eventId, quoteId: null, invoiceNumber: null };

    const quote = await createQuote({ organizationId, eventId, createdByUserId: owner.id });
    await addQuoteLine(organizationId, quote.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 420000 });
    await addScheduleItem(organizationId, quote.id, { label: "À la signature", percentageBasisPoints: 3000, dueDate: addDays(parisToday(), 10) });
    await sendQuote({ organizationId, quoteId: quote.id });
    const signing = await sendQuoteForSignature({
      organizationId,
      quoteId: quote.id,
      signers: [{ name: "Léa Martin", email: `lea-${randomUUID()}@symbola.test`, billingAddress: "4 rue des Lilas, 60300 Senlis" }],
      documentPdf: PDF,
      locale: "fr",
    });
    for (const signer of signing.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
    const invoice = await issueDepositInvoice({ organizationId, scheduleItemId: signing.current.schedule.items[0]!.id, renderOriginal: async () => PDF });
    return { email, organizationId, eventId, quoteId: quote.id, invoiceNumber: invoice.number };
  } finally {
    await sql.end();
  }
}

test("EVT-01 / EVT-05 / CHR-01 — l'option naît avec son rétroplanning ; reportée, la fiche liste la tâche qui tomberait dans le passé, puis les échéances suivent", async ({ page }) => {
  const today = parisToday();
  const eventDate = addDays(today, 200);
  const newDate = addDays(today, 260);
  const { email, organizationId, eventId } = await atelier(eventDate);
  await signIn(page, email, /\/$/);

  // EVT-01 (D8) : l'option a déjà son rétroplanning.
  await page.goto(`/events/${eventId}?onglet=retroplanning`);
  const steps = page.getByRole("list", { name: "Statut de l'événement" });
  await expect(steps.getByRole("listitem").filter({ hasText: "Option" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByText("Dégustation chez le traiteur").first()).toBeVisible();
  // Attend l'hydratation : un envoi avant elle partirait sans retour d'erreur.
  await page.waitForLoadState("networkidle");
  await changeEventStatus(page, "Confirmé");

  // D4 : la nouvelle date ; le report attend sa confirmation.
  await page.getByRole("button", { name: "Reporter l'évènement…" }).click();
  const postpone = page.getByRole("form", { name: "Reporter l'évènement…" });
  await postpone.getByLabel("Nouvelle date").fill(newDate);
  await postpone.getByRole("button", { name: "Reporter", exact: true }).click();

  const card = page.getByRole("region", { name: "Confirmer le report" });
  await expect(card).toContainText("Cette tâche tomberait dans le passé :");
  await expect(card).toContainText(`Réserver le lieu — ${formatCalendarDate(addDays(newDate, -365), "fr")}`);
  await expect(page.locator(".badge", { hasText: `Reporté — prévu le ${formatCalendarDate(eventDate, "fr")}` })).toBeVisible();
  await expectNoAxeViolation(page);

  // Confirmé : les échéances relatives suivent, l'évènement retrouve son statut.
  await card.getByRole("button", { name: "Confirmer le report" }).click();
  await expect(steps.getByRole("listitem").filter({ hasText: "Confirmé" })).toHaveAttribute("aria-current", "step");
  await expect(card).toHaveCount(0);
  await expect
    .poll(async () => (await listEventTasks(organizationId, eventId)).map((task) => `${task.label} ${task.dueDate}`).sort())
    .toEqual([`Dégustation chez le traiteur ${addDays(newDate, -90)}`, `Plan de table ${addDays(newDate, -14)}`, `Réserver le lieu ${addDays(newDate, -365)}`]);
  await expectNoAxeViolation(page);
});

test("EVT-05 / FAC-13 — annuler nomme l'évènement et exige un motif ; un avoir est proposé pour la facture émise ; réactivé, il repasse en Option", async ({ page }) => {
  const { email, eventId, quoteId, invoiceNumber } = await atelier(addDays(parisToday(), 200), { invoice: true });
  await signIn(page, email, /\/$/);

  // La signature a confirmé l'option.
  await page.goto(`/events/${eventId}`);
  const steps = page.getByRole("list", { name: "Statut de l'événement" });
  await expect(steps.getByRole("listitem").filter({ hasText: "Confirmé" })).toHaveAttribute("aria-current", "step");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Annuler l'évènement…" }).click();
  const form = page.getByRole("form", { name: "Annuler l'évènement Léa & Hugo ?" });
  await expect(form).toContainText("un avoir vous est proposé pour chacune");
  await expect(form.getByLabel("Motif de perte ou d'annulation")).toHaveAttribute("required", "");
  await form.getByLabel("Motif de perte ou d'annulation").selectOption({ label: "Séparation" });
  await expectNoAxeViolation(page);
  await form.getByRole("button", { name: "Annuler l'évènement", exact: true }).click();

  // FAC-13 : la facture émise reste ; un avoir est proposé, la planner décide.
  const invoices = page.getByRole("region", { name: "Factures déjà émises" });
  await expect(invoices).toContainText(invoiceNumber!);
  await expect(invoices.getByRole("link", { name: "Émettre un avoir" })).toHaveAttribute("href", `/devis/${quoteId}`);
  // La frise dit l'annulation et sa date.
  await expect(page.locator("p.badge", { hasText: /^Annulé · / })).toBeVisible();
  await expectNoAxeViolation(page);

  await page.getByRole("button", { name: "Réactiver (repasse en Option)" }).click();
  await expect(steps.getByRole("listitem").filter({ hasText: "Option" })).toHaveAttribute("aria-current", "step");
  await expect(invoices).toHaveCount(0);
});
