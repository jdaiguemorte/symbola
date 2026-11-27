// SOC-06 — étant donné une modification incompatible des schémas du
// module events, ce test échoue : les exemples figés représentent des
// charges utiles réellement publiables avec la version actuelle.
import { describe, expect, it } from "vitest";
import {
  EVT_EVENT_CREATED,
  EVT_EVENT_CREATED_VERSION,
  EVT_EVENT_STATUS_CHANGED,
  EVT_EVENT_STATUS_CHANGED_VERSION,
  eventCreatedPayloadSchema,
  eventStatusChangedPayloadSchema,
  eventStatusFromV1,
  readEventStatusChanged,
  EVT_VENDOR_SLOT_BOOKED,
  EVT_VENDOR_SLOT_BOOKED_VERSION,
  vendorSlotBookedPayloadSchema,
  EVENT_STATUSES,
} from "./events";
import { EVENT_STATUS_CHOICES } from "../import/fields";

const FROZEN_CREATED_PAYLOAD = {
  eventId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
  status: "option",
};

const FROZEN_STATUS_CHANGED_PAYLOAD = {
  eventId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
  fromStatus: "option",
  toStatus: "confirmed",
  changedByUserId: "9a3a6b1f-7e2a-4c9a-9a3a-6b1f7e2a7e3a",
};

describe("SOC-06 — Contrat de l'événement events.event.created", () => {
  it("accepte l'exemple figé avec le schéma courant", () => {
    expect(() => eventCreatedPayloadSchema.parse(FROZEN_CREATED_PAYLOAD)).not.toThrow();
  });

  it("garde le nom et la version attendus", () => {
    expect(EVT_EVENT_CREATED).toBe("events.event.created");
    expect(EVT_EVENT_CREATED_VERSION).toBe(2);
  });

  it("refuse un statut inconnu", () => {
    expect(() => eventCreatedPayloadSchema.parse({ ...FROZEN_CREATED_PAYLOAD, status: "autre" })).toThrow();
  });
});

describe("SOC-06 — Contrat de l'événement events.event.status_changed", () => {
  it("accepte l'exemple figé avec le schéma courant", () => {
    expect(() => eventStatusChangedPayloadSchema.parse(FROZEN_STATUS_CHANGED_PAYLOAD)).not.toThrow();
  });

  it("garde le nom et la version attendus", () => {
    expect(EVT_EVENT_STATUS_CHANGED).toBe("events.event.status_changed");
    expect(EVT_EVENT_STATUS_CHANGED_VERSION).toBe(2);
  });

  it("accepte fromStatus nul (création directe à un statut)", () => {
    expect(() =>
      eventStatusChangedPayloadSchema.parse({ ...FROZEN_STATUS_CHANGED_PAYLOAD, fromStatus: null }),
    ).not.toThrow();
  });

  it("refuse un changedByUserId qui n'est pas un UUID", () => {
    expect(() =>
      eventStatusChangedPayloadSchema.parse({ ...FROZEN_STATUS_CHANGED_PAYLOAD, changedByUserId: "pas-un-uuid" }),
    ).toThrow();
  });
});

// Lot 72a (J1, ADR 0121) : « En préparation » est retiré ; le journal déjà écrit reste lisible.
describe("EVT-05 — Statut « En préparation » retiré, journal lisible (lot 72a, J1)", () => {
  it("un événement publié avec in_preparation se lit « confirmed »", () => {
    const payload = eventStatusChangedPayloadSchema.parse({ ...FROZEN_STATUS_CHANGED_PAYLOAD, fromStatus: "confirmed", toStatus: "in_preparation" });
    expect(payload.toStatus).toBe("confirmed");
    expect(readEventStatusChanged(2, { ...FROZEN_STATUS_CHANGED_PAYLOAD, fromStatus: "in_preparation", toStatus: "closed" }).fromStatus).toBe("confirmed");
    expect(eventCreatedPayloadSchema.parse({ ...FROZEN_CREATED_PAYLOAD, status: "in_preparation" }).status).toBe("confirmed");
  });

  it("la liste des statuts ne le propose plus", () => {
    expect(EVENT_STATUSES).not.toContain("in_preparation");
    expect(EVENT_STATUS_CHOICES).not.toContain("in_preparation");
  });
});

const FROZEN_VENDOR_SLOT_BOOKED_PAYLOAD = {
  eventId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
  vendorSlotId: "7e3a6b1f-7e2a-4c9a-9a3a-6b1f7e2a7e3a",
  label: "Photographe",
  amountCents: 250000,
  currency: "EUR",
  bookedByUserId: "9a3a6b1f-7e2a-4c9a-9a3a-6b1f7e2a7e3a",
};

describe("PRD-EVT-03 — Contrat de l'événement events.vendor_slot.booked", () => {
  it("accepte l'exemple figé avec le schéma courant", () => {
    expect(() => vendorSlotBookedPayloadSchema.parse(FROZEN_VENDOR_SLOT_BOOKED_PAYLOAD)).not.toThrow();
  });

  it("garde le nom et la version attendus", () => {
    expect(EVT_VENDOR_SLOT_BOOKED).toBe("events.vendor_slot.booked");
    // Lot 28b (PRE-02) : version 2, ajout compatible du prestataire retenu.
    expect(EVT_VENDOR_SLOT_BOOKED_VERSION).toBe(2);
  });

  it("lot 28b — accepte le prestataire retenu (version 2), et toujours un événement de version 1 sans lui", () => {
    expect(vendorSlotBookedPayloadSchema.parse({ ...FROZEN_VENDOR_SLOT_BOOKED_PAYLOAD, candidateId: "8b1f8f9e-1a2b-4c3d-9e8f-001122334455" }).candidateId).toBe(
      "8b1f8f9e-1a2b-4c3d-9e8f-001122334455",
    );
    expect(vendorSlotBookedPayloadSchema.parse(FROZEN_VENDOR_SLOT_BOOKED_PAYLOAD).candidateId).toBeUndefined();
    expect(() => vendorSlotBookedPayloadSchema.parse({ ...FROZEN_VENDOR_SLOT_BOOKED_PAYLOAD, candidateId: "pas-un-uuid" })).toThrow();
  });

  it("accepte un poste réservé sans montant", () => {
    expect(() =>
      vendorSlotBookedPayloadSchema.parse({ ...FROZEN_VENDOR_SLOT_BOOKED_PAYLOAD, amountCents: null }),
    ).not.toThrow();
  });

  it("refuse un montant qui n'est pas un entier de centimes", () => {
    expect(() =>
      vendorSlotBookedPayloadSchema.parse({ ...FROZEN_VENDOR_SLOT_BOOKED_PAYLOAD, amountCents: 2500.5 }),
    ).toThrow();
  });

  it("ne transporte jamais le nom du prestataire (donnée potentiellement personnelle)", () => {
    const parsed = vendorSlotBookedPayloadSchema.parse({ ...FROZEN_VENDOR_SLOT_BOOKED_PAYLOAD, vendorName: "Jean Dupont" });
    expect(parsed).not.toHaveProperty("vendorName");
  });
});

describe("EVT-05 — Version 2 des statuts (lot 34a, D2) : un événement de version 1 reste lisible", () => {
  it("traduit les statuts de la version 1 : prospect et devis envoyé en Option, réalisé en Clôturé, perdu en Annulé", () => {
    expect(["prospect", "quote_sent", "confirmed", "done", "lost"].map((status) => eventStatusFromV1(status as "prospect"))).toEqual(["option", "option", "confirmed", "closed", "cancelled"]);
    expect(readEventStatusChanged(1, { ...FROZEN_STATUS_CHANGED_PAYLOAD, fromStatus: "quote_sent", toStatus: "lost" })).toMatchObject({ fromStatus: "option", toStatus: "cancelled" });
    expect(readEventStatusChanged(2, FROZEN_STATUS_CHANGED_PAYLOAD)).toEqual(FROZEN_STATUS_CHANGED_PAYLOAD);
    expect(() => readEventStatusChanged(2, { ...FROZEN_STATUS_CHANGED_PAYLOAD, toStatus: "lost" })).toThrow();
  });
});
