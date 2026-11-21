"use server";

import { offerUndo } from "@/lib/undo";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { BUDGET_AMOUNT_FIELDS, type BudgetAmountField } from "@symbola/contracts";
import { parseAmountToCents } from "@symbola/i18n";
import {
  AlertThresholdInvalidError,
  BudgetLineDetailsInvalidError,
  BudgetLineNotFoundError,
  BudgetLinePaidFromPaymentsError,
  VendorPaymentInvalidError,
  VendorPaymentNotFoundError,
  addBudgetLine,
  addVendorPayment,
  removeBudgetLine,
  removeVendorPayment,
  setVendorPaymentPaid,
  setVendorPaymentHandover,
  VendorPaymentHandoverInvalidError,
  confirmVendorPaymentDeclaration,
  refuseVendorPaymentDeclaration,
  VendorPaymentDeclarationError,
  setEventAlertThreshold,
  AllocationModelNotFoundError,
  BudgetSimulationMismatchError,
  DefaultVendorSlotNotFoundError,
  EventBudgetNotFoundError,
  EventNotFoundError,
  EventVendorSlotNotFoundError,
  adjustEventBudgetItems,
  saveBudgetLines,
  BudgetBatchLineError,
  BUDGET_BATCH_MAX_LINES,
  confirmEventBudget,
  simulateEventBudget,
  updateBudgetLine,
} from "@/modules/budget/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isBudgetModuleEnabled, isValidId } from "../module-access";
import { parseDecimal } from "@/app/devis/decimal-input";

export type BudgetFormState = { error?: string; success?: boolean };

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isBudgetModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

export async function simulateEventBudgetAction(
  _prevState: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const eventId = String(formData.get("eventId") ?? "");
  const totalAmountCents = parseAmountToCents(String(formData.get("totalAmount") ?? ""));
  const guestCount = Number(String(formData.get("guestCount") ?? "").trim());
  const allocationModelId = String(formData.get("allocationModelId") ?? "").trim();

  if (!totalAmountCents) return { error: t("invalidTotalAmount") };
  if (!Number.isInteger(guestCount) || guestCount < 0) return { error: t("invalidGuestCount") };
  if (!allocationModelId) return { error: t("missingModel") };

  try {
    await simulateEventBudget({
      organizationId,
      eventId,
      totalAmountCents,
      guestCount,
      allocationModelId,
    });
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof AllocationModelNotFoundError) return { error: t("missingModel") };
    throw error;
  }

  revalidatePath(`/budget/${eventId}`, "layout");
  return {};
}

export async function confirmEventBudgetAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;

  const eventId = String(formData.get("eventId") ?? "");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated") return;

  try {
    await confirmEventBudget({ organizationId, eventId, confirmedByUserId: auth.user.id });
  } catch (error) {
    if (error instanceof EventNotFoundError) return;
    if (error instanceof EventBudgetNotFoundError) return;
    if (error instanceof BudgetSimulationMismatchError) return;
    throw error;
  }

  revalidatePath(`/budget/${eventId}`, "layout");
  revalidatePath(`/events/${eventId}`);
}

// Lot 28a (BUD-01) : les quatre montants saisissables d'une ligne en un seul
// envoi ; un champ vide ou inchangé n'est pas écrit. Chaque montant écrit est
// historisé.
export async function updateBudgetLineAction(
  _prevState: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated") return { error: t("unauthenticated") };

  const eventId = String(formData.get("eventId") ?? "");
  // Lot 28b (Q33) : la ligne visée ; à défaut (fiche de l'événement), la
  // première ligne de la catégorie.
  const lineId = String(formData.get("lineId") ?? "");
  const eventVendorSlotId = String(formData.get("eventVendorSlotId") ?? "");
  const target = isValidId(lineId) ? { lineId } : { eventVendorSlotId };
  const changes: { field: BudgetAmountField; amountCents: number }[] = [];
  for (const field of BUDGET_AMOUNT_FIELDS) {
    const raw = String(formData.get(`amount_${field}`) ?? "").trim();
    if (raw === "") continue;
    const amountCents = parseAmountToCents(raw);
    if (amountCents === null || amountCents === undefined || amountCents < 0) return { error: t("invalidAmount") };
    if (String(amountCents) === String(formData.get(`current_${field}`) ?? "")) continue;
    changes.push({ field, amountCents });
  }

  try {
    for (const change of changes) {
      await updateBudgetLine({ organizationId, eventId, ...target, field: change.field, amountCents: change.amountCents, changedByUserId: auth.user.id });
    }
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof EventVendorSlotNotFoundError || error instanceof BudgetLineNotFoundError) return { error: t("unknownVendorSlot") };
    if (error instanceof BudgetLinePaidFromPaymentsError) return { error: t("paidFromPayments") };
    throw error;
  }

  revalidatePath(`/budget/${eventId}`, "layout");
  // Lot 12 (L12-EVT-17) : l'estimé se saisit aussi depuis l'onglet Budget de la fiche.
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

// Lot 28a (BUD-02, décision D4) : seuil d'alerte propre à l'événement ; vide,
// l'événement reprend celui de l'organisation.
export async function setEventAlertThresholdAction(_prevState: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const raw = String(formData.get("percent") ?? "").trim();
  const percent = raw === "" ? null : Number(raw);
  try {
    await setEventAlertThreshold(organizationId, eventId, percent);
  } catch (error) {
    if (error instanceof AlertThresholdInvalidError) return { error: t("thresholdInvalid") };
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
  revalidatePath(`/budget/${eventId}`, "layout");
  return { success: true };
}

// Lot 62c (UX-13, décision D1) — « Enregistrer la répartition » : tous les postes modifiés de la
// simulation partent ensemble, dans une seule transaction. Un champ vide vaut 0 €, comme avant ;
// une saisie illisible refuse tout l'envoi et dit son poste. Entrées validées par Zod (SEC-18).
const adjustItemsSchema = z.object({
  eventId: z.string().refine(isValidId),
  items: z
    .array(z.object({ defaultVendorSlotId: z.string().refine(isValidId), amount: z.string().max(40) }))
    .min(1)
    .max(200),
});

export type BudgetBatchState = { ok: true; count: number } | { ok: false; error: string; line?: string };

export async function adjustEventBudgetItemsAction(input: z.input<typeof adjustItemsSchema>): Promise<BudgetBatchState> {
  const t = await getTranslations("Budget");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { ok: false, error: t("unauthenticated") };
  const parsed = adjustItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("batchInvalid") };
  const items: { defaultVendorSlotId: string; amountCents: number }[] = [];
  for (const item of parsed.data.items) {
    const cents = parseAmountToCents(item.amount);
    if (cents === undefined || (cents !== null && cents < 0)) return { ok: false, error: t("invalidAmount"), line: item.defaultVendorSlotId };
    items.push({ defaultVendorSlotId: item.defaultVendorSlotId, amountCents: cents ?? 0 });
  }
  try {
    await adjustEventBudgetItems({ organizationId, eventId: parsed.data.eventId, items });
  } catch (error) {
    if (error instanceof EventNotFoundError) return { ok: false, error: t("eventNotFound") };
    if (error instanceof EventBudgetNotFoundError) return { ok: false, error: t("noSimulationYet") };
    if (error instanceof DefaultVendorSlotNotFoundError || error instanceof RangeError) return { ok: false, error: t("unknownVendorSlot") };
    throw error;
  }
  revalidatePath(`/budget/${parsed.data.eventId}`, "layout");
  return { ok: true, count: items.length };
}

// —— Lot 28b (BUD-01, Q33) : lignes d'une catégorie ————————————————————————

async function plannerAccess(): Promise<{ organizationId: string; userId: string } | null> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return null;
  const auth = await getPlannerAuthContext();
  return auth.status === "authenticated" ? { organizationId, userId: auth.user.id } : null;
}

function refresh(eventId: string) {
  revalidatePath(`/budget/${eventId}`, "layout");
  revalidatePath(`/events/${eventId}`);
}

function lineDetailsError(t: Awaited<ReturnType<typeof getTranslations>>, error: unknown): BudgetFormState {
  if (error instanceof BudgetLineDetailsInvalidError) return { error: t(error.reason === "label" ? "lineLabelRequired" : error.reason === "vendor" ? "lineVendorInvalid" : "lineVatRateInvalid") };
  if (error instanceof BudgetLineNotFoundError || error instanceof EventVendorSlotNotFoundError) return { error: t("unknownVendorSlot") };
  if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
  throw error;
}

// Prestataire choisi dans la liste de la catégorie : vide = aucun.
function candidateFrom(formData: FormData): string | null | undefined {
  if (!formData.has("vendorCandidateId")) return undefined;
  const value = String(formData.get("vendorCandidateId") ?? "");
  return isValidId(value) ? value : null;
}

export async function addBudgetLineAction(_prevState: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const access = await plannerAccess();
  if (!access) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const eventVendorSlotId = String(formData.get("eventVendorSlotId") ?? "");
  if (!isValidId(eventId) || !isValidId(eventVendorSlotId)) return { error: t("unknownVendorSlot") };
  try {
    await addBudgetLine({ organizationId: access.organizationId, eventId, eventVendorSlotId, label: String(formData.get("label") ?? ""), vendorCandidateId: candidateFrom(formData) ?? null });
  } catch (error) {
    return lineDetailsError(t, error);
  }
  refresh(eventId);
  return { success: true };
}

// Lot 62c (UX-13, décision D1) — « Enregistrer le budget » : libellé, prestataire, taux de TVA et
// montants de toutes les lignes modifiées, dans une seule transaction. Rien n'est écrit si une
// ligne est refusée, et l'écran apprend laquelle pour l'ouvrir. Un montant laissé vide n'est pas
// écrit (comme avant) ; les montants se lisent sans calcul à virgule flottante.
const saveLinesSchema = z.object({
  eventId: z.string().refine(isValidId),
  lines: z
    .array(
      z.object({
        lineId: z.string().refine(isValidId),
        label: z.string().max(300),
        vendorCandidateId: z.string().refine(isValidId).nullable(),
        vatRate: z.string().max(20),
        amounts: z.partialRecord(z.enum(BUDGET_AMOUNT_FIELDS), z.string().max(40)),
      }),
    )
    .min(1)
    .max(BUDGET_BATCH_MAX_LINES),
});

export async function saveBudgetLinesAction(input: z.input<typeof saveLinesSchema>): Promise<BudgetBatchState> {
  const t = await getTranslations("Budget");
  const access = await plannerAccess();
  if (!access) return { ok: false, error: t("unauthenticated") };
  const parsed = saveLinesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("batchInvalid") };
  const { eventId } = parsed.data;
  const lines = [];
  for (const line of parsed.data.lines) {
    // Lot 28c (BUD-09) : taux saisi comme au catalogue (« 20 », « 5,5 »).
    const vatRateBasisPoints = parseDecimal(line.vatRate, 2);
    if (vatRateBasisPoints === null || vatRateBasisPoints > 10000) return { ok: false, error: t("lineVatRateInvalid"), line: line.lineId };
    const amounts: { field: BudgetAmountField; amountCents: number }[] = [];
    for (const field of BUDGET_AMOUNT_FIELDS) {
      const raw = (line.amounts[field] ?? "").trim();
      if (raw === "") continue;
      const amountCents = parseAmountToCents(raw);
      if (amountCents === null || amountCents === undefined || amountCents < 0) return { ok: false, error: t("invalidAmount"), line: line.lineId };
      amounts.push({ field, amountCents });
    }
    lines.push({ lineId: line.lineId, label: line.label, vendorCandidateId: line.vendorCandidateId, vatRateBasisPoints, amounts });
  }
  try {
    await saveBudgetLines({ organizationId: access.organizationId, eventId, changedByUserId: access.userId, lines });
  } catch (error) {
    const reason = error instanceof BudgetBatchLineError ? error.reason : error;
    const line = error instanceof BudgetBatchLineError ? { line: error.lineId } : {};
    if (reason instanceof BudgetLinePaidFromPaymentsError) return { ok: false, error: t("paidFromPayments"), ...line };
    if (reason instanceof RangeError) return { ok: false, error: t("invalidAmount"), ...line };
    const state = lineDetailsError(t, reason);
    return { ok: false, error: state.error ?? t("batchInvalid"), ...line };
  }
  refresh(eventId);
  return { ok: true, count: lines.length };
}

export async function removeBudgetLineAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(lineId)) return;
  const removed = await removeBudgetLine(access.organizationId, eventId, lineId).then(
    () => true,
    (error: unknown) => {
      if (!(error instanceof BudgetLineNotFoundError)) throw error;
      return false;
    },
  );
  if (removed) await offerUndo({ kind: "budgetLine", id: lineId });
  refresh(eventId);
}

// —— Lot 28b (BUD-03, D12, D13) : échéances des prestataires ———————————————

// « 30 », « 12,5 » ou « 33.33 » % vers des points de base, sans calcul à
// virgule flottante (CLAUDE.md § 5) ; undefined si illisible.
function basisPointsFrom(raw: string): number | undefined {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(raw.trim().replace(/\s*%$/, ""));
  if (!match) return undefined;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export async function addVendorPaymentAction(_prevState: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const access = await plannerAccess();
  if (!access) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  if (!isValidId(eventId) || !isValidId(lineId)) return { error: t("unknownVendorSlot") };
  const mode = String(formData.get("mode") ?? "amount");
  const raw = String(formData.get("value") ?? "");
  const fixedAmountCents = mode === "amount" ? parseAmountToCents(raw) : null;
  const percentageBasisPoints = mode === "percent" ? basisPointsFrom(raw) : null;
  if (fixedAmountCents === undefined || percentageBasisPoints === undefined || (fixedAmountCents === null && percentageBasisPoints === null)) return { error: t("paymentAmountInvalid") };
  try {
    await addVendorPayment({
      organizationId: access.organizationId,
      eventId,
      lineId,
      label: String(formData.get("label") ?? ""),
      fixedAmountCents,
      percentageBasisPoints,
      dueOn: String(formData.get("dueOn") ?? ""),
      changedByUserId: access.userId,
    });
  } catch (error) {
    if (error instanceof VendorPaymentInvalidError) return { error: t(error.reason === "label" ? "paymentLabelRequired" : error.reason === "date" ? "paymentDateInvalid" : "paymentAmountInvalid") };
    if (error instanceof BudgetLineNotFoundError) return { error: t("unknownVendorSlot") };
    throw error;
  }
  refresh(eventId);
  return { success: true };
}

// Payée ce jour (date saisie) ; date vide : le paiement est annulé.
export async function setVendorPaymentPaidAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(paymentId)) return;
  const paidOn = String(formData.get("paidOn") ?? "").trim() || null;
  await setVendorPaymentPaid({ organizationId: access.organizationId, eventId, paymentId, paidOn, changedByUserId: access.userId }).catch((error: unknown) => {
    if (!(error instanceof VendorPaymentNotFoundError) && !(error instanceof VendorPaymentInvalidError)) throw error;
  });
  refresh(eventId);
}

// Lot 51 (JRJ-09 ; D8) — marquer une échéance « à remettre le jour J » (moyen, personne qui remet),
// ou retirer la marque ; une remise déjà pointée reste.
export async function setVendorPaymentHandoverAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(paymentId)) return;
  await setVendorPaymentHandover({
    organizationId: access.organizationId,
    eventId,
    paymentId,
    onDay: formData.get("onDay") === "on",
    method: String(formData.get("method") ?? ""),
    by: String(formData.get("by") ?? ""),
    changedByUserId: access.userId,
  }).catch((error: unknown) => {
    if (!(error instanceof VendorPaymentNotFoundError) && !(error instanceof VendorPaymentHandoverInvalidError)) throw error;
  });
  refresh(eventId);
}

export async function removeVendorPaymentAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(paymentId)) return;
  await removeVendorPayment({ organizationId: access.organizationId, eventId, paymentId, changedByUserId: access.userId }).catch((error: unknown) => {
    if (!(error instanceof VendorPaymentNotFoundError)) throw error;
  });
  refresh(eventId);
}

// Lot 27a (SC-06 étape 5, décision D6) — règlement déclaré par un client :
// confirmer le marque payé à la date déclarée ; refuser le rend à régler, avec
// un motif montré au client.
export async function confirmPaymentDeclarationAction(formData: FormData): Promise<void> {
  const access = await plannerAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(paymentId)) return;
  await confirmVendorPaymentDeclaration({ organizationId: access.organizationId, eventId, paymentId, changedByUserId: access.userId }).catch((error: unknown) => {
    if (!(error instanceof VendorPaymentNotFoundError) && !(error instanceof VendorPaymentDeclarationError)) throw error;
  });
  refresh(eventId);
  revalidatePath("/");
}

export async function refusePaymentDeclarationAction(_prev: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const t = await getTranslations("Budget");
  const access = await plannerAccess();
  const eventId = String(formData.get("eventId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(paymentId)) return { error: t("declarationGone") };
  try {
    await refuseVendorPaymentDeclaration({ organizationId: access.organizationId, eventId, paymentId, reason: String(formData.get("reason") ?? "") });
  } catch (error) {
    if (error instanceof VendorPaymentDeclarationError) return { error: t(error.reason === "reason" ? "declarationReasonRequired" : "declarationGone") };
    if (error instanceof VendorPaymentNotFoundError) return { error: t("declarationGone") };
    throw error;
  }
  refresh(eventId);
  revalidatePath("/");
  return { success: true };
}
