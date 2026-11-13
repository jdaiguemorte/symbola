// Lot 32a (HUB-08, UX-01, UX-06 ; décisions D2 à D4) — la liste des urgences assemblée depuis les
// modules, contre un vrai PostgreSQL : tâches (les vôtres et celles du client), décisions du client,
// prestataire sans contrat, échéance du client ; triée ; un module non souscrit n'apporte rien
// (ARC-06) ; une autre organisation ne voit rien.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import {
  addEventTask,
  addEventVendorSlot,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  requestDecision,
  updateVendorCandidate,
} from "@/modules/events/service";
import { saveOnboardingStep, setModuleEnabled } from "@/modules/hub/service";
import { addQuoteLine, addScheduleItem, createQuote, sendQuote, setQuoteAdvanceKind } from "@/modules/quotes/service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { loadTodayItems, type TodayWords } from "./load";
import { rankToday } from "./rank";

const words: TodayWords = {
  clientTask: "Tâche confiée au client",
  amount: (label, amount) => `${label} · ${amount}`,
  decision: (title) => `Choix : ${title}`,
  paymentDeclaration: (label, amount) => `Règlement déclaré : ${label} · ${amount}`,
  quoteFollowUp: (number) => `Devis ${number} sans réponse`,
  prospectFollowUp: "Prospect sans nouvelle",
  depositBlocked: (number) => `Facture d'acompte bloquée (${number})`,
  vendorContract: (vendorName, slotLabel) => `Contrat de ${vendorName} (${slotLabel}) à faire signer`,
  dateConflict: (count) => `${count} évènements le même jour`,
  linkRenewal: (personName) => `Nouveau lien demandé par ${personName}`,
};
const ALL = { events: true, quotes: true, budget: true };

function plusDays(days: number): string {
  const date = new Date(`${parisToday()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Mariage de Léa et Maxime : une tâche en retard (vous), une confiée au client dans trois jours,
// un choix de fleuriste demandé, un photographe retenu sans contrat, un devis envoyé dont la première
// échéance est passée.
async function atelier() {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
  await fillRequiredMentions(organizationId);
  const planner = await createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" });
  const source = await createProspectSource(organizationId, "Salon");
  const eventId = (await createProspect({ organizationId, createdByUserId: planner.id, prospectSourceId: source.id, clients: [{ firstName: "Léa" }, { firstName: "Maxime" }], eventDate: plusDays(68) })).id;
  await addEventTask(organizationId, eventId, { label: "Faire signer le contrat du photographe", dueDate: plusDays(-3), responsible: "planner" });
  await addEventTask(organizationId, eventId, { label: "Valider le faire-part", dueDate: plusDays(3), responsible: "clients" });
  const flowers = await addEventVendorSlot(organizationId, eventId, "Fleuriste");
  for (const vendorName of ["Atelier Pivoine", "Jardin d'hiver"]) {
    const candidate = await addVendorCandidate({ organizationId, eventId, vendorSlotId: flowers.id, vendorName });
    await updateVendorCandidate({ organizationId, candidateId: candidate.id, shownToClients: true });
  }
  await requestDecision({ organizationId, eventId, requestedByUserId: planner.id, kind: "option", slotId: flowers.id });
  const photo = await addEventVendorSlot(organizationId, eventId, "Photographe");
  const studio = await addVendorCandidate({ organizationId, eventId, vendorSlotId: photo.id, vendorName: "Studio Lumière" });
  await updateVendorCandidate({ organizationId, candidateId: studio.id, status: "retained", changedByUserId: planner.id });
  const quote = await createQuote({ organizationId, eventId, createdByUserId: planner.id });
  await addQuoteLine(organizationId, quote.id, { label: "Organisation complète", unit: "forfait", quantityMilli: 1000, unitPriceCents: 300000 });
  await setQuoteAdvanceKind(organizationId, quote.id, "deposit");
  await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", dueDate: plusDays(-1), percentageBasisPoints: 3000 });
  await sendQuote({ organizationId, quoteId: quote.id });
  return { organizationId, plannerId: planner.id, eventId, studioId: studio.id };
}

describe("HUB-08 / UX-01 / UX-06 — Les urgences de toute l'organisation (lot 32a)", () => {
  it("chaque module apporte ses urgences, triées : en retard d'abord, puis ce qu'attendent le client et le prestataire", async () => {
    const context = await atelier();
    const { items, today, unavailable } = await loadTodayItems(context.organizationId, ALL, words, "fr");
    expect(unavailable).toEqual([]);
    const ranked = rankToday(items, today);

    expect(ranked.groups.overdue.map((entry) => [entry.kind, entry.title.replace(/\s/g, " "), entry.actor.kind])).toEqual([
      ["task", "Faire signer le contrat du photographe", "you"],
      ["client_payment", "Acompte à la signature · 900,00 €", "client"],
    ]);
    expect(ranked.groups.overdue[0]!.action).toEqual({ kind: "check_task", eventId: context.eventId, taskId: expect.any(String) });
    expect(ranked.groups.waiting.map((entry) => [entry.kind, entry.actor.kind]).sort()).toEqual([
      ["client_task", "client"],
      ["decision", "client"],
      ["vendor_contract", "vendor"],
    ]);
    const vendor = ranked.groups.waiting.find((entry) => entry.kind === "vendor_contract")!;
    expect(vendor).toMatchObject({ title: "Contrat de Studio Lumière (Photographe) à faire signer", actor: { kind: "vendor", name: "Studio Lumière" }, action: { kind: "remind_vendor", candidateId: context.studioId } });
    expect(ranked.all.every((entry) => entry.eventNames === "Léa & Maxime")).toBe(true);
    expect(ranked.first).toHaveLength(3);
    expect(ranked.attentionByEvent.get(context.eventId)).toBe(5);
  });

  it("un module non souscrit n'apporte rien (dégradation propre) ; une autre organisation ne voit rien", async () => {
    const context = await atelier();
    await setModuleEnabled(appDatabase(), { adminUserId: randomUUID(), organizationId: context.organizationId, moduleKey: "quotes", enabled: false });
    const withoutQuotes = await loadTodayItems(context.organizationId, { events: true, quotes: false, budget: true }, words, "fr");
    expect(withoutQuotes.items.some((entry) => entry.kind === "client_payment")).toBe(false);
    expect(withoutQuotes.items.some((entry) => entry.kind === "task")).toBe(true);

    const other = (await createOrganization(appDatabase(), `Atelier ${randomUUID().slice(0, 6)}`)).id;
    expect((await loadTodayItems(other, ALL, words, "fr")).items).toEqual([]);
  });
});
