// Lot 47 (PAR-05, D6 ; ADR 0085 ; migration 0164, accord de Julien du 18/11/2026) — quand la planner
// ne retient plus un prestataire, le module Budget libère l'engagé de ses lignes, par son propre
// service, sur l'événement events.vendor_retention.released : seulement si l'engagé vaut encore ce
// que la retenue avait engagé ; sûr au rejeu ; jamais dans une autre organisation. PostgreSQL réel.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import type { VendorRetentionReleasedPayload } from "@symbola/contracts";
import { addEventVendorSlot, addVendorCandidate, createProspect, createProspectSource, updateVendorCandidate } from "@/modules/events/service";
import { CONSUMERS, runEventWorkerOnce } from "@/lib/event-worker";
import { applyVendorRetentionReleasedToBudget, listBudgetLines, updateBudgetLine } from "./service";

// Le worker ne fait tourner que le consommateur du module Budget : lancé avec tous les consommateurs,
// il traiterait aussi les événements des autres fichiers de tests joués en parallèle (une facture
// d'acompte émise par le consommateur « quotes » sous un test des factures, par exemple).
const budgetWorker = () => runEventWorkerOnce({ budget: CONSUMERS.budget! });
const plannerId = randomUUID();

async function organization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

// Un fleuriste retenu à 2 850 € : sa ligne de budget est engagée de son devis.
async function retainedFlorist(organizationId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: "2027-06-12" });
  const slot = await addEventVendorSlot(organizationId, event.id, "Poste A");
  const candidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: slot.id, vendorName: "Atelier Élodie" });
  await updateVendorCandidate({ organizationId, candidateId: candidate.id, quoteAmountCents: 285_000 });
  await updateVendorCandidate({ organizationId, candidateId: candidate.id, status: "retained", changedByUserId: plannerId });
  await budgetWorker();
  const payload: VendorRetentionReleasedPayload = { eventId: event.id, vendorSlotId: slot.id, candidateId: candidate.id, amountCents: 285_000, releasedByUserId: plannerId };
  return { eventId: event.id, candidateId: candidate.id, payload };
}

async function linesOf(organizationId: string, eventId: string, candidateId: string) {
  return (await listBudgetLines(organizationId, eventId)).lines.filter((line) => line.vendorCandidateId === candidateId);
}

describe("PAR-05 (D6) — L'engagé d'un prestataire qui n'est plus retenu est libéré", () => {
  it("libération normale : l'engagé de sa ligne redevient vide, et l'historique le garde", async () => {
    const organizationId = await organization();
    const setup = await retainedFlorist(organizationId);
    expect((await linesOf(organizationId, setup.eventId, setup.candidateId)).map((line) => line.committedAmountCents)).toEqual([285_000]);
    await applyVendorRetentionReleasedToBudget(organizationId, setup.payload);
    const [line] = await linesOf(organizationId, setup.eventId, setup.candidateId);
    expect(line!.committedAmountCents).toBeNull();
    // Le devisé reste (c'est le devis reçu) ; seul l'engagé est libéré.
    expect(line!.quotedAmountCents).toBe(285_000);
  });

  it("engagé modifié entre-temps par la planner : rien n'est touché", async () => {
    const organizationId = await organization();
    const setup = await retainedFlorist(organizationId);
    const [line] = await linesOf(organizationId, setup.eventId, setup.candidateId);
    await updateBudgetLine({ organizationId, eventId: setup.eventId, lineId: line!.id, field: "committed", amountCents: 300_000, changedByUserId: plannerId });
    await applyVendorRetentionReleasedToBudget(organizationId, setup.payload);
    expect((await linesOf(organizationId, setup.eventId, setup.candidateId)).map((entry) => entry.committedAmountCents)).toEqual([300_000]);
  });

  it("idempotence : l'événement reçu deux fois ne libère qu'une fois, sans autre écriture", async () => {
    const organizationId = await organization();
    const setup = await retainedFlorist(organizationId);
    await applyVendorRetentionReleasedToBudget(organizationId, setup.payload);
    const [line] = await linesOf(organizationId, setup.eventId, setup.candidateId);
    // Entre deux réceptions, la planner engage à la main un autre montant : le rejeu n'y touche pas.
    await updateBudgetLine({ organizationId, eventId: setup.eventId, lineId: line!.id, field: "committed", amountCents: 120_000, changedByUserId: plannerId });
    await applyVendorRetentionReleasedToBudget(organizationId, setup.payload);
    expect((await linesOf(organizationId, setup.eventId, setup.candidateId)).map((entry) => entry.committedAmountCents)).toEqual([120_000]);
  });

  it("isolation : l'événement d'une organisation ne libère rien dans une autre", async () => {
    const organizationA = await organization();
    const organizationB = await organization();
    const setup = await retainedFlorist(organizationA);
    await applyVendorRetentionReleasedToBudget(organizationB, setup.payload);
    expect((await linesOf(organizationA, setup.eventId, setup.candidateId)).map((line) => line.committedAmountCents)).toEqual([285_000]);
  });
});
