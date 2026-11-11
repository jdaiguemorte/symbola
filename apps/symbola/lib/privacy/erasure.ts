// RGPD-03 — orchestration de l'oubli (ADR 0023) : sur les fiches que la
// titulaire a cochées, jamais sur un terme. La recherche est relancée côté
// serveur (comme l'export) ; chaque module classe ses fiches (aperçu :
// supprimée, anonymisée, conservée avec motif légal et date de fin), puis
// exécute sa part et renvoie un accusé. La demande n'est close que quand tous
// les modules ont répondu ; un module en échec se relance depuis la trace.
import { withAuditBulk } from "@symbola/db/actor";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { parisDate, type ErasurePlanItem, type ErasureRules, type PersonTerms, type PrivacyRecordRef } from "@symbola/privacy";
import {
  getPrivacyErasure,
  getPrivacySettings,
  recordPrivacyErasureAcks,
  startPrivacyErasure,
  type PrivacyErasureAck,
  type PrivacyErasureItem,
} from "@/modules/hub/service";
import { selectRecordsForExport } from "./export";
import { PARTICIPANTS, withTimeout, type Participant, type SearchRecord } from "./search";

export const MODULE_TIMEOUT_MS = 10_000;

export type ErasurePreviewItem = PrivacyErasureItem & { label: string };

export type ErasurePreview =
  | { status: "ok"; items: ErasurePreviewItem[] }
  | { status: "incomplete" | "changed" | "empty" };

// today : jour (Paris) des règles de conservation, simulable dans les tests.
export type Options = { participants?: Participant[]; timeoutMs?: number; today?: string };

export async function rulesOf(organizationId: string): Promise<ErasureRules> {
  const db = appDatabase();
  const settings = await getPrivacySettings(db, organizationId);
  return { accountingRetentionMonths: settings.accountingRetentionMonths, signedQuoteRetentionMonths: settings.signedQuoteRetentionMonths };
}

export function byModule(records: { module: string; kind: string; recordId: string }[]): Map<string, PrivacyRecordRef[]> {
  const grouped = new Map<string, PrivacyRecordRef[]>();
  for (const record of records) grouped.set(record.module, [...(grouped.get(record.module) ?? []), { kind: record.kind, recordId: record.recordId }]);
  return grouped;
}

export function contractOf(module: string, participants: Participant[]) {
  const participant = participants.find((candidate) => candidate.contract.module === module);
  if (!participant) throw new Error(`module inconnu : ${module}`);
  return participant.contract;
}

// Aperçu : le sort de chaque fiche cochée, sans rien modifier. Une fiche
// qu'aucun module ne classe (disparue entre-temps) rend l'aperçu caduc.
export async function previewErasure(
  input: { organizationId: string; terms: PersonTerms; selectedKeys: string[] },
  options: Options = {},
): Promise<ErasurePreview> {
  const participants = options.participants ?? PARTICIPANTS;
  const selection = await selectRecordsForExport(input, { participants });
  if (selection.status !== "ok") return { status: selection.status };
  const rules = await rulesOf(input.organizationId);
  const labels = new Map(selection.records.map((record: SearchRecord) => [`${record.module}:${record.kind}:${record.recordId}`, record.label]));
  const items: ErasurePreviewItem[] = [];
  try {
    for (const [module, records] of byModule(selection.records)) {
      const plan = await withTimeout(contractOf(module, participants).planErasure({ organizationId: input.organizationId, records, rules, today: options.today ?? parisDate(new Date()) }), options.timeoutMs ?? MODULE_TIMEOUT_MS);
      for (const item of plan) items.push({ module, ...item, label: labels.get(`${module}:${item.kind}:${item.recordId}`) ?? "" });
    }
  } catch (error) {
    console.error("oubli RGPD : aperçu d'un module en échec", { error: error instanceof Error ? error.message : "inconnue" });
    return { status: "incomplete" };
  }
  if (items.length !== selection.records.length) return { status: "changed" };
  return { status: "ok", items };
}

// Lot 23 (SEC-19) : les effacements des modules ne vont pas un à un au journal
// (purge en masse) ; l'appelant écrit une ligne de synthèse.
export function runModules(organizationId: string, items: PrivacyErasureItem[], options: Options): Promise<PrivacyErasureAck[]> {
  return withAuditBulk(() => runModulesNow(organizationId, items, options));
}

async function runModulesNow(organizationId: string, items: PrivacyErasureItem[], options: Options): Promise<PrivacyErasureAck[]> {
  const participants = options.participants ?? PARTICIPANTS;
  const rules = await rulesOf(organizationId);
  const acks: PrivacyErasureAck[] = [];
  for (const [module, records] of byModule(items)) {
    try {
      const done: ErasurePlanItem[] = await withTimeout(contractOf(module, participants).erase({ organizationId, records, rules, today: options.today ?? parisDate(new Date()) }), options.timeoutMs ?? MODULE_TIMEOUT_MS);
      acks.push({ module, status: "ok", at: new Date().toISOString(), count: done.length });
    } catch (error) {
      // Journalisé sans donnée personnelle (CLAUDE.md §5).
      console.error("oubli RGPD : module en échec", { module, error: error instanceof Error ? error.message : "inconnue" });
      acks.push({ module, status: "failed", at: new Date().toISOString(), count: 0 });
    }
  }
  return acks;
}

// Validation : l'aperçu est recalculé (jamais celui du navigateur), tracé,
// puis chaque module exécute sa part.
export async function executeErasure(
  input: { organizationId: string; userId: string; requestId: string; terms: PersonTerms; selectedKeys: string[] },
  options: Options = {},
): Promise<{ status: "ok"; erasureId: string; erasureStatus: "pending" | "partial" | "completed" } | { status: "incomplete" | "changed" | "empty" }> {
  const preview = await previewErasure(input, options);
  if (preview.status !== "ok") return { status: preview.status };
  const items: PrivacyErasureItem[] = preview.items.map((item) => ({
    module: item.module,
    kind: item.kind,
    recordId: item.recordId,
    fate: item.fate,
    legalBasis: item.legalBasis,
    keptUntil: item.keptUntil,
  }));
  const db = appDatabase();
  const erasureId = await startPrivacyErasure(db, { organizationId: input.organizationId, userId: input.userId, requestId: input.requestId, items });
  const acks = await runModules(input.organizationId, items, options);
  const erasureStatus = await recordPrivacyErasureAcks(db, { organizationId: input.organizationId, erasureId, acks });
  await recordAudit(db, { organizationId: input.organizationId, action: "hub.privacy_erasure.executed", objectId: erasureId, details: { status: erasureStatus, items: items.length } });
  return { status: "ok", erasureId, erasureStatus };
}

// Relance des seuls modules en échec, depuis la trace (les fiches ne sont
// plus forcément trouvables par la recherche, déjà en partie effacées).
export async function retryErasure(input: { organizationId: string; erasureId: string }, options: Options = {}) {
  const db = appDatabase();
  const erasure = await getPrivacyErasure(db, input.organizationId, input.erasureId);
  if (erasure.status === "completed") return "completed";
  const ok = new Set(erasure.acks.filter((ack) => ack.status === "ok").map((ack) => ack.module));
  const acks = await runModules(
    input.organizationId,
    erasure.items.filter((item) => !ok.has(item.module)),
    options,
  );
  const erasureStatus = await recordPrivacyErasureAcks(db, { organizationId: input.organizationId, erasureId: input.erasureId, acks });
  await recordAudit(db, { organizationId: input.organizationId, action: "hub.privacy_erasure.executed", objectId: input.erasureId, details: { status: erasureStatus, retry: true } });
  return erasureStatus;
}
