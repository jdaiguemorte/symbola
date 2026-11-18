// Lot 49 (INV-01, INV-04, INV-07, RGP-06, RGP-07, RGP-18 ; D1, D5, D8, D11, D13 ; partie G) —
// réglages du module et des évènements, liste des régimes, foyers et personnes, suivi des réponses.
// Exposé seulement par service.ts (ADR 0011). Les régimes nominatifs ne sortent que vers la
// titulaire ; ailleurs, des nombres sous un seuil « moins de N » (D8, réponse 3 de la DPO).
import { and, eq, inArray, sql } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { dietaryOptions, dietConsents, eventSettings, guestImports, guestLinks, guests, householdGroups, households, moduleSettings, purgePostponements, rsvpAnswers } from "@symbola/db/schema/guests";
import { parisToday } from "@symbola/i18n";
import { starterDietaryOptionLabel, starterGuestPrivacyNotice, starterGuestRules } from "@symbola/starter-templates";
import type {
  DietaryOptionView,
  DietTally,
  GuestEventContext,
  GuestEventSettings,
  GuestEventSettingsInput,
  GuestEventSummary,
  GuestLinkStatus,
  GuestListFilter,
  GuestLocale,
  GuestModuleState,
  GuestPersonView,
  GuestSide,
  GuestViewer,
  HouseholdInput,
  HouseholdView,
  KeyMomentTally,
} from "@symbola/contracts";
import { guestEventContexts } from "@/modules/events/service";
import { aggregateDiets, dietPlace, openDietOptions } from "./diets";
import { ensureDietaryOptions, ensureEventSettings, findEventSettings, findModuleSettings, inOrganization, loadEventRows, UUID, type DietaryOptionRow, type EventGuestRows, type GuestRow, type HouseholdRow, type Tx } from "./repository";
import { defaultDisplayName, householdComplete, invitedMoments, rsvpOpen, suggestedCloseOn, validateHousehold, type HouseholdProblem } from "./rsvp";

// —— Erreurs ———————————————————————————————————————————————————————————————————————————

// Partie G : sans la confirmation de l'analyse d'impact, aucune saisie.
export class GuestsNotReadyError extends Error {
  constructor() {
    super("analyse d'impact non confirmée");
    this.name = "GuestsNotReadyError";
  }
}

// Évènement absent, d'une autre organisation ou d'essai : même réponse (SEC-13).
export class GuestEventNotFoundError extends Error {
  constructor() {
    super("évènement introuvable");
    this.name = "GuestEventNotFoundError";
  }
}

export class HouseholdNotFoundError extends Error {
  constructor() {
    super("foyer introuvable");
    this.name = "HouseholdNotFoundError";
  }
}

export class HouseholdInvalidError extends Error {
  constructor(readonly problem: HouseholdProblem | "group_too_long" | "side_unknown" | "key_moment_unknown" | "display_name_too_long") {
    super(`foyer invalide : ${problem}`);
    this.name = "HouseholdInvalidError";
  }
}

export class GuestSettingsInvalidError extends Error {
  constructor(readonly problem: "close_date" | "reminders" | "notice_too_long" | "option_label") {
    super(`réglage invalide : ${problem}`);
    this.name = "GuestSettingsInvalidError";
  }
}

// —— Réglages du module (partie G) ————————————————————————————————————————————————————

export async function getGuestModuleState(organizationId: string): Promise<GuestModuleState> {
  const row = await inOrganization(organizationId, (tx) => findModuleSettings(tx, organizationId));
  return { impactAssessmentConfirmedAt: row?.impactAssessmentConfirmedAt?.toISOString() ?? null };
}

export async function assertGuestsReady(organizationId: string): Promise<void> {
  if (!(await getGuestModuleState(organizationId)).impactAssessmentConfirmedAt) throw new GuestsNotReadyError();
}

// La titulaire confirme avoir complété l'analyse d'impact « socle » (réponse 5 de la DPO) ; la
// confirmation est datée et tracée au journal.
export async function confirmImpactAssessment(organizationId: string, userId: string, now: Date = new Date()): Promise<void> {
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(moduleSettings)
      .values({ organizationId, impactAssessmentConfirmedAt: now, impactAssessmentConfirmedBy: userId })
      .onConflictDoUpdate({ target: moduleSettings.organizationId, set: { impactAssessmentConfirmedAt: now, impactAssessmentConfirmedBy: userId, updatedAt: now } }),
  );
  await recordAudit(appDatabase(), { organizationId, action: "guests.impact_assessment.confirmed" });
}

// RGP-03 : la mention d'information de la page de réponse, ou null (texte de départ).
const NOTICE_MAX = 4000;

export async function getGuestPrivacyNotice(organizationId: string): Promise<string | null> {
  const row = await inOrganization(organizationId, (tx) => findModuleSettings(tx, organizationId));
  return row?.privacyNotice ?? null;
}

export async function updateGuestPrivacyNotice(organizationId: string, notice: string | null): Promise<void> {
  const text = notice?.replace(/\r\n/g, "\n").trim() || null;
  if (text && text.length > NOTICE_MAX) throw new GuestSettingsInvalidError("notice_too_long");
  await inOrganization(organizationId, (tx) =>
    tx
      .insert(moduleSettings)
      .values({ organizationId, privacyNotice: text })
      .onConflictDoUpdate({ target: moduleSettings.organizationId, set: { privacyNotice: text, updatedAt: new Date() } }),
  );
}

export function guestPrivacyNoticeTemplate(locale: GuestLocale): string {
  return starterGuestPrivacyNotice(locale);
}

// —— Évènement ———————————————————————————————————————————————————————————————————————

// L'évènement réel de l'organisation (lu par le service du module events), sinon une erreur.
export async function eventContext(organizationId: string, eventId: string): Promise<GuestEventContext> {
  if (!UUID.test(eventId)) throw new GuestEventNotFoundError();
  const [context] = await guestEventContexts(organizationId, [eventId]);
  if (!context || context.isDemo) throw new GuestEventNotFoundError();
  return context;
}

function settingsView(context: GuestEventContext, row: { responsesCloseOn: string | null; askDiet: boolean; askAccommodation: boolean; askTransport: boolean; reminderDays: number[]; invitationsSentAt: Date | null } | null): GuestEventSettings {
  const rules = starterGuestRules();
  return {
    eventId: context.eventId,
    responsesCloseOn: row?.responsesCloseOn ?? null,
    suggestedCloseOn: suggestedCloseOn(
      context.keyMoments.map((moment) => moment.date),
      context.eventDate,
      rules.closingDaysBeforeFirstMoment,
    ),
    askDiet: row?.askDiet ?? true,
    askAccommodation: row?.askAccommodation ?? false,
    askTransport: row?.askTransport ?? false,
    reminderDays: row ? [...row.reminderDays].sort((a, b) => b - a) : [...rules.reminderDaysBeforeClosing],
    invitationsSentAt: row?.invitationsSentAt?.toISOString() ?? null,
  };
}

export async function getGuestEventSettings(organizationId: string, eventId: string): Promise<GuestEventSettings> {
  const context = await eventContext(organizationId, eventId);
  const row = await inOrganization(organizationId, (tx) => findEventSettings(tx, eventId));
  return settingsView(context, row);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// D13 : clôture des réponses (les liens expirent à sa fin) ; D11 : questions posées ; D10 :
// relances, zéro à trois, en jours avant la clôture.
export async function saveGuestEventSettings(organizationId: string, eventId: string, input: GuestEventSettingsInput, now: Date = new Date()): Promise<GuestEventSettings> {
  await assertGuestsReady(organizationId);
  const context = await eventContext(organizationId, eventId);
  if (input.responsesCloseOn !== null && (!DATE.test(input.responsesCloseOn) || Number.isNaN(Date.parse(`${input.responsesCloseOn}T00:00:00Z`)) || input.responsesCloseOn < parisToday(now))) {
    throw new GuestSettingsInvalidError("close_date");
  }
  const rules = starterGuestRules();
  const reminderDays = [...new Set(input.reminderDays)].sort((a, b) => b - a);
  if (reminderDays.length > rules.maxReminders || reminderDays.some((day) => !Number.isInteger(day) || day < 1 || day > 90)) throw new GuestSettingsInvalidError("reminders");
  const row = await inOrganization(organizationId, async (tx) => {
    await ensureEventSettings(tx, organizationId, eventId, rules.reminderDaysBeforeClosing);
    const [updated] = await tx
      .update(eventSettings)
      .set({ responsesCloseOn: input.responsesCloseOn, askDiet: input.askDiet, askAccommodation: input.askAccommodation, askTransport: input.askTransport, reminderDays, updatedAt: now })
      .where(eq(eventSettings.eventId, eventId))
      .returning();
    return updated ?? null;
  });
  return settingsView(context, row);
}

// —— Liste des régimes (RGP-06, D6) ——————————————————————————————————————————————————

function optionLabel(row: DietaryOptionRow, locale: GuestLocale): string {
  return row.starterKey ? (starterDietaryOptionLabel(row.starterKey, locale) ?? row.starterKey) : (row.label ?? "");
}

function optionView(row: DietaryOptionRow, locale: GuestLocale): DietaryOptionView {
  return { id: row.id, kind: row.kind, label: optionLabel(row, locale), starterKey: row.starterKey, hidden: row.hidden };
}

export async function listDietaryOptions(organizationId: string, locale: GuestLocale): Promise<DietaryOptionView[]> {
  const rows = await inOrganization(organizationId, (tx) => ensureDietaryOptions(tx, organizationId));
  return rows.map((row) => optionView(row, locale));
}

// Une entrée ajoutée par la planner (libellé court, sous sa responsabilité ; un régime à caractère
// religieux appelle l'avertissement de l'écran, D6).
export async function addDietaryOption(organizationId: string, input: { kind: "diet" | "allergen"; label: string }, locale: GuestLocale): Promise<DietaryOptionView> {
  const label = input.label.replace(/\s+/g, " ").trim();
  if (!label || label.length > 60) throw new GuestSettingsInvalidError("option_label");
  return inOrganization(organizationId, async (tx) => {
    const existing = await ensureDietaryOptions(tx, organizationId);
    const position = existing.reduce((max, row) => Math.max(max, row.position + 1), 0);
    const [row] = await tx.insert(dietaryOptions).values({ organizationId, kind: input.kind, label, starterKey: null, position }).returning();
    return optionView(row!, locale);
  });
}

// Masquer n'efface rien : les régimes déjà cochés gardent l'entrée.
export async function setDietaryOptionHidden(organizationId: string, optionId: string, hidden: boolean): Promise<void> {
  if (!UUID.test(optionId)) return;
  await inOrganization(organizationId, (tx) => tx.update(dietaryOptions).set({ hidden, updatedAt: new Date() }).where(eq(dietaryOptions.id, optionId)));
}

// —— Foyers ————————————————————————————————————————————————————————————————————————

const sideOf = (row: HouseholdRow): GuestSide => (row.sideKind === "both" ? { kind: "both" } : row.sideKind === "client" && row.sideClientId ? { kind: "client", clientId: row.sideClientId } : null);

function linkStatusOf(links: EventGuestRows["links"], guestId: string, closesOn: string | null, today: string): GuestPersonView["link"] {
  const own = links.filter((link) => link.guestId === guestId);
  if (own.length === 0) return { status: "none", lastOpenedAt: null, sentAt: null };
  const active = own.filter((link) => !link.revokedAt);
  const status: GuestLinkStatus = active.length === 0 ? "revoked" : rsvpOpen(closesOn, today) ? "active" : "expired";
  const opened = own.map((link) => link.lastOpenedAt).filter((date): date is Date => date !== null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const sent = own.map((link) => link.sentAt).filter((date): date is Date => date !== null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { status, lastOpenedAt: opened?.toISOString() ?? null, sentAt: sent?.toISOString() ?? null };
}

type ViewOptions = { viewer: GuestViewer; locale: GuestLocale; closesOn: string | null; today: string; options: DietaryOptionRow[] };

function buildViews(organizationId: string, rows: EventGuestRows, context: GuestEventContext, view: ViewOptions): HouseholdView[] {
  const momentIds = new Set(context.keyMoments.map((moment) => moment.id));
  const groupLabel = new Map(rows.groups.map((group) => [group.id, group.label]));
  const labels = new Map(view.options.map((option) => [option.id, optionLabel(option, view.locale)]));
  const nominative = view.viewer.kind === "owner";
  const dietOf = new Map(rows.dietRows.map((row) => [row.guestId, row.optionsSealed]));
  return rows.households.map((household) => ({
    id: household.id,
    eventId: household.eventId,
    displayName: household.displayName,
    side: sideOf(household),
    groupId: household.groupId,
    groupLabel: household.groupId ? (groupLabel.get(household.groupId) ?? null) : null,
    language: household.language === "en" ? "en" : "fr",
    respondentGuestId: household.respondentGuestId,
    keyMomentIds: household.keyMomentIds,
    needsAccommodation: household.needsAccommodation,
    needsTransport: household.needsTransport,
    answeredAt: household.answeredAt?.toISOString() ?? null,
    invitedAt: household.invitedAt?.toISOString() ?? null,
    people: rows.people
      .filter((person) => person.householdId === household.id)
      .map((person): GuestPersonView => {
        const sealed = nominative ? dietOf.get(person.id) : undefined;
        return {
          id: person.id,
          kind: person.kind,
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          phone: person.phone,
          ageRange: person.ageRange,
          opposed: person.opposedAt !== null,
          link: linkStatusOf(rows.links, person.id, view.closesOn, view.today),
          answers: rows.answers.filter((answer) => answer.guestId === person.id && momentIds.has(answer.keyMomentId)).map((answer) => ({ keyMomentId: answer.keyMomentId, attending: answer.attending })),
          diet: sealed ? openDietOptions(sealed, dietPlace(organizationId, person.id)).flatMap((id) => (labels.has(id) ? [labels.get(id)!] : [])) : null,
        };
      }),
  }));
}

function matchesFilter(household: HouseholdView, filter: GuestListFilter): boolean {
  if (filter.side === "both" && household.side?.kind !== "both") return false;
  if (filter.side && filter.side !== "both" && (household.side?.kind !== "client" || household.side.clientId !== filter.side)) return false;
  if (filter.groupId && household.groupId !== filter.groupId) return false;
  if (filter.unanswered && household.answeredAt !== null) return false;
  return true;
}

export async function listHouseholds(organizationId: string, eventId: string, viewer: GuestViewer, filter: GuestListFilter = {}, locale: GuestLocale = "fr", now: Date = new Date()): Promise<HouseholdView[]> {
  const context = await eventContext(organizationId, eventId);
  const { rows, settings, options } = await inOrganization(organizationId, async (tx) => ({
    rows: await loadEventRows(tx, eventId),
    settings: await findEventSettings(tx, eventId),
    options: viewer.kind === "owner" ? await ensureDietaryOptions(tx, organizationId) : [],
  }));
  return buildViews(organizationId, rows, context, { viewer, locale, closesOn: settings?.responsesCloseOn ?? null, today: parisToday(now), options }).filter((household) => matchesFilter(household, filter));
}

export async function listHouseholdGroups(organizationId: string, eventId: string): Promise<{ id: string; label: string }[]> {
  if (!UUID.test(eventId)) return [];
  return inOrganization(organizationId, async (tx) => (await tx.select({ id: householdGroups.id, label: householdGroups.label }).from(householdGroups).where(eq(householdGroups.eventId, eventId))).sort((a, b) => a.label.localeCompare(b.label, "fr")));
}

async function groupIdFor(tx: Tx, organizationId: string, eventId: string, label: string | null | undefined): Promise<string | null> {
  const clean = label?.replace(/\s+/g, " ").trim() ?? "";
  if (!clean) return null;
  if (clean.length > 100) throw new HouseholdInvalidError("group_too_long");
  const [existing] = await tx.select({ id: householdGroups.id }).from(householdGroups).where(and(eq(householdGroups.eventId, eventId), sql`lower(${householdGroups.label}) = lower(${clean})`));
  if (existing) return existing.id;
  const [created] = await tx.insert(householdGroups).values({ organizationId, eventId, label: clean }).onConflictDoNothing().returning({ id: householdGroups.id });
  if (created) return created.id;
  const [raced] = await tx.select({ id: householdGroups.id }).from(householdGroups).where(and(eq(householdGroups.eventId, eventId), sql`lower(${householdGroups.label}) = lower(${clean})`));
  return raced?.id ?? null;
}

function sideColumns(context: GuestEventContext, side: GuestSide | undefined): { sideKind: string | null; sideClientId: string | null } {
  if (!side) return { sideKind: null, sideClientId: null };
  if (side.kind === "both") return { sideKind: "both", sideClientId: null };
  if (!context.clients.some((client) => client.id === side.clientId)) throw new HouseholdInvalidError("side_unknown");
  return { sideKind: "client", sideClientId: side.clientId };
}

function momentColumns(context: GuestEventContext, keyMomentIds: string[] | null | undefined): string[] | null {
  if (keyMomentIds === null || keyMomentIds === undefined) return null;
  const known = new Set(context.keyMoments.map((moment) => moment.id));
  if (keyMomentIds.some((id) => !known.has(id))) throw new HouseholdInvalidError("key_moment_unknown");
  return [...new Set(keyMomentIds)];
}

export type HouseholdWriteChannel = "planner" | "client" | "import";

// INV-01 : un foyer et ses personnes, validés (nom de chacun, un moyen de contact pour le foyer,
// aucun contact pour un enfant). Les personnes absentes de l'entrée sont retirées du foyer.
export async function saveHousehold(
  organizationId: string,
  eventId: string,
  householdId: string | null,
  input: HouseholdInput,
  options: { importId?: string | null; tx?: Tx; context?: GuestEventContext } = {},
): Promise<string> {
  if (!options.tx) await assertGuestsReady(organizationId);
  const context = options.context ?? (await eventContext(organizationId, eventId));
  const checked = validateHousehold(input);
  if (!checked.ok) throw new HouseholdInvalidError(checked.problem);
  const displayName = input.displayName?.replace(/\s+/g, " ").trim() || defaultDisplayName(checked.people);
  if (displayName.length > 200) throw new HouseholdInvalidError("display_name_too_long");
  const side = sideColumns(context, input.side);
  const keyMomentIds = momentColumns(context, input.keyMomentIds);
  const write = async (tx: Tx) => {
    const groupId = await groupIdFor(tx, organizationId, eventId, input.groupLabel);
    const values = { displayName, ...side, groupId, language: input.language === "en" ? "en" : "fr", keyMomentIds };
    let id = householdId;
    if (id) {
      if (!UUID.test(id)) throw new HouseholdNotFoundError();
      const updated = await tx.update(households).set({ ...values, updatedAt: new Date() }).where(and(eq(households.id, id), eq(households.eventId, eventId))).returning({ id: households.id });
      if (updated.length === 0) throw new HouseholdNotFoundError();
    } else {
      const [created] = await tx.insert(households).values({ organizationId, eventId, ...values, importId: options.importId ?? null }).returning({ id: households.id });
      id = created!.id;
    }
    const existing = await tx.select().from(guests).where(eq(guests.householdId, id));
    const kept = new Set<string>();
    const ids: string[] = [];
    for (const [position, person] of checked.people.entries()) {
      const current = person.id ? existing.find((row) => row.id === person.id) : undefined;
      if (person.id && !current) throw new HouseholdNotFoundError();
      if (current) {
        // Une personne devenue enfant perd ses liens (RGP-18 : aucun lien pour un enfant).
        if (current.kind === "adult" && person.kind === "child") await tx.delete(guestLinks).where(eq(guestLinks.guestId, current.id));
        await tx
          .update(guests)
          .set({ kind: person.kind, firstName: person.firstName, lastName: person.lastName, email: current.opposedAt ? null : person.email, phone: current.opposedAt ? null : person.phone, ageRange: person.ageRange, position, updatedAt: new Date() })
          .where(eq(guests.id, current.id));
        kept.add(current.id);
        ids.push(current.id);
      } else {
        const [created] = await tx.insert(guests).values({ organizationId, eventId, householdId: id, kind: person.kind, firstName: person.firstName, lastName: person.lastName, email: person.email, phone: person.phone, ageRange: person.ageRange, position }).returning({ id: guests.id });
        ids.push(created!.id);
      }
    }
    const removed = existing.filter((row) => !kept.has(row.id)).map((row) => row.id);
    if (removed.length > 0) await tx.delete(guests).where(inArray(guests.id, removed));
    await tx.update(households).set({ respondentGuestId: ids[checked.respondentIndex] ?? null }).where(eq(households.id, id));
    await refreshAnswered(tx, context, id);
    return id;
  };
  return options.tx ? write(options.tx) : inOrganization(organizationId, write);
}

export async function removeHousehold(organizationId: string, eventId: string, householdId: string): Promise<void> {
  if (!UUID.test(householdId) || !UUID.test(eventId)) throw new HouseholdNotFoundError();
  const removed = await inOrganization(organizationId, (tx) => tx.delete(households).where(and(eq(households.id, householdId), eq(households.eventId, eventId))).returning({ id: households.id }));
  if (removed.length === 0) throw new HouseholdNotFoundError();
}

// Le foyer a répondu quand chacun a une réponse pour chaque temps fort où il est invité (INV-04 :
// aucune relance vers un foyer qui a répondu).
export async function refreshAnswered(tx: Tx, context: GuestEventContext, householdId: string, now: Date = new Date()): Promise<boolean> {
  const [household] = await tx.select().from(households).where(eq(households.id, householdId));
  if (!household) return false;
  const people = await tx.select({ id: guests.id }).from(guests).where(eq(guests.householdId, householdId));
  const answers = people.length > 0 ? await tx.select({ guestId: rsvpAnswers.guestId, keyMomentId: rsvpAnswers.keyMomentId }).from(rsvpAnswers).where(inArray(rsvpAnswers.guestId, people.map((person) => person.id))) : [];
  const invited = invitedMoments(household.keyMomentIds, context.keyMoments.map((moment) => moment.id));
  const complete = invited.length > 0 && people.length > 0 && householdComplete(people.map((person) => ({ id: person.id, invited })), new Set(answers.map((answer) => `${answer.guestId}:${answer.keyMomentId}`)));
  const answeredAt = complete ? (household.answeredAt ?? now) : null;
  if ((answeredAt?.getTime() ?? null) !== (household.answeredAt?.getTime() ?? null)) await tx.update(households).set({ answeredAt }).where(eq(households.id, householdId));
  return complete;
}

// La planner (ou le client au portail) note une réponse reçue autrement (téléphone, carton).
export async function recordHouseholdAnswers(
  organizationId: string,
  eventId: string,
  householdId: string,
  presence: { guestId: string; keyMomentId: string; attending: boolean }[],
  channel: "planner" | "client",
  now: Date = new Date(),
): Promise<void> {
  await assertGuestsReady(organizationId);
  const context = await eventContext(organizationId, eventId);
  if (!UUID.test(householdId)) throw new HouseholdNotFoundError();
  await inOrganization(organizationId, async (tx) => {
    const [household] = await tx.select().from(households).where(and(eq(households.id, householdId), eq(households.eventId, eventId)));
    if (!household) throw new HouseholdNotFoundError();
    const people = await tx.select({ id: guests.id }).from(guests).where(eq(guests.householdId, householdId));
    const members = new Set(people.map((person) => person.id));
    const invited = new Set(invitedMoments(household.keyMomentIds, context.keyMoments.map((moment) => moment.id)));
    for (const answer of presence) {
      if (!members.has(answer.guestId) || !invited.has(answer.keyMomentId)) continue;
      await tx
        .insert(rsvpAnswers)
        .values({ organizationId, guestId: answer.guestId, keyMomentId: answer.keyMomentId, attending: answer.attending, channel, answeredAt: now })
        .onConflictDoUpdate({ target: [rsvpAnswers.guestId, rsvpAnswers.keyMomentId], set: { attending: answer.attending, channel, answeredAt: now, updatedAt: now } });
    }
    await refreshAnswered(tx, context, householdId, now);
  });
}

// —— Suivi (INV-04, EVT-03) et régimes comptés (RGP-07) ——————————————————————————————

export async function getGuestEventSummary(organizationId: string, eventId: string): Promise<GuestEventSummary> {
  const context = await eventContext(organizationId, eventId);
  const rows = await inOrganization(organizationId, (tx) => loadEventRows(tx, eventId));
  const allMoments = context.keyMoments.map((moment) => moment.id);
  const invitedOf = new Map(rows.households.map((household) => [household.id, new Set(invitedMoments(household.keyMomentIds, allMoments))]));
  const answerOf = new Map(rows.answers.map((answer) => [`${answer.guestId}:${answer.keyMomentId}`, answer.attending]));
  const tallies: KeyMomentTally[] = context.keyMoments.map((moment) => {
    const tally = { keyMomentId: moment.id, name: moment.name, date: moment.date, yes: 0, no: 0, pending: 0 };
    for (const person of rows.people) {
      if (!invitedOf.get(person.householdId)?.has(moment.id)) continue;
      const answer = answerOf.get(`${person.id}:${moment.id}`);
      if (answer === true) tally.yes += 1;
      else if (answer === false) tally.no += 1;
      else tally.pending += 1;
    }
    return tally;
  });
  const confirmed = rows.people.filter((person) => rows.answers.some((answer) => answer.guestId === person.id && answer.attending && invitedOf.get(person.householdId)?.has(answer.keyMomentId))).length;
  return {
    households: rows.households.length,
    people: rows.people.length,
    adults: rows.people.filter((person) => person.kind === "adult").length,
    children: rows.people.filter((person) => person.kind === "child").length,
    answered: rows.households.filter((household) => household.answeredAt !== null).length,
    confirmed,
    tallies,
  };
}

// D8 : par temps fort, combien de personnes présentes ont chaque régime ; jamais de nom, et un
// nombre sous le seuil s'affiche « moins de N ». Calculé après déchiffrement, côté serveur.
export async function getDietTallies(organizationId: string, eventId: string, locale: GuestLocale = "fr"): Promise<DietTally[]> {
  const context = await eventContext(organizationId, eventId);
  const { rows, options } = await inOrganization(organizationId, async (tx) => ({ rows: await loadEventRows(tx, eventId), options: await ensureDietaryOptions(tx, organizationId) }));
  const threshold = starterGuestRules().aggregateThreshold;
  const optionViews = options.map((option) => ({ id: option.id, label: optionLabel(option, locale), kind: option.kind }));
  const dietOf = new Map(rows.dietRows.map((row) => [row.guestId, openDietOptions(row.optionsSealed, dietPlace(organizationId, row.guestId))]));
  return context.keyMoments.map((moment) => {
    const present = rows.answers.filter((answer) => answer.keyMomentId === moment.id && answer.attending).map((answer) => answer.guestId);
    return { keyMomentId: moment.id, name: moment.name, counts: aggregateDiets(present.map((guestId) => ({ optionIds: dietOf.get(guestId) ?? [] })), optionViews, threshold) };
  });
}

export type GuestPersonRow = GuestRow;

// Personnes d'un évènement (sans régime) : doublons de l'import, destinataires des invitations.
export async function listEventPeople(tx: Tx, eventId: string): Promise<GuestRow[]> {
  return tx.select().from(guests).where(eq(guests.eventId, eventId));
}

// Données d'invités d'évènements qui disparaissent (corbeille purgée, essai terminé) : tout part.
export async function removeEventGuestRows(organizationId: string, eventIds: string[]): Promise<void> {
  const ids = eventIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return;
  await inOrganization(organizationId, async (tx) => {
    await tx.delete(households).where(inArray(households.eventId, ids));
    await tx.delete(householdGroups).where(inArray(householdGroups.eventId, ids));
    await tx.delete(dietConsents).where(inArray(dietConsents.eventId, ids));
    await tx.delete(purgePostponements).where(inArray(purgePostponements.eventId, ids));
    await tx.delete(guestImports).where(inArray(guestImports.eventId, ids));
    await tx.delete(eventSettings).where(inArray(eventSettings.eventId, ids));
  });
}
