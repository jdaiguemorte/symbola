// Lot 28b — lignes sous chaque catégorie (BUD-01, Q33), plusieurs prestataires
// retenus et engagement de leurs lignes (PRE-02, D10, D11), échéancier (BUD-03,
// D7, D12, D13), documents par nature (BUD-04), contre un vrai PostgreSQL (RLS),
// par les portes d'entrée des modules.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  addDefaultVendorSlots,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  listEventVendorSlots,
  listVendorCandidates,
  selectVendorCandidate,
  updateVendorCandidate,
} from "@/modules/events/service";
import {
  BudgetLineDetailsInvalidError,
  BudgetLineNotFoundError,
  BudgetLinePaidFromPaymentsError,
  VendorPaymentInvalidError,
  VendorPaymentNotFoundError,
  addBudgetLine,
  addVendorPayment,
  applyVendorSlotBookedToBudget,
  attachBudgetLineQuote,
  budgetPrivacy,
  getBudgetLineAttachmentFile,
  listBudgetLineHistory,
  listBudgetLines,
  listUpcomingVendorPayments,
  previewEngagement,
  removeBudgetLine,
  removeVendorPayment,
  setVendorPaymentPaid,
  updateBudgetLine,
  updateBudgetLineDetails,
} from "./service";

const plannerId = randomUUID();
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function wedding(organizationId: string, labels = ["Traiteur", "Musique"]) {
  await addDefaultVendorSlots(organizationId, labels);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }] });
  const slots = await listEventVendorSlots(organizationId, event.id);
  const slot = (label: string) => slots.find((entry) => entry.label === label)!;
  return { eventId: event.id, slot };
}

// L'engagement part par l'événement interne : le test le rejoue directement,
// comme le worker (la publication elle-même est testée au module events).
async function retain(organizationId: string, eventId: string, candidateId: string) {
  await selectVendorCandidate({ organizationId, candidateId, changedByUserId: plannerId });
  const candidate = (await listVendorCandidates(organizationId, eventId)).find((entry) => entry.id === candidateId)!;
  const slot = (await listEventVendorSlots(organizationId, eventId)).find((entry) => entry.id === candidate.vendorSlotId)!;
  await applyVendorSlotBookedToBudget(organizationId, {
    eventId,
    vendorSlotId: slot.id,
    label: slot.label,
    amountCents: candidate.quoteAmountCents,
    candidateId,
    currency: "EUR",
    bookedByUserId: plannerId,
  });
}

describe("BUD-01 — Lignes sous chaque catégorie (lot 28b, décision Q33)", () => {
  it("une catégorie porte plusieurs lignes ; elle totalise leurs cinq montants, le budget totalise les catégories", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    const caterer = slot("Traiteur");
    for (const label of ["Dîner, 120 couverts", "Vin d'honneur", "Pièce montée"]) {
      await addBudgetLine({ organizationId, eventId, eventVendorSlotId: caterer.id, label });
    }
    const lines = (await listBudgetLines(organizationId, eventId)).lines;
    const id = (label: string) => lines.find((line) => line.label === label)!.id;
    await updateBudgetLine({ organizationId, eventId, lineId: id("Dîner, 120 couverts"), field: "estimated", amountCents: 660000, changedByUserId: plannerId });
    await updateBudgetLine({ organizationId, eventId, lineId: id("Vin d'honneur"), field: "estimated", amountCents: 120000, changedByUserId: plannerId });
    await updateBudgetLine({ organizationId, eventId, lineId: id("Pièce montée"), field: "estimated", amountCents: 60000, changedByUserId: plannerId });
    const view = await updateBudgetLine({ organizationId, eventId, lineId: id("Dîner, 120 couverts"), field: "committed", amountCents: 650000, changedByUserId: plannerId });

    expect(view.categories).toHaveLength(1);
    expect(view.categories[0]).toMatchObject({ label: "Traiteur", estimatedCents: 840000, committedCents: 650000, varianceCents: -10000 });
    expect(view.categories[0]!.lines.map((line) => line.label)).toEqual(["Dîner, 120 couverts", "Vin d'honneur", "Pièce montée"]);
    expect(view).toMatchObject({ totalEstimatedCents: 840000, totalCommittedCents: 650000 });
    expect((await listBudgetLineHistory(organizationId, caterer.id)).map((entry) => entry.field)).toEqual(["estimated", "estimated", "estimated", "committed"]);
  });

  it("sans ligne désignée, un montant va sur la première ligne de la catégorie (créée au nom de la catégorie)", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Musique").id, field: "estimated", amountCents: 180000, changedByUserId: plannerId });
    await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Musique").id, label: "Sonorisation" });
    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Musique").id, field: "estimated", amountCents: 160000, changedByUserId: plannerId });
    const lines = (await listBudgetLines(organizationId, eventId)).lines;
    expect(lines.map((line) => [line.label, line.estimatedAmountCents])).toEqual([
      ["Musique", 160000],
      ["Sonorisation", null],
    ]);
  });

  it("le libellé est obligatoire ; le prestataire d'une ligne est l'un de ceux rattachés à sa catégorie", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    await expect(addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Musique").id, label: "  " })).rejects.toBeInstanceOf(BudgetLineDetailsInvalidError);
    const dj = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot("Musique").id, vendorName: "DJ Solal" });
    const haddad = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot("Traiteur").id, vendorName: "Maison Haddad" });
    await expect(addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Musique").id, label: "DJ", vendorCandidateId: haddad.id })).rejects.toBeInstanceOf(
      BudgetLineDetailsInvalidError,
    );
    const view = await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Musique").id, label: "DJ de la soirée", vendorCandidateId: dj.id });
    const line = view.lines[0]!;
    expect(line).toMatchObject({ label: "DJ de la soirée", vendorCandidateId: dj.id, vendorName: "DJ Solal" });

    const renamed = await updateBudgetLineDetails({ organizationId, eventId, lineId: line.id, label: "DJ et sonorisation", vendorCandidateId: null });
    expect(renamed.lines[0]).toMatchObject({ label: "DJ et sonorisation", vendorCandidateId: null, vendorName: null });
  });

  it("une ligne supprimée sort des totaux, avec ses échéances et son historique", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Traiteur").id, label: "Brunch" });
    const lineId = (await listBudgetLines(organizationId, eventId)).lines[0]!.id;
    await updateBudgetLine({ organizationId, eventId, lineId, field: "committed", amountCents: 120000, changedByUserId: plannerId });
    await addVendorPayment({ organizationId, eventId, lineId, label: "Acompte", fixedAmountCents: 40000, dueOn: "2027-04-01", changedByUserId: plannerId });

    const view = await removeBudgetLine(organizationId, eventId, lineId);
    expect(view).toMatchObject({ lines: [], categories: [], totalCommittedCents: 0 });
    expect(await listBudgetLineHistory(organizationId, slot("Traiteur").id)).toEqual([]);
    await expect(removeBudgetLine(organizationId, eventId, lineId)).rejects.toBeInstanceOf(BudgetLineNotFoundError);
  });
});

describe("PRE-02 — Plusieurs prestataires retenus, « Retenu » engage leurs lignes (lot 28b, D10 et D11)", () => {
  it("retenir un second prestataire laisse le premier retenu ; les concurrents encore en lice sont écartés", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    const music = slot("Musique").id;
    const dj = await addVendorCandidate({ organizationId, eventId, vendorSlotId: music, vendorName: "DJ Solal" });
    const duo = await addVendorCandidate({ organizationId, eventId, vendorSlotId: music, vendorName: "Duo Cordes" });
    await addVendorCandidate({ organizationId, eventId, vendorSlotId: music, vendorName: "Groupe Jazz" });
    await selectVendorCandidate({ organizationId, candidateId: dj.id, changedByUserId: plannerId });
    expect((await listVendorCandidates(organizationId, eventId)).map((candidate) => [candidate.vendorName, candidate.status])).toEqual([
      ["DJ Solal", "retained"],
      ["Duo Cordes", "dismissed"],
      ["Groupe Jazz", "dismissed"],
    ]);
    // Le duo, écarté, est finalement retenu aussi : le DJ le reste.
    await selectVendorCandidate({ organizationId, candidateId: duo.id, changedByUserId: plannerId });
    const statuses = Object.fromEntries((await listVendorCandidates(organizationId, eventId)).map((candidate) => [candidate.vendorName, candidate.status]));
    expect(statuses).toEqual({ "DJ Solal": "retained", "Duo Cordes": "retained", "Groupe Jazz": "dismissed" });
    expect((await listEventVendorSlots(organizationId, eventId)).find((entry) => entry.id === music)?.retainedVendors.map((vendor) => vendor.vendorName)).toEqual([
      "DJ Solal",
      "Duo Cordes",
    ]);
  });

  it("une ligne libre de la catégorie (celle de la simulation) devient celle du prestataire retenu, engagée à son devis", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    const caterer = slot("Traiteur").id;
    await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: caterer, field: "estimated", amountCents: 1087100, changedByUserId: plannerId });
    const haddad = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer, vendorName: "Maison Haddad" });
    await updateVendorCandidate({ organizationId, candidateId: haddad.id, quoteAmountCents: 960000 });

    await retain(organizationId, eventId, haddad.id);
    const [line] = (await listBudgetLines(organizationId, eventId)).lines;
    expect(line).toMatchObject({
      label: "Traiteur",
      vendorName: "Maison Haddad",
      estimatedAmountCents: 1087100,
      quotedAmountCents: 960000,
      committedAmountCents: 960000,
      varianceCents: -127100,
    });
  });

  it("sans ligne libre, une ligne est créée au nom du prestataire ; ses lignes engagent chacune leur devisé quand il en a plusieurs", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    const music = slot("Musique").id;
    const dj = await addVendorCandidate({ organizationId, eventId, vendorSlotId: music, vendorName: "DJ Solal" });
    const duo = await addVendorCandidate({ organizationId, eventId, vendorSlotId: music, vendorName: "Duo Cordes" });
    await updateVendorCandidate({ organizationId, candidateId: duo.id, quoteAmountCents: 50000 });
    // Le DJ a deux lignes, chiffrées ligne par ligne (le détail de son devis).
    for (const [label, quoted] of [
      ["DJ de la soirée", 110000],
      ["Sonorisation de la cérémonie", 20000],
    ] as const) {
      const view = await addBudgetLine({ organizationId, eventId, eventVendorSlotId: music, label, vendorCandidateId: dj.id });
      const lineId = view.lines.find((line) => line.label === label)!.id;
      await updateBudgetLine({ organizationId, eventId, lineId, field: "quoted", amountCents: quoted, changedByUserId: plannerId });
    }
    await updateVendorCandidate({ organizationId, candidateId: dj.id, quoteAmountCents: 130000 });

    // L'alerte du 28a voit ce que la retenue engagera : les devisés des deux lignes.
    expect(await previewEngagement({ organizationId, eventId, eventVendorSlotId: music, amountCents: 130000, candidateId: dj.id })).toMatchObject({ committedAfterCents: 130000 });

    await retain(organizationId, eventId, dj.id);
    await retain(organizationId, eventId, duo.id);
    const view = await listBudgetLines(organizationId, eventId);
    expect(view.lines.map((line) => [line.label, line.vendorName, line.quotedAmountCents, line.committedAmountCents])).toEqual([
      ["DJ de la soirée", "DJ Solal", 110000, 110000],
      ["Sonorisation de la cérémonie", "DJ Solal", 20000, 20000],
      ["Duo Cordes", "Duo Cordes", 50000, 50000],
    ]);
    expect(view.categories[0]?.committedCents).toBe(180000);
  });
});

describe("BUD-03 — Échéancier des prestataires (lot 28b, D7, D12, D13)", () => {
  // Le traiteur : 9 600 € engagés sur deux lignes ; une robe sans prestataire.
  async function engaged(organizationId: string) {
    const { eventId, slot } = await wedding(organizationId, ["Traiteur", "Tenues"]);
    const caterer = slot("Traiteur").id;
    const haddad = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer, vendorName: "Maison Haddad" });
    for (const [label, amount] of [
      ["Dîner, 120 couverts", 660000],
      ["Vin d'honneur", 300000],
    ] as const) {
      const view = await addBudgetLine({ organizationId, eventId, eventVendorSlotId: caterer, label, vendorCandidateId: haddad.id });
      const lineId = view.lines.find((line) => line.label === label)!.id;
      await updateBudgetLine({ organizationId, eventId, lineId, field: "committed", amountCents: amount, changedByUserId: plannerId });
    }
    const dress = (await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Tenues").id, label: "Robe" })).lines.find((line) => line.label === "Robe")!;
    await updateBudgetLine({ organizationId, eventId, lineId: dress.id, field: "committed", amountCents: 190000, changedByUserId: plannerId });
    const lines = (await listBudgetLines(organizationId, eventId)).lines;
    const find = (label: string) => lines.find((line) => line.label === label)!;
    return { eventId, dinner: find("Dîner, 120 couverts"), dress: find("Robe") };
  }

  it("un pourcentage porte sur l'engagé du prestataire (toutes ses lignes) ; sans prestataire, sur l'engagé de la ligne", async () => {
    const organizationId = randomUUID();
    const { eventId, dinner, dress } = await engaged(organizationId);
    await addVendorPayment({ organizationId, eventId, lineId: dinner.id, label: "Acompte du traiteur, 30 %", percentageBasisPoints: 3000, dueOn: "2027-04-09", changedByUserId: plannerId });
    await addVendorPayment({ organizationId, eventId, lineId: dress.id, label: "Arrhes", percentageBasisPoints: 5000, dueOn: "2027-02-01", changedByUserId: plannerId });
    const view = await addVendorPayment({ organizationId, eventId, lineId: dinner.id, label: "Solde", fixedAmountCents: 672000, dueOn: "2027-06-05", changedByUserId: plannerId });
    const lineOf = (id: string) => view.lines.find((line) => line.id === id)!;
    expect(lineOf(dinner.id).payments.map((payment) => [payment.label, payment.amountCents])).toEqual([
      ["Acompte du traiteur, 30 %", 288000],
      ["Solde", 672000],
    ]);
    expect(lineOf(dress.id).payments[0]?.amountCents).toBe(95000);

    // L'engagé change : le pourcentage suit (30 % de 7 000 € + 3 000 €).
    const after = await updateBudgetLine({ organizationId, eventId, lineId: dinner.id, field: "committed", amountCents: 700000, changedByUserId: plannerId });
    expect(after.lines.find((line) => line.id === dinner.id)?.payments[0]?.amountCents).toBe(300000);
  });

  it("payée, une échéance fige son montant ; le payé de la ligne en est la somme et ne se saisit plus", async () => {
    const organizationId = randomUUID();
    const { eventId, dinner } = await engaged(organizationId);
    const added = await addVendorPayment({ organizationId, eventId, lineId: dinner.id, label: "Acompte", percentageBasisPoints: 3000, dueOn: "2027-04-09", changedByUserId: plannerId });
    const paymentId = added.lines.find((line) => line.id === dinner.id)!.payments[0]!.id;
    expect(added.lines.find((line) => line.id === dinner.id)).toMatchObject({ paidFromPayments: true, paidAmountCents: 0 });

    const paid = await setVendorPaymentPaid({ organizationId, eventId, paymentId, paidOn: "2027-04-08", changedByUserId: plannerId });
    const line = paid.lines.find((entry) => entry.id === dinner.id)!;
    expect(line.payments[0]).toMatchObject({ amountCents: 288000, fixedAmountCents: 288000, percentageBasisPoints: null, paidOn: "2027-04-08", status: "paid" });
    expect(line).toMatchObject({ paidAmountCents: 288000, remainingAmountCents: 372000 });

    // Le montant payé ne bouge plus quand l'engagé change.
    const later = await updateBudgetLine({ organizationId, eventId, lineId: dinner.id, field: "committed", amountCents: 700000, changedByUserId: plannerId });
    expect(later.lines.find((entry) => entry.id === dinner.id)?.payments[0]?.amountCents).toBe(288000);
    await expect(updateBudgetLine({ organizationId, eventId, lineId: dinner.id, field: "paid", amountCents: 1, changedByUserId: plannerId })).rejects.toBeInstanceOf(
      BudgetLinePaidFromPaymentsError,
    );

    // Paiement annulé, puis échéance supprimée : le payé suit.
    const unpaid = await setVendorPaymentPaid({ organizationId, eventId, paymentId, paidOn: null, changedByUserId: plannerId });
    expect(unpaid.lines.find((entry) => entry.id === dinner.id)).toMatchObject({ paidAmountCents: 0 });
    await removeVendorPayment({ organizationId, eventId, paymentId, changedByUserId: plannerId });
    expect((await listBudgetLines(organizationId, eventId)).lines.find((entry) => entry.id === dinner.id)).toMatchObject({ paidFromPayments: false });
  });

  it("refuse une échéance sans libellé, sans montant, à double montant, à pourcentage hors de 0,01 à 100 % ou à date invalide", async () => {
    const organizationId = randomUUID();
    const { eventId, dinner } = await engaged(organizationId);
    const base = { organizationId, eventId, lineId: dinner.id, label: "Acompte", dueOn: "2027-04-09", changedByUserId: plannerId };
    for (const invalid of [
      { ...base, label: " ", fixedAmountCents: 100 },
      { ...base },
      { ...base, fixedAmountCents: 100, percentageBasisPoints: 3000 },
      { ...base, percentageBasisPoints: 10001 },
      { ...base, fixedAmountCents: 0 },
      { ...base, fixedAmountCents: 100, dueOn: "2027-13-40" },
    ]) {
      await expect(addVendorPayment(invalid)).rejects.toBeInstanceOf(VendorPaymentInvalidError);
    }
  });

  it("le bloc « Échéances prestataires » liste les retards et les 7 prochains jours, sans les échéances payées ni lointaines", async () => {
    const organizationId = randomUUID();
    const { eventId, dinner, dress } = await engaged(organizationId);
    const today = "2027-04-05";
    await addVendorPayment({ organizationId, eventId, lineId: dress.id, label: "Retard", fixedAmountCents: 10000, dueOn: "2027-04-01", changedByUserId: plannerId });
    await addVendorPayment({ organizationId, eventId, lineId: dinner.id, label: "Acompte", percentageBasisPoints: 3000, dueOn: "2027-04-12", changedByUserId: plannerId });
    await addVendorPayment({ organizationId, eventId, lineId: dinner.id, label: "Lointaine", fixedAmountCents: 10000, dueOn: "2027-04-13", changedByUserId: plannerId });
    const added = await addVendorPayment({ organizationId, eventId, lineId: dress.id, label: "Payée", fixedAmountCents: 10000, dueOn: "2027-04-06", changedByUserId: plannerId });
    const paidId = added.lines.find((line) => line.id === dress.id)!.payments.find((payment) => payment.label === "Payée")!.id;
    await setVendorPaymentPaid({ organizationId, eventId, paymentId: paidId, paidOn: today, changedByUserId: plannerId });

    const upcoming = await listUpcomingVendorPayments(organizationId, today);
    expect(upcoming.map((payment) => [payment.label, payment.vendorName, payment.lineLabel, payment.amountCents, payment.overdue])).toEqual([
      ["Retard", null, "Robe", 10000, true],
      ["Acompte", "Maison Haddad", "Dîner, 120 couverts", 288000, false],
    ]);
    expect(upcoming[0]?.eventName).toBe("Léa");
  });

  it("une autre organisation n'ajoute, ne paie ni ne voit les échéances d'une autre", async () => {
    const organizationId = randomUUID();
    const otherId = randomUUID();
    const { eventId, dinner } = await engaged(organizationId);
    const view = await addVendorPayment({ organizationId, eventId, lineId: dinner.id, label: "Acompte", fixedAmountCents: 288000, dueOn: "2027-04-09", changedByUserId: plannerId });
    const paymentId = view.lines.find((line) => line.id === dinner.id)!.payments[0]!.id;
    await expect(
      addVendorPayment({ organizationId: otherId, eventId, lineId: dinner.id, label: "Intrus", fixedAmountCents: 1, dueOn: "2027-04-09", changedByUserId: plannerId }),
    ).rejects.toBeInstanceOf(BudgetLineNotFoundError);
    await expect(setVendorPaymentPaid({ organizationId: otherId, eventId, paymentId, paidOn: "2027-04-01", changedByUserId: plannerId })).rejects.toBeInstanceOf(
      VendorPaymentNotFoundError,
    );
    expect(await listUpcomingVendorPayments(otherId, "2027-04-05")).toEqual([]);
  });
});

describe("BUD-04 — Documents de la ligne par nature (lot 28b)", () => {
  it("devis, contrat et facture se joignent à la ligne visée et s'ouvrent chacun par l'app", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    const lineId = (await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Traiteur").id, label: "Dîner" })).lines[0]!.id;
    const contract = await attachBudgetLineQuote({ organizationId, eventId, lineId, kind: "contract", content: TINY_PDF, uploadedByUserId: plannerId });
    await attachBudgetLineQuote({ organizationId, eventId, lineId, kind: "invoice", content: TINY_PDF, uploadedByUserId: plannerId });
    expect((await listBudgetLines(organizationId, eventId)).lines[0]?.attachments.map((attachment) => attachment.kind)).toEqual(["contract", "invoice"]);
    expect((await getBudgetLineAttachmentFile(organizationId, contract.id)).fileName).toMatch(/^contrat-prestataire-/);
  });
});

describe("RGPD — Libellés libres des lignes et des échéances (lot 28b)", () => {
  it("sont trouvés par un nom, rendus avec l'événement, et anonymisés à l'oubli (les montants restent)", async () => {
    const organizationId = randomUUID();
    const { eventId, slot } = await wedding(organizationId);
    const lineId = (await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slot("Musique").id, label: "Robe de Philomène" })).lines[0]!.id;
    await updateBudgetLine({ organizationId, eventId, lineId, field: "committed", amountCents: 190000, changedByUserId: plannerId });
    await addVendorPayment({ organizationId, eventId, lineId, label: "Retouches Philomène", fixedAmountCents: 20000, dueOn: "2027-05-01", changedByUserId: plannerId });

    const found = await budgetPrivacy.find({ organizationId, terms: { name: "Philomene" } });
    expect(found.map((record) => record.kind).sort()).toEqual(["budget_line", "vendor_payment"]);
    const related = await budgetPrivacy.related({ organizationId, eventIds: [eventId] });
    expect(related.map((record) => record.kind).sort()).toEqual(["budget_line", "vendor_payment"]);

    await budgetPrivacy.erase({
      organizationId,
      records: found.map((record) => ({ kind: record.kind, recordId: record.recordId })),
      rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 },
      today: "2027-06-01",
    });
    const [line] = (await listBudgetLines(organizationId, eventId)).lines;
    expect(line).toMatchObject({ label: "[anonymisé]", committedAmountCents: 190000 });
    expect(line?.payments[0]).toMatchObject({ label: "[anonymisé]", amountCents: 20000 });
  });
});
