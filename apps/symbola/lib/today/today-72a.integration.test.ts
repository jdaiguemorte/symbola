// Lot 72a (HUB-08, UX-13, PAR-10, EVT-06, GC-02 ; J3, J7 ; critères 4 à 7) — contre un vrai PostgreSQL :
// le contact d'une ligne lu depuis la fiche de la même organisation ; la portée « Moi » d'une agence ; le
// radar en lignes « À regarder », coupé ou filtré par la visibilité du lot 52 ; aucune ligne, aucun
// contact ni compte d'une autre organisation.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { addEventTask, createProspect, createProspectSource, setEventTeamMember, setTaskMilestone, visibleEventIds } from "@/modules/events/service";
import { saveOnboardingStep, setAutomationEnabled, setEventVisibility } from "@/modules/hub/service";
import { withinScope } from "@/lib/event-visibility";
import { loadTodayItems, type TodayWords } from "./load";
import { loadMeScope } from "./me-scope";
import { rankToday } from "./rank";
import { meScope } from "./scope";

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
  watch: (alert) => ({ title: `À regarder : ${alert.label}` }),
};
const MODULES = { events: true, quotes: false, budget: false };
// 25 nov. 2026, 10 h à Paris.
const NOW = new Date("2026-11-25T09:00:00Z");

async function agence() {
  const db = appDatabase();
  const organizationId = (await createOrganization(db, `Agence ${randomUUID().slice(0, 6)}`)).id;
  await saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, metier: "wedding_planner" });
  const camille = await createUser(db, { organizationId, email: `camille-${randomUUID()}@example.test`, role: "owner" });
  const bastien = await createUser(db, { organizationId, email: `bastien-${randomUUID()}@example.test`, role: "member" });
  const source = await createProspectSource(organizationId, "Salon");
  const wedding = async (firstName: string, phone: string | null, email: string | null) =>
    (await createProspect({ organizationId, createdByUserId: camille.id, prospectSourceId: source.id, clients: [{ firstName, lastName: "Martin", phone, email }, { firstName: "Second", lastName: null }], eventDate: "2027-06-12" })).id;
  const ofCamille = await wedding("Léa", "06 00 00 41 27", "lea@example.test");
  const free = await wedding("Inès", null, "ines@example.test");
  await setEventTeamMember({ organizationId, eventId: ofCamille, userId: camille.id, role: "lead", byUserId: camille.id });
  await setEventTeamMember({ organizationId, eventId: free, userId: bastien.id, role: "assistant", byUserId: camille.id });
  const camilleTask = await addEventTask(organizationId, ofCamille, { label: "Rappeler la mère de la mariée", dueDate: "2026-11-26", responsible: "planner", assigneeUserId: camille.id });
  await addEventTask(organizationId, ofCamille, { label: "Relire le contrat", dueDate: "2026-11-27", responsible: "planner", assigneeUserId: bastien.id });
  await addEventTask(organizationId, ofCamille, { label: "Valider le faire-part", dueDate: "2026-12-03", responsible: "clients" });
  await addEventTask(organizationId, free, { label: "Choisir le menu", dueDate: "2026-12-01", responsible: "clients" });
  // Un jalon en retard de dix jours : une alerte du radar (seuil de départ : un jour).
  const milestone = await addEventTask(organizationId, ofCamille, { label: "Réserver le lieu", dueDate: "2026-11-15", responsible: "planner", assigneeUserId: camille.id });
  await setTaskMilestone(organizationId, ofCamille, milestone.id, true);
  return { organizationId, camille: camille.id, bastien: bastien.id, ofCamille, free, camilleTask: camilleTask.id };
}

describe("HUB-08, UX-13 — Contact, portée « Moi » et radar en lignes (lot 72a)", () => {
  it("critère 4 : une ligne qui attend les mariés porte le contact du premier client ; sans téléphone, l'e-mail", async () => {
    const context = await agence();
    const { items } = await loadTodayItems(context.organizationId, MODULES, words, "fr", NOW);
    const clientLine = (eventId: string) => items.find((item) => item.kind === "client_task" && item.eventId === eventId);
    expect(clientLine(context.ofCamille)?.contact).toEqual({ name: "Léa Martin", phone: "06 00 00 41 27", email: "lea@example.test" });
    expect(clientLine(context.free)?.contact).toEqual({ name: "Inès Martin", phone: null, email: "ines@example.test" });
    expect(items.find((item) => item.task?.id === context.camilleTask)?.contact).toBeUndefined();
  });

  it("critère 5 : « Moi » ne montre à Bastien ni les tâches de Camille ni les lignes de son mariage ; il voit celles d'un mariage sans planner principal", async () => {
    const context = await agence();
    const { items, events } = await loadTodayItems(context.organizationId, MODULES, words, "fr", NOW);
    const mine = meScope(items, await loadMeScope(context.organizationId, context.bastien, events.map((event) => event.id)));
    const labels = mine.map((item) => item.task?.label ?? item.title);
    expect(labels).toContain("Relire le contrat");
    expect(labels).toContain("Choisir le menu");
    expect(labels).not.toContain("Rappeler la mère de la mariée");
    expect(labels).not.toContain("Valider le faire-part");
    expect(mine.some((item) => item.kind === "watch")).toBe(false);
    const camilles = meScope(items, await loadMeScope(context.organizationId, context.camille, events.map((event) => event.id)));
    expect(camilles.map((item) => item.task?.label ?? item.title)).toEqual(expect.arrayContaining(["Rappeler la mère de la mariée", "Valider le faire-part", "Choisir le menu"]));
  });

  it("critère 6 : une alerte du radar est une ligne « À regarder », comptée ; radar coupé, aucune ligne", async () => {
    const context = await agence();
    const loaded = await loadTodayItems(context.organizationId, MODULES, words, "fr", NOW);
    const watch = loaded.items.filter((item) => item.kind === "watch");
    expect(watch).toEqual([expect.objectContaining({ eventId: context.ofCamille, title: "À regarder : Réserver le lieu" })]);
    const ranked = rankToday(loaded.items, loaded.today);
    expect(ranked.all.some((item) => item.kind === "watch")).toBe(true);
    await setAutomationEnabled(context.organizationId, "risk_radar", false, NOW);
    const off = await loadTodayItems(context.organizationId, MODULES, words, "fr", NOW);
    expect(off.items.some((item) => item.kind === "watch")).toBe(false);
  });

  it("critère 7 : une Planner restreinte ne voit ni ligne, ni alerte du radar, ni nombre d'un évènement hors de son équipe ; B ne lit rien de A", async () => {
    const context = await agence();
    await setEventVisibility(appDatabase(), { organizationId: context.organizationId, allPlannersSeeAll: false, byUserId: context.camille });
    const scope = await visibleEventIds(context.organizationId, { userId: context.bastien, role: "member", allPlannersSeeAll: false });
    const { items, today } = await loadTodayItems(context.organizationId, MODULES, words, "fr", NOW);
    const visible = withinScope(scope, items, (item) => item.eventId);
    expect(visible.some((item) => item.eventId === context.ofCamille)).toBe(false);
    expect(visible.some((item) => item.kind === "watch")).toBe(false);
    expect(rankToday(visible, today).pointsByEvent.has(context.ofCamille)).toBe(false);
    expect(visible.some((item) => item.eventId === context.free)).toBe(true);

    const other = (await createOrganization(appDatabase(), `Autre ${randomUUID().slice(0, 6)}`)).id;
    const fromB = await loadTodayItems(other, MODULES, words, "fr", NOW);
    expect(fromB.items.filter((item) => item.eventId === context.ofCamille || item.contact)).toEqual([]);
  });
});
