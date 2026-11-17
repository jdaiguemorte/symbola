// Lot 40c (NFR-01, NFR-02, NFR-17, NFR-19) — l'atelier des mesures, du zoom et du clavier : une
// titulaire, le mariage confirmé d'Inès et Sacha dans 120 jours (lieu et traiteur au budget, huit tâches
// dont deux confiées aux mariés), et le lien du couple vers son portail.
import { randomUUID } from "node:crypto";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { addVendorPayment, listBudgetLines, updateBudgetLine } from "../modules/budget/service";
import { addDefaultVendorSlots, addEventTask, changeEventStatus, createEventLink, createProspect, createProspectSource, listEventVendorSlots } from "../modules/events/service";
import { readyOrganization } from "./helpers";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export type Atelier40c = { email: string; organizationId: string; eventId: string; coupleUrl: string };

export async function atelier40c(tag: string): Promise<Atelier40c> {
  const today = parisToday();
  const email = `planner-${tag}-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`);
    const organizationId = organization.id;
    const user = await createUser(db, { organizationId, email, role: "owner" });
    await addDefaultVendorSlots(organizationId, ["Lieu de réception", "Traiteur"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }, { firstName: "Sacha" }], eventDate: addDays(today, 120), applyTemplate: false });
    // Confirmé : le mode jour J ne s'ouvre que pour un évènement confirmé (JRJ-01).
    await changeEventStatus({ organizationId, eventId: event.id, changedByUserId: user.id, toStatus: "confirmed" });
    const tasks: [string, number, "planner" | "clients"][] = [
      ["Réserver le traiteur", -2, "planner"],
      ["Confirmer le lieu", 0, "planner"],
      ["Choisir les faire-part", 4, "clients"],
      ["Envoyer la liste des invités", 9, "clients"],
      ["Relancer le photographe", 12, "planner"],
      ["Composer le plan de table", 40, "planner"],
      ["Organiser la dégustation", 55, "planner"],
      ["Préparer le programme du jour J", 100, "planner"],
    ];
    for (const [label, days, responsible] of tasks) await addEventTask(organizationId, event.id, { label, dueDate: addDays(today, days), responsible });
    const slots = await listEventVendorSlots(organizationId, event.id);
    for (const [label, cents] of [["Lieu de réception", 980000], ["Traiteur", 960000]] as const) {
      const slot = slots.find((candidate) => candidate.label === label)!;
      for (const field of ["estimated", "committed"] as const) await updateBudgetLine({ organizationId, eventId: event.id, eventVendorSlotId: slot.id, field, amountCents: cents, changedByUserId: user.id });
    }
    const caterer = slots.find((slot) => slot.label === "Traiteur")!;
    const lineId = (await listBudgetLines(organizationId, event.id)).lines.find((line) => line.eventVendorSlotId === caterer.id)!.id;
    await addVendorPayment({ organizationId, eventId: event.id, lineId, label: "Acompte", fixedAmountCents: 288000, dueOn: addDays(today, 10), changedByUserId: user.id });
    const couple = await createEventLink({
      organizationId,
      eventId: event.id,
      createdByUserId: user.id,
      audience: "client",
      locale: "fr",
      link: { personName: "Inès", email: `${randomUUID()}@symbola.test`, rights: { rubrics: ["tasks", "program", "budget"], budgetScope: "all", sharedSlotIds: [] } },
    });
    return { email, organizationId, eventId: event.id, coupleUrl: couple.url };
  } finally {
    await sql.end();
  }
}
