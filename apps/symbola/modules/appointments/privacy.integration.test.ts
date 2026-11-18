// Lot 46 (RGP-05, RGPD-01 à RGPD-05 ; question DPO-2, défaut prudent ; ADR 0083) — privacy/v1 du
// module Rendez-vous : trouver, exporter (fiches de la recherche), anonymiser et effacer une personne
// qui a pris rendez-vous ; purge selon la règle des prospects, horloge simulée.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, ensureMembership } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { ANONYMIZED } from "@symbola/privacy";
import { setModuleEnabled } from "@/modules/hub/service";
import { listPurgeCandidates } from "@/lib/privacy/purge";
import { searchPerson } from "@/lib/privacy/search";
import { appointmentsPrivacy, bookAppointment, createAppointmentType, describeManagedAppointment, getAppointment, saveAppointmentReport, saveAvailabilityRules } from "./service";

const MONDAY = new Date("2027-03-01T07:00:00Z");
const TEN = new Date("2027-03-01T09:00:00Z");

async function bookedPerson() {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID()}`)).id;
  await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "appointments", enabled: true });
  const host = await ensureMembership(db, { organizationId, email: `hote-${randomUUID()}@example.test`, role: "owner" });
  const type = await createAppointmentType(organizationId, { name: "Découverte", durationMinutes: 60, minNoticeMinutes: 0, questions: [{ id: "budget", label: "Budget", kind: "text", choices: [] }] }, host.userId);
  await saveAvailabilityRules(organizationId, host.userId, [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "18:00" })));
  const name = `Ines Morel${randomUUID().slice(0, 4)}`;
  const email = `ines-${randomUUID()}@example.test`;
  const result = await bookAppointment({ organizationId, typeId: type.id, startsAt: TEN, now: MONDAY, name, email, phone: "06 12 34 56 78", answers: { budget: "30 000 €" }, locale: "fr" });
  if (result.outcome !== "booked") throw new Error("réservation attendue");
  await saveAppointmentReport(organizationId, result.appointment.id, `Échange avec ${name} : budget serré.`);
  return { organizationId, name, email, appointmentId: result.appointment.id, token: result.manageToken };
}

describe("RGP-05 — privacy/v1 du module Rendez-vous", () => {
  it("trouve la personne par son nom, son e-mail ou son téléphone, avec ses réponses et la note du compte rendu", async () => {
    const booked = await bookedPerson();
    for (const terms of [{ name: booked.name }, { email: booked.email.toUpperCase() }, { phone: "0612345678" }]) {
      const records = await appointmentsPrivacy.find({ organizationId: booked.organizationId, terms });
      expect(records.map((record) => record.recordId)).toEqual([booked.appointmentId]);
      expect(records[0]!.fields).toMatchObject({ email: booked.email, answers: "Budget : 30 000 €" });
      expect(records[0]!.fields.reportNotes).toContain("budget serré");
    }
    const search = await searchPerson({ organizationId: booked.organizationId, terms: { email: booked.email } });
    expect(search!.records.some((record) => record.module === "appointments" && record.recordId === booked.appointmentId)).toBe(true);
    // Une autre organisation ne la trouve pas.
    const other = (await createOrganization(appDatabase(), `Autre ${randomUUID()}`)).id;
    expect(await appointmentsPrivacy.find({ organizationId: other, terms: { email: booked.email } })).toEqual([]);
  });

  it("l'oubli anonymise le rendez-vous, efface réponses et notes, annule un rendez-vous à venir et retire son lien", async () => {
    const booked = await bookedPerson();
    const input = { organizationId: booked.organizationId, records: [{ kind: "appointment", recordId: booked.appointmentId }], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 }, today: "2027-03-01" };
    expect(await appointmentsPrivacy.planErasure(input)).toEqual([{ kind: "appointment", recordId: booked.appointmentId, fate: "anonymized", legalBasis: null, keptUntil: null }]);
    await appointmentsPrivacy.erase(input);
    await appointmentsPrivacy.erase(input); // idempotent
    const after = await getAppointment(booked.organizationId, booked.appointmentId);
    expect(after).toMatchObject({ personName: ANONYMIZED, personEmail: null, personPhone: null, answers: [], status: "cancelled" });
    expect(await describeManagedAppointment(booked.token, MONDAY)).toBeNull();
    expect(await appointmentsPrivacy.find({ organizationId: booked.organizationId, terms: { name: booked.name } })).toEqual([]);
  });

  it("purge : une personne qui a seulement pris rendez-vous suit la règle des prospects (trois ans après son dernier échange)", async () => {
    const booked = await bookedPerson();
    const keys = async (day: string) => (await listPurgeCandidates(booked.organizationId, day)).filter((candidate) => candidate.key.startsWith("appointment:")).map((candidate) => candidate.key);
    expect(await keys("2030-02-28")).toEqual([]);
    expect(await keys("2030-03-01")).toEqual([`appointment:${booked.appointmentId}`]);
  });
});
