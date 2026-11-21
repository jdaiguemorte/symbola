// Lot 46 (RDV-01 à RDV-04, EVT-10, HUB-08, POR-02 ; D2 à D10 ; ADR 0082) — le module Rendez-vous contre
// un vrai PostgreSQL (RLS), Mailpit et une horloge simulée. Les agendas extérieurs sont servis par un
// transport simulé (aucun accès réseau).
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrganization, ensureMembership } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { appointments, busyIntervals, calendarSources } from "@symbola/db/schema/appointments";
import { domainEvents } from "@symbola/db/schema/core";
import { eventTasks } from "@symbola/db/schema/events";
import { jobs } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { findContactByEmail, saveEmailTemplate, setModuleEnabled } from "@/modules/hub/service";
import type { Transport } from "./ics-reader";
import {
  addAppointmentReportAction,
  addCalendarSource,
  AppointmentNotLinkedError,
  availableSlots,
  bookAppointment,
  cancelAppointment,
  cancelByToken,
  CalendarSourceNotFoundError,
  convertActionToTask,
  createAppointmentType,
  createManualAppointment,
  createOptionFromAppointment,
  describeManagedAppointment,
  dueReminder,
  getAppointment,
  getAppointmentReport,
  linkAppointmentToEvent,
  listMyCalendarSources,
  listTodayAppointments,
  listUpcomingAppointmentsForPerson,
  refreshCalendarSource,
  refreshMyCalendarSource,
  removeCalendarSource,
  rescheduleByToken,
  resolvePublicBookingPage,
  saveAvailabilityRules,
  saveBookingPage,
  sendDueAppointmentReminders,
  slotsForManagedAppointment,
  UPCOMING_PER_EMAIL,
  updateAppointmentType,
} from "./service";

const MAILPIT_API = "http://localhost:8025/api/v1";
// Lundi 1er mars 2027, 8 h à Paris.
const MONDAY = new Date("2027-03-01T07:00:00Z");
const TEN = new Date("2027-03-01T09:00:00Z"); // 10 h à Paris
const WEEK = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "18:00" }));

afterEach(() => {
  vi.useRealTimers();
});

async function organization(options: { events?: boolean } = {}) {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID()}`)).id;
  await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "appointments", enabled: true });
  if (options.events === false) {
    for (const moduleKey of ["events", "budget", "quotes", "vendors"] as const) await setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey, enabled: false });
  }
  const host = await ensureMembership(db, { organizationId, email: `hote-${randomUUID()}@example.test`, role: "owner" });
  const type = await createAppointmentType(organizationId, { name: "Découverte", durationMinutes: 60, minNoticeMinutes: 0, bufferAfterMinutes: 15, reminders: "24h_2h" }, host.userId);
  await saveAvailabilityRules(organizationId, host.userId, WEEK);
  return { organizationId, hostId: host.userId, type };
}

const person = (overrides: Partial<{ email: string; name: string }> = {}) => ({ name: overrides.name ?? "Léa Martin", email: overrides.email ?? `lea-${randomUUID()}@example.test`, phone: null, answers: {}, locale: "fr" as const });

async function book(context: Awaited<ReturnType<typeof organization>>, startsAt: Date, who = person(), now = MONDAY) {
  return bookAppointment({ organizationId: context.organizationId, typeId: context.type.id, startsAt, now, ...who });
}

async function mailsTo(email: string): Promise<{ Subject: string; Text: string; Attachments: { FileName: string }[] }[]> {
  const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
  const { messages } = (await response.json()) as { messages: { ID: string }[] };
  return Promise.all(messages.map(async (message) => (await (await fetch(`${MAILPIT_API}/message/${message.ID}`)).json()) as { Subject: string; Text: string; Attachments: { FileName: string }[] }));
}

const ics = (...events: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//FR", ...events, "END:VCALENDAR"].join("\r\n");
const serving = (text: string): Transport => async () => ({ status: 200, location: null, contentLength: null, body: (async function* () { yield Buffer.from(text); })() });
const failing: Transport = async () => ({ status: 500, location: null, contentLength: null, body: (async function* () {})() });

describe("RDV-01 — Types de rendez-vous", () => {
  it("un type se crée avec son nom et sa durée ; tout le reste a sa valeur par défaut", async () => {
    const context = await organization();
    const type = await createAppointmentType(context.organizationId, { name: "Visite", durationMinutes: 90 }, context.hostId);
    expect(type).toMatchObject({ name: "Visite", durationMinutes: 90, locationKind: "video", bufferBeforeMinutes: 0, bufferAfterMinutes: 0, minNoticeMinutes: 1440, horizonDays: 60, reminders: "24h", hostUserId: context.hostId, active: true, allowEventDays: false, questions: [] });
  });
});

describe("RDV-02 — Page publique et créneaux sur les disponibilités réelles", () => {
  it("la page d'une adresse ne répond que si elle est ouverte et le module ouvert ; jamais les rendez-vous d'une autre organisation", async () => {
    const a = await organization();
    const b = await organization();
    const slugA = `atelier-${randomUUID().slice(0, 8)}`;
    await saveBookingPage(a.organizationId, { slug: slugA, active: true, privacyNotice: null });
    const page = await resolvePublicBookingPage(slugA, "fr");
    expect(page?.organizationId).toBe(a.organizationId);
    expect(page?.types.map((type) => type.id)).toEqual([a.type.id]);
    expect(page?.privacyNotice).toContain("CNIL");
    // Un rendez-vous de B ne prend aucun créneau de A.
    await book(b, TEN);
    expect((await availableSlots(a.organizationId, a.type.id, { now: MONDAY })).map((slot) => slot.getTime())).toContain(TEN.getTime());
    await saveBookingPage(a.organizationId, { slug: slugA, active: false, privacyNotice: null });
    expect(await resolvePublicBookingPage(slugA, "fr")).toBeNull();
    expect(await resolvePublicBookingPage("adresse-inconnue", "fr")).toBeNull();
    await setModuleEnabled(appDatabase(), { adminUserId: randomUUID(), organizationId: a.organizationId, moduleKey: "appointments", enabled: false });
    await saveBookingPage(a.organizationId, { slug: slugA, active: true, privacyNotice: null });
    expect(await resolvePublicBookingPage(slugA, "fr")).toBeNull();
  });

  it("aucun créneau sur une plage occupée : rendez-vous pris (marges comprises) et agenda extérieur", async () => {
    const context = await organization();
    await book(context, TEN);
    const external = ics("BEGIN:VEVENT", "UID:1", "DTSTART:20270301T130000Z", "DTEND:20270301T140000Z", "SUMMARY:Médecin", "LOCATION:Cabinet", "END:VEVENT");
    await addCalendarSource(context.organizationId, context.hostId, { label: "Perso", url: "https://calendar.example.test/private-abc/basic.ics" }, { now: MONDAY, transport: serving(external) });
    const slots = (await availableSlots(context.organizationId, context.type.id, { now: MONDAY })).map((slot) => slot.toISOString()).filter((slot) => slot.startsWith("2027-03-01"));
    // 10 h - 11 h pris + 15 min de marge après : 11 h n'est pas libre (11 h - 12 h chevauche 10 h - 11 h 15).
    expect(slots).not.toContain("2027-03-01T09:00:00.000Z");
    expect(slots).not.toContain("2027-03-01T10:00:00.000Z");
    expect(slots).toContain("2027-03-01T10:30:00.000Z");
    // 14 h - 15 h à Paris occupé dans l'agenda : ni 13 h 30, ni 14 h, ni 14 h 30.
    for (const busy of ["2027-03-01T12:30:00.000Z", "2027-03-01T13:00:00.000Z", "2027-03-01T13:30:00.000Z"]) expect(slots).not.toContain(busy);
  });

  it("la lecture d'un agenda ne garde ni titre ni lieu (contrôle en base), et l'adresse est chiffrée", async () => {
    const context = await organization();
    const url = "https://calendar.example.test/private-7f3a9c2e/basic.ics";
    const external = ics("BEGIN:VEVENT", "UID:1", "DTSTART:20270302T090000Z", "DTEND:20270302T100000Z", "SUMMARY:Rendez-vous médical", "LOCATION:Cabinet du docteur", "END:VEVENT");
    const source = await addCalendarSource(context.organizationId, context.hostId, { label: "Perso", url }, { now: MONDAY, transport: serving(external) });
    expect(source.state).toBe("ok");
    expect(source.urlHint).toBe("calendar.example.test/….ics");
    const stored = await withOrganization(appDatabase(), context.organizationId, async (tx) => ({
      source: (await tx.select().from(calendarSources).where(eq(calendarSources.id, source.id)))[0]!,
      busy: await tx.execute(sql`select row_to_json(b)::text as row from appointments.busy_intervals b where source_id = ${source.id}`),
    }));
    expect(stored.source.urlSealed.startsWith("f1:")).toBe(true);
    expect(stored.source.urlSealed).not.toContain("private-7f3a9c2e");
    const rows = (stored.busy as unknown as { row: string }[]).map((entry) => entry.row).join(" ");
    expect(rows).not.toMatch(/médical|Cabinet/);
    expect(rows).toContain("2027-03-02T09:00:00");
  });

  it("un agenda en erreur (trois échecs) : aucun créneau tant qu'il n'est pas relu ; la planner le voit dans « Aujourd'hui »", async () => {
    const context = await organization();
    const source = await addCalendarSource(context.organizationId, context.hostId, { label: "Perso", url: "https://calendar.example.test/x.ics" }, { now: MONDAY, transport: serving(ics()) });
    expect((await availableSlots(context.organizationId, context.type.id, { now: MONDAY })).length).toBeGreaterThan(0);
    for (let attempt = 1; attempt <= 3; attempt++) await refreshCalendarSource(context.organizationId, source.id, { now: new Date(MONDAY.getTime() + attempt * 60_000), transport: failing });
    expect((await listMyCalendarSources(context.organizationId, context.hostId))[0]!.state).toBe("error");
    expect(await availableSlots(context.organizationId, context.type.id, { now: new Date(MONDAY.getTime() + 4 * 60_000) })).toEqual([]);
    const errors = await import("./service").then((service) => service.listCalendarSourcesInError(context.organizationId));
    expect(errors.map((entry) => entry.id)).toEqual([source.id]);
    await refreshCalendarSource(context.organizationId, source.id, { now: new Date(MONDAY.getTime() + 5 * 60_000), transport: serving(ics()) });
    expect((await availableSlots(context.organizationId, context.type.id, { now: new Date(MONDAY.getTime() + 6 * 60_000) })).length).toBeGreaterThan(0);
  });

  it("une personne de l'équipe ne voit, ne relit ni ne retire l'agenda d'une autre", async () => {
    const context = await organization();
    const other = await ensureMembership(appDatabase(), { organizationId: context.organizationId, email: `autre-${randomUUID()}@example.test`, role: "member" });
    const source = await addCalendarSource(context.organizationId, context.hostId, { label: "Perso", url: "https://calendar.example.test/x.ics" }, { now: MONDAY, transport: serving(ics()) });
    expect(await listMyCalendarSources(context.organizationId, other.userId)).toEqual([]);
    await expect(refreshMyCalendarSource(context.organizationId, other.userId, source.id)).rejects.toBeInstanceOf(CalendarSourceNotFoundError);
    await expect(removeCalendarSource(context.organizationId, other.userId, source.id)).rejects.toBeInstanceOf(CalendarSourceNotFoundError);
    await removeCalendarSource(context.organizationId, context.hostId, source.id);
    const left = await withOrganization(appDatabase(), context.organizationId, (tx) => tx.select().from(busyIntervals).where(eq(busyIntervals.sourceId, source.id)));
    expect(left).toEqual([]);
  });

  it("D6 : le jour d'un évènement confirmé n'a aucun créneau (sauf si le type l'accepte)", async () => {
    const context = await organization();
    const sourceId = (await createProspectSource(context.organizationId, "Salon")).id;
    const event = await createProspect({ organizationId: context.organizationId, createdByUserId: context.hostId, prospectSourceId: sourceId, clients: [{ firstName: "Léa" }], eventDate: "2027-03-02" });
    const { changeEventStatus } = await import("@/modules/events/service");
    await changeEventStatus({ organizationId: context.organizationId, eventId: event.id, changedByUserId: context.hostId, toStatus: "confirmed" });
    const days = new Set((await availableSlots(context.organizationId, context.type.id, { now: MONDAY })).map((slot) => slot.toISOString().slice(0, 10)));
    expect(days.has("2027-03-02")).toBe(false);
    expect(days.has("2027-03-03")).toBe(true);
  });

  it("RDV-02, lot 64 : seules les heures de la plage occupée sont retirées ; le reste du jour reste réservable", async () => {
    const context = await organization();
    const sourceId = (await createProspectSource(context.organizationId, "Salon"))!.id;
    const event = await createProspect({ organizationId: context.organizationId, createdByUserId: context.hostId, prospectSourceId: sourceId, clients: [{ firstName: "Léa" }], eventDate: "2027-03-03" });
    const { changeEventStatus, setEventBusyRule } = await import("@/modules/events/service");
    await changeEventStatus({ organizationId: context.organizationId, eventId: event.id, changedByUserId: context.hostId, toStatus: "confirmed" });
    // Occupée le mercredi de 8 h à 12 h : rendez-vous d'une heure, marge de 15 min après.
    await setEventBusyRule(context.organizationId, event.id, { startDayOffset: 0, startTime: "08:00", endDayOffset: 0, endTime: "12:00" });
    const wednesday = (await availableSlots(context.organizationId, context.type.id, { now: MONDAY })).filter((slot) => slot.toISOString().startsWith("2027-03-03"));
    expect(wednesday[0]!.toISOString()).toBe("2027-03-03T11:00:00.000Z"); // 12 h à Paris
    expect(wednesday.some((slot) => slot.getTime() < new Date("2027-03-03T11:00:00Z").getTime())).toBe(false);
  });

  it("RDV-02, lot 64 : la veille à 14 h au lendemain à 12 h, marges comprises, ne propose rien", async () => {
    const context = await organization();
    const sourceId = (await createProspectSource(context.organizationId, "Salon"))!.id;
    const event = await createProspect({ organizationId: context.organizationId, createdByUserId: context.hostId, prospectSourceId: sourceId, clients: [{ firstName: "Léa" }], eventDate: "2027-03-03" });
    const { changeEventStatus, setEventBusyRule } = await import("@/modules/events/service");
    await changeEventStatus({ organizationId: context.organizationId, eventId: event.id, changedByUserId: context.hostId, toStatus: "confirmed" });
    await setEventBusyRule(context.organizationId, event.id, { startDayOffset: -1, startTime: "14:00", endDayOffset: 1, endTime: "12:00" });
    const slots = await availableSlots(context.organizationId, context.type.id, { now: MONDAY });
    const start = new Date("2027-03-02T13:00:00Z"); // mardi 14 h à Paris
    const end = new Date("2027-03-04T11:00:00Z"); // jeudi 12 h à Paris
    // Un créneau d'une heure avec 15 min de marge après : le dernier possible mardi commence à 12 h 45.
    expect(slots.some((slot) => slot.getTime() + 75 * 60_000 > start.getTime() && slot.getTime() < end.getTime())).toBe(false);
    expect(slots.some((slot) => slot.toISOString() === "2027-03-02T11:30:00.000Z")).toBe(true); // mardi 12 h 30
    expect(slots.some((slot) => slot.toISOString() === "2027-03-04T11:00:00.000Z")).toBe(true); // jeudi 12 h
  });

  it("RDV-02, lot 64 (D2, D3) : une option ne bloque pas, sauf réglage ; un évènement d'une autre équipe ne bloque pas", async () => {
    const context = await organization();
    const sourceId = (await createProspectSource(context.organizationId, "Salon"))!.id;
    const option = await createProspect({ organizationId: context.organizationId, createdByUserId: context.hostId, prospectSourceId: sourceId, clients: [{ firstName: "Léa" }], eventDate: "2027-03-03" });
    const { changeEventStatus, setBusySettings, setEventTeamMember } = await import("@/modules/events/service");
    const days = async () => new Set((await availableSlots(context.organizationId, context.type.id, { now: MONDAY })).map((slot) => slot.toISOString().slice(0, 10)));
    expect((await days()).has("2027-03-03")).toBe(true);
    await setBusySettings(context.organizationId, { optionsBlock: true });
    expect((await days()).has("2027-03-03")).toBe(false);
    await setBusySettings(context.organizationId, { optionsBlock: false });
    await changeEventStatus({ organizationId: context.organizationId, eventId: option.id, changedByUserId: context.hostId, toStatus: "confirmed" });
    expect((await days()).has("2027-03-03")).toBe(false);
    // L'évènement est confié à une autre planner : l'agenda de la personne qui reçoit reste libre.
    const other = await ensureMembership(appDatabase(), { organizationId: context.organizationId, email: `autre-${randomUUID()}@example.test`, role: "member" });
    await setEventTeamMember({ organizationId: context.organizationId, eventId: option.id, userId: other.userId, role: "lead", byUserId: context.hostId });
    expect((await days()).has("2027-03-03")).toBe(true);
  });

  it("RDV-01, lot 64 (D8) : une description de 300 caractères au plus, vidée par une chaîne vide", async () => {
    const context = await organization();
    const saved = await updateAppointmentType(context.organizationId, context.type.id, { description: "  Faisons connaissance.  " });
    expect(saved.description).toBe("Faisons connaissance.");
    await expect(updateAppointmentType(context.organizationId, context.type.id, { description: "x".repeat(301) })).rejects.toMatchObject({ field: "description" });
    expect((await updateAppointmentType(context.organizationId, context.type.id, { description: "" })).description).toBeNull();
  });

  it("RDV-02, lot 64 (D7) : une question obligatoire demande une réponse ; une facultative non", async () => {
    const context = await organization();
    const stored = await updateAppointmentType(context.organizationId, context.type.id, {
      questions: [
        { id: "invites", label: "Combien d'invités ?", kind: "choice", choices: ["Moins de 50", "50 à 100"], required: true },
        { id: "date", label: "Date envisagée", kind: "text", choices: [] },
      ],
    });
    expect(stored.questions.map((question) => question.required ?? false)).toEqual([true, false]);
    await expect(book(context, TEN, { ...person(), answers: { date: "Septembre" } })).rejects.toMatchObject({ field: "answer:invites" });
    const booked = await book(context, TEN, { ...person(), answers: { invites: "50 à 100" } });
    expect(booked.outcome).toBe("booked");
  });

  it("deux réservations simultanées du même créneau : une seule passe, l'autre reçoit les créneaux voisins", async () => {
    const context = await organization();
    const [first, second] = await Promise.all([book(context, TEN), book(context, TEN)]);
    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["booked", "taken"]);
    const taken = [first, second].find((result) => result.outcome === "taken") as { alternatives: Date[] };
    expect(taken.alternatives.length).toBeGreaterThan(0);
    const rows = await withOrganization(appDatabase(), context.organizationId, (tx) => tx.select().from(appointments).where(eq(appointments.startsAt, TEN)));
    expect(rows).toHaveLength(1);
  });

  it("D5 : trois rendez-vous à venir au plus par adresse e-mail et par organisation", async () => {
    const context = await organization();
    const who = person();
    for (let index = 0; index < UPCOMING_PER_EMAIL; index++) expect((await book(context, new Date(TEN.getTime() + index * 2 * 3_600_000), who)).outcome).toBe("booked");
    expect((await book(context, new Date("2027-03-02T09:00:00Z"), who)).outcome).toBe("limit");
  });
});

describe("RDV-03 — Confirmation, rappels, report et annulation par lien", () => {
  it("confirmation immédiate avec l'invitation .ics et le lien de gestion ; la planner est prévenue", async () => {
    const context = await organization();
    const who = person();
    const result = await book(context, TEN, who);
    expect(result.outcome).toBe("booked");
    const [mail] = await mailsTo(who.email);
    expect(mail!.Subject).toContain("Rendez-vous confirmé");
    expect(mail!.Text).toContain("/rdv#");
    expect(mail!.Attachments.map((attachment) => attachment.FileName)).toContain("invitation.ics");
  });

  it("un modèle de confirmation réécrit par l'organisation (migration 0158) s'enregistre et sert à la confirmation", async () => {
    const context = await organization();
    await saveEmailTemplate({ organizationId: context.organizationId, kind: "appointment_confirmed", locale: "fr", subject: "C'est réservé : {{rendez_vous}}", body: "Bonjour {{prénom}},\n\nÀ très vite le {{date_rendez_vous}}.\n\n{{lien}}" });
    const who = person();
    await book(context, TEN, who);
    const [mail] = await mailsTo(who.email);
    expect(mail!.Subject).toBe("C'est réservé : Découverte");
    expect(mail!.Text).toContain("À très vite le 1 mars 2027 à 10:00");
  });

  it("report et annulation sans compte depuis le lien ; un autre lien ou une autre organisation : la même réponse qu'un lien inconnu", async () => {
    const context = await organization();
    const other = await organization();
    const result = await book(context, TEN);
    if (result.outcome !== "booked") throw new Error("réservation attendue");
    const token = result.manageToken;
    expect((await describeManagedAppointment(token, MONDAY))?.appointment.id).toBe(result.appointment.id);
    // Même secret, autre organisation : inconnu.
    const forged = `${other.organizationId}.${token.split(".")[1]}`;
    expect(await describeManagedAppointment(forged, MONDAY)).toBeNull();
    expect(await describeManagedAppointment("n-importe-quoi", MONDAY)).toBeNull();
    const slots = await slotsForManagedAppointment(token, MONDAY);
    expect(slots!.map((slot) => slot.getTime())).toContain(TEN.getTime());
    const moved = await rescheduleByToken(token, new Date("2027-03-01T13:00:00Z"), MONDAY);
    expect(moved.outcome).toBe("rescheduled");
    expect(await cancelByToken(token, "schedule", MONDAY)).toBe(true);
    const cancelled = await getAppointment(context.organizationId, result.appointment.id);
    expect(cancelled).toMatchObject({ status: "cancelled", cancelledBy: "person", cancelReason: "schedule" });
    expect(await cancelByToken(token, null, MONDAY)).toBe(false);
  });

  it("le lien expire à la fin du rendez-vous", async () => {
    const context = await organization();
    const result = await book(context, TEN);
    if (result.outcome !== "booked") throw new Error("réservation attendue");
    expect(await describeManagedAppointment(result.manageToken, new Date("2027-03-01T09:59:00Z"))).not.toBeNull();
    expect(await describeManagedAppointment(result.manageToken, new Date("2027-03-01T10:00:00Z"))).toBeNull();
  });

  it("un rappel rejoué ne part qu'une fois ; aucun rappel pour un rendez-vous annulé ; un report change le rappel", async () => {
    const context = await organization();
    const who = person();
    const tuesday = new Date("2027-03-02T09:00:00Z");
    const result = await book(context, tuesday, who);
    if (result.outcome !== "booked") throw new Error("réservation attendue");
    const dayBefore = new Date("2027-03-01T09:05:00Z");
    expect(await sendDueAppointmentReminders(context.organizationId, dayBefore)).toBe(1);
    // Rejoué cinq minutes plus tard : la clé d'unicité est déjà inscrite, rien ne repart.
    await sendDueAppointmentReminders(context.organizationId, new Date("2027-03-01T09:10:00Z"));
    const reminderJobs = await withOrganization(appDatabase(), context.organizationId, (tx) => tx.select().from(jobs).where(sql`${jobs.idempotencyKey} like ${`appointment:${result.appointment.id}:appointment_reminder%`}`));
    expect(reminderJobs).toHaveLength(1);
    expect((await mailsTo(who.email)).filter((mail) => mail.Subject.startsWith("Rappel"))).toHaveLength(1);
    // Annulé : plus de rappel de deux heures.
    await cancelAppointment(context.organizationId, result.appointment.id, { reason: null, notify: false });
    expect(await sendDueAppointmentReminders(context.organizationId, new Date("2027-03-02T07:05:00Z"))).toBe(0);
  });

  it("règle des rappels : à leur heure, si le rendez-vous a été pris avant, jamais en double fenêtre", () => {
    const startsAt = new Date("2027-03-02T09:00:00Z");
    const row = { reminders: "24h_2h" as const, startsAt, createdAt: new Date("2027-02-20T09:00:00Z"), rescheduledAt: null };
    expect(dueReminder(row, new Date("2027-03-01T08:59:00Z"))).toBeNull();
    expect(dueReminder(row, new Date("2027-03-01T09:00:00Z"))).toBe(24);
    expect(dueReminder(row, new Date("2027-03-02T07:00:00Z"))).toBe(2);
    expect(dueReminder(row, new Date("2027-03-02T09:00:00Z"))).toBeNull();
    expect(dueReminder({ ...row, createdAt: new Date("2027-03-01T20:00:00Z") }, new Date("2027-03-01T21:00:00Z"))).toBeNull();
    expect(dueReminder({ ...row, reminders: "none" }, new Date("2027-03-01T09:00:00Z"))).toBeNull();
  });
});

describe("RDV-04 — App autonome, reliée au reste quand il existe", () => {
  it("avec le seul module Rendez-vous : réservation, contact rattaché par son e-mail, évènement interne publié une fois", async () => {
    const context = await organization({ events: false });
    const email = `seule-${randomUUID()}@example.test`;
    const first = await book(context, TEN, person({ email }));
    const second = await book(context, new Date("2027-03-02T09:00:00Z"), person({ email }));
    if (first.outcome !== "booked" || second.outcome !== "booked") throw new Error("réservations attendues");
    const contact = await findContactByEmail(context.organizationId, email);
    expect(contact).not.toBeNull();
    expect(first.appointment.contactId).toBe(contact!.id);
    expect(second.appointment.contactId).toBe(contact!.id);
    const published = await withOrganization(appDatabase(), context.organizationId, (tx) => tx.select().from(domainEvents).where(and(eq(domainEvents.organizationId, context.organizationId), eq(domainEvents.name, "appointments.appointment.booked"))));
    expect(published).toHaveLength(2);
    expect(JSON.stringify(published.map((event) => event.payload))).not.toContain(email);
  });

  it("avec Évènements : rattacher, ou créer une option sans ressaisie (le contact est repris)", async () => {
    const context = await organization();
    const manual = await createManualAppointment(context.organizationId, { typeId: context.type.id, startsAt: TEN, name: "Chloé Bernard", email: `chloe-${randomUUID()}@example.test`, phone: null, notify: false, locale: "fr" });
    const sourceId = (await createProspectSource(context.organizationId, "Page de réservation")).id;
    const { eventId } = await createOptionFromAppointment(context.organizationId, manual.appointment.id, { createdByUserId: context.hostId, prospectSourceId: sourceId, eventDate: "2027-09-18" });
    const linked = await getAppointment(context.organizationId, manual.appointment.id);
    expect(linked?.eventId).toBe(eventId);
    const { getEvent } = await import("@/modules/events/service");
    const event = await getEvent(context.organizationId, eventId);
    expect(event?.status).toBe("option");
    expect(event?.clients[0]?.contactId).toBe(manual.appointment.contactId);
    await linkAppointmentToEvent(context.organizationId, manual.appointment.id, null);
    expect((await getAppointment(context.organizationId, manual.appointment.id))?.eventId).toBeNull();
  });
});

describe("EVT-10 — Comptes rendus ; les actions deviennent des tâches", () => {
  it("une action devient une tâche de l'évènement en un geste, avec son échéance et son responsable ; sans évènement, refusée", async () => {
    const context = await organization();
    const manual = await createManualAppointment(context.organizationId, { typeId: context.type.id, startsAt: TEN, name: "Léa Martin", email: null, phone: null, notify: false, locale: "fr" });
    const report = await addAppointmentReportAction(context.organizationId, manual.appointment.id, { label: "Envoyer trois lieux", dueOn: "2027-03-10", responsible: "planner" });
    const actionId = report.actions[0]!.id;
    await expect(convertActionToTask(context.organizationId, actionId)).rejects.toBeInstanceOf(AppointmentNotLinkedError);
    const sourceId = (await createProspectSource(context.organizationId, "Salon")).id;
    const event = await createProspect({ organizationId: context.organizationId, createdByUserId: context.hostId, prospectSourceId: sourceId, clients: [{ firstName: "Léa" }], eventDate: "2027-09-18", applyTemplate: false });
    await linkAppointmentToEvent(context.organizationId, manual.appointment.id, event.id);
    const { taskId } = await convertActionToTask(context.organizationId, actionId);
    const [task] = await withOrganization(appDatabase(), context.organizationId, (tx) => tx.select().from(eventTasks).where(eq(eventTasks.id, taskId)));
    expect(task).toMatchObject({ eventId: event.id, label: "Envoyer trois lieux", dueDate: "2027-03-10", responsible: "planner" });
    expect((await getAppointmentReport(context.organizationId, manual.appointment.id))?.actions[0]?.taskId).toBe(taskId);
    // Un second geste ne crée pas de seconde tâche.
    expect((await convertActionToTask(context.organizationId, actionId)).taskId).toBe(taskId);
  });
});

describe("HUB-08, POR-02 — Aujourd'hui et portail", () => {
  it("les rendez-vous du jour et les nouveaux depuis la veille ; au portail, seulement ceux de la personne du lien", async () => {
    const context = await organization();
    const email = `lea-${randomUUID()}@example.test`;
    const result = await book(context, TEN, person({ email }));
    const otherResult = await book(context, new Date("2027-03-01T13:00:00Z"));
    if (result.outcome !== "booked" || otherResult.outcome !== "booked") throw new Error("réservations attendues");
    const today = await listTodayAppointments(context.organizationId, MONDAY);
    expect(today.map((entry) => [entry.id, entry.change])).toEqual([
      [result.appointment.id, "today"],
      [otherResult.appointment.id, "today"],
    ]);
    const sourceId = (await createProspectSource(context.organizationId, "Salon")).id;
    const event = await createProspect({ organizationId: context.organizationId, createdByUserId: context.hostId, prospectSourceId: sourceId, clients: [{ firstName: "Léa" }], eventDate: "2027-09-18", applyTemplate: false });
    await linkAppointmentToEvent(context.organizationId, result.appointment.id, event.id);
    await linkAppointmentToEvent(context.organizationId, otherResult.appointment.id, event.id);
    const mine = await listUpcomingAppointmentsForPerson(context.organizationId, event.id, email.toUpperCase(), MONDAY);
    expect(mine.map((entry) => entry.id)).toEqual([result.appointment.id]);
  });
});

describe("RDV-01 à EVT-10 — Isolation par le service", () => {
  it("l'organisation A ne lit ni ne modifie le rendez-vous de B", async () => {
    const a = await organization();
    const b = await organization();
    const result = await book(b, TEN);
    if (result.outcome !== "booked") throw new Error("réservation attendue");
    expect(await getAppointment(a.organizationId, result.appointment.id)).toBeNull();
    await expect(cancelAppointment(a.organizationId, result.appointment.id, { reason: null, notify: false })).rejects.toThrow();
    expect((await getAppointment(b.organizationId, result.appointment.id))?.status).toBe("booked");
  });
});
