"use server";

// Lot 43 (BUD-06, D8) — la planner tient les payeurs de l'évènement : les ajoute (avec ou sans lien),
// règle ce que chacun voit pour le client, partage une ligne (pourcentage ou montant), désigne le payeur
// d'une échéance. Session planner, organisation et module contrôlés côté serveur ; portée par le module.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { EVENT_PAYER_KINDS, type EventPayerKind } from "@symbola/contracts";
import { parseAmountToCents } from "@symbola/i18n";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { parseDecimal } from "@/app/devis/decimal-input";
import { addEventPayer, EventNotFoundError, EventPayerInvalidError, EventPayerNotFoundError, removeEventPayer, setInstalmentPayer, setLinePayerShares, setPayerVisibility, setVendorPaymentPayer } from "@/modules/budget/service";
import { isBudgetModuleEnabled, isValidId } from "../../module-access";

export type PayersState = { error?: string; success?: boolean };

async function run(formData: FormData, write: (organizationId: string, eventId: string) => Promise<PayersState | void>): Promise<PayersState> {
  const t = await getTranslations("Payers");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || !(await isBudgetModuleEnabled(auth.user.organizationId))) return { error: t("errors.unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("errors.notFound") };
  try {
    const result = await write(auth.user.organizationId, eventId);
    if (result) return result;
  } catch (error) {
    if (error instanceof EventPayerInvalidError) return { error: t(`errors.${error.reason}`) };
    if (error instanceof EventPayerNotFoundError || error instanceof EventNotFoundError) return { error: t("errors.notFound") };
    throw error;
  }
  revalidatePath(`/budget/${eventId}/payeurs`);
  revalidatePath(`/budget/${eventId}/calendrier`);
  return { success: true };
}

const kindOf = (value: FormDataEntryValue | null): EventPayerKind | null => ((EVENT_PAYER_KINDS as readonly string[]).includes(String(value)) ? (String(value) as EventPayerKind) : null);
const optionalId = (value: FormDataEntryValue | null): string | null => (value && isValidId(String(value)) ? String(value) : null);

export async function addPayerAction(_prev: PayersState, formData: FormData): Promise<PayersState> {
  const t = await getTranslations("Payers");
  return run(formData, async (organizationId, eventId) => {
    const kind = kindOf(formData.get("kind"));
    if (!kind) return { error: t("errors.kind") };
    await addEventPayer(organizationId, { eventId, name: String(formData.get("name") ?? ""), kind, linkId: optionalId(formData.get("linkId")) });
  });
}

export async function removePayerAction(formData: FormData): Promise<void> {
  await run(formData, async (organizationId, eventId) => {
    const payerId = optionalId(formData.get("payerId"));
    if (payerId) await removeEventPayer(organizationId, eventId, payerId);
  });
}

export async function setVisibilityAction(_prev: PayersState, formData: FormData): Promise<PayersState> {
  return run(formData, async (organizationId, eventId) => {
    const payerId = optionalId(formData.get("payerId"));
    if (!payerId) return {};
    await setPayerVisibility(organizationId, { eventId, payerId, ownShareOnly: formData.get("visibility") !== "all" });
  });
}

// Les parts d'une ligne : pour chaque payeur (hors mariés), un pourcentage ou un montant, ou rien.
export async function setLineSharesAction(_prev: PayersState, formData: FormData): Promise<PayersState> {
  const t = await getTranslations("Payers");
  return run(formData, async (organizationId, eventId) => {
    const lineId = optionalId(formData.get("lineId"));
    if (!lineId) return { error: t("errors.line") };
    const shares = [];
    for (const payerId of formData.getAll("payerId").map(String).filter(isValidId)) {
      const value = String(formData.get(`value-${payerId}`) ?? "").trim();
      if (!value) continue;
      const mode = formData.get(`mode-${payerId}`) === "amount" ? "amount" : "percent";
      const parsed = (mode === "amount" ? parseAmountToCents(value) : parseDecimal(value, 2)) ?? null;
      if (parsed === null || parsed <= 0) return { error: t("errors.shares_invalid") };
      shares.push({ payerId, percentageBasisPoints: mode === "percent" ? parsed : null, amountCents: mode === "amount" ? parsed : null });
    }
    await setLinePayerShares(organizationId, { eventId, lineId, shares });
  });
}

export async function setPaymentPayerAction(_prev: PayersState, formData: FormData): Promise<PayersState> {
  return run(formData, async (organizationId, eventId) => {
    const payerId = optionalId(formData.get("payerId"));
    const paymentId = optionalId(formData.get("paymentId"));
    const scheduleItemId = optionalId(formData.get("scheduleItemId"));
    if (paymentId) await setVendorPaymentPayer(organizationId, { eventId, paymentId, payerId });
    else if (scheduleItemId) await setInstalmentPayer(organizationId, { eventId, scheduleItemId, payerId });
  });
}
