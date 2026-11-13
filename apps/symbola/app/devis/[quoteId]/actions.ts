"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  CatalogItemNotFoundError,
  QuoteEmptyError,
  QuoteNotFoundError,
  QuoteOptionsLockedError,
  QuoteScheduleExceedsTotalError,
  QuoteSectionNotFoundError,
  QuoteTemplateNotFoundError,
  QuoteVatRegimeRequiredError,
  QuoteVersionLockedError,
  RequiredMentionsMissingError,
  addQuoteLine,
  addQuoteSection,
  chooseQuoteOptions,
  getQuote,
  removeQuoteLine,
  removeQuoteSection,
  renameQuoteSection,
  replaceQuoteTemplateFromQuote,
  reviseQuote,
  saveQuoteAsTemplate,
  sendQuote,
  setQuoteAdvanceKind,
  setQuoteGlobalDiscount,
  updateQuoteLine,
  type GlobalDiscountInput,
  type MissingMention,
} from "@/modules/quotes/service";
import { getEvent } from "@/modules/events/service";
import { parseDecimal } from "../decimal-input";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";

export type QuoteFormState = { error?: string; success?: boolean; vatRegimeRequired?: boolean; missingMentions?: MissingMention[] };

type Translate = Awaited<ReturnType<typeof getTranslations<"Quotes">>>;

// Erreurs métier du service → message traduit ; toute autre erreur remonte.
function errorState(error: unknown, t: Translate): QuoteFormState {
  if (error instanceof QuoteNotFoundError) return { error: t("quoteNotFound") };
  if (error instanceof QuoteVersionLockedError) return { error: t("versionLocked") };
  if (error instanceof CatalogItemNotFoundError) return { error: t("catalogItemNotFound") };
  if (error instanceof QuoteEmptyError) return { error: t("quoteEmpty") };
  if (error instanceof QuoteScheduleExceedsTotalError) return { error: t("scheduleExceedsTotal") };
  if (error instanceof QuoteVatRegimeRequiredError) return { error: t("vatRegimeRequired"), vatRegimeRequired: true };
  // Lot 31a (FAC-07, D4) : le refus nomme chaque mention manquante (liens vers où la remplir).
  if (error instanceof RequiredMentionsMissingError) return { error: t("mentionsMissing"), missingMentions: error.fields };
  if (error instanceof QuoteSectionNotFoundError) return { error: t("sectionNotFound") };
  if (error instanceof QuoteOptionsLockedError) return { error: t("optionsLocked") };
  if (error instanceof QuoteTemplateNotFoundError) return { error: t("templateNotFound") };
  if (error instanceof RangeError) return { error: t("invalidLine") };
  throw error;
}

// Lot 31a (FAC-01, D2) : section de la ligne (vide : aucune) et ligne en option.
function readPlacement(formData: FormData): { sectionId: string | null; isOption: boolean } {
  const sectionId = String(formData.get("sectionId") ?? "");
  return { sectionId: isValidId(sectionId) ? sectionId : null, isOption: formData.get("isOption") === "on" };
}

function readQuoteId(formData: FormData): string | null {
  const quoteId = String(formData.get("quoteId") ?? "");
  return isValidId(quoteId) ? quoteId : null;
}

function optionalDecimal(formData: FormData, name: string, scale: number): number | undefined | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return undefined;
  return parseDecimal(raw, scale);
}

async function run(
  formData: FormData,
  write: (organizationId: string, quoteId: string, t: Translate) => Promise<QuoteFormState | void>,
): Promise<QuoteFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  const quoteId = readQuoteId(formData);
  if (!quoteId) return { error: t("quoteNotFound") };
  try {
    const result = await write(planner.organizationId, quoteId, t);
    if (result) return result;
  } catch (error) {
    return errorState(error, t);
  }
  revalidatePath(`/devis/${quoteId}`);
  return { success: true };
}

export async function addCatalogLineAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId, t) => {
    const catalogItemId = String(formData.get("catalogItemId") ?? "");
    if (!isValidId(catalogItemId)) return { error: t("chooseItem") };
    const quantityMilli = optionalDecimal(formData, "quantity", 3);
    if (!quantityMilli) return { error: t("invalidQuantity") };
    await addQuoteLine(organizationId, quoteId, { catalogItemId, quantityMilli, ...readPlacement(formData) });
  });
}

export async function addFreeLineAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId, t) => {
    const label = String(formData.get("label") ?? "").trim();
    const unit = String(formData.get("unit") ?? "").trim();
    if (!label || !unit) return { error: t("missingLabelOrUnit") };
    const quantityMilli = optionalDecimal(formData, "quantity", 3);
    if (!quantityMilli) return { error: t("invalidQuantity") };
    const unitPriceCents = optionalDecimal(formData, "unitPrice", 2);
    if (unitPriceCents === undefined || unitPriceCents === null) return { error: t("invalidPrice") };
    const vatRateBasisPoints = optionalDecimal(formData, "vatRate", 2);
    if (vatRateBasisPoints === null) return { error: t("invalidVatRate") };
    await addQuoteLine(organizationId, quoteId, {
      label,
      unit,
      description: String(formData.get("description") ?? ""),
      quantityMilli,
      unitPriceCents,
      vatRateBasisPoints,
      ...readPlacement(formData),
    });
  });
}

export async function updateLineAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, _quoteId, t) => {
    const lineId = String(formData.get("lineId") ?? "");
    if (!isValidId(lineId)) return { error: t("quoteNotFound") };
    const quantityMilli = optionalDecimal(formData, "quantity", 3);
    if (!quantityMilli) return { error: t("invalidQuantity") };
    const unitPriceCents = optionalDecimal(formData, "unitPrice", 2);
    if (unitPriceCents === null) return { error: t("invalidPrice") };
    const discountBasisPoints = optionalDecimal(formData, "discount", 2);
    if (discountBasisPoints === null || (discountBasisPoints ?? 0) > 10000) return { error: t("invalidDiscount") };
    const vatRateBasisPoints = optionalDecimal(formData, "vatRate", 2);
    if (vatRateBasisPoints === null) return { error: t("invalidVatRate") };
    await updateQuoteLine(organizationId, lineId, {
      label: String(formData.get("label") ?? ""),
      description: String(formData.get("description") ?? ""),
      quantityMilli,
      unitPriceCents,
      discountBasisPoints: discountBasisPoints ?? 0,
      vatRateBasisPoints,
      ...readPlacement(formData),
    });
  });
}

export async function removeLineAction(formData: FormData): Promise<void> {
  await run(formData, async (organizationId) => {
    const lineId = String(formData.get("lineId") ?? "");
    if (!isValidId(lineId)) return {};
    await removeQuoteLine(organizationId, lineId);
  });
}

export async function setGlobalDiscountAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId, t) => {
    const kind = String(formData.get("kind") ?? "none");
    let discount: GlobalDiscountInput = { kind: "none" };
    if (kind === "percent" || kind === "amount") {
      const value = optionalDecimal(formData, "value", 2);
      if (value === undefined || value === null || (kind === "percent" && value > 10000)) return { error: t("invalidDiscount") };
      discount = kind === "percent" ? { kind, basisPoints: value } : { kind, cents: value };
    }
    await setQuoteGlobalDiscount(organizationId, quoteId, discount);
  });
}

export async function sendQuoteAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId) => {
    await sendQuote({ organizationId, quoteId });
  });
}

// DEV-01 / ONB-02 — nouvelle version d'un devis envoyé.
export async function reviseQuoteAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId) => {
    await reviseQuote(organizationId, quoteId);
  });
}

// --- Lot 31a (FAC-01, FAC-07, JUR-08, HUB-21 ; décisions D2 à D5) ---

export async function addSectionAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId, t) => {
    const title = String(formData.get("title") ?? "").trim();
    if (!title || title.length > 120) return { error: t("invalidSectionTitle") };
    await addQuoteSection(organizationId, quoteId, title);
  });
}

export async function renameSectionAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, _quoteId, t) => {
    const sectionId = String(formData.get("sectionId") ?? "");
    if (!isValidId(sectionId)) return { error: t("sectionNotFound") };
    const title = String(formData.get("title") ?? "").trim();
    if (!title || title.length > 120) return { error: t("invalidSectionTitle") };
    await renameQuoteSection(organizationId, sectionId, title);
  });
}

export async function removeSectionAction(formData: FormData): Promise<void> {
  await run(formData, async (organizationId) => {
    const sectionId = String(formData.get("sectionId") ?? "");
    if (!isValidId(sectionId)) return {};
    await removeQuoteSection(organizationId, sectionId);
  });
}

export async function setAdvanceKindAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId) => {
    const value = String(formData.get("advanceKind") ?? "");
    await setQuoteAdvanceKind(organizationId, quoteId, value === "deposit" || value === "earnest" ? value : null);
  });
}

// La planner coche pour le client (choix fait au téléphone) : au nom des clients de l'événement.
export async function chooseOptionsAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId, t) => {
    const chosenLineIds = formData.getAll("optionLineIds").map(String);
    if (!chosenLineIds.every(isValidId)) return { error: t("quoteNotFound") };
    const quote = await getQuote(organizationId, quoteId);
    const event = await getEvent(organizationId, quote.eventId);
    const chosenBy = event?.clients.map((client) => client.firstName).join(" & ") || t("noClient");
    await chooseQuoteOptions({ organizationId, quoteId, chosenLineIds, chosenBy, byKind: "planner" });
  });
}

// HUB-21 (D3) : le devis devient modèle, ou remplace le contenu d'un modèle (version + 1).
export async function saveAsTemplateAction(_prevState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  return run(formData, async (organizationId, quoteId, t) => {
    const templateId = String(formData.get("templateId") ?? "");
    if (isValidId(templateId)) {
      await replaceQuoteTemplateFromQuote({ organizationId, templateId, quoteId });
      return;
    }
    const name = String(formData.get("name") ?? "").trim();
    if (!name || name.length > 120) return { error: t("invalidTemplateName") };
    const quote = await getQuote(organizationId, quoteId);
    const event = await getEvent(organizationId, quote.eventId);
    await saveQuoteAsTemplate({ organizationId, quoteId, name, eventTypeId: event?.eventTypeId ?? null });
  });
}
