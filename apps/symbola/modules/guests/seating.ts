// Lot 50 (INV-05, INV-06 ; D1 à D9) — plan de table et synthèse pour le traiteur. Un plan par temps
// fort à table ; tables en série, copie d'un plan ; placement d'un invité ou d'un foyer (présents et
// « en attente » seulement), une place par invité et par plan ; contraintes « ensemble » et
// « séparés » et capacité signalées, jamais bloquantes ; repas des prestataires ; synthèse calculée à
// la demande (nominative pour la titulaire seule, agrégée exacte pour un membre), jamais rangée,
// chaque téléchargement tracé sans contenu. Le client n'a ni plan ni synthèse (D9). Exposé seulement
// par service.ts (ADR 0011) ; chaque requête passe par withOrganization (RLS, SEC-10).
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import {
  catererSummaryDownloads,
  eventSettings,
  guests,
  households,
  seatAssignments,
  seatingConstraintMembers,
  seatingConstraints,
  seatingPlans,
  seatingTables,
  vendorMealCounts,
} from "@symbola/db/schema/guests";
import { starterDietaryOptionLabel, starterGuestRules, starterSeatingRules } from "@symbola/starter-templates";
import {
  SEATING_SHAPES,
  type CatererSummary,
  type CatererSummaryFormat,
  type CatererSummaryVersion,
  type GuestEventContext,
  type GuestLocale,
  type GuestViewer,
  type KeyMoment,
  type SeatingAlert,
  type SeatingConstraintKind,
  type SeatingGuest,
  type SeatingGuestStatus,
  type SeatingMoment,
  type SeatingMomentSummary,
  type SeatingPlanView,
  type SeatingTableInput,
  type SeatingTablesInput,
} from "@symbola/contracts";
import { buildCatererSummary } from "./caterer-summary";
import { aggregateDiets, dietPlace, openDietOptions } from "./diets";
import { assertGuestsReady, eventContext } from "./households";
import { mealTypeLabel } from "./meal-types";
import { ensureDietaryOptions, ensureMealTypes, inOrganization, loadEventRows, UUID, type EventGuestRows, type Tx } from "./repository";
import { invitedMoments } from "./rsvp";
import { SeatingInvalidError, SeatingNotFoundError } from "./seating-errors";
import { resolveMealType, seatEligibility, seatingAlerts, seriesNames } from "./seating-rules";

type PlanRow = typeof seatingPlans.$inferSelect;
type TableRow = typeof seatingTables.$inferSelect;
type SeatRow = typeof seatAssignments.$inferSelect;

const personName = (person: { firstName: string; lastName: string | null }) => (person.lastName ? `${person.firstName} ${person.lastName}` : person.firstName);

function momentOf(context: GuestEventContext, keyMomentId: string): KeyMoment {
  const moment = UUID.test(keyMomentId) ? context.keyMoments.find((candidate) => candidate.id === keyMomentId) : undefined;
  if (!moment) throw new SeatingNotFoundError();
  return moment;
}

const momentView = (moment: KeyMoment): SeatingMoment => ({ id: moment.id, name: moment.name, date: moment.date, startTime: moment.startTime });

// D9 : la titulaire et les membres de l'équipe composent le plan ; jamais le client.
function assertTeam(viewer: GuestViewer): void {
  if (viewer.kind === "client") throw new SeatingNotFoundError();
}

// Présence de chaque invité au temps fort : présent, en attente, ou absent de la liste (décliné, non
// invité).
function eligibilityOf(rows: EventGuestRows, context: GuestEventContext, keyMomentId: string): Map<string, SeatingGuestStatus> {
  const allMoments = context.keyMoments.map((moment) => moment.id);
  const invited = new Map(rows.households.map((household) => [household.id, invitedMoments(household.keyMomentIds, allMoments).includes(keyMomentId)]));
  const answers = new Map(rows.answers.filter((answer) => answer.keyMomentId === keyMomentId).map((answer) => [answer.guestId, answer.attending]));
  const result = new Map<string, SeatingGuestStatus>();
  for (const person of rows.people) {
    const status = seatEligibility({ invited: invited.get(person.householdId) ?? false, attending: answers.get(person.id) });
    if (status) result.set(person.id, status);
  }
  return result;
}

async function planOfMoment(tx: Tx, eventId: string, keyMomentId: string): Promise<PlanRow | null> {
  const [plan] = await tx.select().from(seatingPlans).where(and(eq(seatingPlans.keyMomentId, keyMomentId), eq(seatingPlans.eventId, eventId)));
  return plan ?? null;
}

async function planInEvent(tx: Tx, eventId: string, planId: string): Promise<PlanRow> {
  if (!UUID.test(planId)) throw new SeatingNotFoundError();
  const [plan] = await tx.select().from(seatingPlans).where(and(eq(seatingPlans.id, planId), eq(seatingPlans.eventId, eventId)));
  if (!plan) throw new SeatingNotFoundError();
  return plan;
}

async function tableInEvent(tx: Tx, eventId: string, tableId: string): Promise<TableRow> {
  if (!UUID.test(tableId)) throw new SeatingNotFoundError();
  const [row] = await tx.select({ table: seatingTables }).from(seatingTables).innerJoin(seatingPlans, eq(seatingPlans.id, seatingTables.planId)).where(and(eq(seatingTables.id, tableId), eq(seatingPlans.eventId, eventId)));
  if (!row) throw new SeatingNotFoundError();
  return row.table;
}

type PlanContent = { tables: TableRow[]; seats: SeatRow[]; constraints: { id: string; kind: SeatingConstraintKind; guestIds: string[] }[] };

async function planContent(tx: Tx, planId: string): Promise<PlanContent> {
  const tables = await tx.select().from(seatingTables).where(eq(seatingTables.planId, planId)).orderBy(asc(seatingTables.position), asc(seatingTables.createdAt));
  const seats = await tx.select().from(seatAssignments).where(eq(seatAssignments.planId, planId));
  const constraintRows = await tx.select().from(seatingConstraints).where(eq(seatingConstraints.planId, planId)).orderBy(asc(seatingConstraints.createdAt));
  const members = constraintRows.length > 0 ? await tx.select().from(seatingConstraintMembers).where(inArray(seatingConstraintMembers.constraintId, constraintRows.map((row) => row.id))).orderBy(asc(seatingConstraintMembers.createdAt)) : [];
  const constraints = constraintRows
    .map((row) => ({ id: row.id, kind: row.kind, guestIds: members.filter((member) => member.constraintId === row.id).map((member) => member.guestId) }))
    .filter((constraint) => constraint.guestIds.length >= 2);
  return { tables, seats, constraints };
}

function dietsOf(organizationId: string, rows: EventGuestRows): Map<string, string[]> {
  return new Map(rows.dietRows.map((row) => [row.guestId, openDietOptions(row.optionsSealed, dietPlace(organizationId, row.guestId))]));
}

// —— Les temps forts et leurs plans ———————————————————————————————————————————————————

export async function listSeatingMoments(organizationId: string, eventId: string): Promise<SeatingMomentSummary[]> {
  const context = await eventContext(organizationId, eventId);
  const { rows, plans, seats, tables } = await inOrganization(organizationId, async (tx) => {
    const plans = await tx.select().from(seatingPlans).where(eq(seatingPlans.eventId, eventId));
    const ids = plans.map((plan) => plan.id);
    return {
      rows: await loadEventRows(tx, eventId),
      plans,
      seats: ids.length > 0 ? await tx.select().from(seatAssignments).where(and(inArray(seatAssignments.planId, ids), isNull(seatAssignments.releasedAt))) : [],
      tables: ids.length > 0 ? await tx.select({ id: seatingTables.id, planId: seatingTables.planId }).from(seatingTables).where(inArray(seatingTables.planId, ids)) : [],
    };
  });
  return context.keyMoments.map((moment) => {
    const eligible = eligibilityOf(rows, context, moment.id);
    const plan = plans.find((candidate) => candidate.keyMomentId === moment.id) ?? null;
    const statuses = [...eligible.values()];
    return {
      ...momentView(moment),
      planId: plan?.id ?? null,
      tables: plan ? tables.filter((table) => table.planId === plan.id).length : 0,
      placed: plan ? seats.filter((seat) => seat.planId === plan.id && eligible.has(seat.guestId)).length : 0,
      present: statuses.filter((status) => status === "present").length,
      pending: statuses.filter((status) => status === "pending").length,
    };
  });
}

// D1 : le plan d'un temps fort (créé une fois ; recréer rend le même).
export async function createSeatingPlan(organizationId: string, eventId: string, keyMomentId: string): Promise<string> {
  await assertGuestsReady(organizationId);
  const context = await eventContext(organizationId, eventId);
  const moment = momentOf(context, keyMomentId);
  return inOrganization(organizationId, async (tx) => {
    await tx.insert(seatingPlans).values({ organizationId, eventId, keyMomentId: moment.id }).onConflictDoNothing({ target: seatingPlans.keyMomentId });
    const plan = await planOfMoment(tx, eventId, moment.id);
    if (!plan) throw new SeatingNotFoundError();
    return plan.id;
  });
}

export async function removeSeatingPlan(organizationId: string, eventId: string, planId: string): Promise<void> {
  await eventContext(organizationId, eventId);
  await inOrganization(organizationId, async (tx) => {
    const plan = await planInEvent(tx, eventId, planId);
    await tx.delete(seatingPlans).where(eq(seatingPlans.id, plan.id));
  });
}

// —— Vue du plan (INV-05) ——————————————————————————————————————————————————————————

export async function getSeatingPlan(organizationId: string, eventId: string, keyMomentId: string, viewer: GuestViewer, locale: GuestLocale = "fr"): Promise<SeatingPlanView> {
  assertTeam(viewer);
  const context = await eventContext(organizationId, eventId);
  const moment = momentOf(context, keyMomentId);
  const data = await inOrganization(organizationId, async (tx) => {
    const plan = await planOfMoment(tx, eventId, moment.id);
    const [vendor] = await tx.select().from(vendorMealCounts).where(eq(vendorMealCounts.keyMomentId, moment.id));
    return {
      rows: await loadEventRows(tx, eventId),
      plan,
      content: plan ? await planContent(tx, plan.id) : ({ tables: [], seats: [], constraints: [] } satisfies PlanContent),
      types: await ensureMealTypes(tx, organizationId),
      options: await ensureDietaryOptions(tx, organizationId),
      vendorMeals: vendor?.mealCount ?? 0,
    };
  });
  const { rows, plan, content, types, options } = data;
  const eligible = eligibilityOf(rows, context, moment.id);
  const householdOf = new Map(rows.households.map((household) => [household.id, household]));
  const names = new Map(rows.people.map((person) => [person.id, personName(person)]));
  const tableIds = new Set(content.tables.map((table) => table.id));
  const active = content.seats.filter((seat) => seat.releasedAt === null && seat.tableId !== null && tableIds.has(seat.tableId));
  const tableOfGuest = new Map(active.map((seat) => [seat.guestId, seat.tableId!]));
  const typeLabel = new Map(types.map((type) => [type.id, mealTypeLabel(type, locale)]));

  const seatingGuests: SeatingGuest[] = rows.people.flatMap((person) => {
    const status = eligible.get(person.id);
    if (!status) return [];
    const household = householdOf.get(person.householdId)!;
    const meal = resolveMealType(person, types);
    return [
      {
        id: person.id,
        name: personName(person),
        householdId: household.id,
        householdName: household.displayName,
        kind: person.kind,
        ageRange: person.ageRange,
        mealTypeId: meal.id,
        mealTypeLabel: meal.id ? (typeLabel.get(meal.id) ?? "") : "",
        mealTypeChosen: meal.chosen,
        status,
        tableId: plan ? (tableOfGuest.get(person.id) ?? null) : null,
      },
    ];
  });

  // Régimes de la table, en nombres : exacts pour la titulaire, « moins de N » pour un membre (règle
  // du lot 49).
  const threshold = viewer.kind === "owner" ? 1 : starterGuestRules().aggregateThreshold;
  const optionViews = options.map((option) => ({ id: option.id, kind: option.kind, label: option.starterKey ? (starterDietaryOptionLabel(option.starterKey, locale) ?? option.starterKey) : (option.label ?? "") }));
  const diets = dietsOf(organizationId, rows);
  const seated = seatingGuests.filter((guest) => guest.tableId !== null);
  const tables = content.tables.map((table) => {
    const here = seated.filter((guest) => guest.tableId === table.id);
    return {
      id: table.id,
      name: table.name,
      shape: table.shape,
      capacity: table.capacity,
      position: table.position,
      occupied: here.length,
      children: here.filter((guest) => guest.kind === "child").length,
      diets: aggregateDiets(here.map((guest) => ({ optionIds: diets.get(guest.id) ?? [] })), optionViews, threshold),
    };
  });

  const alerts: SeatingAlert[] = [
    ...seatingAlerts({ tables: content.tables, seats: seated.map((guest) => ({ guestId: guest.id, tableId: guest.tableId! })), constraints: content.constraints, names }),
    ...content.seats
      .filter((seat) => seat.releasedAt !== null && names.has(seat.guestId))
      .sort((a, b) => (names.get(a.guestId) ?? "").localeCompare(names.get(b.guestId) ?? "", "fr"))
      .map((seat): SeatingAlert => ({ kind: "released", guestId: seat.guestId, guestName: names.get(seat.guestId)!, tableName: seat.releasedTableName })),
    ...active.filter((seat) => !eligible.has(seat.guestId) && names.has(seat.guestId)).map((seat): SeatingAlert => ({ kind: "notInvited", guestId: seat.guestId, guestName: names.get(seat.guestId)!, tableId: seat.tableId! })),
  ];

  return {
    eventId,
    keyMoment: momentView(moment),
    planId: plan?.id ?? null,
    tables,
    guests: seatingGuests,
    unplacedCount: seatingGuests.filter((guest) => guest.status === "present" && guest.tableId === null).length,
    constraints: content.constraints.map((constraint) => ({ id: constraint.id, kind: constraint.kind, members: constraint.guestIds.map((id) => ({ id, name: names.get(id) ?? "" })) })),
    alerts,
    vendorMeals: data.vendorMeals,
  };
}

// —— Tables (D2) ———————————————————————————————————————————————————————————————————

function checkTable(input: { shape: string; capacity: number }): void {
  const rules = starterSeatingRules();
  if (!(SEATING_SHAPES as readonly string[]).includes(input.shape)) throw new SeatingInvalidError("capacity");
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > rules.maxCapacity) throw new SeatingInvalidError("capacity");
}

function cleanName(name: string, max = 60): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > max) throw new SeatingInvalidError("table_name");
  return clean;
}

// « 12 tables rondes de 10 » : numérotées à la suite.
export async function addSeatingTables(organizationId: string, eventId: string, planId: string, input: SeatingTablesInput): Promise<string[]> {
  await assertGuestsReady(organizationId);
  await eventContext(organizationId, eventId);
  const rules = starterSeatingRules();
  checkTable(input);
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > rules.maxTablesPerSeries) throw new SeatingInvalidError("count");
  const prefix = cleanName(input.namePrefix, 40);
  return inOrganization(organizationId, async (tx) => {
    const plan = await planInEvent(tx, eventId, planId);
    const existing = await tx.select({ name: seatingTables.name, position: seatingTables.position }).from(seatingTables).where(eq(seatingTables.planId, plan.id));
    if (existing.length + input.count > rules.maxTablesPerPlan) throw new SeatingInvalidError("too_many_tables");
    const start = existing.reduce((max, row) => Math.max(max, row.position + 1), 0);
    const names = seriesNames(existing.map((row) => row.name), input.count, prefix);
    if (names.some((name) => name.length > 60)) throw new SeatingInvalidError("table_name");
    const created = await tx
      .insert(seatingTables)
      .values(names.map((name, index) => ({ organizationId, planId: plan.id, name, shape: input.shape, capacity: input.capacity, position: start + index })))
      .returning({ id: seatingTables.id });
    return created.map((row) => row.id);
  });
}

export async function updateSeatingTable(organizationId: string, eventId: string, tableId: string, input: SeatingTableInput): Promise<void> {
  await assertGuestsReady(organizationId);
  await eventContext(organizationId, eventId);
  checkTable(input);
  const name = cleanName(input.name);
  await inOrganization(organizationId, async (tx) => {
    const table = await tableInEvent(tx, eventId, tableId);
    await tx.update(seatingTables).set({ name, shape: input.shape, capacity: input.capacity, updatedAt: new Date() }).where(eq(seatingTables.id, table.id));
  });
}

// Ses invités reviennent dans « Non placés » (places supprimées en cascade).
export async function removeSeatingTable(organizationId: string, eventId: string, tableId: string): Promise<void> {
  await eventContext(organizationId, eventId);
  await inOrganization(organizationId, async (tx) => {
    const table = await tableInEvent(tx, eventId, tableId);
    await tx.delete(seatingTables).where(eq(seatingTables.id, table.id));
  });
}

// Copie du plan d'un temps fort vers un autre : les tables, et les places de ceux qui se placent au
// temps fort d'arrivée (présents ou en attente). Le plan d'arrivée doit être vide.
export async function copySeatingPlan(organizationId: string, eventId: string, fromKeyMomentId: string, toKeyMomentId: string): Promise<{ tables: number; seats: number }> {
  await assertGuestsReady(organizationId);
  const context = await eventContext(organizationId, eventId);
  const from = momentOf(context, fromKeyMomentId);
  const to = momentOf(context, toKeyMomentId);
  if (from.id === to.id) throw new SeatingInvalidError("same_moment");
  return inOrganization(organizationId, async (tx) => {
    const source = await planOfMoment(tx, eventId, from.id);
    if (!source) throw new SeatingNotFoundError();
    await tx.insert(seatingPlans).values({ organizationId, eventId, keyMomentId: to.id }).onConflictDoNothing({ target: seatingPlans.keyMomentId });
    const target = (await planOfMoment(tx, eventId, to.id))!;
    const already = await tx.select({ id: seatingTables.id }).from(seatingTables).where(eq(seatingTables.planId, target.id)).limit(1);
    if (already.length > 0) throw new SeatingInvalidError("target_not_empty");
    const content = await planContent(tx, source.id);
    const eligible = eligibilityOf(await loadEventRows(tx, eventId), context, to.id);
    const mapping = new Map<string, string>();
    for (const table of content.tables) {
      const [created] = await tx.insert(seatingTables).values({ organizationId, planId: target.id, name: table.name, shape: table.shape, capacity: table.capacity, position: table.position }).returning({ id: seatingTables.id });
      mapping.set(table.id, created!.id);
    }
    const seats = content.seats.filter((seat) => seat.releasedAt === null && seat.tableId && mapping.has(seat.tableId) && eligible.has(seat.guestId));
    if (seats.length > 0) await tx.insert(seatAssignments).values(seats.map((seat) => ({ organizationId, planId: target.id, tableId: mapping.get(seat.tableId!)!, guestId: seat.guestId })));
    return { tables: content.tables.length, seats: seats.length };
  });
}

// —— Placement (D3) ————————————————————————————————————————————————————————————————

async function seatIn(tx: Tx, organizationId: string, context: GuestEventContext, plan: PlanRow, guestIds: string[], tableId: string | null): Promise<number> {
  if (tableId === null) {
    const removed = await tx.delete(seatAssignments).where(and(eq(seatAssignments.planId, plan.id), inArray(seatAssignments.guestId, guestIds), isNull(seatAssignments.releasedAt))).returning({ id: seatAssignments.id });
    return removed.length;
  }
  if (!UUID.test(tableId)) throw new SeatingNotFoundError();
  const [table] = await tx.select().from(seatingTables).where(and(eq(seatingTables.id, tableId), eq(seatingTables.planId, plan.id)));
  if (!table) throw new SeatingNotFoundError();
  const eligible = eligibilityOf(await loadEventRows(tx, context.eventId), context, plan.keyMomentId);
  const seatable = guestIds.filter((id) => eligible.has(id));
  const now = new Date();
  for (const guestId of seatable) {
    await tx
      .insert(seatAssignments)
      .values({ organizationId, planId: plan.id, tableId: table.id, guestId })
      .onConflictDoUpdate({ target: [seatAssignments.planId, seatAssignments.guestId], set: { tableId: table.id, releasedAt: null, releasedTableName: null, updatedAt: now } });
  }
  return seatable.length;
}

// Placer un invité à une table du plan (null : le retirer, il revient dans « Non placés »).
export async function seatGuest(organizationId: string, eventId: string, planId: string, guestId: string, tableId: string | null): Promise<void> {
  await assertGuestsReady(organizationId);
  const context = await eventContext(organizationId, eventId);
  if (!UUID.test(guestId)) throw new SeatingNotFoundError();
  await inOrganization(organizationId, async (tx) => {
    const plan = await planInEvent(tx, eventId, planId);
    const [guest] = await tx.select({ id: guests.id }).from(guests).where(and(eq(guests.id, guestId), eq(guests.eventId, eventId)));
    if (!guest) throw new SeatingNotFoundError();
    const seated = await seatIn(tx, organizationId, context, plan, [guest.id], tableId);
    if (tableId !== null && seated === 0) throw new SeatingInvalidError("not_eligible");
  });
}

// Placer tout un foyer d'un geste : ses membres présents ou en attente ; renvoie le nombre placé.
export async function seatHousehold(organizationId: string, eventId: string, planId: string, householdId: string, tableId: string | null): Promise<number> {
  await assertGuestsReady(organizationId);
  const context = await eventContext(organizationId, eventId);
  if (!UUID.test(householdId)) throw new SeatingNotFoundError();
  return inOrganization(organizationId, async (tx) => {
    const plan = await planInEvent(tx, eventId, planId);
    const [household] = await tx.select({ id: households.id }).from(households).where(and(eq(households.id, householdId), eq(households.eventId, eventId)));
    if (!household) throw new SeatingNotFoundError();
    const members = await tx.select({ id: guests.id }).from(guests).where(eq(guests.householdId, household.id)).orderBy(asc(guests.position));
    return seatIn(tx, organizationId, context, plan, members.map((member) => member.id), tableId);
  });
}

// La planner a pris connaissance d'un désistement : l'alerte disparaît.
export async function dismissSeatRelease(organizationId: string, eventId: string, planId: string, guestId: string): Promise<void> {
  await eventContext(organizationId, eventId);
  if (!UUID.test(guestId)) throw new SeatingNotFoundError();
  await inOrganization(organizationId, async (tx) => {
    const plan = await planInEvent(tx, eventId, planId);
    await tx.delete(seatAssignments).where(and(eq(seatAssignments.planId, plan.id), eq(seatAssignments.guestId, guestId), isNotNull(seatAssignments.releasedAt)));
  });
}

// —— Contraintes (D4) ——————————————————————————————————————————————————————————————

export async function addSeatingConstraint(organizationId: string, eventId: string, planId: string, kind: SeatingConstraintKind, guestIds: string[]): Promise<string> {
  await assertGuestsReady(organizationId);
  await eventContext(organizationId, eventId);
  const ids = [...new Set(guestIds)];
  if (kind !== "together" && kind !== "apart") throw new SeatingInvalidError("constraint_members");
  if (ids.length < 2 || ids.length > 20) throw new SeatingInvalidError("constraint_members");
  if (ids.some((id) => !UUID.test(id))) throw new SeatingNotFoundError();
  return inOrganization(organizationId, async (tx) => {
    const plan = await planInEvent(tx, eventId, planId);
    const found = await tx.select({ id: guests.id }).from(guests).where(and(inArray(guests.id, ids), eq(guests.eventId, eventId)));
    if (found.length !== ids.length) throw new SeatingNotFoundError();
    const [constraint] = await tx.insert(seatingConstraints).values({ organizationId, planId: plan.id, kind }).returning({ id: seatingConstraints.id });
    await tx.insert(seatingConstraintMembers).values(ids.map((guestId) => ({ organizationId, constraintId: constraint!.id, guestId })));
    return constraint!.id;
  });
}

export async function removeSeatingConstraint(organizationId: string, eventId: string, constraintId: string): Promise<void> {
  await eventContext(organizationId, eventId);
  if (!UUID.test(constraintId)) throw new SeatingNotFoundError();
  await inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select({ id: seatingConstraints.id }).from(seatingConstraints).innerJoin(seatingPlans, eq(seatingPlans.id, seatingConstraints.planId)).where(and(eq(seatingConstraints.id, constraintId), eq(seatingPlans.eventId, eventId)));
    if (!row) throw new SeatingNotFoundError();
    await tx.delete(seatingConstraints).where(eq(seatingConstraints.id, row.id));
  });
}

// —— Repas des prestataires (D5) ——————————————————————————————————————————————————————

export async function setVendorMealCount(organizationId: string, eventId: string, keyMomentId: string, count: number): Promise<void> {
  await assertGuestsReady(organizationId);
  const context = await eventContext(organizationId, eventId);
  const moment = momentOf(context, keyMomentId);
  if (!Number.isInteger(count) || count < 0 || count > 1000) throw new SeatingInvalidError("vendor_count");
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(vendorMealCounts)
      .values({ organizationId, eventId, keyMomentId: moment.id, mealCount: count })
      .onConflictDoUpdate({ target: vendorMealCounts.keyMomentId, set: { mealCount: count, updatedAt: new Date() } }),
  );
}

// —— Synthèse pour le traiteur (INV-06 ; D6 à D8) ——————————————————————————————————————

export type CatererSummaryRequest = {
  organizationId: string;
  userId: string;
  viewer: GuestViewer;
  eventId: string;
  keyMomentId: string;
  requested: CatererSummaryVersion;
  format: CatererSummaryFormat;
  locale: GuestLocale;
  now?: Date;
};

// D6 : la nominative pour la titulaire seule ; un membre reçoit l'agrégée, exacte par table. D8 :
// calculée à chaque demande, jamais rangée ; le téléchargement est tracé (qui, quand, quel temps
// fort, quelle version, quel format), sans contenu.
export async function downloadCatererSummary(request: CatererSummaryRequest): Promise<CatererSummary> {
  assertTeam(request.viewer);
  const { organizationId, eventId, locale } = request;
  const now = request.now ?? new Date();
  const context = await eventContext(organizationId, eventId);
  const moment = momentOf(context, request.keyMomentId);
  const version: CatererSummaryVersion = request.viewer.kind === "owner" && request.requested === "nominative" ? "nominative" : "aggregate";
  const data = await inOrganization(organizationId, async (tx) => {
    const plan = await planOfMoment(tx, eventId, moment.id);
    const [vendor] = await tx.select().from(vendorMealCounts).where(eq(vendorMealCounts.keyMomentId, moment.id));
    const [settings] = await tx.select({ dietsPurgedAt: eventSettings.dietsPurgedAt }).from(eventSettings).where(eq(eventSettings.eventId, eventId));
    return {
      rows: await loadEventRows(tx, eventId),
      plan,
      content: plan ? await planContent(tx, plan.id) : null,
      types: await ensureMealTypes(tx, organizationId),
      options: await ensureDietaryOptions(tx, organizationId),
      vendorMeals: vendor?.mealCount ?? 0,
      dietsPurged: Boolean(settings?.dietsPurgedAt),
    };
  });
  const { rows, content, types, options } = data;
  const eligible = eligibilityOf(rows, context, moment.id);
  const tableIds = new Set(content?.tables.map((table) => table.id) ?? []);
  const tableOf = new Map((content?.seats ?? []).filter((seat) => seat.releasedAt === null && seat.tableId && tableIds.has(seat.tableId)).map((seat) => [seat.guestId, seat.tableId!]));
  const diets = dietsOf(organizationId, rows);
  const summary = buildCatererSummary({
    version,
    eventId,
    keyMoment: momentView(moment),
    generatedAt: now,
    dietsPurged: data.dietsPurged,
    tables: content ? content.tables.map((table) => ({ id: table.id, name: table.name, shape: table.shape, capacity: table.capacity })) : null,
    people: rows.people.flatMap((person) => {
      const status = eligible.get(person.id);
      if (!status) return [];
      return [{ id: person.id, name: personName(person), status, tableId: tableOf.get(person.id) ?? null, mealTypeId: resolveMealType(person, types).id, dietOptionIds: diets.get(person.id) ?? [] }];
    }),
    mealTypes: types.map((type) => ({ id: type.id, label: mealTypeLabel(type, locale), hidden: type.hidden })),
    dietOptions: options.map((option) => ({ id: option.id, kind: option.kind, label: option.starterKey ? (starterDietaryOptionLabel(option.starterKey, locale) ?? option.starterKey) : (option.label ?? "") })),
    vendorMeals: data.vendorMeals,
    vendorMealTypeId: types.find((type) => type.starterKey === "vendor")?.id ?? null,
  });
  await inOrganization(organizationId, (tx) =>
    tx.insert(catererSummaryDownloads).values({ organizationId, eventId, keyMomentId: moment.id, version, format: request.format, downloadedBy: request.userId, downloadedAt: now }),
  );
  await recordAudit(appDatabase(), { organizationId, action: "guests.caterer_summary.downloaded", objectId: eventId, details: { keyMomentId: moment.id, version, format: request.format } });
  return summary;
}

// Pour l'effacement d'une personne (privacy/v1) : ses places actives, par temps fort.
export async function seatsOfGuests(tx: Tx, guestIds: string[]): Promise<{ guestId: string; eventId: string; keyMomentId: string; tableName: string }[]> {
  if (guestIds.length === 0) return [];
  return tx
    .select({ guestId: seatAssignments.guestId, eventId: seatingPlans.eventId, keyMomentId: seatingPlans.keyMomentId, tableName: seatingTables.name })
    .from(seatAssignments)
    .innerJoin(seatingPlans, eq(seatingPlans.id, seatAssignments.planId))
    .innerJoin(seatingTables, eq(seatingTables.id, seatAssignments.tableId))
    .where(and(inArray(seatAssignments.guestId, guestIds), isNull(seatAssignments.releasedAt)));
}
