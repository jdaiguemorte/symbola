// Lot 46 (RGP-05, RGPD-01 à RGPD-05 ; ADR 0082) — contrat privacy/v1 du module Rendez-vous. Champs
// personnels (privacy.registry.yaml) : nom, e-mail et téléphone figés d'une personne qui a pris
// rendez-vous, ses réponses aux questions préalables, les notes du compte rendu. Une fiche « appointment »
// par rendez-vous ; rattachée à son évènement quand il y en a un. Les rendez-vous d'essai ne sont
// jamais trouvés. L'oubli anonymise : le rendez-vous reste (statistiques, historique de l'agenda)
// sans rien qui désigne la personne ; un rendez-vous à venir est annulé, son lien de gestion retiré.
import { and, eq, inArray } from "drizzle-orm";
import { appointmentReports, appointments } from "@symbola/db/schema/appointments";
import { ANONYMIZED, hasTerms, idsOfKind, prepareTerms, recordMatches, type ErasurePlanItem, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";
import { inOrganization, type AppointmentRow, type Tx } from "./repository";

const MODULE = "appointments";
const KIND = "appointment";

function compact(fields: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
}

function toRecord(row: AppointmentRow, notes: string | null): PrivacyRecord {
  return {
    module: MODULE,
    kind: KIND,
    recordId: row.id,
    label: `${row.personName} — ${row.typeName} (${row.startsAt.toISOString().slice(0, 10)})`,
    fields: compact({
      name: row.personName,
      email: row.personEmail,
      phone: row.personPhone,
      appointment: `${row.typeName}, ${row.startsAt.toISOString()}`,
      answers: row.answers.map((answer) => `${answer.label} : ${answer.answer}`).join(" · ") || null,
      reportNotes: notes,
    }),
    eventId: row.eventId,
  };
}

async function notesOf(tx: Tx, ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const rows = await tx.select({ appointmentId: appointmentReports.appointmentId, notes: appointmentReports.notes }).from(appointmentReports).where(inArray(appointmentReports.appointmentId, ids));
  return new Map(rows.map((row) => [row.appointmentId, row.notes]));
}

async function existing(tx: Tx, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  return (await tx.select({ id: appointments.id }).from(appointments).where(and(inArray(appointments.id, ids), eq(appointments.isDemo, false)))).map((row) => row.id);
}

const plan = (ids: string[]): ErasurePlanItem[] => ids.map((recordId) => ({ kind: KIND, recordId, fate: "anonymized", legalBasis: null, keptUntil: null }));

export const appointmentsPrivacy: PrivacyContractV1 = {
  module: MODULE,

  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    return inOrganization(organizationId, async (tx) => {
      const rows = await tx.select().from(appointments).where(eq(appointments.isDemo, false));
      const notes = await notesOf(tx, rows.map((row) => row.id));
      return rows
        .filter((row) => recordMatches([row.personName, row.personEmail, row.personPhone, ...row.answers.map((answer) => answer.answer), notes.get(row.id) ?? null], terms))
        .map((row) => toRecord(row, notes.get(row.id) ?? null));
    });
  },

  async related({ organizationId, eventIds }) {
    if (eventIds.length === 0) return [];
    return inOrganization(organizationId, async (tx) => {
      const rows = await tx.select().from(appointments).where(and(inArray(appointments.eventId, eventIds), eq(appointments.isDemo, false)));
      const notes = await notesOf(tx, rows.map((row) => row.id));
      return rows.map((row) => toRecord(row, notes.get(row.id) ?? null));
    });
  },

  async planErasure(input) {
    return inOrganization(input.organizationId, async (tx) => plan(await existing(tx, idsOfKind(input.records, KIND))));
  },

  async erase(input) {
    return inOrganization(input.organizationId, async (tx) => {
      const ids = await existing(tx, idsOfKind(input.records, KIND));
      if (ids.length === 0) return [];
      const now = new Date();
      const rows = await tx.select({ id: appointments.id, status: appointments.status, endsAt: appointments.endsAt }).from(appointments).where(inArray(appointments.id, ids));
      const upcoming = rows.filter((row) => row.status === "booked" && row.endsAt.getTime() > now.getTime()).map((row) => row.id);
      await tx
        .update(appointments)
        .set({ personName: ANONYMIZED, personEmail: null, personPhone: null, answers: [], contactId: null, manageTokenHash: null, manageTokenSealed: null, updatedAt: now })
        .where(inArray(appointments.id, ids));
      if (upcoming.length > 0) await tx.update(appointments).set({ status: "cancelled", cancelledAt: now, cancelledBy: "planner" }).where(inArray(appointments.id, upcoming));
      await tx.update(appointmentReports).set({ notes: null, updatedAt: now }).where(inArray(appointmentReports.appointmentId, ids));
      return plan(ids);
    });
  },
};

// RGP-05 (DPO-2, défaut prudent) : une personne qui a seulement pris rendez-vous, sans évènement,
// suit la règle des prospects à compter de son dernier échange (le plus récent de ses rendez-vous).
export async function listAppointmentRetention(organizationId: string): Promise<{ appointmentId: string; label: string; lastActivity: Date }[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(appointments).where(eq(appointments.isDemo, false));
    const latest = new Map<string, number>();
    const personKey = (row: AppointmentRow) => row.personEmail ?? `id:${row.id}`;
    for (const row of rows) {
      const activity = Math.max(row.endsAt.getTime(), row.createdAt.getTime(), row.rescheduledAt?.getTime() ?? 0, row.cancelledAt?.getTime() ?? 0);
      latest.set(personKey(row), Math.max(latest.get(personKey(row)) ?? 0, activity));
    }
    return rows
      .filter((row) => row.eventId === null && row.personName !== ANONYMIZED)
      .map((row) => ({ appointmentId: row.id, label: `${row.personName} — ${row.typeName}`, lastActivity: new Date(latest.get(personKey(row))!) }));
  });
}
