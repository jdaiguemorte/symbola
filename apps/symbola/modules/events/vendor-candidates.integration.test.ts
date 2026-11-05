// Lot 11 (EVT-08 / EVT-09) — prestataires consultés pour un poste, contre
// un vrai PostgreSQL (RLS) et le stockage privé, par la porte d'entrée du
// module events.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization, login, requireUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { EVT_VENDOR_SLOT_BOOKED } from "@symbola/contracts";
import {
  acceptEventClientInvitation,
  addDefaultVendorSlots,
  addVendorCandidate,
  addVendorCandidateNote,
  attachVendorCandidateQuote,
  ClientVendorOptionsAccessDeniedError,
  createProspect,
  createProspectSource,
  getClientVendorOptions,
  getClientSharedRibVendorId,
  getClientVendorQuoteFile,
  getVendorCandidateQuoteFile,
  inviteEventClient,
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
const PASSWORD = "mot-de-passe-du-client";
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
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

async function invitedClient(organizationId: string, eventId: string) {
  const email = `client-${randomUUID()}@example.test`;
  const invitation = await inviteEventClient({ organizationId, eventId, email, invitedByUserId: plannerId, locale: "fr" });
  await acceptEventClientInvitation(invitation.invitationToken!, PASSWORD);
  const session = await withDb((db) => login(db, email, PASSWORD));
  if (session.outcome !== "success") throw new Error("connexion attendue");
  const auth = await withDb((db) => requireUser(db, session.sessionToken));
  if (auth.status !== "authenticated") throw new Error("session attendue");
  return auth.user.id;
}

describe("EVT-08 — Plusieurs prestataires consultés par poste", () => {
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
    expect(candidates.every((candidate) => candidate.response === "contacted" && candidate.outcome === null)).toBe(true);
  });

  it("le premier consulté passe le poste « À trouver » à « Devis demandé », un devis reçu à « Devis reçu »", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);

    const first = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
    expect((await listEventVendorSlots(organizationId, eventId)).find((slot) => slot.id === caterer.id)?.status).toBe("quote_requested");

    // Le formulaire renvoie la réponse affichée (« contacté ») avec le montant.
    await updateVendorCandidate({ organizationId, candidateId: first.id, response: "contacted", quoteAmountCents: 512000 });
    const [candidate] = await listVendorCandidates(organizationId, eventId);
    expect(candidate?.response).toBe("quote_received");
    expect((await listEventVendorSlots(organizationId, eventId)).find((slot) => slot.id === caterer.id)?.status).toBe("quote_received");
  });

  it("un poste réservé ou non requis ne change pas de statut quand on ajoute un consulté", async () => {
    const organizationId = await newOrganization();
    const { eventId, photographer } = await eventWithCaterer(organizationId);
    await updateEventVendorSlot({ organizationId, vendorSlotId: photographer.id, changedByUserId: plannerId, status: "not_required" });

    await addVendorCandidate({ organizationId, eventId, vendorSlotId: photographer.id, vendorName: "Studio Lumière" });

    expect((await listEventVendorSlots(organizationId, eventId)).find((slot) => slot.id === photographer.id)?.status).toBe("not_required");
  });

  it("« Retenir » réserve le poste avec ce prestataire et le montant de son devis, publie la réservation, et les autres deviennent « non retenu »", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
    const tables = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Les Tables de Flandre" });
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, quoteAmountCents: 512000 });
    await updateVendorCandidate({ organizationId, candidateId: tables.id, quoteAmountCents: 448000 });

    await selectVendorCandidate({ organizationId, candidateId: tables.id, changedByUserId: plannerId });

    const slot = (await listEventVendorSlots(organizationId, eventId)).find((candidate) => candidate.id === caterer.id);
    expect(slot).toMatchObject({ status: "booked", vendorName: "Les Tables de Flandre", amountCents: 448000, selectedCandidateId: tables.id });
    const outcomes = Object.fromEntries((await listVendorCandidates(organizationId, eventId)).map((candidate) => [candidate.vendorName, candidate.outcome]));
    expect(outcomes).toEqual({ "Maison Verdier": "not_selected", "Les Tables de Flandre": "selected" });
    const published = await withDb((db) =>
      withOrganization(db, organizationId, (tx) =>
        tx.select().from(domainEvents).where(and(eq(domainEvents.organizationId, organizationId), eq(domainEvents.name, EVT_VENDOR_SLOT_BOOKED))),
      ),
    );
    expect(published.map((event) => (event.payload as { amountCents: number }).amountCents)).toEqual([448000]);
  });

  it("le poste repassé à la main hors « Réservé » n'a plus de consulté retenu", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
    await selectVendorCandidate({ organizationId, candidateId: verdier.id, changedByUserId: plannerId });

    await updateEventVendorSlot({ organizationId, vendorSlotId: caterer.id, changedByUserId: plannerId, status: "quote_received" });

    expect((await listVendorCandidates(organizationId, eventId))[0]?.outcome).toBeNull();
  });

  it("un devis joint est vérifié et rangé dans le stockage privé ; un fichier d'un autre format est refusé", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });

    await attachVendorCandidateQuote({ organizationId, candidateId: verdier.id, content: TINY_PDF });
    const file = await getVendorCandidateQuoteFile(organizationId, verdier.id);
    expect(file.contentType).toBe("application/pdf");
    expect(file.fileName).toBe("devis-Maison-Verdier.pdf");
    expect((await listVendorCandidates(organizationId, eventId))[0]).toMatchObject({ hasQuoteFile: true, response: "quote_received" });

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
    expect(slot).toMatchObject({ brief: "Buffet assis, produits de saison", selectedCandidateId: null });
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

describe("EVT-09 — Notes et options montrées aux clients", () => {
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

    expect(await getClientVendorOptions(organizationId, clientId, eventId)).toEqual([
      {
        slotLabel: "Traiteur",
        options: [{ candidateId: verdier.id, vendorName: "Maison Verdier", quoteAmountCents: 512000, hasQuoteFile: true, notes: ["Uniquement des produits frais"], ribShared: false }],
      },
    ]);
    expect((await getClientVendorQuoteFile(organizationId, clientId, eventId, verdier.id)).contentType).toBe("application/pdf");
    await expect(getClientVendorQuoteFile(organizationId, clientId, eventId, hidden.id)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
  });

  it("un client d'un autre événement n'a accès à rien", async () => {
    const organizationId = await newOrganization();
    const first = await eventWithCaterer(organizationId);
    const source = await createProspectSource(organizationId, "Bouche-à-oreille");
    const other = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Paul", lastName: null }] });
    const verdier = await addVendorCandidate({ organizationId, eventId: first.eventId, vendorSlotId: first.caterer.id, vendorName: "Maison Verdier" });
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, shownToClients: true });
    const otherClientId = await invitedClient(organizationId, other.id);

    await expect(getClientVendorOptions(organizationId, otherClientId, first.eventId)).rejects.toBeInstanceOf(ClientVendorOptionsAccessDeniedError);
    await expect(getClientVendorQuoteFile(organizationId, otherClientId, first.eventId, verdier.id)).rejects.toBeInstanceOf(ClientVendorOptionsAccessDeniedError);
    expect(await getClientVendorOptions(organizationId, otherClientId, other.id)).toEqual([]);
  });
});

describe("EVT-16 — RIB d'un prestataire partagé aux clients", () => {
  it("le RIB de la fiche n'est servi aux clients que si l'option est montrée et le RIB partagé", async () => {
    const organizationId = await newOrganization();
    const { eventId, caterer } = await eventWithCaterer(organizationId);
    const { vendor } = await createVendor(organizationId, { name: "Maison Verdier", typeId: null });
    await attachVendorFile({ organizationId, vendorId: vendor.id, kind: "rib", fileName: "rib.pdf", content: TINY_PDF, uploadedByUserId: plannerId });
    const verdier = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Maison Verdier", vendorId: vendor.id });
    const clientId = await invitedClient(organizationId, eventId);

    // Montré mais RIB non partagé : rien.
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, shownToClients: true });
    expect((await getClientVendorOptions(organizationId, clientId, eventId))[0]!.options[0]!.ribShared).toBe(false);
    await expect(getClientSharedRibVendorId(organizationId, clientId, eventId, verdier.id)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);

    // Partagé : le lien apparaît et le fichier est servi.
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, shareRibWithClients: true });
    expect((await listVendorCandidates(organizationId, eventId)).find((c) => c.id === verdier.id)!.shareRibWithClients).toBe(true);
    expect((await getClientVendorOptions(organizationId, clientId, eventId))[0]!.options[0]!.ribShared).toBe(true);
    const vendorId = await getClientSharedRibVendorId(organizationId, clientId, eventId, verdier.id);
    expect((await getVendorRibFile(organizationId, vendorId)).contentType).toBe("application/pdf");

    // Plus montré : plus servi.
    await updateVendorCandidate({ organizationId, candidateId: verdier.id, shownToClients: false });
    await expect(getClientSharedRibVendorId(organizationId, clientId, eventId, verdier.id)).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
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
    await expect(getClientSharedRibVendorId(organizationId, otherClientId, eventId, free.id)).rejects.toBeInstanceOf(ClientVendorOptionsAccessDeniedError);
  });
});

describe("PRE-09 — Consultations d'une fiche du carnet", () => {
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
