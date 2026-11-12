// Lot 11 (L11-EVT-10 / L11-EVT-11) — prestataires consultés pour un poste, contre
// un vrai PostgreSQL (RLS) et le stockage privé, par la porte d'entrée du
// module events.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { EVT_VENDOR_SLOT_BOOKED } from "@symbola/contracts";
import {
  addDefaultVendorSlots,
  addVendorCandidate,
  addVendorCandidateNote,
  attachVendorCandidateQuote,
  LinkAccessDeniedError,
  createProspect,
  createProspectSource,
  getLinkVendorOptions,
  getLinkSharedRibVendorId,
  getLinkVendorQuoteFile,
  getVendorCandidateQuoteFile,
  createEventLink,
  revokeEventLink,
  listEventVendorSlots,
  listSelectedVendorIds,
  listVendorCandidates,
  listVendorConsultations,
  removeVendorCandidate,
  selectVendorCandidate,
  setVendorSlotBrief,
  updateEventVendorSlot,
  updateVendorCandidate,
  VendorCandidateNotFoundError,
} from "./service";
import { attachVendorFile, createVendor, getVendorRibFile } from "../vendors/service";

const plannerId = randomUUID();
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function newOrganization(): Promise<string> {
  return (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
}

async function eventWithCaterer(organizationId: string) {
  await addDefaultVendorSlots(organizationId, ["Traiteur", "Photographe"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }] });
  const slots = await listEventVendorSlots(organizationId, event.id);
  return { eventId: event.id, caterer: slots.find((slot) => slot.label === "Traiteur")!, photographer: slots.find((slot) => slot.label === "Photographe")! };
}

// Lot 26a : le client a un lien personnel (rubrique « Options de prestataires »).
async function invitedClient(organizationId: string, eventId: string) {
  const delivery = await createEventLink({
    organizationId,
    eventId,
    createdByUserId: plannerId,
    audience: "client",
    locale: "fr",
    link: { personName: "Inès", email: `client-${randomUUID()}@example.test`, rights: { rubrics: ["vendor_options"], budgetScope: "all", sharedSlotIds: [] } },
  });
  return delivery.link.id;
}

describe("L11-EVT-10 — Plusieurs prestataires consultés par poste", () => {
  it("elle consulte plusieurs prestataires pour un même poste, avec ou sans fiche du carnet", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const vendorId = randomUUID();

    await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier", vendorId });
    await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Les Tables de Flandre" });

    const candidates = await listVendorCandidates(organizationId, eventId);
    expect(candidates.map((candidate) => [candidate.vendorName, candidate.vendorId])).toEqual([
      ["Maison Verdier", vendorId],
      ["Les Tables de Flandre", null],
    ]);
    expect(candidates.every((candidate) => candidate.status === "shortlisted" && candidate.outcome === null)).toBe(true);
  });

  it("PRE-02 — le poste prend le statut le plus avancé de ses prestataires : Pressenti à l'ajout, Devis reçu avec un montant", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);

    const first = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
    expect((await listEventVendorSlots(organizationId, eventId)).find((slot) => slot.id === caterer.id)?.status).toBe("shortlisted");

    // Le formulaire renvoie le statut affiché (« Consulté ») avec le montant.
    await updateVendorCandidate({ organizationId, candidateId: first.id, status: "contacted", quoteAmountCents: 512000 });
    const [candidate] = await listVendorCandidates(organizationId, eventId);
    expect(candidate?.status).toBe("quote_received");
    expect((await listEventVendorSlots(organizationId, eventId)).find((slot) => slot.id === caterer.id)?.status).toBe("quote_received");
  });

  it("un poste non requis reste « Non requis » quand on lui ajoute un prestataire", async () => {
    const organizationId = await newOrganization();
    const { eventId, photographer } = await eventWithCaterer(organizationId);
    await updateEventVendorSlot({ organizationId, vendorSlotId: photographer.id, changedByUserId: plannerId, notRequired: true });

    await addVendorCandidate({ organizationId, eventId, vendorSlotId: photographer.id, vendorName: "Studio Lumière" });

    expect((await listEventVendorSlots(organizationId, eventId)).find((slot) => slot.id === photographer.id)?.status).toBe("not_required");
  });

  it("PRE-02 — « Retenir » engage le poste avec ce prestataire et le montant de son devis, publie la retenue, et les autres deviennent « Écarté »", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
    const tables = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Les Tables de Flandre" });
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, quoteAmountCents: 512000 });
    await updateVendorCandidate({ organizationId, candidateId: tables.id, quoteAmountCents: 448000 });

    await selectVendorCandidate({ organizationId, candidateId: tables.id, changedByUserId: plannerId });

    const slot = (await listEventVendorSlots(organizationId, eventId)).find((candidate) => candidate.id === caterer.id);
    expect(slot).toMatchObject({ status: "retained", retainedVendors: [{ candidateId: tables.id, vendorName: "Les Tables de Flandre", quoteAmountCents: 448000 }] });
    const candidates = await listVendorCandidates(organizationId, eventId);
    expect(Object.fromEntries(candidates.map((candidate) => [candidate.vendorName, candidate.outcome]))).toEqual({ "Maison Verdier": "not_selected", "Les Tables de Flandre": "selected" });
    expect(Object.fromEntries(candidates.map((candidate) => [candidate.vendorName, candidate.status]))).toEqual({ "Maison Verdier": "dismissed", "Les Tables de Flandre": "retained" });
    const published = await withDb((db) =>
      withOrganization(db, organizationId, (tx) =>
        tx.select().from(domainEvents).where(and(eq(domainEvents.organizationId, organizationId), eq(domainEvents.name, EVT_VENDOR_SLOT_BOOKED))),
      ),
    );
    expect(published.map((event) => (event.payload as { amountCents: number }).amountCents)).toEqual([448000]);
  });

  it("PRE-02 — le prestataire retenu repassé avant « Retenu » libère le poste", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
    await selectVendorCandidate({ organizationId, candidateId: verdier.id, changedByUserId: plannerId });

    await updateVendorCandidate({ organizationId, candidateId: verdier.id, status: "quote_received", changedByUserId: plannerId });

    expect((await listVendorCandidates(organizationId, eventId))[0]).toMatchObject({ status: "quote_received", outcome: null });
    expect((await listEventVendorSlots(organizationId, eventId)).find((slot) => slot.id === caterer.id)).toMatchObject({ status: "quote_received", retainedVendors: [] });
  });

  it("PRE-02 — passer un prestataire à « Retenu » par son statut engage comme « Retenir » ; Contrat signé et Soldé gardent l'engagement", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
    const tables = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Les Tables de Flandre" });
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, quoteAmountCents: 512000 });

    await updateVendorCandidate({ organizationId, candidateId: verdier.id, status: "retained", changedByUserId: plannerId });
    expect((await listEventVendorSlots(organizationId, eventId)).find((slot) => slot.id === caterer.id)).toMatchObject({ status: "retained", retainedVendors: [{ candidateId: verdier.id, vendorName: "Maison Verdier", quoteAmountCents: 512000 }] });
    expect((await listVendorCandidates(organizationId, eventId)).find((candidate) => candidate.id === tables.id)?.status).toBe("dismissed");

    await updateVendorCandidate({ organizationId, candidateId: verdier.id, status: "contract_signed", changedByUserId: plannerId });
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, status: "paid_off", changedByUserId: plannerId });
    expect((await listEventVendorSlots(organizationId, eventId)).find((slot) => slot.id === caterer.id)).toMatchObject({ status: "paid_off", retainedVendors: [expect.objectContaining({ candidateId: verdier.id })] });

    // Le devis du prestataire retenu change : l'engagement est republié.
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, quoteAmountCents: 530000, changedByUserId: plannerId });
    const published = await withDb((db) =>
      withOrganization(db, organizationId, (tx) =>
        tx.select().from(domainEvents).where(and(eq(domainEvents.organizationId, organizationId), eq(domainEvents.name, EVT_VENDOR_SLOT_BOOKED))),
      ),
    );
    expect(published.map((event) => (event.payload as { amountCents: number }).amountCents).sort()).toEqual([512000, 530000]);
  });

  it("un devis joint est vérifié et rangé dans le stockage privé ; un fichier d'un autre format est refusé", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });

    await attachVendorCandidateQuote({ organizationId, candidateId: verdier.id, content: TINY_PDF });
    const file = await getVendorCandidateQuoteFile(organizationId, verdier.id);
    expect(file.contentType).toBe("application/pdf");
    expect(file.fileName).toBe("devis-Maison-Verdier.pdf");
    expect((await listVendorCandidates(organizationId, eventId))[0]).toMatchObject({ hasQuoteFile: true, status: "quote_received" });

    await expect(attachVendorCandidateQuote({ organizationId, candidateId: verdier.id, content: Buffer.from("<html></html>") })).rejects.toMatchObject({
      name: "CandidateQuoteRejectedError",
    });
  });

  it("le brief du poste et la suppression d'un consulté", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    await setVendorSlotBrief(organizationId, caterer.id, "  Buffet assis, produits de saison  ");
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
    await selectVendorCandidate({ organizationId, candidateId: verdier.id, changedByUserId: plannerId });

    await removeVendorCandidate(organizationId, verdier.id);

    const slot = (await listEventVendorSlots(organizationId, eventId)).find((candidate) => candidate.id === caterer.id);
    expect(slot).toMatchObject({ brief: "Buffet assis, produits de saison", retainedVendors: [] });
    expect(await listVendorCandidates(organizationId, eventId)).toEqual([]);
  });

  it("une autre organisation ne voit ni ne modifie les consultés", async () => {
    const organizationId = await newOrganization();
    const otherId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });

    expect(await listVendorCandidates(otherId, eventId)).toEqual([]);
    await expect(updateVendorCandidate({ organizationId: otherId, candidateId: verdier.id, quoteAmountCents: 1 })).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    await expect(selectVendorCandidate({ organizationId: otherId, candidateId: verdier.id, changedByUserId: plannerId })).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    await expect(addVendorCandidate({ organizationId: otherId, eventId, vendorSlotId: caterer.id, vendorName: "Intrus" })).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
  });
});

describe("L11-EVT-11 — Notes et options montrées aux clients", () => {
  it("les clients voient seulement les consultés montrés, avec les notes « Clients », et leur devis", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
    const hidden = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Saveurs & Sens" });
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, quoteAmountCents: 512000, shownToClients: true });
    await attachVendorCandidateQuote({ organizationId, candidateId: verdier.id, content: TINY_PDF });
    await attachVendorCandidateQuote({ organizationId, candidateId: hidden.id, content: TINY_PDF });
    await addVendorCandidateNote({ organizationId, candidateId: verdier.id, body: "Uniquement des produits frais", visibleToClients: true, createdByUserId: plannerId });
    await addVendorCandidateNote({ organizationId, candidateId: verdier.id, body: "Négociable à 60 €", visibleToClients: false, createdByUserId: plannerId });
    const clientId = await invitedClient(organizationId, eventId);

    expect(await getLinkVendorOptions(organizationId, clientId)).toEqual([
      {
        slotLabel: "Traiteur",
        options: [{ candidateId: verdier.id, vendorName: "Maison Verdier", quoteAmountCents: 512000, hasQuoteFile: true, notes: ["Uniquement des produits frais"], ribShared: false }],
      },
    ]);
    expect((await getLinkVendorQuoteFile(organizationId, clientId, verdier.id)).contentType).toBe("application/pdf");
    await expect(getLinkVendorQuoteFile(organizationId, clientId, hidden.id)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
  });

  it("un client d'un autre événement n'a accès à rien", async () => {
    const organizationId = await newOrganization();
    const first = await eventWithCaterer(organizationId);
    const source = await createProspectSource(organizationId, "Bouche-à-oreille");
    const other = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Paul", lastName: null }] });
    const verdier = await addVendorCandidate({ organizationId, eventId: first.eventId, vendorSlotId: first.caterer.id, vendorName: "Maison Verdier" });
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, shownToClients: true });
    const otherClientId = await invitedClient(organizationId, other.id);

    // Lot 26a : le lien ne voit que son événement ; un fichier d'un autre répond comme inexistant.
    expect(await getLinkVendorOptions(organizationId, otherClientId)).toEqual([]);
    await expect(getLinkVendorQuoteFile(organizationId, otherClientId, verdier.id)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
  });
});

describe("L12-EVT-16 — RIB d'un prestataire partagé aux clients", () => {
  it("le RIB de la fiche n'est servi aux clients que si l'option est montrée et le RIB partagé", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const { vendor } = await createVendor(organizationId, { name: "Maison Verdier", typeId: null });
    await attachVendorFile({ organizationId, vendorId: vendor.id, kind: "rib", fileName: "rib.pdf", content: TINY_PDF, uploadedByUserId: plannerId });
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier", vendorId: vendor.id });
    const clientId = await invitedClient(organizationId, eventId);

    // Montré mais RIB non partagé : rien.
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, shownToClients: true });
    expect((await getLinkVendorOptions(organizationId, clientId))[0]!.options[0]!.ribShared).toBe(false);
    await expect(getLinkSharedRibVendorId(organizationId, clientId, verdier.id)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);

    // Partagé : le lien apparaît et le fichier est servi.
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, shareRibWithClients: true });
    expect((await listVendorCandidates(organizationId, eventId)).find((c) => c.id === verdier.id)!.shareRibWithClients).toBe(true);
    expect((await getLinkVendorOptions(organizationId, clientId))[0]!.options[0]!.ribShared).toBe(true);
    const vendorId = await getLinkSharedRibVendorId(organizationId, clientId, verdier.id);
    expect((await getVendorRibFile(organizationId, vendorId)).contentType).toBe("application/pdf");

    // Plus montré : plus servi.
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, shownToClients: false });
    await expect(getLinkSharedRibVendorId(organizationId, clientId, verdier.id)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
  });

  it("un consulté sans fiche du carnet ne peut pas partager de RIB ; un client d'un autre événement n'y a pas accès", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const free = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Sans fiche" });
    await updateVendorCandidate({ organizationId, candidateId: free.id, shownToClients: true, shareRibWithClients: true });
    expect((await listVendorCandidates(organizationId, eventId)).find((c) => c.id === free.id)!.shareRibWithClients).toBe(false);

    const source = await createProspectSource(organizationId, "Salon 2");
    const other = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Paul", lastName: null }] });
    const otherClientId = await invitedClient(organizationId, other.id);
    await expect(getLinkSharedRibVendorId(organizationId, otherClientId, free.id)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    // Un lien retiré n'ouvre plus rien.
    await revokeEventLink(organizationId, otherClientId);
    await expect(getLinkVendorOptions(organizationId, otherClientId)).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });
});

describe("L11-PRE-09 — Consultations d'une fiche du carnet", () => {
  it("liste les événements où la fiche a été consultée, avec l'issue, et les fiches déjà retenues", async () => {
    const organizationId = await newOrganization();
    const vendorId = randomUUID();
    const a = await eventWithCaterer(organizationId);
    const b = await eventWithCaterer(organizationId);
    const retained = await addVendorCandidate({ organizationId, eventId: a.eventId, vendorSlotId: a.caterer.id, vendorName: "Maison Verdier", vendorId });
    await updateVendorCandidate({ organizationId, candidateId: retained.id, quoteAmountCents: 350000 });
    await selectVendorCandidate({ organizationId, candidateId: retained.id, changedByUserId: plannerId });
    await addVendorCandidate({ organizationId, eventId: b.eventId, vendorSlotId: b.caterer.id, vendorName: "Maison Verdier", vendorId });

    const consultations = await listVendorConsultations(organizationId, vendorId);
    expect(consultations.map((entry) => [entry.eventId, entry.slotLabel, entry.outcome, entry.quotedCents]).sort()).toEqual(
      [
        [a.eventId, "Traiteur", "selected", 350000],
        [b.eventId, "Traiteur", "pending", null],
      ].sort(),
    );
    expect(consultations.every((entry) => entry.eventNames === "Inès")).toBe(true);
    expect(await listSelectedVendorIds(organizationId)).toEqual([vendorId]);
  });
});
