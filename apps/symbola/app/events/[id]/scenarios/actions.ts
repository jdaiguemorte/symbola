"use server";

// Lot 47 (BUD-05 ; D5 ; ADR 0085) — scénarios d'options d'un évènement : créer, retirer, choisir au
// plus un prestataire consulté par poste, montrer un scénario au client. Session, organisation et
// module vérifiés ; le service revérifie le poste et le prestataire (même évènement).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createVendorScenario, removeVendorScenario, setVendorScenarioChoice, showVendorScenarioToClients, VendorBriefInvalidError, VendorCandidateNotFoundError, EventNotFoundError } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export type ScenarioState = { error?: string; success?: boolean };

async function authorize() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId };
}

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function createScenarioAction(_prev: ScenarioState, formData: FormData): Promise<ScenarioState> {
  const t = await getTranslations("VendorCoordination");
  const user = await authorize();
  const eventId = field(formData, "eventId");
  if (!user || !isValidId(eventId)) return { error: t("errors.unauthorized") };
  try {
    await createVendorScenario(user.organizationId, eventId, field(formData, "name"));
  } catch (error) {
    if (error instanceof VendorBriefInvalidError) return { error: t("errors.scenarioName") };
    if (error instanceof EventNotFoundError) return { error: t("errors.unauthorized") };
    throw error;
  }
  revalidatePath(`/events/${eventId}/scenarios`);
  return { success: true };
}

export async function setScenarioChoiceAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const eventId = field(formData, "eventId");
  const scenarioId = field(formData, "scenarioId");
  const slotId = field(formData, "vendorSlotId");
  const candidateId = field(formData, "candidateId");
  if (!user || !isValidId(eventId) || !isValidId(scenarioId) || !isValidId(slotId)) return;
  try {
    await setVendorScenarioChoice(user.organizationId, scenarioId, slotId, isValidId(candidateId) ? candidateId : null);
  } catch (error) {
    if (!(error instanceof VendorCandidateNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}/scenarios`);
}

export async function removeScenarioAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const eventId = field(formData, "eventId");
  const scenarioId = field(formData, "scenarioId");
  if (!user || !isValidId(eventId) || !isValidId(scenarioId)) return;
  await removeVendorScenario(user.organizationId, scenarioId);
  revalidatePath(`/events/${eventId}/scenarios`);
}

export async function showScenarioAction(formData: FormData): Promise<void> {
  const user = await authorize();
  const eventId = field(formData, "eventId");
  const scenarioId = field(formData, "scenarioId");
  if (!user || !isValidId(eventId) || !isValidId(scenarioId)) return;
  try {
    await showVendorScenarioToClients(user.organizationId, scenarioId);
  } catch (error) {
    if (!(error instanceof VendorCandidateNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}/scenarios`);
}
