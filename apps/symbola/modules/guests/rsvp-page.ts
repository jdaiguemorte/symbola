// Lot 49 (INV-03, RGP-03, RGP-06, RGP-08 ; D3, D11, D13 ; ADR 0053) — la page de réponse d'un
// invité, sans compte : son lien personnel (jeton après « # », reçu en POST, jamais écrit) ouvre la
// réponse de son foyer. Le jeton est relu à chaque requête (retiré, clôturé, module fermé : plus
// rien). Sans accord, aucun régime n'est enregistré, quoi que contienne la requête ; l'accord vient
// de l'invité lui-même (ou du représentant légal d'un enfant), avec sa preuve (réponse 3 de la DPO).
// L'opposition efface aussitôt ses coordonnées et ses régimes.
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { hashLinkSecret, parseLinkToken } from "@symbola/auth";
import { withActor } from "@symbola/db/actor";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { dietConsents, diets, guestLinks, guests, households, rsvpAnswers } from "@symbola/db/schema/guests";
import { parisToday } from "@symbola/i18n";
import { starterDietaryOptionLabel as starterLabel, starterDietConsent } from "@symbola/starter-templates";
import type { GuestEventContext, GuestLocale, RsvpAnswerInput, RsvpMember, RsvpOutcome, RsvpView } from "@symbola/contracts";
import { getPrivacySettings, isModuleEnabled } from "@/modules/hub/service";
import { dietPlace, openDietOptions, sealDietOptions } from "./diets";
import { eventContext, getGuestPrivacyNotice, guestPrivacyNoticeTemplate, refreshAnswered } from "./households";
import { plannerContact } from "./links";
import { ensureDietaryOptions, findEventSettings, inOrganization, type EventSettingsRow, type GuestLinkRow, type GuestRow, type HouseholdRow, type Tx } from "./repository";
import { invitedMoments, rsvpOpen, sanitizeRsvpAnswer } from "./rsvp";

type Resolved = {
  organizationId: string;
  link: GuestLinkRow;
  self: GuestRow;
  household: HouseholdRow;
  members: GuestRow[];
  settings: EventSettingsRow;
  context: GuestEventContext;
  open: boolean;
};

// Le lien du jeton, s'il ouvre encore quelque chose : module ouvert, lien non retiré, adulte non
// opposé, évènement réel et réponses réglées. Toute autre situation : null (« lien inconnu »).
async function resolve(token: unknown, now: Date): Promise<Resolved | null> {
  if (typeof token !== "string" || token.length > 200) return null;
  const parsed = parseLinkToken(token);
  if (!parsed) return null;
  const { organizationId } = parsed;
  const db = appDatabase();
  if (!(await isModuleEnabled(db, organizationId, "guests")) || !(await isModuleEnabled(db, organizationId, "events"))) return null;
  const found = await inOrganization(organizationId, async (tx) => {
    const [link] = await tx.select().from(guestLinks).where(and(eq(guestLinks.tokenHash, hashLinkSecret(parsed.secret)), isNull(guestLinks.revokedAt)));
    if (!link) return null;
    const [self] = await tx.select().from(guests).where(eq(guests.id, link.guestId));
    if (!self || self.kind !== "adult" || self.opposedAt) return null;
    const [household] = await tx.select().from(households).where(eq(households.id, self.householdId));
    const settings = await findEventSettings(tx, self.eventId);
    if (!household || !settings?.responsesCloseOn || settings.purgedAt) return null;
    const members = await tx.select().from(guests).where(eq(guests.householdId, household.id));
    return { link, self, household, settings, members: members.sort((a, b) => a.position - b.position) };
  });
  if (!found) return null;
  let context: GuestEventContext;
  try {
    context = await eventContext(organizationId, found.self.eventId);
  } catch {
    return null;
  }
  return { organizationId, ...found, context, open: rsvpOpen(found.settings.responsesCloseOn, parisToday(now)) };
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

async function buildView(resolved: Resolved, locale: GuestLocale): Promise<RsvpView> {
  const { organizationId, self, household, members, settings, context } = resolved;
  const allMoments = context.keyMoments.map((moment) => moment.id);
  const invited = invitedMoments(household.keyMomentIds, allMoments);
  const isRespondent = household.respondentGuestId === self.id;
  const { answers, dietRows, consents, options } = await inOrganization(organizationId, async (tx) => ({
    answers: await tx.select().from(rsvpAnswers).where(inArray(rsvpAnswers.guestId, members.map((member) => member.id))),
    dietRows: await tx.select().from(diets).where(inArray(diets.guestId, members.map((member) => member.id))),
    consents: await tx.select().from(dietConsents).where(and(eq(dietConsents.givenByGuestId, self.id), isNull(dietConsents.withdrawnAt))).orderBy(desc(dietConsents.grantedAt)),
    options: await ensureDietaryOptions(tx, organizationId),
  }));
  const own = new Set([self.id, ...consents.filter((consent) => consent.legalGuardian && consent.guestId).map((consent) => consent.guestId!)]);
  const dietOf = new Map(dietRows.map((row) => [row.guestId, row.optionsSealed]));
  const memberViews: RsvpMember[] = members.map((member) => {
    const answered: Record<string, boolean> = {};
    for (const answer of answers) if (answer.guestId === member.id && invited.includes(answer.keyMomentId)) answered[answer.keyMomentId] = answer.attending;
    const sealed = own.has(member.id) && resolved.open ? dietOf.get(member.id) : undefined;
    return {
      id: member.id,
      firstName: member.firstName,
      kind: member.kind,
      ageRange: member.ageRange,
      keyMomentIds: invited,
      answers: answered,
      canAnswerPresence: member.id === self.id || isRespondent,
      canGiveDiet: member.id === self.id || member.kind === "child",
      isSelf: member.id === self.id,
      diet: sealed ? openDietOptions(sealed, dietPlace(organizationId, member.id)) : null,
      guardianDeclared: member.kind === "child" && consents.some((consent) => consent.guestId === member.id && consent.legalGuardian),
    };
  });
  const [organization, privacy, customNotice] = await Promise.all([plannerContact(organizationId), getPrivacySettings(appDatabase(), organizationId), getGuestPrivacyNotice(organizationId)]);
  const clients = context.clients.map((client) => client.firstName).filter(Boolean).join(" & ");
  const values = { organization: organization.name, clients, contact: organization.email ?? organization.phone ?? organization.name, dietDays: String(privacy.guestDietRetentionDays), days: String(privacy.guestRetentionDays) };
  const consent = starterDietConsent(locale);
  const { guestLabel } = labeller(locale);
  return {
    status: resolved.open ? "open" : "closed",
    organizationName: organization.name,
    clientNames: clients,
    vocabulary: context.vocabulary,
    eventDate: context.eventDate,
    closesOn: settings.responsesCloseOn!,
    selfId: self.id,
    selfFirstName: self.firstName,
    isRespondent,
    householdName: household.displayName,
    keyMoments: context.keyMoments.filter((moment) => invited.includes(moment.id)).map((moment) => ({ id: moment.id, name: moment.name, date: moment.date, startTime: moment.startTime, placeLabel: moment.placeLabel })),
    members: memberViews,
    questions: { diet: settings.askDiet && resolved.open, accommodation: settings.askAccommodation && resolved.open, transport: settings.askTransport && resolved.open },
    dietOptions: options.filter((option) => !option.hidden).map((option) => ({ id: option.id, kind: option.kind, label: guestLabel(option) })),
    consented: consents.some((consent) => consent.guestId === self.id && !consent.legalGuardian),
    accommodation: household.needsAccommodation,
    transport: household.needsTransport,
    answeredAt: household.answeredAt?.toISOString() ?? null,
    notice: fill(customNotice ?? guestPrivacyNoticeTemplate(locale), values),
    consent: {
      version: consent.version,
      text: fill(consent.text, values),
      guardianTexts: Object.fromEntries(members.filter((member) => member.kind === "child").map((member) => [member.id, fill(consent.guardian, { name: member.firstName })])),
    },
    contact: { name: organization.name, email: organization.email, phone: organization.phone },
  };
}

function labeller(locale: GuestLocale) {
  return {
    guestLabel: (option: { starterKey: string | null; label: string | null }) => (option.starterKey ? (starterLabel(option.starterKey, locale) ?? option.starterKey) : (option.label ?? "")),
  };
}

export type OpenRsvpResult = { outcome: "open" | "closed"; view: RsvpView } | { outcome: "invalid" };

// Ouverture de la page : la réponse du foyer, ou « lien inconnu » sans rien dire de plus.
export async function openRsvp(token: unknown, locale: GuestLocale, now: Date = new Date()): Promise<OpenRsvpResult> {
  const resolved = await resolve(token, now);
  if (!resolved) return { outcome: "invalid" };
  await withActor({ kind: "link", id: resolved.link.id }, async () => {
    await inOrganization(resolved.organizationId, (tx) => tx.update(guestLinks).set({ lastOpenedAt: now }).where(eq(guestLinks.id, resolved.link.id)));
    await recordAudit(appDatabase(), { organizationId: resolved.organizationId, action: "guests.link.opened", objectId: resolved.context.eventId });
  });
  return { outcome: resolved.open ? "open" : "closed", view: await buildView(resolved, locale) };
}

async function activeConsent(tx: Tx, guestId: string) {
  const [row] = await tx.select().from(dietConsents).where(and(eq(dietConsents.guestId, guestId), isNull(dietConsents.withdrawnAt))).orderBy(desc(dietConsents.grantedAt)).limit(1);
  return row ?? null;
}

// Régimes d'une personne : enregistrés avec la preuve de l'accord, ou effacés au retrait (la preuve
// garde l'horodatage du retrait).
async function writeDiet(tx: Tx, resolved: Resolved, guestId: string, optionIds: string[] | null, legalGuardian: boolean, now: Date): Promise<"granted" | "withdrawn" | null> {
  const { organizationId, self, context } = resolved;
  const consent = await activeConsent(tx, guestId);
  if (optionIds === null) {
    // Le régime d'un enfant donné par l'autre parent n'est pas touché.
    if (consent && consent.givenByGuestId !== self.id && guestId !== self.id) return null;
    await tx.delete(diets).where(eq(diets.guestId, guestId));
    if (!consent) return null;
    await tx.update(dietConsents).set({ withdrawnAt: now, updatedAt: now }).where(eq(dietConsents.id, consent.id));
    return "withdrawn";
  }
  let outcome: "granted" | null = null;
  if (!consent || consent.givenByGuestId !== self.id) {
    await tx.insert(dietConsents).values({ organizationId, eventId: context.eventId, guestId, givenByGuestId: self.id, textVersion: starterDietConsent("fr").version, channel: "personal_link", legalGuardian, grantedAt: now });
    outcome = "granted";
  }
  if (optionIds.length === 0) await tx.delete(diets).where(eq(diets.guestId, guestId));
  else {
    const sealed = sealDietOptions(optionIds, dietPlace(organizationId, guestId));
    await tx.insert(diets).values({ organizationId, guestId, optionsSealed: sealed }).onConflictDoUpdate({ target: diets.guestId, set: { optionsSealed: sealed, updatedAt: now } });
  }
  return outcome;
}

// Envoi de la réponse : présence par temps fort (le répondant pour tout le foyer), régimes avec
// accord, hébergement et transport si la planner les a activés. Après la clôture : rien.
export async function answerRsvp(token: unknown, input: RsvpAnswerInput, locale: GuestLocale, now: Date = new Date()): Promise<RsvpOutcome> {
  const resolved = await resolve(token, now);
  if (!resolved) return { outcome: "invalid" };
  if (!resolved.open) return { outcome: "closed" };
  const { organizationId, self, household, members, settings, context } = resolved;
  const invited = invitedMoments(household.keyMomentIds, context.keyMoments.map((moment) => moment.id));
  const options = await inOrganization(organizationId, (tx) => ensureDietaryOptions(tx, organizationId));
  const answer = sanitizeRsvpAnswer(
    {
      selfId: self.id,
      respondentId: household.respondentGuestId,
      members: members.map((member) => ({ id: member.id, kind: member.kind, invited })),
      optionIds: options.filter((option) => !option.hidden).map((option) => option.id),
      questions: { diet: settings.askDiet, accommodation: settings.askAccommodation, transport: settings.askTransport },
    },
    input,
  );
  const events: ("granted" | "withdrawn")[] = [];
  await withActor({ kind: "link", id: resolved.link.id }, async () => {
    await inOrganization(organizationId, async (tx) => {
      for (const presence of answer.presence) {
        await tx
          .insert(rsvpAnswers)
          .values({ organizationId, guestId: presence.guestId, keyMomentId: presence.keyMomentId, attending: presence.attending, channel: "link", answeredAt: now })
          .onConflictDoUpdate({ target: [rsvpAnswers.guestId, rsvpAnswers.keyMomentId], set: { attending: presence.attending, channel: "link", answeredAt: now, updatedAt: now } });
      }
      if (answer.ownDiet !== undefined) {
        const outcome = await writeDiet(tx, resolved, self.id, answer.ownDiet, false, now);
        if (outcome) events.push(outcome);
      }
      for (const child of answer.children) {
        const outcome = await writeDiet(tx, resolved, child.guestId, child.optionIds, true, now);
        if (outcome) events.push(outcome);
      }
      const householdUpdate: { needsAccommodation?: boolean | null; needsTransport?: boolean | null } = {};
      if (answer.accommodation !== undefined && household.respondentGuestId === self.id) householdUpdate.needsAccommodation = answer.accommodation;
      if (answer.transport !== undefined && household.respondentGuestId === self.id) householdUpdate.needsTransport = answer.transport;
      if (Object.keys(householdUpdate).length > 0) await tx.update(households).set({ ...householdUpdate, updatedAt: now }).where(eq(households.id, household.id));
      await refreshAnswered(tx, context, household.id, now);
    });
    for (const event of new Set(events)) await recordAudit(appDatabase(), { organizationId, action: event === "granted" ? "guests.diet_consent.granted" : "guests.diet_consent.withdrawn", objectId: context.eventId });
  });
  const fresh = await resolve(token, now);
  if (!fresh) return { outcome: "invalid" };
  return { outcome: "saved", view: await buildView(fresh, locale) };
}

// RGP-08 (partie F) : « Je ne souhaite pas que mes données soient conservées » : coordonnées et
// régimes effacés aussitôt (les siens, et ceux qu'elle a donnés pour ses enfants), liens retirés ;
// sa présence déjà donnée reste sous son seul nom jusqu'à la purge (DPO-3).
export async function opposeAsGuest(token: unknown, now: Date = new Date()): Promise<{ outcome: "done" } | { outcome: "invalid" }> {
  const resolved = await resolve(token, now);
  if (!resolved) return { outcome: "invalid" };
  const { organizationId, self, context } = resolved;
  await withActor({ kind: "link", id: resolved.link.id }, async () => {
    await inOrganization(organizationId, async (tx) => {
      const given = await tx.select().from(dietConsents).where(and(eq(dietConsents.givenByGuestId, self.id), isNull(dietConsents.withdrawnAt)));
      const subjects = [...new Set([self.id, ...given.map((consent) => consent.guestId).filter((id): id is string => id !== null)])];
      await tx.delete(diets).where(inArray(diets.guestId, subjects));
      await tx.update(dietConsents).set({ withdrawnAt: now, updatedAt: now }).where(and(inArray(dietConsents.guestId, subjects), isNull(dietConsents.withdrawnAt)));
      await tx.update(guests).set({ email: null, phone: null, opposedAt: now, updatedAt: now }).where(eq(guests.id, self.id));
      await tx.update(guestLinks).set({ revokedAt: now, updatedAt: now }).where(and(eq(guestLinks.guestId, self.id), isNull(guestLinks.revokedAt)));
    });
    await recordAudit(appDatabase(), { organizationId, action: "guests.guest.opposed", objectId: context.eventId });
  });
  return { outcome: "done" };
}
