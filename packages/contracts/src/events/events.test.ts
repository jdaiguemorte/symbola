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
} from "./events";

const FROZEN_CREATED_PAYLOAD = {
  eventId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
  status: "prospect",
};

const FROZEN_STATUS_CHANGED_PAYLOAD = {
  eventId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
  fromStatus: "prospect",
  toStatus: "confirmed",
  changedByUserId: "9a3a6b1f-7e2a-4c9a-9a3a-6b1f7e2a7e3a",
};

describe("SOC-06 — Contrat de l'événement events.event.created", () => {
  it("accepte l'exemple figé avec le schéma courant", () => {
    expect(() => eventCreatedPayloadSchema.parse(FROZEN_CREATED_PAYLOAD)).not.toThrow();
  });

  it("garde le nom et la version attendus", () => {
    expect(EVT_EVENT_CREATED).toBe("events.event.created");
    expect(EVT_EVENT_CREATED_VERSION).toBe(1);
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
    expect(EVT_EVENT_STATUS_CHANGED_VERSION).toBe(1);
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
