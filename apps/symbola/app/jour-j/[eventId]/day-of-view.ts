// Lot 29a (JRJ-02, décision D5) — ce que montre l'écran du jour J : le programme du jour
// (avec notes internes et participants), les lieux, les prestataires retenus et les
// clients avec leurs coordonnées. Ni montants, ni budget, ni tâches.
import type { EventDetail, EventPlace, EventProgram, EventStatus, EventVendorSlot, VendorCandidate } from "@/modules/events/service";
import type { VendorContact } from "@/modules/vendors/service";

// L'écran existe pour un évènement confirmé et daté, et encore le lendemain une fois
// l'évènement passé en « réalisé ».
export const DAY_OF_STATUSES: readonly EventStatus[] = ["confirmed", "done"];

export function isDayOfOpen(event: Pick<EventDetail, "status" | "eventDate">): event is Pick<EventDetail, "status"> & { eventDate: string } {
  return DAY_OF_STATUSES.includes(event.status) && event.eventDate !== null;
}

export type DayOfPerson = { name: string; detail: string | null; phone: string | null; email: string | null };
export type DayOfVendor = DayOfPerson & { id: string; slot: string };
export type DayOfParticipant = { label: string; vendors: string[] };
export type DayOfItem = {
  id: string;
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  note: string | null;
  participants: DayOfParticipant[];
  // Lot 30a (JRJ-03, D5) : prestataires retenus de la séquence qui ont un téléphone.
  calls: { name: string; phone: string }[];
};
export type DayOfPlace = { id: string; label: string; address: string | null };
export type DayOfView = { items: DayOfItem[]; places: DayOfPlace[]; vendors: DayOfVendor[]; clients: DayOfPerson[] };

// Lien d'appel : chiffres et « + » seulement ; rien si le numéro n'en a presque pas.
export function telHref(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return digits.replace(/\+/g, "").length >= 3 ? `tel:${digits}` : null;
}

export function buildDayOfView(input: {
  event: Pick<EventDetail, "clients">;
  program: EventProgram;
  places: EventPlace[];
  slots: EventVendorSlot[];
  candidates: VendorCandidate[];
  // null : module Prestataires non souscrit (dégradation propre) ; les noms restent.
  contacts: VendorContact[] | null;
}): DayOfView {
  const contactById = new Map((input.contacts ?? []).map((contact) => [contact.id, contact]));
  const slotPosition = new Map(input.slots.map((slot, index) => [slot.id, index]));
  const slotLabel = new Map(input.slots.map((slot) => [slot.id, slot.label]));
  const retained = input.candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.outcome === "selected" && slotPosition.has(candidate.vendorSlotId))
    .sort((a, b) => slotPosition.get(a.candidate.vendorSlotId)! - slotPosition.get(b.candidate.vendorSlotId)! || a.index - b.index)
    .map(({ candidate }) => candidate);

  const vendors: DayOfVendor[] = retained.map((candidate) => {
    const contact = candidate.vendorId ? contactById.get(candidate.vendorId) : undefined;
    return {
      id: candidate.id,
      slot: slotLabel.get(candidate.vendorSlotId)!,
      name: contact?.name ?? candidate.vendorName,
      detail: contact?.contactName ?? null,
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
    };
  });

  const namesBySlot = new Map<string, string[]>();
  const callsBySlot = new Map<string, { name: string; phone: string }[]>();
  for (const candidate of retained) {
    const contact = candidate.vendorId ? contactById.get(candidate.vendorId) : undefined;
    const name = contact?.name ?? candidate.vendorName;
    namesBySlot.set(candidate.vendorSlotId, [...(namesBySlot.get(candidate.vendorSlotId) ?? []), name]);
    if (contact?.phone && telHref(contact.phone)) callsBySlot.set(candidate.vendorSlotId, [...(callsBySlot.get(candidate.vendorSlotId) ?? []), { name, phone: contact.phone }]);
  }

  return {
    items: input.program.items.map((item) => ({
      id: item.id,
      startTime: item.startTime,
      endTime: item.endTime,
      label: item.label,
      location: item.location,
      note: item.internalNote,
      participants: item.participants.map((participant) => ({
        label: participant.label,
        vendors: participant.vendorSlotId ? (namesBySlot.get(participant.vendorSlotId) ?? []) : [],
      })),
      calls: item.participants.flatMap((participant) => (participant.vendorSlotId ? (callsBySlot.get(participant.vendorSlotId) ?? []) : [])),
    })),
    places: input.places.map((place) => ({ id: place.id, label: place.label, address: place.address })),
    vendors,
    clients: input.event.clients.map((client) => ({
      name: [client.firstName, client.lastName].filter(Boolean).join(" "),
      detail: null,
      phone: client.phone,
      email: client.email,
    })),
  };
}
