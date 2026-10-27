"use server";

import { redirect } from "next/navigation";
import { createQuote, EventNotFoundError } from "@/modules/quotes/service";
import { isValidId } from "./module-access";
import { authorizedPlanner } from "./planner-access";

// DEV-01 — « Composition depuis la fiche d'un événement » : le devis est
// créé (et numéroté) depuis la fiche, puis s'ouvre pour être composé.
export async function createQuoteAction(formData: FormData): Promise<void> {
  const planner = await authorizedPlanner();
  if (!planner) return;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return;
  let quoteId: string;
  try {
    quoteId = (await createQuote({ organizationId: planner.organizationId, eventId, createdByUserId: planner.userId })).id;
  } catch (error) {
    if (error instanceof EventNotFoundError) return;
    throw error;
  }
  redirect(`/devis/${quoteId}`);
}
