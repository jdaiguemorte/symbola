// Lot 32a (HUB-08, UX-06, EVT-02 ; décisions D4 et D6) — sources des urgences propres au module
// Évènements, contre un vrai PostgreSQL (RLS) : décisions du client en attente, prestataires retenus
// sans contrat signé, relance d'un prestataire inscrite dans l'activité ; abus d'une autre
// organisation et d'un autre évènement.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import {
  addEventVendorSlot,
  addVendorCandidate,
  changeEventStatus,
  createProspect,
  createProspectSource,
  listEventActivity,
  listLastVendorReminders,
  listVendorCandidates,
  listPendingDecisions,
  listUncontractedVendors,
  recordVendorReminder,
  removeVendorCandidate,
  requestDecision,
  updateVendorCandidate,
  VendorCandidateNotFoundError,
  withdrawDecision,
} from "./service";

const plannerId = randomUUID();
const TODAY = "2027-04-05";

async function atelier() {
  const organizationId = (await createOrganization(appDatabase(), `Atelier ${randomUUID().slice(0, 6)}`)).id;
  const source = await createProspectSource(organizationId, "Salon");
  const wedding = async (firstName: string, eventDate: string | null) =>
    (await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName, lastName: "Martin" }], ...(eventDate ? { eventDate } : {}) })).id;
  return { organizationId, wedding };
}

describe("HUB-08 / UX-06 — Décisions du client en attente, pour toute l'organisation (lot 32a)", () => {
  it("seules les demandes sans réponse, de chaque évènement, avec leur échéance et leur date de demande ; une autre organisation n'en voit aucune", async () => {
    const { organizationId, wedding } = await atelier();
    const lea = await wedding("Léa", "2027-06-12");
    const ines = await wedding("Inès", "2027-07-03");
    // Une demande d'options : deux prestataires montrés au client.
    const optionDecision = async (eventId: string, label: string, dueOn?: string) => {
      const slot = await addEventVendorSlot(organizationId, eventId, label);
      for (const vendorName of [`${label} A`, `${label} B`]) {
        const created = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot.id, vendorName });
        await updateVendorCandidate({ organizationId, candidateId: created.id, shownToClients: true });
      }
      return requestDecision({ organizationId, eventId, requestedByUserId: plannerId, kind: "option", slotId: slot.id, ...(dueOn ? { dueOn } : {}) });
    };
    const pending = await optionDecision(lea, "Fleuriste", "2027-04-09");
    const program = await optionDecision(ines, "Traiteur");
    await withdrawDecision(organizationId, program.id);

    const decisions = await listPendingDecisions(organizationId);
    expect(decisions.map((decision) => [decision.id, decision.eventId, decision.title, decision.dueOn])).toEqual([[pending.id, lea, "Fleuriste", "2027-04-09"]]);
    expect(decisions[0]!.requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const other = await atelier();
    expect(await listPendingDecisions(other.organizationId)).toEqual([]);
  });
});

describe("UX-06 / EVT-02 — Prestataires retenus sans contrat signé (lot 32a, D6)", () => {
  it("retenu sans contrat, sur un évènement en cours : oui ; contrat signé, consulté, évènement passé ou perdu : non", async () => {
    const { organizationId, wedding } = await atelier();
    const lea = await wedding("Léa", "2027-06-12");
    const past = await wedding("Ancien", "2027-01-10");
    const lost = await wedding("Perdu", "2027-08-01");
    const slot = async (eventId: string, label: string) => (await addEventVendorSlot(organizationId, eventId, label)).id;
    const candidate = async (eventId: string, slotId: string, vendorName: string, status: "contacted" | "retained" | "contract_signed") => {
      const created = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slotId, vendorName });
      await updateVendorCandidate({ organizationId, candidateId: created.id, status, changedByUserId: plannerId });
      return created.id;
    };
    const photo = await slot(lea, "Photographe");
    const studio = await candidate(lea, photo, "Studio Lumière", "retained");
    await candidate(lea, await slot(lea, "Traiteur"), "Maison Haddad", "contract_signed");
    await candidate(lea, await slot(lea, "DJ"), "Son et Lumière", "contacted");
    await candidate(past, await slot(past, "Photographe"), "Ancien studio", "retained");
    await candidate(lost, await slot(lost, "Photographe"), "Studio perdu", "retained");
    await changeEventStatus({ organizationId, eventId: lost, changedByUserId: plannerId, toStatus: "cancelled", lossReasonId: null, lossReasonNote: "Choix d'un autre planner" });

    const vendors = await listUncontractedVendors(organizationId, TODAY);
    expect(vendors.map((vendor) => [vendor.candidateId, vendor.eventId, vendor.vendorName, vendor.slotLabel])).toEqual([[studio, lea, "Studio Lumière", "Photographe"]]);
    expect(vendors[0]!.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const other = await atelier();
    expect(await listUncontractedVendors(other.organizationId, TODAY)).toEqual([]);
  });

  it("une relance s'inscrit dans l'activité de l'évènement, au nom du prestataire, sans copie de ce nom ; jamais pour le prestataire d'un autre évènement ou d'une autre organisation", async () => {
    const { organizationId, wedding } = await atelier();
    const lea = await wedding("Léa", "2027-06-12");
    const ines = await wedding("Inès", "2027-07-03");
    const photo = await addEventVendorSlot(organizationId, lea, "Photographe");
    const studio = await addVendorCandidate({ organizationId, eventId: lea, vendorSlotId: photo.id, vendorName: "Studio Lumière" });
    await updateVendorCandidate({ organizationId, candidateId: studio.id, status: "retained", changedByUserId: plannerId });

    expect(await recordVendorReminder({ organizationId, eventId: lea, candidateId: studio.id, userId: plannerId })).toMatchObject({ vendorName: "Studio Lumière", vendorId: null });
    const activity = await listEventActivity(organizationId, lea);
    expect(activity.map((entry) => [entry.kind, entry.taskLabel])).toEqual([["vendor_reminded", "Studio Lumière"]]);

    await expect(recordVendorReminder({ organizationId, eventId: ines, candidateId: studio.id, userId: plannerId })).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    const other = await atelier();
    await expect(recordVendorReminder({ organizationId: other.organizationId, eventId: lea, candidateId: studio.id, userId: plannerId })).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    expect(await listEventActivity(organizationId, ines)).toEqual([]);

    // RGPD (RGP-05) : le nom n'est pas recopié dans l'activité ; il se lit sur le prestataire, et
    // disparaît avec lui (retrait, demande d'oubli).
    await removeVendorCandidate(organizationId, studio.id);
    expect((await listEventActivity(organizationId, lea)).map((entry) => [entry.kind, entry.taskLabel])).toEqual([["vendor_reminded", ""]]);
  });
});

describe("PRE-02, HUB-08 — Lot 65d : « Noter une relance » (M16)", () => {
  async function retained() {
    const { organizationId, wedding } = await atelier();
    const lea = await wedding("Léa", "2027-06-12");
    const photo = await addEventVendorSlot(organizationId, lea, "Photographe");
    const studio = await addVendorCandidate({ organizationId, eventId: lea, vendorSlotId: photo.id, vendorName: "Studio Lumière" });
    await updateVendorCandidate({ organizationId, candidateId: studio.id, status: "retained", changedByUserId: plannerId });
    return { organizationId, lea, studio };
  }
  const pending = async (organizationId: string, today: string) => (await listUncontractedVendors(organizationId, today)).map((vendor) => vendor.vendorName);

  it("le prestataire relancé quitte « Aujourd'hui » jusqu'au rappel : absent la veille du rappel, de retour le jour même et le lendemain", async () => {
    const { organizationId, lea, studio } = await retained();
    expect(await pending(organizationId, TODAY)).toEqual(["Studio Lumière"]);
    await recordVendorReminder({ organizationId, eventId: lea, candidateId: studio.id, userId: plannerId, channel: "phone", remindedOn: TODAY, recallOn: "2027-04-08", today: TODAY });
    expect(await pending(organizationId, TODAY)).toEqual([]);
    expect(await pending(organizationId, "2027-04-07")).toEqual([]);
    expect(await pending(organizationId, "2027-04-08")).toEqual(["Studio Lumière"]);
    expect(await pending(organizationId, "2027-04-09")).toEqual(["Studio Lumière"]);
  });

  it("sans rappel, il reste dans « Aujourd'hui » ; la dernière relance garde son moyen et sa date ; la note va aux notes internes", async () => {
    const { organizationId, lea, studio } = await retained();
    await recordVendorReminder({ organizationId, eventId: lea, candidateId: studio.id, userId: plannerId, channel: "email", remindedOn: "2027-04-01", recallOn: null, today: TODAY });
    await recordVendorReminder({ organizationId, eventId: lea, candidateId: studio.id, userId: plannerId, channel: "in_person", remindedOn: "2027-04-04", recallOn: null, note: "  Contrat promis pour vendredi.  ", today: TODAY });
    expect(await pending(organizationId, TODAY)).toEqual(["Studio Lumière"]);
    expect((await listLastVendorReminders(organizationId, lea)).get(studio.id)).toEqual({ remindedOn: "2027-04-04", channel: "in_person", recallOn: null });
    const candidate = (await listVendorCandidates(organizationId, lea)).find((entry) => entry.id === studio.id)!;
    expect(candidate.notes.map((note) => [note.body, note.visibleToClients])).toEqual([["Contrat promis pour vendredi.", false]]);
    expect((await listEventActivity(organizationId, lea)).map((entry) => entry.kind)).toEqual(["vendor_reminded", "vendor_reminded"]);
  });

  it("refuse une relance future, un rappel avant la relance ou un moyen inconnu ; abus : jamais pour une autre organisation", async () => {
    const { organizationId, lea, studio } = await retained();
    await expect(recordVendorReminder({ organizationId, eventId: lea, candidateId: studio.id, userId: plannerId, remindedOn: "2027-04-06", today: TODAY })).rejects.toBeInstanceOf(RangeError);
    await expect(recordVendorReminder({ organizationId, eventId: lea, candidateId: studio.id, userId: plannerId, remindedOn: TODAY, recallOn: "2027-04-04", today: TODAY })).rejects.toBeInstanceOf(RangeError);
    await expect(recordVendorReminder({ organizationId, eventId: lea, candidateId: studio.id, userId: plannerId, channel: "pigeon" as "phone", today: TODAY })).rejects.toBeInstanceOf(RangeError);
    const other = await atelier();
    await expect(recordVendorReminder({ organizationId: other.organizationId, eventId: lea, candidateId: studio.id, userId: plannerId, channel: "phone", recallOn: "2027-04-10", today: TODAY })).rejects.toBeInstanceOf(VendorCandidateNotFoundError);
    expect((await listLastVendorReminders(other.organizationId, lea)).size).toBe(0);
    expect((await listLastVendorReminders(organizationId, lea)).size).toBe(0);
    expect(await pending(organizationId, TODAY)).toEqual(["Studio Lumière"]);
  });
});
