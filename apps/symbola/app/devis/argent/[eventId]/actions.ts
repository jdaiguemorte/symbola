"use server";

// Lot 48b (BUD-08, PRE-07 ; D6, D8 ; ADR 0093) — honoraires et commissions d'un évènement : régler les
// honoraires, tracer une commission ou un apport d'affaires, changer son statut ou son affichage, la
// retirer tant qu'elle n'est pas facturée, émettre sa facture au prestataire. Session, organisation,
// module des devis vérifiés ; la fiche du prestataire (destinataire) est relue par le serveur.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import {
  addCommission,
  CommissionAlreadyInvoicedError,
  CommissionNotFoundError,
  getCommission,
  InvalidPlannerMoneyError,
  issueCommissionInvoice,
  removeCommission,
  removePlannerFeeTerms,
  RequiredMentionsMissingError,
  setCommissionShown,
  setCommissionStatus,
  setPlannerFeeTerms,
} from "@/modules/quotes/service";
import { EventNotFoundError, getEvent, eventNames } from "@/modules/events/service";
import { getVendor } from "@/modules/vendors/service";
import { renderInvoicePdf } from "../../factures/render-invoice-pdf";
import { parseDecimal } from "../../decimal-input";
import { isValidId } from "../../module-access";
import { authorizedPlanner } from "../../planner-access";

export type MoneyFormState = { error?: string; success?: boolean };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function cents(formData: FormData, name: string): number | null {
  const raw = text(formData, name);
  if (!raw) return null;
  const value = parseDecimal(raw, 2);
  return value === null ? Number.NaN : value;
}

function basisPoints(formData: FormData, name: string): number | null {
  const raw = text(formData, name);
  if (!raw) return null;
  const value = parseDecimal(raw, 2);
  return value === null ? Number.NaN : value;
}

export async function savePlannerFeeAction(_previous: MoneyFormState, formData: FormData): Promise<MoneyFormState> {
  const t = await getTranslations("PlannerMoney");
  const planner = await authorizedPlanner();
  const eventId = text(formData, "eventId");
  if (!planner || !isValidId(eventId)) return { error: t("unauthorized") };
  const kind = text(formData, "kind");
  try {
    if (kind === "none") await removePlannerFeeTerms(planner.organizationId, eventId);
    else
      await setPlannerFeeTerms(planner.organizationId, eventId, {
        kind: kind as "flat" | "percent" | "mixed",
        flatCents: cents(formData, "flat"),
        percentBasisPoints: basisPoints(formData, "percent"),
        base: text(formData, "base") === "committed" ? "committed" : "estimated",
      });
  } catch (error) {
    if (error instanceof InvalidPlannerMoneyError) return { error: t("feeInvalid") };
    if (error instanceof EventNotFoundError) return { error: t("unauthorized") };
    throw error;
  }
  revalidatePath(`/devis/argent/${eventId}`);
  return { success: true };
}

export async function addCommissionAction(_previous: MoneyFormState, formData: FormData): Promise<MoneyFormState> {
  const t = await getTranslations("PlannerMoney");
  const planner = await authorizedPlanner();
  const eventId = text(formData, "eventId");
  if (!planner || !isValidId(eventId)) return { error: t("unauthorized") };
  const [vendorId, ...nameParts] = text(formData, "vendor").split("|");
  const byPercent = text(formData, "mode") === "percent";
  try {
    await addCommission(planner.organizationId, {
      eventId,
      vendorId: vendorId && isValidId(vendorId) ? vendorId : null,
      vendorName: nameParts.join("|") || text(formData, "vendorName"),
      nature: text(formData, "nature") === "referral" ? "referral" : "commission",
      amountCents: byPercent ? null : cents(formData, "amount"),
      percentBasisPoints: byPercent ? basisPoints(formData, "percent") : null,
      baseCents: byPercent ? cents(formData, "base") : null,
      shownToClient: formData.get("shownToClient") === "on",
    });
  } catch (error) {
    if (error instanceof InvalidPlannerMoneyError) return { error: t("commissionInvalid") };
    if (error instanceof EventNotFoundError) return { error: t("unauthorized") };
    throw error;
  }
  revalidatePath(`/devis/argent/${eventId}`);
  return { success: true };
}

export async function updateCommissionAction(formData: FormData): Promise<void> {
  const planner = await authorizedPlanner();
  const eventId = text(formData, "eventId");
  const commissionId = text(formData, "commissionId");
  if (!planner || !isValidId(eventId) || !isValidId(commissionId)) return;
  const action = text(formData, "action");
  try {
    if (action === "received") await setCommissionStatus(planner.organizationId, commissionId, "received", text(formData, "receivedOn") || new Date().toISOString().slice(0, 10));
    else if (action === "expected") await setCommissionStatus(planner.organizationId, commissionId, "expected");
    else if (action === "show") await setCommissionShown(planner.organizationId, commissionId, true);
    else if (action === "hide") await setCommissionShown(planner.organizationId, commissionId, false);
    else if (action === "remove") await removeCommission(planner.organizationId, commissionId);
  } catch (error) {
    if (!(error instanceof CommissionNotFoundError || error instanceof InvalidPlannerMoneyError)) throw error;
  }
  revalidatePath(`/devis/argent/${eventId}`);
}

export async function issueCommissionInvoiceAction(_previous: MoneyFormState, formData: FormData): Promise<MoneyFormState> {
  const t = await getTranslations("PlannerMoney");
  const planner = await authorizedPlanner();
  const eventId = text(formData, "eventId");
  const commissionId = text(formData, "commissionId");
  if (!planner || !isValidId(eventId) || !isValidId(commissionId)) return { error: t("unauthorized") };
  try {
    const commission = await getCommission(planner.organizationId, commissionId);
    const vendor = commission.vendorId ? await getVendor(planner.organizationId, commission.vendorId) : null;
    if (!vendor) return { error: t("invoiceVendorMissing") };
    const event = await getEvent(planner.organizationId, eventId);
    const locale = (await getLocale()) === "en" ? "en" : "fr";
    await issueCommissionInvoice({
      organizationId: planner.organizationId,
      commissionId,
      buyer: { name: vendor.name, addressLine: vendor.addressLine, postalCode: vendor.postalCode, city: vendor.city, countryCode: vendor.country, siret: vendor.siret },
      label: t(commission.nature === "referral" ? "invoiceLineReferral" : "invoiceLineCommission", { event: event ? eventNames(event.clients) : "" }),
      locale,
      renderOriginal: (invoice) => renderInvoicePdf(planner.organizationId, invoice),
    });
  } catch (error) {
    if (error instanceof CommissionAlreadyInvoicedError) return { error: t("invoiceAlready") };
    if (error instanceof RequiredMentionsMissingError) return { error: t("invoiceMentionsMissing") };
    if (error instanceof CommissionNotFoundError) return { error: t("unauthorized") };
    throw error;
  }
  revalidatePath(`/devis/argent/${eventId}`);
  return { success: true };
}
