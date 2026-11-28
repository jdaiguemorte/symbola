"use server";

// Lot 53 (HUB-24 ; D8) — le terme qui désigne les clients d'un type d'évènement, par langue, avec son
// genre et son nombre. Validé par le module Évènements (Zod) ; un type d'une autre organisation
// n'existe pas pour celle-ci (RLS).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { PlanningInputError, setEventTypeClientTerm } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled } from "../../module-access";

export type ClientTermFormState = { error?: string; success?: boolean };

export async function saveClientTermAction(_prev: ClientTermFormState, formData: FormData): Promise<ClientTermFormState> {
  const auth = await requirePlanner();
  const t = await getTranslations("ClientTerms");
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("invalid") };
  const reset = formData.get("reset") === "true";
  try {
    await setEventTypeClientTerm(auth.user.organizationId, {
      eventTypeId: String(formData.get("eventTypeId") ?? ""),
      locale: String(formData.get("locale") ?? ""),
      term: reset ? null : { term: String(formData.get("term") ?? ""), gender: String(formData.get("gender") ?? ""), number: String(formData.get("number") ?? "") },
    });
  } catch (error) {
    if (error instanceof PlanningInputError) return { error: t("invalid") };
    throw error;
  }
  revalidatePath("/events/parametres/types");
  return { success: true };
}
