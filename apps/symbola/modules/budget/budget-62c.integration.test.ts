// Lot 62c (UX-13, décision D1) — le budget s'enregistre d'un coup, contre un vrai PostgreSQL (RLS),
// par la porte d'entrée du module : plusieurs lignes (libellé, prestataire, taux, montants) dans une
// seule transaction, tout ou rien ; la répartition de la simulation de même ; une ligne refusée dit
// laquelle ; abus d'une autre organisation et d'un autre évènement. Les calculs (reste, écart) et
// l'historique des montants ne changent pas.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addDefaultVendorSlots, addVendorCandidate, createProspect, createProspectSource, listEventVendorSlots } from "@/modules/events/service";
import {
  BudgetBatchLineError,
  BudgetLineDetailsInvalidError,
  BudgetLineNotFoundError,
  BudgetLinePaidFromPaymentsError,
  DefaultVendorSlotNotFoundError,
  EventBudgetNotFoundError,
  EventNotFoundError,
  addBudgetLine,
  addVendorPayment,
  adjustEventBudgetItems,
  createAllocationModel,
  getEventBudget,
  listBudgetLineHistory,
  listBudgetLines,
  saveBudgetLines,
  simulateEventBudget,
  updateBudgetLine,
} from "./service";

const plannerId = randomUUID();

async function wedding(organizationId: string, labels = ["Traiteur", "Musique"]) {
  const defaults = await addDefaultVendorSlots(organizationId, labels);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }] });
  const slots = await listEventVendorSlots(organizationId, event.id);
  const slot = (label: string) => slots.find((entry) => entry.label === label)!;
  return { eventId: event.id, slot, defaults };
}

// Deux lignes : un dîner (estimé 6 000 €) et un DJ (estimé 1 000 €).
async function twoLines(organizationId: string) {
  const { eventId, slot } = await wedding(organizationId);
  await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Traiteur").id, label: "Dîner" });
  const view = await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Musique").id, label: "DJ" });
  const dinner = view.lines.find((line) => line.label === "Dîner")!;
  const dj = view.lines.find((line) => line.label === "DJ")!;
  await updateBudgetLine({ organizationId, eventId, lineId: dinner.id, field: "estimated", amountCents: 600000, changedByUserId: plannerId });
  await updateBudgetLine({ organizationId, eventId, lineId: dj.id, field: "estimated", amountCents: 100000, changedByUserId: plannerId });
  return { eventId, slot, dinner, dj };
}

const amounts = async (organizationId: string, eventId: string) =>
  (await listBudgetLines(organizationId, eventId)).lines.map((line) => `${line.label} ${line.estimatedAmountCents ?? "—"}/${line.committedAmountCents ?? "—"}/${line.paidAmountCents ?? "—"}`);

describe("UX-13 — Les lignes du budget s'enregistrent d'un coup (lot 62c, D1)", () => {
  it("libellé, prestataire, taux et montants de plusieurs lignes sont écrits ensemble ; les calculs ne changent pas", async () => {
    const organizationId = randomUUID();
    const { eventId, slot, dinner, dj } = await twoLines(organizationId);
    const solal = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot("Musique").id, vendorName: "DJ Solal" });

    const view = await saveBudgetLines({
      organizationId,
      eventId,
      changedByUserId: plannerId,
      lines: [
        { lineId: dinner.id, label: "  Dîner, 120 couverts ", vatRateBasisPoints: 1000, amounts: [{ field: "quoted", amountCents: 660000 }, { field: "committed", amountCents: 660000 }, { field: "paid", amountCents: 198000 }] },
        { lineId: dj.id, vendorCandidateId: solal.id, amounts: [{ field: "committed", amountCents: 110000 }] },
      ],
    });

    const saved = (label: string) => view.lines.find((line) => line.label === label)!;
    expect(saved("Dîner, 120 couverts")).toMatchObject({ vatRateBasisPoints: 1000, estimatedAmountCents: 600000, quotedAmountCents: 660000, committedAmountCents: 660000, paidAmountCents: 198000, remainingAmountCents: 462000, varianceCents: 60000 });
    expect(saved("DJ")).toMatchObject({ vendorCandidateId: solal.id, vendorName: "DJ Solal", committedAmountCents: 110000, remainingAmountCents: 110000, varianceCents: 10000 });
    expect(view).toMatchObject({ totalEstimatedCents: 700000, totalCommittedCents: 770000, totalPaidCents: 198000, totalRemainingCents: 572000 });
  });

  it("chaque montant écrit est historisé ; un montant inchangé ne l'est pas", async () => {
    const organizationId = randomUUID();
    const { eventId, slot, dinner } = await twoLines(organizationId);
    await saveBudgetLines({ organizationId, eventId, changedByUserId: plannerId, lines: [{ lineId: dinner.id, amounts: [{ field: "estimated", amountCents: 600000 }, { field: "committed", amountCents: 650000 }] }] });

    const history = await listBudgetLineHistory(organizationId, slot("Traiteur").id);
    expect(history.map((entry) => `${entry.field} ${entry.oldValueCents ?? "—"}→${entry.newValueCents}`)).toEqual(["estimated —→600000", "committed —→650000"]);
    expect(history.every((entry) => entry.changedByUserId === plannerId)).toBe(true);
  });

  it("une ligne refusée dit laquelle, et rien n'est écrit sur les autres", async () => {
    const organizationId = randomUUID();
    const { eventId, slot, dinner, dj } = await twoLines(organizationId);
    const before = await amounts(organizationId, eventId);
    const good = { lineId: dinner.id, label: "Dîner de gala", amounts: [{ field: "committed" as const, amountCents: 650000 }] };
    const refused = async (line: Parameters<typeof saveBudgetLines>[0]["lines"][number], reason: new (...args: never[]) => Error) => {
      const attempt = saveBudgetLines({ organizationId, eventId, changedByUserId: plannerId, lines: [good, line] });
      await expect(attempt).rejects.toMatchObject({ name: "BudgetBatchLineError", lineId: dj.id });
      await expect(attempt).rejects.toSatisfy((error: BudgetBatchLineError) => error.reason instanceof reason);
    };

    await refused({ lineId: dj.id, label: "   " }, BudgetLineDetailsInvalidError);
    await refused({ lineId: dj.id, vatRateBasisPoints: 10001 }, BudgetLineDetailsInvalidError);
    await refused({ lineId: dj.id, amounts: [{ field: "committed", amountCents: -1 }] }, RangeError);
    await refused({ lineId: dj.id, amounts: [{ field: "committed", amountCents: 10.5 }] }, RangeError);
    // Le prestataire d'une ligne est l'un de ceux de sa catégorie.
    const haddad = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot("Traiteur").id, vendorName: "Maison Haddad" });
    await refused({ lineId: dj.id, vendorCandidateId: haddad.id }, BudgetLineDetailsInvalidError);
    expect(await amounts(organizationId, eventId)).toEqual(before);
    // D13 : le payé d'une ligne à échéances vient de ses échéances (0 tant qu'aucune n'est payée).
    await addVendorPayment({ organizationId, eventId, lineId: dj.id, label: "Acompte", fixedAmountCents: 30000, dueOn: "2027-04-09", changedByUserId: plannerId });
    await refused({ lineId: dj.id, amounts: [{ field: "paid", amountCents: 30000 }] }, BudgetLinePaidFromPaymentsError);
    expect(await amounts(organizationId, eventId)).toEqual(["Dîner 600000/—/—", "DJ 100000/—/0"]);
    expect((await listBudgetLines(organizationId, eventId)).lines.map((line) => line.label).sort()).toEqual(["DJ", "Dîner"]);
  });

  it("un envoi vide n'écrit rien ; une ligne citée deux fois est refusée", async () => {
    const organizationId = randomUUID();
    const { eventId, dinner } = await twoLines(organizationId);
    const before = await amounts(organizationId, eventId);
    expect((await saveBudgetLines({ organizationId, eventId, changedByUserId: plannerId, lines: [] })).lines).toHaveLength(2);
    await expect(
      saveBudgetLines({ organizationId, eventId, changedByUserId: plannerId, lines: [{ lineId: dinner.id, label: "Un" }, { lineId: dinner.id, label: "Deux" }] }),
    ).rejects.toBeInstanceOf(BudgetLineNotFoundError);
    expect(await amounts(organizationId, eventId)).toEqual(before);
  });

  it("abus : une autre organisation ne modifie rien ; une ligne d'un autre évènement refuse tout l'envoi", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const mine = await twoLines(organizationId);
    const other = await twoLines(otherOrganizationId);
    const elsewhere = await wedding(organizationId, ["Fleurs"]);
    const foreign = (await addBudgetLine({ organizationId, eventId: elsewhere.eventId, eventVendorSlotId: elsewhere.slot("Fleurs").id, label: "Bouquets" })).lines[0]!;
    const before = await amounts(organizationId, mine.eventId);
    const stolen = [{ lineId: mine.dinner.id, label: "Détournée", amounts: [{ field: "committed" as const, amountCents: 1 }] }];

    // L'organisation B vise l'évènement de A : il n'existe pas pour elle.
    await expect(saveBudgetLines({ organizationId: otherOrganizationId, eventId: mine.eventId, changedByUserId: plannerId, lines: stolen })).rejects.toBeInstanceOf(EventNotFoundError);
    // L'organisation B vise son propre évènement, avec une ligne de A : invisible sous RLS.
    await expect(saveBudgetLines({ organizationId: otherOrganizationId, eventId: other.eventId, changedByUserId: plannerId, lines: stolen })).rejects.toBeInstanceOf(BudgetLineNotFoundError);
    // Dans la même organisation, une ligne d'un autre évènement refuse tout l'envoi.
    await expect(
      saveBudgetLines({ organizationId, eventId: mine.eventId, changedByUserId: plannerId, lines: [{ lineId: mine.dj.id, label: "DJ modifié" }, { lineId: foreign.id, label: "Bouquets détournés" }] }),
    ).rejects.toBeInstanceOf(BudgetLineNotFoundError);

    expect(await amounts(organizationId, mine.eventId)).toEqual(before);
    expect((await listBudgetLines(organizationId, elsewhere.eventId)).lines[0]).toMatchObject({ label: "Bouquets" });
    expect((await listBudgetLines(otherOrganizationId, other.eventId)).lines.map((line) => line.label).sort()).toEqual(["DJ", "Dîner"]);
  });
});

describe("UX-13 — La répartition de la simulation s'enregistre d'un coup (lot 62c, D1)", () => {
  async function simulated(organizationId: string) {
    const { eventId, defaults } = await wedding(organizationId, ["Lieu", "Traiteur"]);
    const [lieu, traiteur] = defaults;
    const model = await createAllocationModel({
      organizationId,
      name: "Classique",
      items: [
        { defaultVendorSlotId: lieu!.id, percentageBasisPoints: 6000 },
        { defaultVendorSlotId: traiteur!.id, percentageBasisPoints: 4000 },
      ],
    });
    await simulateEventBudget({ organizationId, eventId, totalAmountCents: 1000000, guestCount: 40, allocationModelId: model.id });
    return { eventId, lieu: lieu!.id, traiteur: traiteur!.id };
  }
  const items = async (organizationId: string, eventId: string) => Object.fromEntries((await getEventBudget(organizationId, eventId))!.items.map((item) => [item.defaultVendorSlotId, item.amountCents]));

  it("plusieurs postes sont ajustés ensemble ; le déjà réparti et le reste suivent", async () => {
    const organizationId = randomUUID();
    const { eventId, lieu, traiteur } = await simulated(organizationId);
    const view = await adjustEventBudgetItems({ organizationId, eventId, items: [{ defaultVendorSlotId: lieu, amountCents: 550000 }, { defaultVendorSlotId: traiteur, amountCents: 420000 }] });
    expect(view).toMatchObject({ allocatedCents: 970000, remainingCents: 30000 });
    expect(await items(organizationId, eventId)).toEqual({ [lieu]: 550000, [traiteur]: 420000 });
  });

  it("un poste inconnu, cité deux fois ou un montant invalide refuse tout : rien n'est écrit", async () => {
    const organizationId = randomUUID();
    const { eventId, lieu, traiteur } = await simulated(organizationId);
    const good = { defaultVendorSlotId: lieu, amountCents: 550000 };
    await expect(adjustEventBudgetItems({ organizationId, eventId, items: [good, { defaultVendorSlotId: randomUUID(), amountCents: 1 }] })).rejects.toBeInstanceOf(DefaultVendorSlotNotFoundError);
    await expect(adjustEventBudgetItems({ organizationId, eventId, items: [good, { defaultVendorSlotId: lieu, amountCents: 1 }] })).rejects.toBeInstanceOf(RangeError);
    await expect(adjustEventBudgetItems({ organizationId, eventId, items: [good, { defaultVendorSlotId: traiteur, amountCents: -5 }] })).rejects.toBeInstanceOf(RangeError);
    expect(await items(organizationId, eventId)).toEqual({ [lieu]: 600000, [traiteur]: 400000 });
  });

  it("abus : une autre organisation n'ajuste rien ; sans simulation, l'envoi est refusé", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const mine = await simulated(organizationId);
    const other = await simulated(otherOrganizationId);
    const bare = await wedding(organizationId, ["Fleurs"]);

    await expect(adjustEventBudgetItems({ organizationId: otherOrganizationId, eventId: mine.eventId, items: [{ defaultVendorSlotId: other.lieu, amountCents: 1 }] })).rejects.toBeInstanceOf(EventNotFoundError);
    // Les postes de A sont inconnus de B (RLS) : son propre évènement ne les reçoit pas.
    await expect(adjustEventBudgetItems({ organizationId: otherOrganizationId, eventId: other.eventId, items: [{ defaultVendorSlotId: mine.lieu, amountCents: 1 }] })).rejects.toBeInstanceOf(DefaultVendorSlotNotFoundError);
    await expect(adjustEventBudgetItems({ organizationId, eventId: bare.eventId, items: [{ defaultVendorSlotId: mine.lieu, amountCents: 1 }] })).rejects.toBeInstanceOf(EventBudgetNotFoundError);

    expect(await items(organizationId, mine.eventId)).toEqual({ [mine.lieu]: 600000, [mine.traiteur]: 400000 });
    expect(await items(otherOrganizationId, other.eventId)).toEqual({ [other.lieu]: 600000, [other.traiteur]: 400000 });
  });
});
