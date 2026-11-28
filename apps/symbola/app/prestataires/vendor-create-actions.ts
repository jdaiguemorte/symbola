"use server";

// Lot 73d (PRE-01, PRE-02, UX-10, HUB-19, SEC-10 à SEC-13, SEC-18 ; spécification du lot 73, § 5.4,
// critères 1 à 5 ; V10, C-46) — les actions de la fenêtre unique de création d'un prestataire, la même au
// carnet, depuis un poste du budget, et pour « Modifier » sur la fiche. Chaque action revérifie la session,
// l'organisation et le module Prestataires (et, depuis un poste, le module Évènements et l'équipe d'une
// Planner restreinte) ; les champs passent par le schéma partagé avec l'écran (lib/forms) et reviennent,
// en erreur, champ par champ. Un poste ou une fiche hors de portée répond « introuvable ».
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { formatAmount, parisToday, type Locale } from "@symbola/i18n";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { unexpectedActionError } from "@/lib/action-errors";
import { taskListViewer } from "@/lib/event-visibility";
import { discardMyFormDraft } from "@/lib/form-drafts";
import { fieldErrors, formValues } from "@/lib/forms/field-validation";
import { chosenTypeIds, vendorCreateFieldsSchema } from "@/lib/forms/vendor-create-fields";
import { createVendorRecord, slotCreationContext } from "@/lib/vendors/vendor-sheet";
import type { AdditionAccess } from "@/lib/vendors/add-to-event";
import {
  InvalidVendorFieldValueError,
  InvalidVendorLinkError,
  InvalidVendorRatingError,
  listVendorFamilies,
  listVendorImportCandidates,
  listVendorTagGroups,
  listVendorTags,
  listVendorTypes,
  updateVendor,
  VendorNotFoundError,
  VendorTagTierConflictError,
  VendorTypeNotFoundError,
  type SaveVendorResult,
  type VendorFamily,
  type VendorTag,
  type VendorTagGroup,
  type VendorType,
} from "@/modules/vendors/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "./module-access";
import { additionFeedback } from "./add-to-event-model";
import { similarVendor, type SimilarVendor } from "./vendor-create-similar";
import { vendorCreateLabels } from "./vendor-create-labels";
import type { VendorCreateLabels } from "./vendor-create-model";
import { readVendorInput } from "./vendor-input";

async function access(options: { slot: boolean }): Promise<AdditionAccess | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  const organizationId = auth.user.organizationId;
  if (!(await isVendorsModuleEnabled(organizationId))) return null;
  if (options.slot && !(await isEventsModuleEnabled(organizationId))) return null;
  const viewer = await taskListViewer({ user: { id: auth.user.id, role: auth.user.role, organizationId } });
  return { organizationId, userId: auth.user.id, viewer, budgetEnabled: await isBudgetModuleEnabled(organizationId) };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export type VendorCreateState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  // Modification enregistrée (la fenêtre se ferme) ; at distingue deux enregistrements de suite.
  saved?: { at: number; notice?: string };
  // Depuis un poste : la fiche est créée et ajoutée ; le message de retour et son « Annuler ».
  added?: { title: string; detail: string; undoId: string; eventId: string; slotId: string };
  // Depuis un poste : la fiche est créée, l'ajout attend une réponse (P12, ou le seuil du budget) ; la
  // fenêtre la demande, puis ajoute la fiche par « Ajouter à un mariage… ».
  pending?: { vendorId: string; eventId: string; slotId: string; kind: "choice"; retainedName: string } | { vendorId: string; eventId: string; slotId: string; kind: "confirm"; message: string; mode: "compare" | "retain" };
};

function geocodingNotice(t: Awaited<ReturnType<typeof getTranslations<"VendorBook">>>, result: SaveVendorResult): string | undefined {
  if (result.geocoding === "placed") return t("geocodingPlaced");
  if (result.geocoding === "not_found") return t("geocodingNotFound");
  return undefined;
}

async function serviceError(error: unknown): Promise<VendorCreateState> {
  const t = await getTranslations("VendorBook");
  if (error instanceof InvalidVendorFieldValueError) return { error: t("invalidFieldValue") };
  if (error instanceof VendorTagTierConflictError) return { error: t("tagTierConflict") };
  if (error instanceof InvalidVendorLinkError) return error.field === "siret" ? { fieldErrors: { siret: t("invalidSiret") } } : { fieldErrors: { website: t("invalidWebsite") } };
  if (error instanceof InvalidVendorRatingError) return { error: t("invalidRating") };
  if (error instanceof VendorNotFoundError || error instanceof VendorTypeNotFoundError) return { error: t("notFound") };
  return { error: await unexpectedActionError(error) };
}

// « Créer la fiche », « Créer et ajouter » et « Enregistrer » (Modifier).
export async function saveVendorRecordAction(_previous: VendorCreateState, formData: FormData): Promise<VendorCreateState> {
  const t = await getTranslations("VendorBook");
  const tErrors = await getTranslations("VendorCreate.errors");
  const vendorId = text(formData, "vendorId");
  const editing = isValidId(vendorId);
  const eventId = text(formData, "eventId");
  const slotId = text(formData, "slotId");
  const fromSlot = !editing && (eventId !== "" || slotId !== "");
  const allowed = await access({ slot: fromSlot });
  if (!allowed) return { error: t("unauthorized") };
  if (fromSlot && (!isValidId(eventId) || !isValidId(slotId))) return { error: t("notFound") };
  const errors = fieldErrors(vendorCreateFieldsSchema({ fromSlot, edit: editing }), formValues(formData));
  type ErrorKey = Parameters<typeof tErrors>[0];
  if (errors.length > 0) return { fieldErrors: Object.fromEntries(errors.map((entry) => [entry.field, tErrors(entry.key as ErrorKey)])) };
  const today = parisToday(new Date());
  let input;
  try {
    input = await readVendorInput(allowed.organizationId, formData, editing ? undefined : chosenTypeIds(text(formData, "typeId")));
  } catch (error) {
    return serviceError(error);
  }

  if (editing) {
    let result: SaveVendorResult;
    try {
      result = await updateVendor(allowed.organizationId, vendorId, input);
    } catch (error) {
      return serviceError(error);
    }
    await discardMyFormDraft(`vendor:${vendorId}`);
    revalidatePath("/prestataires");
    revalidatePath(`/prestataires/${vendorId}`);
    const notice = geocodingNotice(t, result);
    return { saved: { at: Date.now(), ...(notice ? { notice } : {}) } };
  }

  const mode = text(formData, "mode") === "retain" ? "retain" : "compare";
  let outcome;
  try {
    outcome = await createVendorRecord(allowed, { vendor: input, ...(fromSlot ? { slot: { eventId, slotId, mode, today } } : {}) });
  } catch (error) {
    return serviceError(error);
  }
  if (outcome.status === "not_found") return { error: t("notFound") };
  await discardMyFormDraft(fromSlot ? `vendor-new:${slotId}` : "vendor-new");
  revalidatePath("/prestataires");
  const created = outcome.result.vendor;
  if (outcome.status === "created") {
    // Au carnet (C-46, P-11) : la fiche s'ouvre ; sa mise sur la carte se dit en tête.
    const placement = outcome.result.geocoding === "placed" || outcome.result.geocoding === "not_found" ? `?placement=${outcome.result.geocoding}` : "";
    redirect(`/prestataires/${created.id}${placement}`);
  }
  revalidatePath(`/events/${eventId}`);
  if (outcome.status === "created_pending") {
    const addition = outcome.addition;
    if (addition.status === "choice_required") return { pending: { vendorId: created.id, eventId, slotId, kind: "choice", retainedName: addition.retainedName } };
    const locale: Locale = (await getLocale()) === "en" ? "en" : "fr";
    const tCandidates = await getTranslations("VendorCandidates");
    return {
      pending: {
        vendorId: created.id,
        eventId,
        slotId,
        kind: "confirm",
        mode,
        message: tCandidates("engagementAlert", { committed: formatAmount(addition.committedAfterCents, locale), over: formatAmount(addition.overThresholdCents, locale), percent: addition.thresholdPercent }),
      },
    };
  }
  const tAdd = await getTranslations("VendorAddition");
  type Key = Parameters<typeof tAdd>[0];
  const added = outcome.addition;
  const message = additionFeedback({ mode: added.mode, slotLabel: added.slotLabel, vendorNames: added.vendorNames, eventLabel: added.eventLabel, comparingCount: added.comparingCount, replacedName: added.replacedName });
  return {
    added: {
      title: tAdd(`feedback.${message.title.key}` as Key, message.title.values),
      detail: message.detail.map((part) => ("text" in part ? part.text : tAdd(`feedback.${part.key}` as Key, part.values))).join(" · "),
      undoId: added.undoId,
      eventId: added.eventId,
      slotId: added.slotId,
    },
  };
}

// Ce que la fenêtre propose : les métiers, familles et étiquettes du carnet ; depuis un poste, le poste, le
// mariage et le métier proposé d'après le poste (73a, P7).
export type VendorCreateOptions = {
  labels: VendorCreateLabels;
  types: VendorType[];
  families: VendorFamily[];
  tags: VendorTag[];
  tagGroups: VendorTagGroup[];
  slot: { eventId: string; slotId: string; slotLabel: string; eventLabel: string; proposedTypeId: string | null } | null;
};

export type LoadVendorCreateResult = { ok: true; options: VendorCreateOptions } | { ok: false; error: string };

export async function loadVendorCreateOptionsAction(input: unknown): Promise<LoadVendorCreateResult> {
  const t = await getTranslations("VendorBook");
  const parsed = z.object({ eventId: z.uuid(), slotId: z.uuid() }).partial().safeParse(input ?? {});
  const fromSlot = Boolean(parsed.success && parsed.data.eventId && parsed.data.slotId);
  const allowed = await access({ slot: fromSlot });
  if (!allowed) return { ok: false, error: t("unauthorized") };
  if (!parsed.success) return { ok: false, error: t("notFound") };
  const [labels, types, families, tags, tagGroups, slot] = await Promise.all([
    vendorCreateLabels(),
    listVendorTypes(allowed.organizationId),
    listVendorFamilies(allowed.organizationId),
    listVendorTags(allowed.organizationId),
    listVendorTagGroups(allowed.organizationId),
    fromSlot ? slotCreationContext(allowed, { eventId: parsed.data.eventId!, slotId: parsed.data.slotId!, today: parisToday(new Date()) }) : Promise.resolve(null),
  ]);
  if (fromSlot && !slot) return { ok: false, error: t("notFound") };
  return { ok: true, options: { labels, types, families, tags, tagGroups, slot } };
}

// Critère 4 : une fiche du carnet au nom proche, signalée sous le champ (son nom et sa ville, jamais plus).
export async function similarVendorAction(input: unknown): Promise<SimilarVendor | null> {
  const parsed = z.object({ name: z.string().max(200), exceptId: z.uuid().nullable().optional() }).safeParse(input);
  const allowed = await access({ slot: false });
  if (!allowed || !parsed.success) return null;
  const candidates = await listVendorImportCandidates(allowed.organizationId);
  return similarVendor(parsed.data.name, candidates, { exceptId: parsed.data.exceptId ?? null });
}
