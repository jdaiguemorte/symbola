import { describe, expect, it } from "vitest";
import { APPOINTMENTS_APPOINTMENT_BOOKED, APPOINTMENTS_APPOINTMENT_BOOKED_VERSION, appointmentBookedPayloadSchema } from "./events";

describe("RDV-04 — Évènement interne appointments.appointment.booked (D7)", () => {
  it("porte le nom <module>.<entité>.<action> au passé, en version 1", () => {
    expect(APPOINTMENTS_APPOINTMENT_BOOKED).toBe("appointments.appointment.booked");
    expect(APPOINTMENTS_APPOINTMENT_BOOKED_VERSION).toBe(1);
  });

  it("n'accepte que des identifiants, jamais de nom ni d'adresse e-mail", () => {
    const payload = {
      appointmentId: "6f1f7f0e-5d3c-4a8b-9a51-1f4d2a6c7b10",
      typeId: null,
      contactId: "0b6a3d8e-2c1f-4e5a-8b7d-9c0e1f2a3b4c",
      eventId: null,
      hostUserId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
      startsAt: "2027-03-02T09:00:00.000Z",
      origin: "public",
    };
    expect(appointmentBookedPayloadSchema.parse(payload)).toEqual(payload);
    expect(Object.keys(appointmentBookedPayloadSchema.parse({ ...payload, personEmail: "lea@example.test" }))).not.toContain("personEmail");
    expect(appointmentBookedPayloadSchema.safeParse({ ...payload, contactId: "lea@example.test" }).success).toBe(false);
  });
});
