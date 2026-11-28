// Lot 72e (EVT-02, J13 ; critère 2) — contre un vrai PostgreSQL : la suite d'une fiche lit les mêmes lignes
// que l'accueil, restreintes à l'évènement, toutes personnes confondues, sans les tâches hors évènement ni
// les autres mariages ; un évènement d'une autre organisation ne donne aucune ligne (SEC-10, SEC-13).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { addEventTask, createProspect, createProspectSource, setEventTeamMember } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { loadTodayItems, type TodayWords } from "./load";
import { rankToday } from "./rank";

const words: TodayWords = {
  clientTask: "Tâche des mariés",
  amount: (label, amount) => `${label} · ${amount}`,
  decision: (title) => title,
  paymentDeclaration: (label) => label,
  quoteFollowUp: (number) => number,
  prospectFollowUp: "Prospect",
  depositBlocked: (number) => number,
  vendorContract: (vendor) => vendor,
  dateConflict: (count) => String(count),
  linkRenewal: (name) => name,
  standaloneTask: "Hors évènement",
  watch: (alert) => ({ title: `À regarder : ${alert.label}` }),
};
const MODULES = { events: true, quotes: false, budget: false };
// 25 nov. 2026, 10 h à Paris.
const NOW = new Date("2026-11-25T09:00:00Z");

async function atelier() {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
  const camille = await createUser(db, { organizationId, email: `camille-${randomUUID()}@example.test`, role: "owner" });
  const bastien = await createUser(db, { organizationId, email: `bastien-${randomUUID()}@example.test`, role: "member" });
  const source = await createProspectSource(organizationId, "Salon");
  const wedding = async (firstName: string) => (await createProspect({ organizationId, createdByUserId: camille.id, prospectSourceId: source.id, clients: [{ firstName, lastName: "Martin" }], eventDate: "2027-06-12" })).id;
  const lea = await wedding("Léa");
  const ines = await wedding("Inès");
  await setEventTeamMember({ organizationId, eventId: lea, userId: camille.id, role: "lead", byUserId: camille.id });
  await addEventTask(organizationId, lea, { label: "Faire signer le contrat du photographe", dueDate: "2026-11-20", responsible: "planner", assigneeUserId: camille.id });
  await addEventTask(organizationId, lea, { label: "Confirmer la voiture des mariés", dueDate: "2026-11-21", responsible: "planner", assigneeUserId: bastien.id });
  await addEventTask(organizationId, lea, { label: "Choisir le fleuriste", dueDate: "2026-11-29", responsible: "clients" });
  await addEventTask(organizationId, lea, { label: "Au-delà de l'horizon", dueDate: "2027-03-01", responsible: "planner" });
  await addEventTask(organizationId, ines, { label: "Choisir le menu", dueDate: "2026-11-27", responsible: "planner" });
  return { organizationId, lea, ines };
}

describe("EVT-02 — La suite de la fiche : les lignes de l'accueil, restreintes à l'évènement (lot 72e, critère 2, J13)", () => {
  it("les mêmes lignes et les mêmes comptes que l'accueil pour cet évènement, toutes personnes confondues", async () => {
    const context = await atelier();
    const home = await loadTodayItems(context.organizationId, MODULES, words, "fr", NOW);
    const homeRanked = rankToday(home.items, home.today);
    const sheet = await loadTodayItems(context.organizationId, MODULES, words, "fr", NOW, undefined, { eventId: context.lea });
    const sheetRanked = rankToday(sheet.items, sheet.today);
    expect(sheetRanked.all.map((item) => item.key)).toEqual(homeRanked.all.filter((item) => item.eventId === context.lea).map((item) => item.key));
    expect(sheetRanked.points).toBe(homeRanked.pointsByEvent.get(context.lea));
    expect(sheetRanked.late).toBe(homeRanked.lateByEvent.get(context.lea));
    expect(sheetRanked.points).toBe(3);
    expect(sheetRanked.late).toBe(2);
  });

  it("ni les autres mariages, ni les lignes hors évènement ; l'évènement seul est relu", async () => {
    const context = await atelier();
    const sheet = await loadTodayItems(context.organizationId, MODULES, words, "fr", NOW, undefined, { eventId: context.lea });
    expect(sheet.items.every((item) => item.eventId === context.lea)).toBe(true);
    expect(sheet.events.map((event) => event.id)).toEqual([context.lea]);
  });

  it("un évènement d'une autre organisation ne donne aucune ligne", async () => {
    const a = await atelier();
    const b = await atelier();
    const sheet = await loadTodayItems(b.organizationId, MODULES, words, "fr", NOW, undefined, { eventId: a.lea });
    expect(sheet.items).toEqual([]);
    expect(sheet.events).toEqual([]);
  });
});
