"use server";

// Lot 71b (HUB-14, PAR-01 ; spécification du lot 71, § 5.2) — les boutons de la page de reprise. La
// reprise naît de la première action de la planner (R1) : ouvrir la page n'écrit rien. Toute entrée est
// validée (identifiants, sorte de ligne, intention) ; la reprise, le mariage et les imports sont
// contrôlés par le service, avec ce que voit la personne : une reprise d'une autre organisation donne la
// même réponse qu'une reprise inexistante (SEC-13).
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import type { EventClientInput } from "@symbola/contracts";
import { unexpectedActionError } from "@/lib/action-errors";
import { fieldErrors, formValues, translatedFieldErrors } from "@/lib/forms/field-validation";
import { takeoverEventFieldsSchema } from "@/lib/forms/takeover-event-fields";
import { abandonTakeoverImport, enterTakeoverEvent, startTakeoverStep, type TakeoverStepIntent } from "@/lib/takeover/flow";
import { listEventTypes } from "@/modules/events/service";
import { ContactNotFoundError, TakeoverDemoEventError, TakeoverNotFoundError } from "@/modules/hub/service";
import { parseStepKind, takeoverActorForAction, validId } from "./access";

const INTENTS: readonly TakeoverStepIntent[] = ["drop", "noFile", "dropAgain", "dropAnyway"];

export async function takeoverStepAction(formData: FormData): Promise<void> {
  const actor = await takeoverActorForAction();
  if (!actor) redirect("/reprise");
  const kind = parseStepKind(formData.get("kind"));
  const intent = INTENTS.find((value) => value === formData.get("intent")) ?? null;
  if (!kind || !intent) redirect("/reprise");
  const takeoverId = validId(formData.get("takeoverId"));
  const eventId = validId(formData.get("eventId"));
  let href: string;
  try {
    ({ href } = await startTakeoverStep(actor, { takeoverId, eventId, kind, intent }));
  } catch (error) {
    if (error instanceof TakeoverNotFoundError || error instanceof TakeoverDemoEventError) notFound();
    throw error;
  }
  revalidatePath("/reprise");
  redirect(href);
}

export async function abandonTakeoverImportAction(formData: FormData): Promise<void> {
  const actor = await takeoverActorForAction();
  const takeoverId = validId(formData.get("takeoverId"));
  const importId = validId(formData.get("importId"));
  if (!actor || !takeoverId || !importId) redirect("/reprise");
  await abandonTakeoverImport(actor, takeoverId, importId);
  revalidatePath(`/reprise/${takeoverId}`);
  revalidatePath("/import");
  redirect(`/reprise/${takeoverId}`);
}

export type TakeoverEventFormState = { error?: string; fieldErrors?: Record<string, string> };

// « Saisir les noms et la date » (ligne 2) : le mariage, Confirmé, d'origine « reprise », sans modèle de
// rétroplanning ; la reprise le reçoit (et naît ici si la page était neuve). Le client est un contact
// choisi, ou un nom saisi ; le type est le seul de l'espace, ou celui choisi.
export async function enterTakeoverEventAction(_prev: TakeoverEventFormState, formData: FormData): Promise<TakeoverEventFormState> {
  const t = await getTranslations("Events");
  const actor = await takeoverActorForAction();
  if (!actor) return { error: t("unauthenticated") };
  const invalid = fieldErrors(takeoverEventFieldsSchema, formValues(formData));
  if (invalid.length > 0) {
    const tValidation = await getTranslations("Validation");
    return { fieldErrors: translatedFieldErrors(invalid, (key) => tValidation(key)) };
  }
  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  const eventDate = String(formData.get("eventDate") ?? "").trim() || null;
  const eventTypes = await listEventTypes(actor.organizationId);
  const wantedType = String(formData.get("eventTypeId") ?? "").trim();
  const eventType = eventTypes.find((type) => type.id === wantedType) ?? (eventTypes.length === 1 ? eventTypes[0] : undefined);
  if (eventTypes.length > 1 && !eventType) return { error: t("missingEventType") };
  const contactId = validId(String(formData.get("contactId1") ?? "").trim());
  const firstName = String(formData.get("firstName1") ?? "").trim();
  const lastName = String(formData.get("lastName1") ?? "").trim();
  const clients: EventClientInput[] = contactId ? [{ contactId, firstName: "" }] : firstName ? [{ firstName, lastName: lastName || null }] : [];

  let takeoverId: string;
  try {
    ({ takeoverId } = await enterTakeoverEvent(actor, {
      takeoverId: validId(formData.get("takeoverId")),
      name,
      eventDate,
      clients,
      eventTypeId: eventType?.id ?? null,
      locale: (await getLocale()) === "en" ? "en" : "fr",
    }));
  } catch (error) {
    if (error instanceof TakeoverNotFoundError) notFound();
    if (error instanceof ContactNotFoundError) return { error: (await getTranslations("Contacts"))("notFound") };
    return { error: await unexpectedActionError(error) };
  }
  revalidatePath("/reprise");
  redirect(`/reprise/${takeoverId}?saisi=1`);
}
