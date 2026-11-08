// RGPD-05 — purge mensuelle (ADR 0024) : liste des personnes et documents dont
// la durée de conservation est échue, selon les réglages de l'organisation
// (cahier des charges § 6), puis purge des seules lignes validées par la
// titulaire ; une ligne exclue l'est avec un motif obligatoire et revient le
// mois suivant (décision de Julien du 02/11/2026). Rien n'est purgé sans
// validation. Chaque module exécute sa part par son contrat privacy/v1, comme
// pour l'oubli (RGPD-03).
import { appDatabase } from "@symbola/db/client";
import { clientDueOn, isExpired, parisDate, prospectDueOn, type PrivacyRecord } from "@symbola/privacy";
import { lastPaymentDates as quotesLastPaymentDates, listExpiredDocuments } from "@/modules/quotes/service";
import { listRetentionEvents } from "@/modules/events/service";
import {
  getPrivacyPurge,
  getPrivacySettings,
  listInactiveClientAccounts,
  recordPrivacyPurgeAcks,
  startPrivacyPurge,
  type PrivacyErasureItem,
  type PrivacyPurgeLine,
} from "@/modules/hub/service";
import { byModule, contractOf, MODULE_TIMEOUT_MS, rulesOf, runModules, type Options } from "./erasure";
import { PARTICIPANTS, withTimeout } from "./search";

export type PurgeRule = PrivacyPurgeLine["rule"];

export type PurgeCandidate = {
  key: string;
  rule: PurgeRule;
  dueOn: string;
  // Libellé pour la titulaire (noms, e-mail, numéro) : jamais enregistré.
  label: string;
  eventDate: string | null;
};

const PROSPECT_STATUSES = new Set(["prospect", "quote_sent", "lost"]);
const CLIENT_STATUSES = new Set(["confirmed", "done"]);

export function purgePeriod(today: string): string {
  return today.slice(0, 7);
}

// Liste du jour : tout ce qui est échu à `today` (jour de Paris).
export async function listPurgeCandidates(organizationId: string, today: string = parisDate(new Date())): Promise<PurgeCandidate[]> {
  const db = appDatabase();
  const settings = await getPrivacySettings(db, organizationId);
  const accounts = await listInactiveClientAccounts(db, { organizationId, months: settings, today });
  const candidates: PurgeCandidate[] = [];

  const events = await listRetentionEvents(organizationId);
  const payments = await quotesLastPaymentDates(
    organizationId,
    events.filter((event) => CLIENT_STATUSES.has(event.status)).map((event) => event.eventId),
  );
  for (const event of events) {
    let rule: PurgeRule | null = null;
    let dueOn: string | null = null;
    if (PROSPECT_STATUSES.has(event.status)) {
      rule = "prospect";
      dueOn = prospectDueOn(event.activityDates, settings);
    } else if (CLIENT_STATUSES.has(event.status)) {
      rule = "client";
      dueOn = clientDueOn({ eventDate: event.eventDate, lastPaymentOn: payments.get(event.eventId) ?? null }, settings);
    }
    if (!rule || !dueOn || !isExpired(today, dueOn)) continue;
    candidates.push({ key: `event:${event.eventId}`, rule, dueOn, label: event.clientNames.join(" & "), eventDate: event.eventDate });
  }

  for (const account of accounts) candidates.push({ key: `account:${account.id}`, rule: "inactive_account", dueOn: account.dueOn, label: account.email, eventDate: null });

  for (const document of await listExpiredDocuments(organizationId, { ...settings, today })) {
    candidates.push({
      key: `${document.kind}:${document.id}`,
      rule: document.kind === "quote" ? "signed_quote" : "accounting_document",
      dueOn: document.dueOn,
      label: document.number,
      eventDate: null,
    });
  }
  return candidates.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.key.localeCompare(b.key));
}

// Fiches à purger pour une ligne validée.
async function recordsOf(organizationId: string, keys: string[], options: Options): Promise<{ module: string; kind: string; recordId: string }[]> {
  const participants = options.participants ?? PARTICIPANTS;
  const refs: { module: string; kind: string; recordId: string }[] = [];
  const eventIds = keys.filter((key) => key.startsWith("event:")).map((key) => key.slice("event:".length));
  if (eventIds.length > 0) {
    // Toutes les données des événements (fiche, tâches, budget, devis…),
    // par le contrat de chaque module, plus leurs clients.
    for (const participant of participants) {
      const related: PrivacyRecord[] = await withTimeout(participant.contract.related({ organizationId, eventIds }), options.timeoutMs ?? MODULE_TIMEOUT_MS);
      for (const record of related) refs.push({ module: record.module, kind: record.kind, recordId: record.recordId });
    }
    for (const event of (await listRetentionEvents(organizationId)).filter((candidate) => eventIds.includes(candidate.eventId))) {
      for (const clientId of event.clientIds) refs.push({ module: "events", kind: "event_client", recordId: clientId });
    }
  }
  for (const key of keys) {
    const [prefix, id] = key.split(":");
    if (prefix === "account") refs.push({ module: "hub", kind: "client_account", recordId: id! });
    if (prefix === "invoice" || prefix === "credit_note" || prefix === "quote") refs.push({ module: "quotes", kind: prefix, recordId: id! });
  }
  return refs;
}

export type PurgeDecision = { key: string; excluded: boolean; reason: string };

// Validation de la liste : la liste est recalculée côté serveur ; seules les
// lignes affichées et validées sont traitées (une ligne apparue depuis
// l'affichage attend la prochaine validation). Une ligne disparue (déjà
// purgée, données modifiées) est ignorée.
export async function executePurge(
  input: { organizationId: string; userId: string; decisions: PurgeDecision[]; today?: string },
  options: Options = {},
): Promise<{ status: "ok"; purgeId: string; purgeStatus: "pending" | "partial" | "completed" } | { status: "empty" | "reason_missing" }> {
  const today = input.today ?? parisDate(new Date());
  const candidates = new Map((await listPurgeCandidates(input.organizationId, today)).map((candidate) => [candidate.key, candidate]));
  const decided = input.decisions.filter((decision) => candidates.has(decision.key));
  if (decided.length === 0) return { status: "empty" };
  if (decided.some((decision) => decision.excluded && decision.reason.trim() === "")) return { status: "reason_missing" };

  const lines: PrivacyPurgeLine[] = decided.map((decision) => {
    const candidate = candidates.get(decision.key)!;
    return {
      key: decision.key,
      rule: candidate.rule,
      dueOn: candidate.dueOn,
      outcome: decision.excluded ? "excluded" : "purged",
      exclusionReason: decision.excluded ? decision.reason : null,
    };
  });
  const toPurge = lines.filter((line) => line.outcome === "purged").map((line) => line.key);
  const participants = options.participants ?? PARTICIPANTS;
  const items: PrivacyErasureItem[] = [];
  if (toPurge.length > 0) {
    const rules = await rulesOf(input.organizationId);
    for (const [module, records] of byModule(await recordsOf(input.organizationId, toPurge, options))) {
      const plan = await withTimeout(contractOf(module, participants).planErasure({ organizationId: input.organizationId, records, rules, today }), options.timeoutMs ?? MODULE_TIMEOUT_MS);
      for (const item of plan) items.push({ module, ...item });
    }
  }

  const db = appDatabase();
  const purgeId = await startPrivacyPurge(db, { organizationId: input.organizationId, userId: input.userId, period: purgePeriod(today), lines, items });
  if (items.length === 0) return { status: "ok", purgeId, purgeStatus: "completed" };
  const acks = await runModules(input.organizationId, items, { ...options, today });
  const purgeStatus = await recordPrivacyPurgeAcks(db, { organizationId: input.organizationId, purgeId, acks });
  return { status: "ok", purgeId, purgeStatus };
}

export async function retryPurge(input: { organizationId: string; purgeId: string; today?: string }, options: Options = {}) {
  const db = appDatabase();
  const purge = await getPrivacyPurge(db, input.organizationId, input.purgeId);
  if (purge.status === "completed") return "completed";
  const ok = new Set(purge.acks.filter((ack) => ack.status === "ok").map((ack) => ack.module));
  const acks = await runModules(
    input.organizationId,
    purge.items.filter((item) => !ok.has(item.module)),
    { ...options, ...(input.today ? { today: input.today } : {}) },
  );
  return await recordPrivacyPurgeAcks(db, { organizationId: input.organizationId, purgeId: input.purgeId, acks });
}
