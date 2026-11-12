"use server";

// Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) — décisions demandées
// au client, depuis la fiche de l'événement : demander (options d'un poste,
// dépense, programme), retirer une demande sans réponse, remplacer une décision
// répondue, et appliquer d'un geste ce que le client a décidé (retenir le
// prestataire choisi, engager la dépense validée).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  DecisionInvalidError,
  DecisionNotFoundError,
  DemoEventRestrictionError,
  EventNotFoundError,
  listEventDecisions,
  requestDecision,
  selectVendorCandidate,
  withdrawDecision,
  type RequestDecisionInput,
} from "@/modules/events/service";
import { listBudgetLines, updateBudgetLine } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type DecisionFormState = { error?: string; success?: boolean };

async function plannerAccess(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

// Une dépense est lue au module budget : sa ligne, son poste, son montant
// (devisé, sinon engagé, sinon estimé).
async function expenseOf(organizationId: string, eventId: string, lineId: string) {
  if (!isValidId(lineId) || !(await isBudgetModuleEnabled(organizationId))) return null;
  const view = await listBudgetLines(organizationId, eventId);
  const line = view.lines.find((candidate) => candidate.id === lineId);
  const amountCents = line ? (line.quotedAmountCents ?? line.committedAmountCents ?? line.estimatedAmountCents ?? 0) : 0;
  if (!line || amountCents <= 0) return null;
  const slotLabel = view.categories.find((category) => category.eventVendorSlotId === line.eventVendorSlotId)?.label ?? line.label;
  return { slotId: line.eventVendorSlotId, lineId: line.id, slotLabel, label: line.label || slotLabel, vendorName: line.vendorName, amountCents };
}

async function decisionInput(
  access: { organizationId: string; userId: string },
  eventId: string,
  kind: string,
  subject: { slotId: string; lineId: string },
  extra: { note: string | null; dueOn: string | null; replacesDecisionId: string | null },
): Promise<RequestDecisionInput | null> {
  const base = { organizationId: access.organizationId, eventId, requestedByUserId: access.userId, ...extra };
  if (kind === "option") return isValidId(subject.slotId) ? { ...base, kind: "option", slotId: subject.slotId } : null;
  if (kind === "program") return { ...base, kind: "program" };
  if (kind === "expense") {
    const expense = await expenseOf(access.organizationId, eventId, subject.lineId);
    return expense ? { ...base, kind: "expense", ...expense } : null;
  }
  return null;
}

async function errorMessage(error: unknown): Promise<string | null> {
  const t = await getTranslations("Decisions");
  if (error instanceof DecisionInvalidError) return t(`requestError.${error.reason}`);
  if (error instanceof DemoEventRestrictionError) return t("requestError.demo");
  if (error instanceof EventNotFoundError || error instanceof DecisionNotFoundError) return t("requestError.gone");
  return null;
}

export async function requestDecisionAction(_prev: DecisionFormState, formData: FormData): Promise<DecisionFormState> {
  const t = await getTranslations("Decisions");
  const access = await plannerAccess();
  const eventId = text(formData, "eventId");
  if (!access || !isValidId(eventId)) return { error: t("requestError.gone") };
  const input = await decisionInput(access, eventId, text(formData, "kind"), { slotId: text(formData, "slotId"), lineId: text(formData, "lineId") }, {
    note: text(formData, "note") || null,
    dueOn: text(formData, "dueOn") || null,
    replacesDecisionId: null,
  });
  if (!input) return { error: t("requestError.subject") };
  try {
    await requestDecision(input);
  } catch (error) {
    const message = await errorMessage(error);
    if (message) return { error: message };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

// Remplacer : une nouvelle demande sur le même objet, au contenu du jour.
export async function replaceDecisionAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = text(formData, "eventId");
  const decisionId = text(formData, "decisionId");
  if (!access || !isValidId(eventId) || !isValidId(decisionId)) return;
  const decision = (await listEventDecisions(access.organizationId, eventId)).find((candidate) => candidate.id === decisionId);
  if (!decision) return;
  const input = await decisionInput(access, eventId, decision.kind, { slotId: decision.subjectId ?? "", lineId: decision.subjectId ?? "" }, { note: null, dueOn: null, replacesDecisionId: decision.id });
  if (!input) return;
  await requestDecision(input).catch(async (error: unknown) => {
    if (!(await errorMessage(error))) throw error;
  });
  revalidatePath(`/events/${eventId}`);
}

export async function withdrawDecisionAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = text(formData, "eventId");
  const decisionId = text(formData, "decisionId");
  if (!access || !isValidId(eventId) || !isValidId(decisionId)) return;
  await withdrawDecision(access.organizationId, decisionId).catch((error: unknown) => {
    if (!(error instanceof DecisionInvalidError) && !(error instanceof DecisionNotFoundError)) throw error;
  });
  revalidatePath(`/events/${eventId}`);
}

// D9 : appliquer d'un geste. Retenir le prestataire choisi par le client.
export async function retainDecisionChoiceAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = text(formData, "eventId");
  const decisionId = text(formData, "decisionId");
  if (!access || !isValidId(eventId) || !isValidId(decisionId)) return;
  const decision = (await listEventDecisions(access.organizationId, eventId)).find((candidate) => candidate.id === decisionId);
  if (!decision || decision.kind !== "option" || decision.status !== "approved" || !decision.choiceId) return;
  await selectVendorCandidate({ organizationId: access.organizationId, candidateId: decision.choiceId, changedByUserId: access.userId });
  revalidatePath(`/events/${eventId}`);
}

// D9 : engager la dépense validée, au montant figé dans la décision.
export async function commitDecisionExpenseAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = text(formData, "eventId");
  const decisionId = text(formData, "decisionId");
  if (!access || !isValidId(eventId) || !isValidId(decisionId) || !(await isBudgetModuleEnabled(access.organizationId))) return;
  const decision = (await listEventDecisions(access.organizationId, eventId)).find((candidate) => candidate.id === decisionId);
  if (!decision || decision.snapshot.kind !== "expense" || decision.status !== "approved" || !decision.subjectId) return;
  await updateBudgetLine({ organizationId: access.organizationId, eventId, lineId: decision.subjectId, field: "committed", amountCents: decision.snapshot.amountCents, changedByUserId: access.userId });
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/budget/${eventId}`);
}
