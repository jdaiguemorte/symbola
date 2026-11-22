// Lot 47 (PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; D1 à D10 ; ADR 0085) — prestataires par lien :
// le brief d'un poste envoyé à plusieurs prestataires (un e-mail et un lien chacun), la réponse du
// prestataire par son lien (disponibilité, devis, facture une fois retenu), la relance la veille de
// la date limite, le comparatif et les scénarios, l'avis et le choix du client qui engage, la
// feuille de route à J-30 et J-7 et sa confirmation. Fichier interne au module events : exposé aux
// autres modules seulement par service.ts (ADR 0011). Tout se lit et s'écrit sous RLS, dans
// l'organisation ; un lien ne voit que son prestataire (PRE-03 : les consultés ne se voient pas).
import type { AutomationHooks, PreparedEmailView, RelationDraft } from "@symbola/contracts";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { listTeam } from "@symbola/auth";
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appendAudit, recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { emitDomainEvent } from "@symbola/db/events/emit";
import {
  eventActivities,
  eventDayContacts,
  eventDecisionOptionFeedback,
  eventDecisions,
  eventDocuments,
  eventDocumentVersions,
  eventLinkCodes,
  eventLinks,
  eventLinkSessions,
  events,
  eventTasks,
  eventVendorCandidateNotes,
  eventVendorCandidates,
  eventVendorSlots,
  vendorBriefDocuments,
  vendorBriefs,
  vendorCoordinationSettings,
  vendorRoadmaps,
  vendorScenarioChoices,
  vendorScenarios,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { parseEnv } from "@symbola/env";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import { dateInTimeZone, formatCalendarDate } from "@symbola/i18n";
import { MailQuotaExceededError, reserveOrganizationMail } from "@symbola/mail";
import { starterVendorCoordination, starterVendorFollowUpTasks, type StarterVendorCoordination } from "@symbola/starter-templates";
import {
  ENGAGED_CANDIDATE_STATUSES,
  EVT_VENDOR_ANSWERED,
  EVT_VENDOR_ANSWERED_VERSION,
  EVT_VENDOR_OPTION_CHOSEN,
  EVT_VENDOR_OPTION_CHOSEN_VERSION,
  EVT_VENDOR_RETENTION_RELEASED,
  EVT_VENDOR_RETENTION_RELEASED_VERSION,
  vendorAnsweredPayloadSchema,
  vendorOptionChosenPayloadSchema,
  vendorRetentionReleasedPayloadSchema,
  type ChangeRetainedVendorInput,
  type AnswerVendorBriefInput,
  type DecisionSnapshot,
  type EmailValues,
  type EngagedChoiceNotice,
  type EventTypeAudience,
  type FileDownload,
  type SaveVendorBriefInput,
  type SaveVendorCoordinationSettingsInput,
  type ScenarioComparison,
  type SendVendorBriefInput,
  type SetOptionFeedbackInput,
  type VendorAnswerNotice,
  type VendorAvailability,
  type VendorBrief,
  type VendorBriefDelivery,
  type VendorCandidateStatus,
  type VendorComparison,
  type VendorConsultationView,
  type VendorCoordinationSettings,
  type VendorDismissalReason,
  type VendorFollowUpStatus,
  type VendorRoadmapAlert,
  type VendorRoadmapStage,
  type VendorRoadmapView,
  type VendorScenario,
} from "@symbola/contracts";
import { assertOrganizationEmailReady, assertRecipientsConfirmed, depositPreparedEmail, EmailVariableMissingError, getOrganizationProfile, getUserContact, preparesRelationEmail, sendOrganizationEmail, sendTimeReached } from "@/modules/hub/service";
import { DemoEventRestrictionError, EventNotFoundError, LinkAccessDeniedError } from "./errors";
import { findEventAudience } from "./event-types";
import { findLinkRow, type LinkWithContext } from "./links-repository";
import { formatLinkToken, hashLinkSecret, isLinkExpired, linkExpiresOn, newLinkSecret } from "./link-tokens";
import { findEventById } from "./repository";
import { decisionOpenTo } from "./decisions";
import { addDays } from "./schedule";
import { CANDIDATE_QUOTE_MAX_SIZE_BYTES, CandidateQuoteRejectedError, publishRetention, VendorCandidateNotFoundError } from "./vendor-candidates";
import { findLatestProgramVersion } from "./program-versions";
import {
  briefReminderDue,
  choiceNoticeShown,
  compareByAmount,
  roadmapAlertDue,
  roadmapStageDue,
  scenarioTotals,
  vendorCanAnswer,
  vendorLinkStage,
} from "./vendor-coordination-rules";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type CandidateRow = typeof eventVendorCandidates.$inferSelect;
type BriefRow = typeof vendorBriefs.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NEED_MAX = 4000;
const MESSAGE_MAX = 1000;
const FEEDBACK_COMMENT_MAX = 500;
const SCENARIO_NAME_MAX = 120;
const ENGAGED: VendorCandidateStatus[] = [...ENGAGED_CANDIDATE_STATUSES];
// En lice : écartés quand un autre est retenu (lot 28b, D10).
const IN_THE_RUNNING: VendorCandidateStatus[] = ["shortlisted", "contacted", "quote_received"];
const CLOSED_EVENT_STATUSES: ("cancelled" | "closed")[] = ["cancelled", "closed"];

export class VendorBriefInvalidError extends Error {
  constructor(readonly reason: "need" | "deadline" | "guests" | "budget" | "documents" | "slot" | "recipients" | "missing" | "email" | "settings" | "name") {
    super(`brief invalide : ${reason}`);
    this.name = "VendorBriefInvalidError";
  }
}

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

const isEngaged = (status: VendorCandidateStatus) => ENGAGED.includes(status);

// --- Réglages de l'organisation (partie F) ---

type Policy = StarterVendorCoordination & { briefReminder: boolean; roadmapMonth: boolean; roadmapWeek: boolean };

async function policyOf(tx: Tx, organizationId: string): Promise<Policy> {
  const starter = starterVendorCoordination();
  const [row] = await tx.select().from(vendorCoordinationSettings).where(eq(vendorCoordinationSettings.organizationId, organizationId));
  return {
    ...starter,
    briefDeadlineDays: row?.briefDeadlineDays ?? starter.briefDeadlineDays,
    roadmapAlertDays: row?.roadmapAlertDays ?? starter.roadmapAlertDays,
    briefReminder: row?.briefReminder ?? true,
    roadmapMonth: row?.roadmapMonth ?? true,
    roadmapWeek: row?.roadmapWeek ?? true,
  };
}

type Metier = "wedding_planner" | "event_agency" | "autre";

export async function getSettings(organizationId: string, locale: "fr" | "en", metier: Metier | null): Promise<VendorCoordinationSettings> {
  return inOrganization(organizationId, async (tx) => {
    const policy = await policyOf(tx, organizationId);
    const [row] = await tx.select({ followUpTasks: vendorCoordinationSettings.followUpTasks }).from(vendorCoordinationSettings).where(eq(vendorCoordinationSettings.organizationId, organizationId));
    const custom = row?.followUpTasks ?? null;
    return {
      briefDeadlineDays: policy.briefDeadlineDays,
      briefReminder: policy.briefReminder,
      roadmapMonth: policy.roadmapMonth,
      roadmapWeek: policy.roadmapWeek,
      roadmapAlertDays: policy.roadmapAlertDays,
      followUpTasks: custom ?? starterVendorFollowUpTasks(locale, metier ?? "wedding_planner"),
      followUpTasksCustomized: custom !== null,
    };
  });
}

export async function saveSettings(input: SaveVendorCoordinationSettingsInput): Promise<void> {
  const deadline = input.briefDeadlineDays;
  const alert = input.roadmapAlertDays;
  if (!Number.isInteger(deadline) || deadline < 1 || deadline > 60 || !Number.isInteger(alert) || alert < 1 || alert > 6) throw new VendorBriefInvalidError("settings");
  const tasks = input.followUpTasks?.map((task) => ({ label: task.label.trim().slice(0, 200), dueInDays: task.dueInDays })) ?? null;
  if (tasks && (tasks.length > 20 || tasks.some((task) => !task.label || !Number.isInteger(task.dueInDays) || task.dueInDays < 0 || task.dueInDays > 365))) throw new VendorBriefInvalidError("settings");
  await inOrganization(input.organizationId, async (tx) => {
    const values = { briefDeadlineDays: deadline, briefReminder: input.briefReminder, roadmapMonth: input.roadmapMonth, roadmapWeek: input.roadmapWeek, roadmapAlertDays: alert, followUpTasks: tasks, updatedAt: new Date() };
    await tx.insert(vendorCoordinationSettings).values({ organizationId: input.organizationId, ...values }).onConflictDoUpdate({ target: vendorCoordinationSettings.organizationId, set: values });
  });
}

// --- Brief (PRE-03 ; D1, D10) ---

function toBrief(row: BriefRow, documentIds: string[]): VendorBrief {
  return {
    id: row.id,
    eventId: row.eventId,
    vendorSlotId: row.vendorSlotId,
    need: row.need,
    guestCount: row.guestCount,
    indicativeBudgetCents: row.indicativeBudgetCents,
    showBudget: row.showBudget,
    deadline: row.deadline,
    sentAt: row.sentAt?.toISOString() ?? null,
    documentIds,
  };
}

async function briefDocumentIds(tx: Tx, briefId: string): Promise<string[]> {
  const rows = await tx.select({ documentId: vendorBriefDocuments.documentId }).from(vendorBriefDocuments).where(eq(vendorBriefDocuments.briefId, briefId)).orderBy(asc(vendorBriefDocuments.createdAt));
  return rows.map((row) => row.documentId);
}

export async function getBrief(organizationId: string, vendorSlotId: string): Promise<VendorBrief | null> {
  if (!UUID.test(vendorSlotId)) return null;
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(vendorBriefs).where(eq(vendorBriefs.vendorSlotId, vendorSlotId));
    return row ? toBrief(row, await briefDocumentIds(tx, row.id)) : null;
  });
}

export async function saveBrief(input: SaveVendorBriefInput): Promise<VendorBrief> {
  const need = input.need.trim();
  if (!need || need.length > NEED_MAX) throw new VendorBriefInvalidError("need");
  if (!DATE.test(input.deadline) || Number.isNaN(Date.parse(`${input.deadline}T00:00:00Z`))) throw new VendorBriefInvalidError("deadline");
  if (input.guestCount !== null && (!Number.isInteger(input.guestCount) || input.guestCount < 0 || input.guestCount > 100_000)) throw new VendorBriefInvalidError("guests");
  if (input.indicativeBudgetCents !== null && (!Number.isInteger(input.indicativeBudgetCents) || input.indicativeBudgetCents < 0)) throw new VendorBriefInvalidError("budget");
  const documentIds = [...new Set(input.documentIds)];
  if (documentIds.some((id) => !UUID.test(id)) || documentIds.length > 20) throw new VendorBriefInvalidError("documents");
  return inOrganization(input.organizationId, async (tx) => {
    const [slot] = await tx.select({ id: eventVendorSlots.id }).from(eventVendorSlots).where(and(eq(eventVendorSlots.id, input.vendorSlotId), eq(eventVendorSlots.eventId, input.eventId)));
    if (!slot) throw new VendorBriefInvalidError("slot");
    if (documentIds.length > 0) {
      const found = await tx.select({ id: eventDocuments.id }).from(eventDocuments).where(and(inArray(eventDocuments.id, documentIds), eq(eventDocuments.eventId, input.eventId)));
      if (found.length !== documentIds.length) throw new VendorBriefInvalidError("documents");
    }
    const values = { need, guestCount: input.guestCount, indicativeBudgetCents: input.indicativeBudgetCents, showBudget: input.showBudget, deadline: input.deadline, updatedAt: new Date() };
    const [row] = await tx
      .insert(vendorBriefs)
      .values({ organizationId: input.organizationId, eventId: input.eventId, vendorSlotId: slot.id, ...values })
      .onConflictDoUpdate({ target: vendorBriefs.vendorSlotId, set: values })
      .returning();
    await tx.delete(vendorBriefDocuments).where(eq(vendorBriefDocuments.briefId, row!.id));
    if (documentIds.length > 0) await tx.insert(vendorBriefDocuments).values(documentIds.map((documentId) => ({ organizationId: input.organizationId, briefId: row!.id, documentId })));
    return toBrief(row!, documentIds);
  });
}

// La date limite par défaut d'un nouveau brief : aujourd'hui (fuseau de l'évènement) plus le délai
// réglé par l'organisation.
export async function defaultBriefDeadline(organizationId: string, eventId: string, now: Date): Promise<string> {
  const found = await findEventById(organizationId, eventId);
  const policy = await inOrganization(organizationId, (tx) => policyOf(tx, organizationId));
  return addDays(dateInTimeZone(now, found?.event.timeZone ?? "Europe/Paris"), policy.briefDeadlineDays);
}

// --- Liens et e-mails des prestataires ---

function emailTranslator(locale: "fr" | "en") {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Emails" });
}

// SEC-17 : le jeton suit « # » (jamais envoyé au serveur). « ?reponse= » présélectionne la réponse
// (D4) : la page l'affiche, un toucher la confirme.
function vendorLinkUrls(token: string): { link: string; available: string; unavailable: string } {
  const base = parseEnv(process.env).APP_PUBLIC_URL;
  return { link: `${base}/lien#${token}`, available: `${base}/lien?reponse=oui#${token}`, unavailable: `${base}/lien?reponse=non#${token}` };
}

// « le mariage de Léa & Maxime » au prestataire (ADR 0045, vocabulaire du type d'évènement).
async function vendorEventValues(organizationId: string, eventId: string, locale: "fr" | "en"): Promise<EmailValues> {
  const found = await findEventById(organizationId, eventId);
  const named = (found?.clients ?? []).filter((client) => client.firstName.trim()).map((client) => client.firstName.trim());
  const clients = named.join(" & ");
  const vocabulary: EventTypeAudience = (await findEventAudience(organizationId, eventId)) ?? "couple";
  const t = emailTranslator(locale);
  const couple = vocabulary === "couple";
  return {
    event: clients ? t(couple ? "event.coupleVendor" : "event.clientsVendor", { clients }) : t(couple ? "event.coupleVendorUnnamed" : "event.clientsVendorUnnamed"),
    ...(clients ? { clients } : {}),
    ...(found?.event.eventDate ? { event_date: formatCalendarDate(found.event.eventDate, locale) } : {}),
  };
}

// Un lien vaut s'il n'est ni retiré ni expiré, et si son évènement n'est ni perdu ni un essai.
function usable(context: LinkWithContext, now: Date): boolean {
  const expiresOn = linkExpiresOn({ audience: context.link.audience, customExpiresOn: context.link.customExpiresOn, eventDate: context.event.eventDate, createdAt: context.link.createdAt });
  return !context.link.revokedAt && !isLinkExpired(expiresOn, now) && context.event.status !== "cancelled" && !context.event.isDemo;
}

// Le lien du prestataire consulté, créé ou rééquipé d'un nouveau jeton (l'ancien cesse, ses
// sessions sont coupées) : seul le haché reste en base, le jeton part dans l'e-mail.
async function issueVendorLink(tx: Tx, input: { organizationId: string; eventId: string; candidateId: string; personName: string; email: string; locale: "fr" | "en" }): Promise<{ linkId: string; token: string }> {
  const secret = newLinkSecret();
  const tokenHash = hashLinkSecret(secret);
  const [existing] = await tx
    .select({ id: eventLinks.id })
    .from(eventLinks)
    .where(and(eq(eventLinks.vendorCandidateId, input.candidateId), eq(eventLinks.audience, "vendor"), isNull(eventLinks.revokedAt)))
    .orderBy(desc(eventLinks.createdAt))
    .limit(1);
  if (existing) {
    await tx.update(eventLinks).set({ tokenHash, email: input.email, personName: input.personName, locale: input.locale, renewalRequestedAt: null }).where(eq(eventLinks.id, existing.id));
    await tx.delete(eventLinkSessions).where(eq(eventLinkSessions.linkId, existing.id));
    await tx.delete(eventLinkCodes).where(eq(eventLinkCodes.linkId, existing.id));
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.link.renewed", objectId: input.eventId, details: { linkId: existing.id } });
    return { linkId: existing.id, token: formatLinkToken(input.organizationId, secret) };
  }
  const [link] = await tx
    .insert(eventLinks)
    .values({
      organizationId: input.organizationId,
      eventId: input.eventId,
      audience: "vendor",
      personName: input.personName,
      email: input.email,
      vendorCandidateId: input.candidateId,
      rubrics: [],
      budgetScope: "all",
      otpRequired: false,
      taskReminders: false,
      locale: input.locale,
      tokenHash,
    })
    .returning({ id: eventLinks.id });
  await appendAudit(tx, { organizationId: input.organizationId, action: "events.link.created", objectId: input.eventId, details: { linkId: link!.id, audience: "vendor" } });
  return { linkId: link!.id, token: formatLinkToken(input.organizationId, secret) };
}

// Pour une relance ou une feuille de route : le lien actif du prestataire, rééquipé d'un jeton.
async function reissueActiveLink(organizationId: string, candidateId: string, now: Date): Promise<{ linkId: string; token: string; email: string; personName: string; locale: "fr" | "en"; eventId: string } | null> {
  const [link] = await inOrganization(organizationId, (tx) =>
    tx.select().from(eventLinks).where(and(eq(eventLinks.vendorCandidateId, candidateId), eq(eventLinks.audience, "vendor"), isNull(eventLinks.revokedAt))).orderBy(desc(eventLinks.createdAt)).limit(1),
  );
  if (!link) return null;
  const context = await findLinkRow(organizationId, link.id);
  if (!context || !usable(context, now)) return null;
  const locale = link.locale === "en" ? "en" : "fr";
  const issued = await inOrganization(organizationId, (tx) => issueVendorLink(tx, { organizationId, eventId: link.eventId, candidateId, personName: link.personName, email: link.email, locale }));
  return { ...issued, email: link.email, personName: link.personName, locale, eventId: link.eventId };
}

// Lot 65d : le lien actif et valable du prestataire, sans le rééquiper (le jeton est donné à l'ouverture
// de la fenêtre « Préparer l'e-mail »).
async function activeVendorLink(organizationId: string, candidateId: string, now: Date): Promise<{ id: string } | null> {
  const [link] = await inOrganization(organizationId, (tx) =>
    tx.select({ id: eventLinks.id }).from(eventLinks).where(and(eq(eventLinks.vendorCandidateId, candidateId), eq(eventLinks.audience, "vendor"), isNull(eventLinks.revokedAt))).orderBy(desc(eventLinks.createdAt)).limit(1),
  );
  if (!link) return null;
  const context = await findLinkRow(organizationId, link.id);
  return context && usable(context, now) ? link : null;
}

// Lot 65d (MSG-01, HUB-28 ; ADR 0110) — brief, relance du brief et feuille de route recomposés à
// l'ouverture de la fenêtre « Préparer l'e-mail » : le lien du prestataire reçoit un nouveau jeton,
// comme à chaque envoi par Symbola (l'ancien cesse). null : lien retiré ou expiré, réponse déjà
// donnée (brief et relance), prestataire plus retenu (feuille de route).
export async function draftVendorRelationEmail(organizationId: string, item: PreparedEmailView, now: Date = new Date()): Promise<RelationDraft | null> {
  const context = await findLinkRow(organizationId, item.recipientId);
  if (!context || context.link.audience !== "vendor" || !context.link.vendorCandidateId || context.link.eventId !== item.eventId || !usable(context, now)) return null;
  const candidateId = context.link.vendorCandidateId;
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .select({ candidate: eventVendorCandidates, slotLabel: eventVendorSlots.label })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .where(eq(eventVendorCandidates.id, candidateId)),
  );
  if (!row) return null;
  const brief = item.kind === "vendor_roadmap" ? null : ((await inOrganization(organizationId, (tx) => tx.select().from(vendorBriefs).where(eq(vendorBriefs.id, item.ref.briefId ?? "00000000-0000-0000-0000-000000000000"))))[0] ?? null);
  if (item.kind === "vendor_roadmap" ? !isEngaged(row.candidate.status) : !brief || row.candidate.answeredAt !== null) return null;
  const link = await reissueActiveLink(organizationId, candidateId, now);
  if (!link) return null;
  const locale = item.ref.locale === "en" ? "en" : item.ref.locale === "fr" ? "fr" : link.locale;
  const urls = vendorLinkUrls(link.token);
  const base: EmailValues = { ...(await vendorEventValues(organizationId, row.candidate.eventId, locale)), first_name: link.personName };
  const values: EmailValues =
    item.kind === "vendor_roadmap"
      ? { ...base, link: urls.link }
      : { ...base, slot: row.slotLabel, deadline: formatCalendarDate(brief!.deadline, locale), link: urls.link, link_available: urls.available, link_unavailable: urls.unavailable };
  return { to: link.email, recipientName: link.personName, locale, values, renewedLink: true };
}

// D4, MSG-02 : un e-mail par prestataire, jamais de copie ni de liste visible ; chacun porte son
// lien personnel. L'envoi à plusieurs ne part qu'une fois l'écran de contrôle confirmé.
export async function sendBrief(input: SendVendorBriefInput): Promise<VendorBriefDelivery> {
  const now = input.now ?? new Date();
  const recipients = input.recipients.map((recipient) => ({ candidateId: recipient.candidateId, name: recipient.name.trim().slice(0, 120), email: recipient.email.trim() }));
  if (recipients.length === 0 || recipients.length > 30 || new Set(recipients.map((recipient) => recipient.candidateId)).size !== recipients.length) throw new VendorBriefInvalidError("recipients");
  if (recipients.some((recipient) => !UUID.test(recipient.candidateId) || !recipient.name)) throw new VendorBriefInvalidError("recipients");
  if (recipients.some((recipient) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email))) throw new VendorBriefInvalidError("email");
  const found = await findEventById(input.organizationId, input.eventId);
  if (!found) throw new EventNotFoundError();
  // AIDE-02 : jamais d'e-mail à un tiers depuis un essai.
  if (found.event.isDemo) throw new DemoEventRestrictionError();
  const { brief, slotLabel, candidates } = await inOrganization(input.organizationId, async (tx) => {
    const [row] = await tx.select().from(vendorBriefs).where(and(eq(vendorBriefs.vendorSlotId, input.vendorSlotId), eq(vendorBriefs.eventId, input.eventId)));
    const [slot] = await tx.select({ label: eventVendorSlots.label }).from(eventVendorSlots).where(eq(eventVendorSlots.id, input.vendorSlotId));
    const rows = await tx
      .select()
      .from(eventVendorCandidates)
      .where(and(eq(eventVendorCandidates.vendorSlotId, input.vendorSlotId), eq(eventVendorCandidates.eventId, input.eventId), inArray(eventVendorCandidates.id, recipients.map((recipient) => recipient.candidateId))));
    return { brief: row ?? null, slotLabel: slot?.label ?? null, candidates: rows };
  });
  if (!brief || !slotLabel) throw new VendorBriefInvalidError("missing");
  // Abus : un destinataire d'un autre poste, d'un autre évènement ou d'une autre organisation.
  if (candidates.length !== recipients.length || candidates.some((candidate) => isEngaged(candidate.status))) throw new VendorBriefInvalidError("recipients");
  assertRecipientsConfirmed(recipients.map((recipient) => ({ name: recipient.name, email: recipient.email })), input.confirmedDigest);

  const locale = input.locale;
  const base = await vendorEventValues(input.organizationId, input.eventId, locale);
  const common: EmailValues = { ...base, slot: slotLabel, deadline: formatCalendarDate(brief.deadline, locale) };
  // Lot 38a (MSG-01, D5) : rien ne part si le modèle a une variable vide.
  const placeholder = vendorLinkUrls("x");
  await assertOrganizationEmailReady({ organizationId: input.organizationId, kind: "vendor_brief", locale, values: { ...common, first_name: recipients[0]!.name, link_available: placeholder.available, link_unavailable: placeholder.unavailable } });

  let sent = 0;
  let deferred = 0;
  let prepared = 0;
  const today = dateInTimeZone(now, found.event.timeZone);
  // Lot 65d (MSG-01 ; ADR 0110) : quand la planner envoie de sa messagerie, le brief est préparé pour
  // chaque prestataire (son lien personnel est inséré à l'ouverture de la fenêtre) ; rien ne part.
  const planner = await preparesRelationEmail(input.organizationId, "vendor_brief");
  for (const recipient of recipients) {
    // SEC-22 : chaque e-mail compte dans le plafond de l'organisation, réservé avant le lien.
    if (!planner) await reserveOrganizationMail(input.organizationId, { now });
    const issued = await inOrganization(input.organizationId, async (tx) => {
      const link = await issueVendorLink(tx, { organizationId: input.organizationId, eventId: input.eventId, candidateId: recipient.candidateId, personName: recipient.name, email: recipient.email, locale });
      const [current] = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, recipient.candidateId));
      await tx
        .update(eventVendorCandidates)
        .set({
          briefId: brief.id,
          status: current!.status === "shortlisted" || current!.status === "dismissed" ? "contacted" : current!.status,
          dismissalReason: null,
          availability: null,
          answeredAt: null,
          remindedAt: null,
          contactedOn: today,
          updatedAt: now,
        })
        .where(eq(eventVendorCandidates.id, recipient.candidateId));
      return link;
    });
    if (planner) {
      await depositPreparedEmail({ organizationId: input.organizationId, kind: "vendor_brief", eventId: input.eventId, recipientType: "event_link", recipientId: issued.linkId, ref: { briefId: brief.id, locale }, origin: "gesture", sourceKey: `vendor-brief:${brief.id}:${recipient.candidateId}:${now.getTime()}` });
      prepared += 1;
      continue;
    }
    const urls = vendorLinkUrls(issued.token);
    const result = await sendOrganizationEmail({
      organizationId: input.organizationId,
      to: recipient.email,
      kind: "vendor_brief",
      locale,
      values: { ...common, first_name: recipient.name, link: urls.link, link_available: urls.available, link_unavailable: urls.unavailable },
      reserve: false,
    });
    sent += 1;
    if (result.deferred) deferred += 1;
  }
  await inOrganization(input.organizationId, async (tx) => {
    await tx.update(vendorBriefs).set({ sentAt: now, sentByUserId: input.sentByUserId, updatedAt: now }).where(eq(vendorBriefs.id, brief.id));
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.vendor_brief.sent", objectId: input.eventId, details: { briefId: brief.id, recipients: recipients.length } });
  });
  return { sent, deferred, ...(planner ? { prepared } : {}) };
}

// --- La relance de la veille (D2) ---

// Lot 66a (D1) : isSendTime, l'heure d'envoi par défaut de l'organisation (remise par l'appelant).
export async function sendBriefReminders(organizationId: string, now: Date, isSendTime?: AutomationHooks["isSendTime"]): Promise<number> {
  const policy = await inOrganization(organizationId, (tx) => policyOf(tx, organizationId));
  if (!policy.briefReminder) return 0;
  const due = await inOrganization(organizationId, async (tx) =>
    tx
      .select({ candidate: eventVendorCandidates, brief: vendorBriefs, slotLabel: eventVendorSlots.label, timeZone: events.timeZone })
      .from(eventVendorCandidates)
      .innerJoin(vendorBriefs, eq(vendorBriefs.id, eventVendorCandidates.briefId))
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
      .where(
        and(
          isNotNull(vendorBriefs.sentAt),
          isNull(eventVendorCandidates.answeredAt),
          isNull(eventVendorCandidates.remindedAt),
          inArray(eventVendorCandidates.status, ["shortlisted", "contacted"]),
          eq(events.isDemo, false),
          notInArray(events.status, CLOSED_EVENT_STATUSES),
        ),
      ),
  );
  let sent = 0;
  // Lot 65d (HUB-28 ; ADR 0110) : déposée « À envoyer » quand la planner envoie de sa messagerie.
  const planner = await preparesRelationEmail(organizationId, "vendor_brief_reminder");
  for (const row of due) {
    if (!briefReminderDue(row.brief.deadline, dateInTimeZone(now, row.timeZone), policy)) continue;
    // Lot 66a (D1) : à l'heure d'envoi, dans le fuseau de l'évènement.
    if (!sendTimeReached(isSendTime, now, row.timeZone)) continue;
    // Une seule relance : marquée avant l'envoi (deux passages simultanés n'en envoient qu'une).
    const claimed = await inOrganization(organizationId, async (tx) =>
      (await tx.update(eventVendorCandidates).set({ remindedAt: now }).where(and(eq(eventVendorCandidates.id, row.candidate.id), isNull(eventVendorCandidates.remindedAt))).returning({ id: eventVendorCandidates.id })).length > 0,
    );
    if (!claimed) continue;
    if (planner) {
      const active = await activeVendorLink(organizationId, row.candidate.id, now);
      if (!active) continue;
      await depositPreparedEmail({ organizationId, kind: "vendor_brief_reminder", eventId: row.candidate.eventId, recipientType: "event_link", recipientId: active.id, ref: { briefId: row.brief.id }, origin: "automation", sourceKey: `vendor-brief-reminder:${row.candidate.id}:${row.brief.id}` });
      sent += 1;
      continue;
    }
    const link = await reissueActiveLink(organizationId, row.candidate.id, now);
    if (!link) continue;
    const values: EmailValues = {
      ...(await vendorEventValues(organizationId, row.candidate.eventId, link.locale)),
      first_name: link.personName,
      slot: row.slotLabel,
      deadline: formatCalendarDate(row.brief.deadline, link.locale),
    };
    const urls = vendorLinkUrls(link.token);
    try {
      await assertOrganizationEmailReady({ organizationId, kind: "vendor_brief_reminder", locale: link.locale, values: { ...values, link: urls.link, link_available: urls.available, link_unavailable: urls.unavailable } });
      await reserveOrganizationMail(organizationId, { now });
    } catch (error) {
      if (error instanceof EmailVariableMissingError) {
        await recordAudit(appDatabase(), { organizationId, action: "hub.mail.variable_missing", objectId: row.candidate.eventId, details: { kind: "vendor_brief_reminder", locale: link.locale, missing: error.missing.join(",") }, actor: SYSTEM_ACTOR });
        continue;
      }
      if (error instanceof MailQuotaExceededError) break;
      throw error;
    }
    await sendOrganizationEmail({ organizationId, to: link.email, kind: "vendor_brief_reminder", locale: link.locale, values: { ...values, link: urls.link, link_available: urls.available, link_unavailable: urls.unavailable }, reserve: false, idempotencyKey: `vendor-brief-reminder:${row.candidate.id}:${row.brief.id}` });
    await inOrganization(organizationId, (tx) => appendAudit(tx, { organizationId, action: "events.vendor_brief.reminded", objectId: row.candidate.eventId, details: { linkId: link.linkId } }));
    sent += 1;
  }
  return sent;
}

// --- Le prestataire par son lien (PRE-04 ; D3, D4) ---

type VendorAccess = { context: LinkWithContext; candidate: CandidateRow; slotLabel: string; slotDecided: boolean };

// Le lien d'un prestataire, relu en base : son prestataire consulté, de son évènement. Sinon la
// même réponse dans tous les cas (SEC-13).
async function vendorAccess(organizationId: string, linkId: string, now: Date): Promise<VendorAccess> {
  if (!UUID.test(linkId)) throw new LinkAccessDeniedError();
  const context = await findLinkRow(organizationId, linkId);
  if (!context || context.link.audience !== "vendor" || !context.link.vendorCandidateId || !usable(context, now)) throw new LinkAccessDeniedError();
  const candidateId = context.link.vendorCandidateId;
  const found = await inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .select({ candidate: eventVendorCandidates, slotLabel: eventVendorSlots.label })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .where(and(eq(eventVendorCandidates.id, candidateId), eq(eventVendorCandidates.eventId, context.link.eventId)));
    if (!row) return null;
    const engaged = await tx
      .select({ id: eventVendorCandidates.id })
      .from(eventVendorCandidates)
      .where(and(eq(eventVendorCandidates.vendorSlotId, row.candidate.vendorSlotId), inArray(eventVendorCandidates.status, ENGAGED)))
      .limit(1);
    return { ...row, slotDecided: engaged.length > 0 };
  });
  if (!found) throw new LinkAccessDeniedError();
  return { context, candidate: found.candidate, slotLabel: found.slotLabel, slotDecided: found.slotDecided };
}

// D3 : ce que voit le lien selon le statut. En consultation : le brief et la réponse de son
// prestataire, l'évènement (prénoms, date, lieux en intitulé et ville). Jamais un autre consulté,
// ni programme, ni contacts, ni tâches, ni budget (s'il n'est pas coché).
export async function consultationView(organizationId: string, linkId: string, now: Date = new Date()): Promise<VendorConsultationView> {
  const access = await vendorAccess(organizationId, linkId, now);
  const { candidate } = access;
  const stage = vendorLinkStage({ status: candidate.status, briefId: candidate.briefId });
  const found = await findEventById(organizationId, candidate.eventId);
  if (!found) throw new LinkAccessDeniedError();
  const showBrief = stage === "consultation";
  const details = await inOrganization(organizationId, async (tx) => {
    const places = await tx.execute<{ id: string; label: string; city: string | null }>(
      sql`select id, label, city from events.event_places where event_id = ${candidate.eventId} order by position, created_at`,
    );
    if (!showBrief || !candidate.briefId) return { places: [...places], brief: null };
    const [brief] = await tx.select().from(vendorBriefs).where(eq(vendorBriefs.id, candidate.briefId));
    if (!brief) return { places: [...places], brief: null };
    const documents = await tx
      .select({ id: eventDocuments.id, label: eventDocuments.label, mime: eventDocuments.mime })
      .from(vendorBriefDocuments)
      .innerJoin(eventDocuments, eq(eventDocuments.id, vendorBriefDocuments.documentId))
      .where(eq(vendorBriefDocuments.briefId, brief.id))
      .orderBy(asc(vendorBriefDocuments.createdAt));
    return {
      places: [...places],
      brief: { need: brief.need, guestCount: brief.guestCount, budgetCents: brief.showBudget ? brief.indicativeBudgetCents : null, deadline: brief.deadline, documents },
    };
  });
  return {
    stage,
    vendorName: candidate.vendorName,
    slotLabel: access.slotLabel,
    clientFirstNames: found.clients.map((client) => client.firstName).filter(Boolean),
    eventDate: found.event.eventDate,
    places: details.places.map((place) => ({ id: place.id, label: place.label, city: place.city })),
    brief: details.brief,
    answer: {
      availability: (candidate.availability as VendorAvailability | null) ?? null,
      answeredAt: candidate.answeredAt?.toISOString() ?? null,
      message: candidate.answerMessage,
      quoteAmountCents: candidate.quoteAmountCents,
      hasQuoteFile: candidate.quoteFileKey !== null,
    },
    canAnswer: vendorCanAnswer({ status: candidate.status, dismissalReason: candidate.dismissalReason, briefId: candidate.briefId }, access.slotDecided),
  };
}

// Une inspiration du brief, ouverte par le lien en consultation.
export async function briefDocumentFile(organizationId: string, linkId: string, documentId: string): Promise<FileDownload> {
  const { candidate } = await vendorAccess(organizationId, linkId, new Date());
  if (!candidate.briefId || !UUID.test(documentId) || vendorLinkStage({ status: candidate.status, briefId: candidate.briefId }) !== "consultation") throw new LinkAccessDeniedError();
  const briefId = candidate.briefId;
  const [document] = await inOrganization(organizationId, (tx) =>
    tx
      .select({ fileKey: eventDocuments.fileKey, mime: eventDocuments.mime, label: eventDocuments.label })
      .from(vendorBriefDocuments)
      .innerJoin(eventDocuments, eq(eventDocuments.id, vendorBriefDocuments.documentId))
      .where(and(eq(vendorBriefDocuments.briefId, briefId), eq(vendorBriefDocuments.documentId, documentId))),
  );
  if (!document) throw new LinkAccessDeniedError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), document.fileKey);
    const extension = document.fileKey.split(".").pop() ?? "bin";
    const safe = document.label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "inspiration";
    return { data, contentType: document.mime, fileName: `${safe}.${extension}` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new LinkAccessDeniedError();
    throw error;
  }
}

function cleanMessage(message: string | null | undefined): string | null {
  const text = message?.trim() ?? "";
  if (!text) return null;
  if (text.length > MESSAGE_MAX) throw new VendorBriefInvalidError("need");
  return text;
}

async function recordAnswer(tx: Tx, organizationId: string, access: VendorAccess, availability: VendorAvailability, withQuote: boolean, now: Date): Promise<void> {
  await tx.insert(eventActivities).values({ organizationId, eventId: access.candidate.eventId, actorLinkId: access.context.link.id, kind: "vendor_answered", taskLabel: "", vendorCandidateId: access.candidate.id, createdAt: now });
  await appendAudit(tx, { organizationId, action: "events.vendor.answered", objectId: access.candidate.eventId, details: { linkId: access.context.link.id, availability } });
  // Jamais pour un évènement d'essai (un lien n'y vaut pas, la règle reste écrite).
  await emitDomainEvent(tx, {
    organizationId,
    name: EVT_VENDOR_ANSWERED,
    version: EVT_VENDOR_ANSWERED_VERSION,
    payload: vendorAnsweredPayloadSchema.parse({ eventId: access.candidate.eventId, vendorSlotId: access.candidate.vendorSlotId, candidateId: access.candidate.id, availability, withQuote, linkId: access.context.link.id }),
  });
}

// D4 : la réponse se confirme d'un toucher sur la page (jamais à l'ouverture du lien). « Disponible »
// garde le prestataire consulté (« Devis reçu » avec un montant) ; « Indisponible » l'écarte, motif
// « indisponible ». Il change d'avis tant que la planner n'a pas tranché.
export async function answerBrief(input: AnswerVendorBriefInput): Promise<void> {
  const now = input.now ?? new Date();
  const access = await vendorAccess(input.organizationId, input.linkId, now);
  const { candidate } = access;
  if (!vendorCanAnswer({ status: candidate.status, dismissalReason: candidate.dismissalReason, briefId: candidate.briefId }, access.slotDecided)) throw new LinkAccessDeniedError();
  const message = cleanMessage(input.message);
  const amount = input.quoteAmountCents ?? null;
  if (amount !== null && (!Number.isInteger(amount) || amount < 0)) throw new VendorBriefInvalidError("budget");
  await withActor({ kind: "link", id: input.linkId }, () =>
    inOrganization(input.organizationId, async (tx) => {
      const available = input.availability === "available";
      const quoteAmountCents = available ? (amount ?? candidate.quoteAmountCents) : candidate.quoteAmountCents;
      const hasQuote = quoteAmountCents !== null || candidate.quoteFileKey !== null;
      await tx
        .update(eventVendorCandidates)
        .set({
          availability: input.availability,
          answeredAt: now,
          answerMessage: message ?? candidate.answerMessage,
          quoteAmountCents,
          status: available ? (hasQuote ? "quote_received" : "contacted") : "dismissed",
          dismissalReason: available ? null : "unavailable",
          updatedAt: now,
        })
        .where(eq(eventVendorCandidates.id, candidate.id));
      await recordAnswer(tx, input.organizationId, access, input.availability, available && hasQuote, now);
    }),
  );
}

// Le devis déposé depuis le téléphone (photo ou PDF) : contrôlé (type par le contenu, taille,
// antivirus), rangé en privé ; il vaut « Disponible » et « Devis reçu ».
export async function attachQuoteByLink(input: { organizationId: string; linkId: string; content: Uint8Array; quoteAmountCents?: number | null; message?: string | null; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  const access = await vendorAccess(input.organizationId, input.linkId, now);
  if (!vendorCanAnswer({ status: access.candidate.status, dismissalReason: access.candidate.dismissalReason, briefId: access.candidate.briefId }, access.slotDecided)) throw new LinkAccessDeniedError();
  const amount = input.quoteAmountCents ?? null;
  if (amount !== null && (!Number.isInteger(amount) || amount < 0)) throw new VendorBriefInvalidError("budget");
  const message = cleanMessage(input.message);
  const upload = await uploadFile({ organizationId: input.organizationId, buffer: Buffer.from(input.content), maxSizeBytes: CANDIDATE_QUOTE_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new CandidateQuoteRejectedError(upload.reason);
  const previousKey = await withActor({ kind: "link", id: input.linkId }, () =>
    inOrganization(input.organizationId, async (tx) => {
      const [current] = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.id, access.candidate.id));
      if (!current) throw new LinkAccessDeniedError();
      await tx
        .update(eventVendorCandidates)
        .set({
          quoteFileKey: upload.key,
          quoteMime: upload.mime,
          quoteSizeBytes: upload.size,
          ...(amount !== null ? { quoteAmountCents: amount } : {}),
          availability: "available",
          answeredAt: now,
          answerMessage: message ?? current.answerMessage,
          status: "quote_received",
          dismissalReason: null,
          updatedAt: now,
        })
        .where(eq(eventVendorCandidates.id, current.id));
      await recordAnswer(tx, input.organizationId, access, "available", true, now);
      return current.quoteFileKey;
    }),
  ).catch(async (error: unknown) => {
    await deletePrivateObject(createStorageClient(), upload.key).catch(() => undefined);
    throw error;
  });
  if (previousKey) await deletePrivateObject(createStorageClient(), previousKey).catch(() => undefined);
}

// Une fois retenu : la facture déposée est rangée dans les documents de l'évènement (non partagée,
// ADR 0027) et signalée. Elle ne crée rien dans la facturation de la planner.
export async function attachInvoiceByLink(input: { organizationId: string; linkId: string; content: Uint8Array; label: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  const access = await vendorAccess(input.organizationId, input.linkId, now);
  if (!isEngaged(access.candidate.status)) throw new LinkAccessDeniedError();
  const upload = await uploadFile({ organizationId: input.organizationId, buffer: Buffer.from(input.content), maxSizeBytes: CANDIDATE_QUOTE_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new CandidateQuoteRejectedError(upload.reason);
  const label = input.label.trim().slice(0, 200) || "—";
  try {
    await withActor({ kind: "link", id: input.linkId }, () =>
      inOrganization(input.organizationId, async (tx) => {
        const [document] = await tx
          .insert(eventDocuments)
          .values({ organizationId: input.organizationId, eventId: access.candidate.eventId, label, fileKey: upload.key, mime: upload.mime, sizeBytes: upload.size, uploadedByUserId: null, uploadedByLinkId: input.linkId })
          .returning({ id: eventDocuments.id });
        await tx.insert(eventDocumentVersions).values({ organizationId: input.organizationId, documentId: document!.id, version: 1, fileKey: upload.key, mime: upload.mime, sizeBytes: upload.size, uploadedByUserId: null });
        await tx.update(eventVendorCandidates).set({ invoiceDocumentId: document!.id, updatedAt: now }).where(eq(eventVendorCandidates.id, access.candidate.id));
        await tx.insert(eventActivities).values({ organizationId: input.organizationId, eventId: access.candidate.eventId, actorLinkId: input.linkId, kind: "vendor_invoice_received", taskLabel: "", vendorCandidateId: access.candidate.id, createdAt: now });
        await appendAudit(tx, { organizationId: input.organizationId, action: "events.vendor.invoice_received", objectId: access.candidate.eventId, details: { linkId: input.linkId, documentId: document!.id } });
      }),
    );
  } catch (error) {
    await deletePrivateObject(createStorageClient(), upload.key).catch(() => undefined);
    throw error;
  }
}

// --- Comparatif (PRE-03, BUD-05) ---

export async function comparison(organizationId: string, eventId: string, vendorSlotId: string): Promise<VendorComparison> {
  const empty = (label: string): VendorComparison => ({ slot: { id: vendorSlotId, label }, brief: null, rows: [] });
  if (!UUID.test(eventId) || !UUID.test(vendorSlotId)) return empty("");
  return inOrganization(organizationId, async (tx) => {
    const [slot] = await tx.select({ id: eventVendorSlots.id, label: eventVendorSlots.label }).from(eventVendorSlots).where(and(eq(eventVendorSlots.id, vendorSlotId), eq(eventVendorSlots.eventId, eventId)));
    if (!slot) return empty("");
    const [briefRow] = await tx.select().from(vendorBriefs).where(eq(vendorBriefs.vendorSlotId, slot.id));
    const candidates = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.vendorSlotId, slot.id));
    const ids = candidates.map((candidate) => candidate.id);
    const notes = ids.length > 0 ? await tx.select().from(eventVendorCandidateNotes).where(and(inArray(eventVendorCandidateNotes.candidateId, ids), eq(eventVendorCandidateNotes.visibleToClients, false))).orderBy(asc(eventVendorCandidateNotes.createdAt)) : [];
    const feedback =
      ids.length > 0
        ? await tx
            .select({ feedback: eventDecisionOptionFeedback, personName: eventLinks.personName })
            .from(eventDecisionOptionFeedback)
            .leftJoin(eventLinks, eq(eventLinks.id, eventDecisionOptionFeedback.linkId))
            .where(inArray(eventDecisionOptionFeedback.candidateId, ids))
            .orderBy(asc(eventDecisionOptionFeedback.updatedAt))
        : [];
    const rows = candidates
      .map((candidate) => ({
        candidateId: candidate.id,
        vendorId: candidate.vendorId,
        vendorName: candidate.vendorName,
        status: candidate.status,
        availability: (candidate.availability as VendorAvailability | null) ?? null,
        dismissalReason: (candidate.dismissalReason as VendorDismissalReason | null) ?? null,
        quoteAmountCents: candidate.quoteAmountCents,
        hasQuoteFile: candidate.quoteFileKey !== null,
        answerMessage: candidate.answerMessage,
        answeredAt: candidate.answeredAt?.toISOString() ?? null,
        remindedAt: candidate.remindedAt?.toISOString() ?? null,
        shownToClients: candidate.shownToClients,
        internalNotes: notes.filter((note) => note.candidateId === candidate.id).map((note) => note.body),
        feedback: feedback
          .filter((row) => row.feedback.candidateId === candidate.id)
          .map((row) => ({ opinion: (row.feedback.opinion as "like" | "dislike" | null) ?? null, comment: row.feedback.comment, personName: row.personName ?? null, updatedAt: row.feedback.updatedAt.toISOString() })),
        hasInvoice: candidate.invoiceDocumentId !== null,
      }))
      .sort(compareByAmount);
    return { slot, brief: briefRow ? toBrief(briefRow, await briefDocumentIds(tx, briefRow.id)) : null, rows };
  });
}

// --- Scénarios (BUD-05 ; D5) ---

async function scenariosOf(tx: Tx, eventId: string, ids?: string[]): Promise<VendorScenario[]> {
  const rows = await tx
    .select()
    .from(vendorScenarios)
    .where(and(eq(vendorScenarios.eventId, eventId), ...(ids ? [inArray(vendorScenarios.id, ids)] : [])))
    .orderBy(asc(vendorScenarios.position), asc(vendorScenarios.createdAt));
  const choices = rows.length > 0 ? await tx.select().from(vendorScenarioChoices).where(inArray(vendorScenarioChoices.scenarioId, rows.map((row) => row.id))) : [];
  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    position: row.position,
    choices: choices.filter((choice) => choice.scenarioId === row.id).map((choice) => ({ vendorSlotId: choice.vendorSlotId, candidateId: choice.candidateId })),
  }));
}

export async function listScenarios(organizationId: string, eventId: string): Promise<VendorScenario[]> {
  if (!UUID.test(eventId)) return [];
  return inOrganization(organizationId, (tx) => scenariosOf(tx, eventId));
}

function scenarioName(name: string): string {
  const clean = name.trim();
  if (!clean || clean.length > SCENARIO_NAME_MAX) throw new VendorBriefInvalidError("name");
  return clean;
}

export async function createScenario(organizationId: string, eventId: string, name: string): Promise<VendorScenario> {
  const clean = scenarioName(name);
  return inOrganization(organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    if (!event) throw new EventNotFoundError();
    const [{ next } = { next: 0 }] = await tx.select({ next: sql<number>`coalesce(max(${vendorScenarios.position}) + 1, 0)::int` }).from(vendorScenarios).where(eq(vendorScenarios.eventId, eventId));
    const [row] = await tx.insert(vendorScenarios).values({ organizationId, eventId, name: clean, position: next }).returning();
    return { id: row!.id, eventId, name: row!.name, position: row!.position, choices: [] };
  });
}

export async function renameScenario(organizationId: string, scenarioId: string, name: string): Promise<void> {
  const clean = scenarioName(name);
  await inOrganization(organizationId, async (tx) => {
    const updated = await tx.update(vendorScenarios).set({ name: clean, updatedAt: new Date() }).where(eq(vendorScenarios.id, scenarioId)).returning({ id: vendorScenarios.id });
    if (updated.length === 0) throw new VendorCandidateNotFoundError();
  });
}

export async function removeScenario(organizationId: string, scenarioId: string): Promise<void> {
  if (!UUID.test(scenarioId)) return;
  await inOrganization(organizationId, (tx) => tx.delete(vendorScenarios).where(eq(vendorScenarios.id, scenarioId)));
}

// Au plus un prestataire par poste, parmi les consultés de ce poste et de cet évènement ; null
// retire le choix du poste.
export async function setScenarioChoice(organizationId: string, scenarioId: string, vendorSlotId: string, candidateId: string | null): Promise<void> {
  if (!UUID.test(scenarioId) || !UUID.test(vendorSlotId) || (candidateId !== null && !UUID.test(candidateId))) throw new VendorCandidateNotFoundError();
  await inOrganization(organizationId, async (tx) => {
    const [scenario] = await tx.select().from(vendorScenarios).where(eq(vendorScenarios.id, scenarioId));
    if (!scenario) throw new VendorCandidateNotFoundError();
    const [slot] = await tx.select({ id: eventVendorSlots.id }).from(eventVendorSlots).where(and(eq(eventVendorSlots.id, vendorSlotId), eq(eventVendorSlots.eventId, scenario.eventId)));
    if (!slot) throw new VendorCandidateNotFoundError();
    if (candidateId === null) {
      await tx.delete(vendorScenarioChoices).where(and(eq(vendorScenarioChoices.scenarioId, scenarioId), eq(vendorScenarioChoices.vendorSlotId, vendorSlotId)));
      return;
    }
    const [candidate] = await tx.select({ id: eventVendorCandidates.id }).from(eventVendorCandidates).where(and(eq(eventVendorCandidates.id, candidateId), eq(eventVendorCandidates.vendorSlotId, vendorSlotId)));
    if (!candidate) throw new VendorCandidateNotFoundError();
    await tx
      .insert(vendorScenarioChoices)
      .values({ organizationId, scenarioId, vendorSlotId, candidateId })
      .onConflictDoUpdate({ target: [vendorScenarioChoices.scenarioId, vendorScenarioChoices.vendorSlotId], set: { candidateId, updatedAt: new Date() } });
  });
}

// D5, critère BUD-05 : postes en lignes, scénarios en colonnes, totaux au centime.
export async function compareScenarios(organizationId: string, eventId: string, scenarioIds: string[]): Promise<ScenarioComparison> {
  const ids = scenarioIds.filter((id) => UUID.test(id)).slice(0, 4);
  if (!UUID.test(eventId) || ids.length === 0) return { slots: [], columns: [] };
  return inOrganization(organizationId, async (tx) => {
    const scenarios = (await scenariosOf(tx, eventId, ids)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    if (scenarios.length === 0) return { slots: [], columns: [] };
    const slots = await tx.select({ id: eventVendorSlots.id, label: eventVendorSlots.label }).from(eventVendorSlots).where(eq(eventVendorSlots.eventId, eventId)).orderBy(asc(eventVendorSlots.position), asc(eventVendorSlots.label));
    const chosenIds = [...new Set(scenarios.flatMap((scenario) => scenario.choices.map((choice) => choice.candidateId)))];
    const candidates = chosenIds.length > 0 ? await tx.select().from(eventVendorCandidates).where(inArray(eventVendorCandidates.id, chosenIds)) : [];
    const used = new Set(scenarios.flatMap((scenario) => scenario.choices.map((choice) => choice.vendorSlotId)));
    const shownSlots = slots.filter((slot) => used.has(slot.id));
    return {
      slots: shownSlots,
      columns: scenarios.map((scenario) => {
        const lines = shownSlots.map((slot) => {
          const choice = scenario.choices.find((entry) => entry.vendorSlotId === slot.id);
          const candidate = choice ? candidates.find((row) => row.id === choice.candidateId) : undefined;
          return { vendorSlotId: slot.id, candidateId: candidate?.id ?? null, vendorName: candidate?.vendorName ?? null, amountCents: candidate?.quoteAmountCents ?? null };
        });
        return { scenario, lines, ...scenarioTotals(lines.filter((line) => line.candidateId !== null)) };
      }),
    };
  });
}

// Montrer un scénario au client : ses prestataires deviennent visibles au portail (Options) ; la
// planner demande ensuite le choix, poste par poste (décision « options »).
export async function showScenarioToClients(organizationId: string, scenarioId: string): Promise<number> {
  if (!UUID.test(scenarioId)) throw new VendorCandidateNotFoundError();
  return inOrganization(organizationId, async (tx) => {
    const choices = await tx.select({ candidateId: vendorScenarioChoices.candidateId }).from(vendorScenarioChoices).where(eq(vendorScenarioChoices.scenarioId, scenarioId));
    if (choices.length === 0) return 0;
    await tx.update(eventVendorCandidates).set({ shownToClients: true, updatedAt: new Date() }).where(inArray(eventVendorCandidates.id, choices.map((choice) => choice.candidateId)));
    return choices.length;
  });
}

// --- Avis et choix du client (PRE-09 ; D6, D7) ---

type ClientLinkAccess = { linkId: string; eventId: string; personName: string; rights: ReturnType<typeof rightsOfContext> };

function rightsOfContext(context: LinkWithContext) {
  return { rubrics: context.link.rubrics as ("tasks" | "program" | "vendor_options" | "budget" | "quotes")[], budgetScope: (context.link.budgetScope === "selected" ? "selected" : "all") as "all" | "selected", sharedSlotIds: context.sharedSlotIds };
}

async function clientAccess(organizationId: string, linkId: string, now: Date): Promise<ClientLinkAccess> {
  if (!UUID.test(linkId)) throw new LinkAccessDeniedError();
  const context = await findLinkRow(organizationId, linkId);
  if (!context || context.link.audience !== "client" || !usable(context, now)) throw new LinkAccessDeniedError();
  return { linkId, eventId: context.link.eventId, personName: context.link.personName, rights: rightsOfContext(context) };
}

// D7 : « J'aime » / « Pas pour nous » et un commentaire court, sur une option de la sélection figée,
// avant le choix. Un avis par lien et par option ; un avis vide le retire.
export async function setOptionFeedback(input: SetOptionFeedbackInput): Promise<void> {
  const access = await clientAccess(input.organizationId, input.linkId, new Date());
  const comment = input.comment?.trim() || null;
  if (comment && comment.length > FEEDBACK_COMMENT_MAX) throw new VendorBriefInvalidError("need");
  if (input.opinion !== null && input.opinion !== "like" && input.opinion !== "dislike") throw new LinkAccessDeniedError();
  if (!UUID.test(input.decisionId) || !UUID.test(input.candidateId)) throw new LinkAccessDeniedError();
  await withActor({ kind: "link", id: input.linkId }, () =>
    inOrganization(input.organizationId, async (tx) => {
      const [decision] = await tx.select().from(eventDecisions).where(eq(eventDecisions.id, input.decisionId));
      if (!decision || decision.eventId !== access.eventId || decision.kind !== "option" || decision.status !== "pending" || !decisionOpenTo({ kind: "option", slotId: decision.slotId }, { audience: "client", rights: access.rights })) {
        throw new LinkAccessDeniedError();
      }
      const snapshot = decision.snapshot as DecisionSnapshot;
      if (snapshot.kind !== "option" || !snapshot.options.some((option) => option.candidateId === input.candidateId)) throw new LinkAccessDeniedError();
      const where = and(eq(eventDecisionOptionFeedback.decisionId, decision.id), eq(eventDecisionOptionFeedback.candidateId, input.candidateId), eq(eventDecisionOptionFeedback.linkId, input.linkId));
      if (input.opinion === null && comment === null) {
        await tx.delete(eventDecisionOptionFeedback).where(where);
        return;
      }
      const [existing] = await tx.select({ id: eventDecisionOptionFeedback.id }).from(eventDecisionOptionFeedback).where(where);
      if (existing) await tx.update(eventDecisionOptionFeedback).set({ opinion: input.opinion, comment, updatedAt: new Date() }).where(eq(eventDecisionOptionFeedback.id, existing.id));
      else await tx.insert(eventDecisionOptionFeedback).values({ organizationId: input.organizationId, decisionId: decision.id, candidateId: input.candidateId, linkId: input.linkId, opinion: input.opinion, comment });
    }),
  );
}

// Les avis de ce lien sur les options d'une décision, pour le portail.
export async function linkOptionFeedback(organizationId: string, linkId: string): Promise<{ decisionId: string; candidateId: string; opinion: "like" | "dislike" | null; comment: string | null }[]> {
  const access = await clientAccess(organizationId, linkId, new Date());
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ feedback: eventDecisionOptionFeedback })
      .from(eventDecisionOptionFeedback)
      .innerJoin(eventDecisions, eq(eventDecisions.id, eventDecisionOptionFeedback.decisionId))
      .where(and(eq(eventDecisionOptionFeedback.linkId, linkId), eq(eventDecisions.eventId, access.eventId))),
  );
  return rows.map(({ feedback }) => ({ decisionId: feedback.decisionId, candidateId: feedback.candidateId, opinion: (feedback.opinion as "like" | "dislike" | null) ?? null, comment: feedback.comment }));
}

// L'auteur des écritures du budget engagées par un choix du client : la personne de l'équipe qui a
// demandé la décision, sinon la titulaire ; à défaut, le lien du client.
async function engagementAuthor(organizationId: string, decision: typeof eventDecisions.$inferSelect, linkId: string): Promise<string> {
  if (decision.createdBy) return decision.createdBy;
  const team = (await listTeam(appDatabase(), organizationId)).filter((member) => !member.disabledAt);
  return team.find((member) => member.role === "owner")?.id ?? team[0]?.id ?? linkId;
}

// Les tâches de suivi : la liste de l'organisation, sinon celle de départ dans la langue de la
// titulaire et le métier de l'organisation (HUB-20).
async function followUpTaskList(organizationId: string): Promise<{ label: string; dueInDays: number }[]> {
  const custom = await inOrganization(organizationId, async (tx) => (await tx.select({ followUpTasks: vendorCoordinationSettings.followUpTasks }).from(vendorCoordinationSettings).where(eq(vendorCoordinationSettings.organizationId, organizationId)))[0]?.followUpTasks ?? null);
  if (custom) return custom;
  const db = appDatabase();
  const team = (await listTeam(db, organizationId)).filter((member) => !member.disabledAt);
  const owner = team.find((member) => member.role === "owner");
  const locale = owner ? ((await getUserContact(db, organizationId, owner.id))?.language ?? "fr") : "fr";
  const metier = (await getOrganizationProfile(db, organizationId)).metier ?? "wedding_planner";
  return starterVendorFollowUpTasks(locale, metier);
}

// Les tâches de suivi d'un prestataire retenu, rattachées à lui (follow_up_candidate_id) ; échéances
// comptées depuis aujourd'hui, dans le fuseau de l'évènement.
async function insertFollowUpTasks(tx: Tx, organizationId: string, candidate: CandidateRow, tasks: { label: string; dueInDays: number }[], now: Date): Promise<string[]> {
  if (tasks.length === 0) return [];
  const [event] = await tx.select({ timeZone: events.timeZone }).from(events).where(eq(events.id, candidate.eventId));
  const today = dateInTimeZone(now, event?.timeZone ?? "Europe/Paris");
  const rows = await tx
    .insert(eventTasks)
    .values(
      tasks.map((task, index) => ({
        organizationId,
        eventId: candidate.eventId,
        label: task.label.split("{{prestataire}}").join(candidate.vendorName).split("{{vendor}}").join(candidate.vendorName).slice(0, 200),
        dueDate: addDays(today, task.dueInDays),
        responsible: "planner" as const,
        position: 10_000 + index,
        fixedAt: now,
        followUpCandidateId: candidate.id,
      })),
    )
    .returning({ id: eventTasks.id });
  return rows.map((row) => row.id);
}

// Un prestataire cesse d'être retenu : ses tâches de suivi non commencées sont retirées (celles
// faites restent) ; le module Budget libère son engagé (événement interne).
async function releaseRetained(tx: Tx, organizationId: string, candidate: CandidateRow, next: { status: VendorCandidateStatus; dismissalReason: VendorDismissalReason | null }, userId: string, now: Date): Promise<void> {
  await tx.update(eventVendorCandidates).set({ status: next.status, dismissalReason: next.dismissalReason, updatedAt: now }).where(eq(eventVendorCandidates.id, candidate.id));
  await tx.delete(eventTasks).where(and(eq(eventTasks.followUpCandidateId, candidate.id), isNull(eventTasks.doneAt)));
  const [event] = await tx.select({ isDemo: events.isDemo }).from(events).where(eq(events.id, candidate.eventId));
  if (event?.isDemo) return;
  await emitDomainEvent(tx, {
    organizationId,
    name: EVT_VENDOR_RETENTION_RELEASED,
    version: EVT_VENDOR_RETENTION_RELEASED_VERSION,
    payload: vendorRetentionReleasedPayloadSchema.parse({ eventId: candidate.eventId, vendorSlotId: candidate.vendorSlotId, candidateId: candidate.id, amountCents: candidate.quoteAmountCents, releasedByUserId: userId }),
  });
}

// De nouveau en lice : « Devis reçu » s'il a un devis, « Consulté » s'il a reçu le brief, sinon « Pressenti ».
function backInTheRunning(candidate: CandidateRow): VendorCandidateStatus {
  if (candidate.quoteAmountCents !== null || candidate.quoteFileKey !== null) return "quote_received";
  return candidate.briefId ? "contacted" : "shortlisted";
}

// D6 : dans la transaction de la réponse du client. Le prestataire choisi passe à « Retenu » (ce qui
// engage la ligne de budget, règle PRE-02), les autres consultés en lice du poste à « Écarté » (sans
// e-mail), les tâches de suivi sont créées et rattachées à lui. Le choix ne vaut pas commande : le
// contrat se signe directement avec le prestataire (décision de Julien, AV-6).
export async function engageOptionChoice(tx: Tx, input: { organizationId: string; decision: typeof eventDecisions.$inferSelect; choiceId: string; linkId: string; now: Date; bookedByUserId: string; tasks: { label: string; dueInDays: number }[] }): Promise<void> {
  const { decision } = input;
  if (!decision.slotId) return;
  const slotCandidates = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.vendorSlotId, decision.slotId));
  const chosen = slotCandidates.find((candidate) => candidate.id === input.choiceId);
  if (!chosen) return;
  const others = slotCandidates.filter((candidate) => candidate.id !== chosen.id && IN_THE_RUNNING.includes(candidate.status));
  if (others.length > 0) {
    await tx.update(eventVendorCandidates).set({ status: "dismissed", dismissalReason: "other_chosen", updatedAt: input.now }).where(inArray(eventVendorCandidates.id, others.map((candidate) => candidate.id)));
  }
  const wasEngaged = isEngaged(chosen.status);
  const [updated] = await tx.update(eventVendorCandidates).set({ status: wasEngaged ? chosen.status : "retained", dismissalReason: null, updatedAt: input.now }).where(eq(eventVendorCandidates.id, chosen.id)).returning();
  if (updated && !wasEngaged) await publishRetention(tx, input.organizationId, updated, input.bookedByUserId);
  const taskIds = wasEngaged ? [] : await insertFollowUpTasks(tx, input.organizationId, chosen, input.tasks, input.now);
  await tx.update(eventDecisions).set({ engagedAt: input.now }).where(eq(eventDecisions.id, decision.id));
  await appendAudit(tx, { organizationId: input.organizationId, action: "events.decision.engaged", objectId: decision.eventId, details: { decisionId: decision.id, tasks: taskIds.length } });
  await emitDomainEvent(tx, {
    organizationId: input.organizationId,
    name: EVT_VENDOR_OPTION_CHOSEN,
    version: EVT_VENDOR_OPTION_CHOSEN_VERSION,
    payload: vendorOptionChosenPayloadSchema.parse({ eventId: decision.eventId, vendorSlotId: decision.slotId, decisionId: decision.id, candidateId: chosen.id, dismissedCandidateIds: others.map((candidate) => candidate.id), taskIds, linkId: input.linkId }),
  });
}

// Ce qu'il faut à engageOptionChoice, préparé hors de la transaction (lectures d'autres modules).
export async function engagementContext(organizationId: string, decision: typeof eventDecisions.$inferSelect, linkId: string): Promise<{ bookedByUserId: string; tasks: { label: string; dueInDays: number }[] }> {
  return { bookedByUserId: await engagementAuthor(organizationId, decision, linkId), tasks: await followUpTaskList(organizationId) };
}

// D6 (décision de Julien du 18/11/2026) : la planner modifie le prestataire retenu d'un poste à tout
// moment, sans délai. Un autre consulté du poste : il passe à « Retenu » (l'engagé passe à son
// devis), ses tâches de suivi sont créées, l'ancien retenu et les autres en lice sont écartés.
// Personne : l'ancien retenu revient en lice, comme ceux écartés pour lui ; l'engagé est libéré.
// Les tâches de suivi non commencées d'un prestataire qui n'est plus retenu sont retirées.
export async function changeRetained(input: ChangeRetainedVendorInput): Promise<void> {
  const now = input.now ?? new Date();
  if (!UUID.test(input.eventId) || !UUID.test(input.vendorSlotId) || (input.candidateId !== null && !UUID.test(input.candidateId))) throw new VendorCandidateNotFoundError();
  const tasks = input.candidateId ? await followUpTaskList(input.organizationId) : [];
  await inOrganization(input.organizationId, async (tx) => {
    const [slot] = await tx.select({ id: eventVendorSlots.id }).from(eventVendorSlots).where(and(eq(eventVendorSlots.id, input.vendorSlotId), eq(eventVendorSlots.eventId, input.eventId)));
    if (!slot) throw new VendorCandidateNotFoundError();
    const candidates = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.vendorSlotId, slot.id)).for("update");
    const target = input.candidateId ? candidates.find((candidate) => candidate.id === input.candidateId) : null;
    if (input.candidateId && !target) throw new VendorCandidateNotFoundError();
    for (const previous of candidates.filter((candidate) => isEngaged(candidate.status) && candidate.id !== target?.id)) {
      await releaseRetained(tx, input.organizationId, previous, target ? { status: "dismissed", dismissalReason: "other_chosen" } : { status: backInTheRunning(previous), dismissalReason: null }, input.userId, now);
    }
    if (target) {
      const others = candidates.filter((candidate) => candidate.id !== target.id && IN_THE_RUNNING.includes(candidate.status));
      if (others.length > 0) await tx.update(eventVendorCandidates).set({ status: "dismissed", dismissalReason: "other_chosen", updatedAt: now }).where(inArray(eventVendorCandidates.id, others.map((candidate) => candidate.id)));
      if (!isEngaged(target.status)) {
        const [updated] = await tx.update(eventVendorCandidates).set({ status: "retained", dismissalReason: null, updatedAt: now }).where(eq(eventVendorCandidates.id, target.id)).returning();
        if (updated) await publishRetention(tx, input.organizationId, updated, input.userId);
        await insertFollowUpTasks(tx, input.organizationId, target, tasks, now);
      }
    } else {
      const setAside = candidates.filter((candidate) => candidate.status === "dismissed" && candidate.dismissalReason === "other_chosen");
      for (const candidate of setAside) await tx.update(eventVendorCandidates).set({ status: backInTheRunning(candidate), dismissalReason: null, updatedAt: now }).where(eq(eventVendorCandidates.id, candidate.id));
    }
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.vendor_retention.changed", objectId: input.eventId, details: { vendorSlotId: slot.id, candidateId: target?.id ?? null } });
  });
}

// --- Feuille de route (PAR-05 étapes 5 et 6 ; D8) ---

// Lot 53 (HUB-28, D5) : hooks.notBefore — une feuille de route dont le jour d'envoi précède la remise en
// route ne part pas ; hooks.onRun, la trace de chaque envoi.
export async function sendRoadmaps(organizationId: string, now: Date, hooks: AutomationHooks = {}): Promise<number> {
  const policy = await inOrganization(organizationId, (tx) => policyOf(tx, organizationId));
  if (!policy.roadmapMonth && !policy.roadmapWeek) return 0;
  const retained = await inOrganization(organizationId, (tx) =>
    tx
      .select({ candidate: eventVendorCandidates, eventDate: events.eventDate, timeZone: events.timeZone })
      .from(eventVendorCandidates)
      .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
      .where(and(inArray(eventVendorCandidates.status, ENGAGED), eq(events.isDemo, false), notInArray(events.status, CLOSED_EVENT_STATUSES), isNotNull(events.eventDate))),
  );
  let sent = 0;
  // Lot 65d (HUB-28 ; ADR 0110) : déposée « À envoyer » quand la planner envoie de sa messagerie.
  const planner = await preparesRelationEmail(organizationId, "vendor_roadmap");
  for (const row of retained) {
    const stage = roadmapStageDue(row.eventDate!, dateInTimeZone(now, row.timeZone), { month: policy.roadmapMonth, week: policy.roadmapWeek }, policy);
    if (!stage) continue;
    // Lot 66a (D1) : à l'heure d'envoi de l'automatisme, dans le fuseau de l'évènement.
    if (!sendTimeReached(hooks.isSendTime, now, row.timeZone)) continue;
    if (hooks.notBefore && addDays(row.eventDate!, -(stage === "j7" ? policy.roadmapDaysBefore.week : policy.roadmapDaysBefore.month)) < hooks.notBefore) continue;
    const hasLink = await inOrganization(organizationId, async (tx) => (await tx.select({ id: eventLinks.id }).from(eventLinks).where(and(eq(eventLinks.vendorCandidateId, row.candidate.id), isNull(eventLinks.revokedAt))).limit(1)).length > 0);
    if (!hasLink) continue;
    // Une fois chacune : la ligne est réservée avant l'envoi (contrainte d'unicité).
    const program = await findLatestProgramVersion(organizationId, row.candidate.eventId);
    const claimed = await inOrganization(organizationId, async (tx) =>
      (await tx.insert(vendorRoadmaps).values({ organizationId, candidateId: row.candidate.id, stage, sentAt: now, programVersion: program?.number ?? null }).onConflictDoNothing().returning({ id: vendorRoadmaps.id })).length > 0,
    );
    if (!claimed) continue;
    if (planner) {
      const active = await activeVendorLink(organizationId, row.candidate.id, now);
      if (!active) continue;
      await depositPreparedEmail({ organizationId, kind: "vendor_roadmap", eventId: row.candidate.eventId, recipientType: "event_link", recipientId: active.id, ref: { stage }, origin: "automation", automationKey: "vendor_roadmap", sourceKey: `vendor-roadmap:${row.candidate.id}:${stage}` });
      sent += 1;
      await hooks.onRun?.({ objectKey: `${row.candidate.id}:${stage}`, href: `/events/${row.candidate.eventId}?onglet=budget`, result: "sent" });
      continue;
    }
    const link = await reissueActiveLink(organizationId, row.candidate.id, now);
    if (!link) continue;
    const values: EmailValues = { ...(await vendorEventValues(organizationId, row.candidate.eventId, link.locale)), first_name: link.personName, link: vendorLinkUrls(link.token).link };
    try {
      await reserveOrganizationMail(organizationId, { now });
      await sendOrganizationEmail({ organizationId, to: link.email, kind: "vendor_roadmap", locale: link.locale, values, reserve: false, idempotencyKey: `vendor-roadmap:${row.candidate.id}:${stage}` });
    } catch (error) {
      if (error instanceof EmailVariableMissingError) {
        await recordAudit(appDatabase(), { organizationId, action: "hub.mail.variable_missing", objectId: row.candidate.eventId, details: { kind: "vendor_roadmap", locale: link.locale, missing: error.missing.join(",") }, actor: SYSTEM_ACTOR });
        continue;
      }
      if (error instanceof MailQuotaExceededError) {
        // Le plafond est atteint : la feuille repartira au prochain passage.
        await inOrganization(organizationId, (tx) => tx.delete(vendorRoadmaps).where(and(eq(vendorRoadmaps.candidateId, row.candidate.id), eq(vendorRoadmaps.stage, stage))));
        break;
      }
      throw error;
    }
    await inOrganization(organizationId, (tx) => appendAudit(tx, { organizationId, action: "events.vendor_roadmap.sent", objectId: row.candidate.eventId, details: { linkId: link.linkId, stage } }));
    sent += 1;
    await hooks.onRun?.({ objectKey: `${row.candidate.id}:${stage}`, href: `/events/${row.candidate.eventId}?onglet=prestataires`, result: "sent" });
  }
  return sent;
}

function toRoadmapStatus(row: typeof vendorRoadmaps.$inferSelect) {
  return { stage: row.stage as VendorRoadmapStage, sentAt: row.sentAt.toISOString(), confirmedAt: row.confirmedAt?.toISOString() ?? null, programVersion: row.programVersion };
}

// La feuille de route du prestataire retenu : ce qui a été envoyé, le contact sur place, la facture.
export async function roadmapView(organizationId: string, linkId: string, now: Date = new Date()): Promise<VendorRoadmapView> {
  const access = await vendorAccess(organizationId, linkId, now);
  if (!isEngaged(access.candidate.status)) throw new LinkAccessDeniedError();
  return inOrganization(organizationId, async (tx) => {
    const sent = await tx.select().from(vendorRoadmaps).where(eq(vendorRoadmaps.candidateId, access.candidate.id)).orderBy(asc(vendorRoadmaps.sentAt));
    const contacts = await tx.select({ name: eventDayContacts.name, role: eventDayContacts.role, phone: eventDayContacts.phone }).from(eventDayContacts).where(eq(eventDayContacts.eventId, access.candidate.eventId)).orderBy(asc(eventDayContacts.position));
    const invoice = access.candidate.invoiceDocumentId
      ? (await tx.select({ id: eventDocuments.id, createdAt: eventDocuments.createdAt }).from(eventDocuments).where(eq(eventDocuments.id, access.candidate.invoiceDocumentId)))[0]
      : undefined;
    const last = sent.at(-1);
    return {
      sent: sent.map(toRoadmapStatus),
      awaitingConfirmation: last !== undefined && last.confirmedAt === null,
      dayContacts: contacts,
      invoice: invoice ? { documentId: invoice.id, uploadedAt: invoice.createdAt.toISOString() } : null,
    };
  });
}

// « J'ai bien reçu » : horodaté sur les feuilles envoyées non confirmées, avec la version du
// programme vue (CHR-07 : une version republiée ensuite est signalée à part).
export async function confirmRoadmap(input: { organizationId: string; linkId: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  const access = await vendorAccess(input.organizationId, input.linkId, now);
  if (!isEngaged(access.candidate.status)) throw new LinkAccessDeniedError();
  const program = await findLatestProgramVersion(input.organizationId, access.candidate.eventId);
  await withActor({ kind: "link", id: input.linkId }, () =>
    inOrganization(input.organizationId, async (tx) => {
      const confirmed = await tx
        .update(vendorRoadmaps)
        .set({ confirmedAt: now, programVersion: program?.number ?? null, updatedAt: now })
        .where(and(eq(vendorRoadmaps.candidateId, access.candidate.id), isNull(vendorRoadmaps.confirmedAt)))
        .returning({ id: vendorRoadmaps.id });
      if (confirmed.length === 0) return;
      await tx.insert(eventActivities).values({ organizationId: input.organizationId, eventId: access.candidate.eventId, actorLinkId: input.linkId, kind: "vendor_roadmap_confirmed", taskLabel: "", vendorCandidateId: access.candidate.id, createdAt: now });
      await appendAudit(tx, { organizationId: input.organizationId, action: "events.vendor_roadmap.confirmed", objectId: access.candidate.eventId, details: { linkId: input.linkId } });
    }),
  );
}

// Pour la fiche : feuilles de route et facture des prestataires retenus de l'évènement.
export async function followUps(organizationId: string, eventId: string): Promise<VendorFollowUpStatus[]> {
  if (!UUID.test(eventId)) return [];
  return inOrganization(organizationId, async (tx) => {
    const retained = await tx.select().from(eventVendorCandidates).where(and(eq(eventVendorCandidates.eventId, eventId), inArray(eventVendorCandidates.status, ENGAGED)));
    if (retained.length === 0) return [];
    const ids = retained.map((candidate) => candidate.id);
    const roadmaps = await tx.select().from(vendorRoadmaps).where(inArray(vendorRoadmaps.candidateId, ids)).orderBy(asc(vendorRoadmaps.sentAt));
    const links = await tx.select({ candidateId: eventLinks.vendorCandidateId }).from(eventLinks).where(and(inArray(eventLinks.vendorCandidateId, ids), isNull(eventLinks.revokedAt)));
    return retained.map((candidate) => ({
      candidateId: candidate.id,
      roadmaps: roadmaps.filter((roadmap) => roadmap.candidateId === candidate.id).map(toRoadmapStatus),
      invoiceDocumentId: candidate.invoiceDocumentId,
      hasLink: links.some((link) => link.candidateId === candidate.id),
    }));
  });
}

// --- « Aujourd'hui » de la planner ---

// Réponses de prestataires de moins de 7 jours (disponible, devis reçu, ou indisponible), sur des
// évènements en cours ; pas celles d'un prestataire écarté parce qu'un autre a été choisi.
export async function answerNotices(organizationId: string, now: Date = new Date()): Promise<VendorAnswerNotice[]> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ candidate: eventVendorCandidates, slotLabel: eventVendorSlots.label })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
      .where(
        and(
          isNotNull(eventVendorCandidates.answeredAt),
          gte(eventVendorCandidates.answeredAt, since),
          inArray(eventVendorCandidates.status, ["contacted", "quote_received", "dismissed"]),
          or(isNull(eventVendorCandidates.dismissalReason), eq(eventVendorCandidates.dismissalReason, "unavailable")),
          eq(events.isDemo, false),
          notInArray(events.status, CLOSED_EVENT_STATUSES),
        ),
      )
      .orderBy(desc(eventVendorCandidates.answeredAt)),
  );
  return rows.map(({ candidate, slotLabel }) => ({
    candidateId: candidate.id,
    eventId: candidate.eventId,
    vendorSlotId: candidate.vendorSlotId,
    vendorName: candidate.vendorName,
    slotLabel,
    availability: (candidate.availability as VendorAvailability | null) ?? "available",
    hasQuote: candidate.quoteFileKey !== null || candidate.quoteAmountCents !== null,
    answeredAt: candidate.answeredAt!.toISOString(),
  }));
}

export async function roadmapAlerts(organizationId: string, now: Date = new Date()): Promise<VendorRoadmapAlert[]> {
  return inOrganization(organizationId, async (tx) => {
    const policy = await policyOf(tx, organizationId);
    const rows = await tx
      .select({ roadmap: vendorRoadmaps, candidate: eventVendorCandidates })
      .from(vendorRoadmaps)
      .innerJoin(eventVendorCandidates, eq(eventVendorCandidates.id, vendorRoadmaps.candidateId))
      .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
      .where(and(eq(vendorRoadmaps.stage, "j7"), isNull(vendorRoadmaps.confirmedAt), inArray(eventVendorCandidates.status, ENGAGED), eq(events.isDemo, false), notInArray(events.status, CLOSED_EVENT_STATUSES)));
    return rows
      .filter(({ roadmap }) => roadmapAlertDue({ stage: "j7", sentAt: roadmap.sentAt, confirmedAt: roadmap.confirmedAt }, now, policy.roadmapAlertDays))
      .map(({ roadmap, candidate }) => ({ candidateId: candidate.id, eventId: candidate.eventId, vendorName: candidate.vendorName, sentAt: roadmap.sentAt.toISOString() }));
  });
}

// Choix du client engagés récemment, pour que la planner les voie (simple affichage).
export async function engagedChoiceNotices(organizationId: string, now: Date = new Date()): Promise<EngagedChoiceNotice[]> {
  const policy = starterVendorCoordination();
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ decision: eventDecisions, vendorName: eventVendorCandidates.vendorName, slotLabel: eventVendorSlots.label })
      .from(eventDecisions)
      .innerJoin(eventVendorCandidates, eq(eventVendorCandidates.id, eventDecisions.choiceId))
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .where(isNotNull(eventDecisions.engagedAt)),
  );
  return rows
    .filter(({ decision }) => choiceNoticeShown(decision.engagedAt!, now, policy))
    .map(({ decision, vendorName, slotLabel }) => ({ decisionId: decision.id, eventId: decision.eventId, vendorSlotId: decision.slotId ?? "", vendorName, slotLabel, engagedAt: decision.engagedAt!.toISOString() }));
}
