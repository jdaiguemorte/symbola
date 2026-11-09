// Lot 18 (RGPD-07, ADR 0047) — dossier d'une demande d'exercice de droits :
// enregistrer, retrouver les données, agir (effacer, exporter, ou rectifier à
// la main), répondre à la personne, clore. L'état des étapes se déduit des
// traces existantes (exécution d'oubli, exports, dates de la demande) ; la
// clôture exige l'action faite et la réponse envoyée (décision C).
// Exposé par service.ts ; tables sous RLS (withOrganization).
import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { privacyErasures, privacyExports, privacyRequests } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { getPrivacyRequest, PrivacyRequestInvalidError, PrivacyRequestNotFoundError, type PrivacyRequestType, type PrivacyRequestView } from "./privacy-requests";

export type PrivacyCaseStep = "registered" | "found" | "action" | "response" | "closed";
export type PrivacyCaseStepState = "done" | "current" | "waiting" | "todo";
// Effacement (oubli), export (accès, portabilité), ou action menée à la main
// dans l'app (rectification, opposition).
export type PrivacyCaseActionKind = "erasure" | "export" | "manual";

export const PRIVACY_CASE_STEPS: PrivacyCaseStep[] = ["registered", "found", "action", "response", "closed"];

export type PrivacyCaseView = {
  request: PrivacyRequestView;
  actionKind: PrivacyCaseActionKind;
  erasure: { id: string; status: "pending" | "partial" | "completed"; createdAt: Date; completedAt: Date | null } | null;
  // Exports rattachés : tous (pour savoir si l'action est faite), dont ceux
  // encore téléchargeables.
  exports: { id: string; recordCount: number; createdAt: Date; expiresAt: Date; available: boolean }[];
  actionDone: boolean;
  steps: Record<PrivacyCaseStep, PrivacyCaseStepState>;
  // Première étape à faire (la dernière si tout est fait).
  current: PrivacyCaseStep;
  canClose: boolean;
};

export function actionKindOf(type: PrivacyRequestType): PrivacyCaseActionKind {
  if (type === "erasure") return "erasure";
  if (type === "access" || type === "portability") return "export";
  return "manual";
}

// Fonction pure : l'état de chaque étape à partir des traces du dossier.
export function caseSteps(input: {
  closed: boolean;
  actionDone: boolean;
  actionStarted: boolean;
  actionWaiting: boolean;
  responseSent: boolean;
}): { steps: Record<PrivacyCaseStep, PrivacyCaseStepState>; current: PrivacyCaseStep } {
  const found: PrivacyCaseStepState = input.actionDone || input.actionStarted ? "done" : "current";
  const steps: Record<PrivacyCaseStep, PrivacyCaseStepState> = {
    registered: "done",
    found,
    action: input.actionDone ? "done" : input.actionWaiting ? "waiting" : found === "done" ? "current" : "todo",
    response: input.responseSent ? "done" : input.actionDone ? "current" : "todo",
    closed: input.closed ? "done" : input.actionDone && input.responseSent ? "current" : "todo",
  };
  const current = PRIVACY_CASE_STEPS.find((step) => steps[step] !== "done") ?? "closed";
  return { steps, current };
}

export async function getPrivacyCase(db: AppDatabase, organizationId: string, requestId: string, now: Date = new Date()): Promise<PrivacyCaseView> {
  const request = await getPrivacyRequest(db, organizationId, requestId, now);
  const { erasures, exports } = await withOrganization(db, organizationId, async (tx) => ({
    erasures: await tx.select().from(privacyErasures).where(eq(privacyErasures.requestId, requestId)).orderBy(desc(privacyErasures.createdAt)),
    exports: await tx.select().from(privacyExports).where(eq(privacyExports.requestId, requestId)).orderBy(desc(privacyExports.createdAt)),
  }));
  const actionKind = actionKindOf(request.type);
  const latest = erasures[0] ?? null;
  const actionDone =
    actionKind === "erasure" ? latest?.status === "completed" : actionKind === "export" ? exports.length > 0 : request.actionDoneAt !== null;
  const { steps, current } = caseSteps({
    closed: request.status === "closed",
    actionDone,
    actionStarted: latest !== null,
    actionWaiting: latest !== null && latest.status !== "completed",
    responseSent: request.responseSentAt !== null,
  });
  return {
    request,
    actionKind,
    erasure: latest ? { id: latest.id, status: latest.status, createdAt: latest.createdAt, completedAt: latest.completedAt } : null,
    exports: exports.map((row) => ({
      id: row.id,
      recordCount: row.recordCount,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      available: row.purgedAt === null && row.expiresAt > now,
    })),
    actionDone,
    steps,
    current,
    canClose: request.status !== "closed" && actionDone && request.responseSentAt !== null,
  };
}

const OPEN = ["open", "extended"] as const;

async function setOnOpenRequest(db: AppDatabase, organizationId: string, requestId: string, values: Partial<typeof privacyRequests.$inferInsert>): Promise<void> {
  const updated = await withOrganization(db, organizationId, (tx) =>
    tx
      .update(privacyRequests)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(privacyRequests.id, requestId), inArray(privacyRequests.status, [...OPEN])))
      .returning({ id: privacyRequests.id }),
  );
  if (updated.length === 0) throw new PrivacyRequestNotFoundError();
}

// Rectification ou opposition : la titulaire a fait la modification dans l'app.
export async function markPrivacyActionDone(db: AppDatabase, input: { organizationId: string; requestId: string; now?: Date }): Promise<void> {
  const request = await getPrivacyRequest(db, input.organizationId, input.requestId);
  if (actionKindOf(request.type) !== "manual") throw new PrivacyRequestInvalidError("not_manual");
  if (request.status === "closed") throw new PrivacyRequestInvalidError("closed");
  await setOnOpenRequest(db, input.organizationId, input.requestId, { actionDoneAt: input.now ?? new Date() });
}

// La réponse ne se marque « envoyée » qu'une fois l'action faite.
export async function markPrivacyResponseSent(db: AppDatabase, input: { organizationId: string; requestId: string; now?: Date }): Promise<void> {
  const view = await getPrivacyCase(db, input.organizationId, input.requestId);
  if (view.request.status === "closed") throw new PrivacyRequestInvalidError("closed");
  if (!view.actionDone) throw new PrivacyRequestInvalidError("action_missing");
  await setOnOpenRequest(db, input.organizationId, input.requestId, { responseSentAt: input.now ?? new Date() });
}

// Décision C : une demande ne se clôt que si l'action est faite et la réponse
// marquée envoyée.
export async function closePrivacyRequest(db: AppDatabase, input: { organizationId: string; requestId: string; now?: Date }): Promise<void> {
  const view = await getPrivacyCase(db, input.organizationId, input.requestId);
  if (view.request.status === "closed") throw new PrivacyRequestInvalidError("closed");
  if (!view.actionDone) throw new PrivacyRequestInvalidError("action_missing");
  if (view.request.responseSentAt === null) throw new PrivacyRequestInvalidError("response_missing");
  const now = input.now ?? new Date();
  await setOnOpenRequest(db, input.organizationId, input.requestId, { status: "closed", closedAt: now });
}
