// Lot 27a (CHR-04, décision D7) — rappels par e-mail des tâches confiées au
// client, contre un vrai PostgreSQL (RLS) et Mailpit, horloge simulée : seuils,
// un e-mail par jour, jamais deux fois le même rappel, heures d'envoi, liens
// sans rubrique, rappels décochés, retirés, événement perdu ; langue du lien.
import { setRelationMailSender } from "@/modules/hub/service";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { eventTaskReminders } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { EventLinkRights } from "@symbola/contracts";
import { listPreparedEmails, recentEmailVariableProblems, resetEmailTemplate, saveEmailTemplate } from "@/modules/hub/service";
import { draftPreparedEmails } from "@/lib/prepared-emails";
import { loadTodayItems, type TodayWords } from "@/lib/today/load";
import { addEventTask, changeEventDate, changeEventStatus, createEventLink, createLossReason, createProspect, createProspectSource, revokeEventLink, sendClientTaskReminders, updateEventLink, updateEventTask } from "./service";

// Lot 65d (MSG-01 ; ADR 0110) : ces tests vérifient l'envoi par Symbola, réglage « Symbola les envoie
// pour moi » : rien n'y change. Le réglage par défaut (la planner envoie de sa messagerie) est vérifié
// dans modules/hub/relation-mail.integration.test.ts.
async function symbolaSends(organizationId: string): Promise<string> {
  await setRelationMailSender(organizationId, "symbola");
  return organizationId;
}

const plannerId = randomUUID();
const TODAY_WORDS: TodayWords = {
  clientTask: "tâche du client",
  amount: (label, amount) => `${label} ${amount}`,
  decision: (title) => `choix ${title}`,
  paymentDeclaration: (label) => `déclaration ${label}`,
  quoteFollowUp: (number) => `devis ${number}`,
  prospectFollowUp: "prospect sans nouvelle",
  depositBlocked: (number) => `acompte bloqué ${number}`,
  vendorContract: (vendor) => `contrat ${vendor}`,
  dateConflict: (count) => `${count} le même jour`,
  linkRenewal: (name) => `lien ${name}`,
};
const MAILPIT_API = "http://localhost:8025/api/v1";
const TASKS: EventLinkRights = { rubrics: ["tasks", "program"], budgetScope: "all", sharedSlotIds: [] };
// Mercredi 3 mars 2027, 11 h à Paris (heure d'hiver).
const MARCH_3 = new Date("2027-03-03T10:00:00Z");
const at = (iso: string) => new Date(iso);

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function wedding() {
  const organizationId = await symbolaSends((await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" });
  const task = (label: string, dueDate: string, responsible: "clients" | "planner" = "clients") => addEventTask(organizationId, event.id, { label, dueDate, responsible });
  const week = await task("Choisir les alliances", "2027-03-10");
  const eve = await task("Envoyer la liste des invités", "2027-03-04");
  const overdue = await task("Réserver le coiffeur", "2027-03-02");
  await task("Choisir les faire-part", "2027-03-20");
  await task("Rappeler le traiteur", "2027-03-05", "planner");
  const done = await task("Signer le contrat", "2027-03-05");
  return { organizationId, eventId: event.id, week, eve, overdue, done };
}

async function link(organizationId: string, eventId: string, options: { rights?: EventLinkRights; locale?: "fr" | "en" } = {}) {
  const email = `rappel-${randomUUID()}@example.test`;
  const delivery = await createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "client", locale: options.locale ?? "fr", link: { personName: "Léa Martin", email, rights: options.rights ?? TASKS } });
  return { linkId: delivery.link.id, email };
}

async function mailsTo(email: string): Promise<{ Subject: string; Text: string }[]> {
  const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
  const { messages } = (await response.json()) as { messages: { ID: string; Subject: string }[] };
  const reminders = messages.filter((message) => /tâches|tasks/.test(message.Subject));
  return Promise.all(
    reminders.map(async (message) => ({ Subject: message.Subject, Text: ((await (await fetch(`${MAILPIT_API}/message/${message.ID}`)).json()) as { Text: string }).Text })),
  );
}

describe("CHR-04 — Rappel automatique des tâches confiées au client", () => {
  it("un e-mail regroupe les tâches qui atteignent un seuil ; un seul par jour ; jamais deux fois le même rappel", async () => {
    const w = await wedding();
    const { email } = await link(w.organizationId, w.eventId);
    await updateEventTask({ organizationId: w.organizationId, taskId: w.done.id, done: true });

    expect(await sendClientTaskReminders(w.organizationId, MARCH_3)).toBe(1);
    const [first] = await mailsTo(email);
    expect(first!.Subject).toBe("Vos prochaines tâches pour votre mariage");
    for (const label of ["Choisir les alliances", "Envoyer la liste des invités", "Réserver le coiffeur"]) expect(first!.Text).toContain(label);
    for (const label of ["Choisir les faire-part", "Rappeler le traiteur", "Signer le contrat"]) expect(first!.Text).not.toContain(label);
    expect(first!.Text).not.toContain("/lien#");

    // Plus tard le même jour : rien. Le lendemain : rien de nouveau.
    expect(await sendClientTaskReminders(w.organizationId, at("2027-03-03T15:00:00Z"))).toBe(0);
    expect(await sendClientTaskReminders(w.organizationId, at("2027-03-04T09:00:00Z"))).toBe(0);
    // La veille des alliances : un e-mail, pour elles et pour la liste des
    // invités, désormais en retard ; pas pour le coiffeur, déjà rappelé en retard.
    expect(await sendClientTaskReminders(w.organizationId, at("2027-03-09T09:00:00Z"))).toBe(1);
    const mails = await mailsTo(email);
    expect(mails).toHaveLength(2);
    expect(mails[0]!.Text).toContain("Choisir les alliances : avant le 10 mars 2027 (demain)");
    expect(mails[0]!.Text).toContain("Envoyer la liste des invités : avant le 4 mars 2027 (en retard)");
    expect(mails[0]!.Text).not.toContain("Réserver le coiffeur");

    const rows = await withDb((db) => withOrganization(db, w.organizationId, (tx) => tx.select().from(eventTaskReminders)));
    expect(rows.map((row) => row.threshold).sort()).toEqual(["eve", "eve", "overdue", "overdue", "week"]);
  });

  it("hors des heures d'envoi (avant 9 h, après 19 h à Paris), rien ne part", async () => {
    const w = await wedding();
    const { email } = await link(w.organizationId, w.eventId);
    expect(await sendClientTaskReminders(w.organizationId, at("2027-03-03T07:30:00Z"))).toBe(0);
    expect(await sendClientTaskReminders(w.organizationId, at("2027-03-03T18:30:00Z"))).toBe(0);
    expect(await mailsTo(email)).toEqual([]);
  });

  it("aucun rappel sans la rubrique Rétroplanning, rappels décochés, lien retiré ou événement perdu", async () => {
    const w = await wedding();
    const noTasks = await link(w.organizationId, w.eventId, { rights: { rubrics: ["program"], budgetScope: "all", sharedSlotIds: [] } });
    const off = await link(w.organizationId, w.eventId);
    await updateEventLink(w.organizationId, off.linkId, { personName: "Léa Martin", email: off.email, rights: TASKS, taskReminders: false });
    const revoked = await link(w.organizationId, w.eventId);
    await revokeEventLink(w.organizationId, revoked.linkId);
    expect(await sendClientTaskReminders(w.organizationId, MARCH_3)).toBe(0);

    const lost = await wedding();
    const active = await link(lost.organizationId, lost.eventId);
    const reason = await createLossReason(lost.organizationId, "Budget", false);
    await changeEventStatus({ organizationId: lost.organizationId, eventId: lost.eventId, changedByUserId: plannerId, toStatus: "cancelled", lossReasonId: reason.id });
    expect(await sendClientTaskReminders(lost.organizationId, MARCH_3)).toBe(0);
    for (const email of [noTasks.email, off.email, revoked.email, active.email]) expect(await mailsTo(email)).toEqual([]);
  });

  it("dans la langue du lien ; journal sans e-mail ; une autre organisation n'envoie rien pour celle-ci", async () => {
    const w = await wedding();
    const { linkId, email } = await link(w.organizationId, w.eventId, { locale: "en" });
    const other = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
    expect(await sendClientTaskReminders(other, MARCH_3)).toBe(0);
    expect(await sendClientTaskReminders(w.organizationId, MARCH_3)).toBe(1);
    expect((await mailsTo(email))[0]!.Subject).toBe("Your next tasks for your wedding");
    const journal = await withDb((db) => withOrganization(db, w.organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.action, "events.link.reminder_sent"))));
    expect(journal).toHaveLength(1);
    // Alliances (semaine), liste des invités (veille), coiffeur (retard), contrat (semaine).
    expect(journal[0]).toMatchObject({ actorKind: "system", details: { linkId, tasks: 4 } });
    expect(JSON.stringify(journal)).not.toContain(email);
  });
});

describe("MSG-01 — Aucun e-mail avec une variable vide (lot 38a, D5)", () => {
  it("un rappel dont le modèle emploie une variable sans valeur ne part pas : il est porté au journal, signalé dans « Aujourd'hui », et part une fois le modèle corrigé", async () => {
    const w = await wedding();
    await changeEventDate(w.organizationId, w.eventId, null);
    await saveEmailTemplate({ organizationId: w.organizationId, kind: "task_reminder", locale: "fr", subject: "Vos tâches avant le {{date_évènement}}", body: "{{tâches}}" });
    const { email } = await link(w.organizationId, w.eventId);
    expect(await sendClientTaskReminders(w.organizationId, MARCH_3)).toBe(0);
    expect(await mailsTo(email)).toEqual([]);

    const journal = await withDb((db) => withOrganization(db, w.organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.action, "hub.mail.variable_missing"))));
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ actorKind: "system", category: "partage", objectType: "event", objectId: w.eventId, details: { kind: "task_reminder", locale: "fr", missing: "event_date" } });
    expect(JSON.stringify(journal)).not.toContain(email);
    expect(await recentEmailVariableProblems(w.organizationId)).toEqual({ events: 1, kind: "task_reminder", locale: "fr" });

    await resetEmailTemplate(w.organizationId, "task_reminder", "fr");
    expect(await sendClientTaskReminders(w.organizationId, MARCH_3)).toBe(1);
    expect(await mailsTo(email)).toHaveLength(1);
  });
});

// Lot 65d (décision 2 du 22/11 ; HUB-28 ; ADR 0110) — par défaut, le rappel des tâches du client n'est
// plus envoyé par Symbola : l'automatisme dépose un élément « À envoyer » dans « Aujourd'hui », que la
// planner ouvre, relit et envoie de sa messagerie.
describe("HUB-28 — Rappel des tâches préparé pour la planner (lot 65d, ADR 0110)", () => {
  it("rien ne part ; un seul élément « À envoyer » par lien et par jour ; il s'ouvre sur les tâches du rappel ; une autre organisation ne le voit pas", async () => {
    const w = await wedding();
    await setRelationMailSender(w.organizationId, "planner");
    const { linkId, email } = await link(w.organizationId, w.eventId);
    await updateEventTask({ organizationId: w.organizationId, taskId: w.done.id, done: true });

    expect(await sendClientTaskReminders(w.organizationId, MARCH_3)).toBe(1);
    expect(await sendClientTaskReminders(w.organizationId, at("2027-03-03T15:00:00Z"))).toBe(0);
    expect(await mailsTo(email)).toEqual([]);
    const pending = await listPreparedEmails(w.organizationId, { status: "to_send" });
    expect(pending.map((item) => [item.kind, item.recipientId, item.origin, item.automationKey])).toEqual([["task_reminder", linkId, "automation", "client_task_reminder"]]);

    const today = await loadTodayItems(w.organizationId, { events: true, quotes: false, budget: false }, { ...TODAY_WORDS, emailToSend: (kind) => `À envoyer : ${kind}` }, "fr", MARCH_3);
    const item = today.items.find((candidate) => candidate.kind === "email_to_send");
    expect(item).toMatchObject({ title: "À envoyer : task_reminder", eventId: w.eventId, href: `?preparer=${pending[0]!.id}`, actor: { kind: "you" } });

    const [draft] = await draftPreparedEmails(w.organizationId, [pending[0]!.id], MARCH_3);
    expect(draft).toMatchObject({ to: email, subject: "Vos prochaines tâches pour votre mariage", problem: null });
    for (const label of ["Choisir les alliances", "Envoyer la liste des invités", "Réserver le coiffeur"]) expect(draft!.body).toContain(label);
    expect(draft!.body).not.toContain("Signer le contrat");

    const other = await symbolaSends((await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id);
    expect(await draftPreparedEmails(other, [pending[0]!.id], MARCH_3)).toEqual([]);
    expect((await loadTodayItems(other, { events: true, quotes: false, budget: false }, { ...TODAY_WORDS, emailToSend: (kind) => kind }, "fr", MARCH_3)).items.filter((candidate) => candidate.kind === "email_to_send")).toEqual([]);
  });
});
