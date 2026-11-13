"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createQuote, createQuoteFromTemplate, EventNotFoundError, QuoteTemplateNotFoundError, startQuotesTrial } from "@/modules/quotes/service";
import { isValidId } from "./module-access";
import { authorizedPlanner } from "./planner-access";

// DEV-01 — « Composition depuis la fiche d'un événement » : le devis est
// créé (et numéroté) depuis la fiche, puis s'ouvre pour être composé.
export async function createQuoteAction(formData: FormData): Promise<void> {
  const planner = await authorizedPlanner();
  if (!planner) return;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return;
  // Lot 31a (FAC-01, HUB-21, D3) : depuis un modèle, le devis en reprend tout le contenu.
  const templateId = String(formData.get("templateId") ?? "");
  let quoteId: string;
  try {
    const input = { organizationId: planner.organizationId, eventId, createdByUserId: planner.userId };
    quoteId = (isValidId(templateId) ? await createQuoteFromTemplate({ ...input, templateId }) : await createQuote(input)).id;
  } catch (error) {
    if (error instanceof EventNotFoundError || error instanceof QuoteTemplateNotFoundError) return;
    throw error;
  }
  redirect(`/devis/${quoteId}`);
}

// AIDE-02 — essai guidé : devis fictif (série DEMO) sur l'événement d'essai,
// prêt à être signé par le faux fournisseur et facturé, sans e-mail à un tiers.
export async function startQuotesTrialAction(formData: FormData): Promise<void> {
  const planner = await authorizedPlanner();
  if (!planner) return;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return;
  let quoteId: string;
  try {
    const locale = (await getLocale()) === "en" ? "en" : "fr";
    quoteId = (await startQuotesTrial({ organizationId: planner.organizationId, eventId, createdByUserId: planner.userId, locale })).id;
  } catch (error) {
    if (error instanceof EventNotFoundError) return;
    throw error;
  }
  redirect(`/devis/${quoteId}`);
}
