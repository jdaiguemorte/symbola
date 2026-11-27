"use server";

// Lot 67e (HUB-14, PRE-02, BUD-04 ; recette du 24/11/2026, R07) — « Reprendre les prestataires
// retenus (PDF) » depuis l'onglet « Budget et prestataires » : aperçu, puis écriture. Session,
// organisation et modules contrôlés ici ; l'évènement, les fiches et les lignes choisies le sont dans
// le service (SEC-12, SEC-13).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { EventNotFoundError } from "@/modules/events/service";
import { isModuleEnabled } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { importEventVendors, type EventVendorsImportResult } from "@/lib/vendors/event-vendors-import";
import type { EventVendorsImportChoice } from "@/lib/vendors/event-vendors-import-rules";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { taskListViewer } from "@/lib/event-visibility";
import { markTakeoverPdfStepDone } from "@/lib/takeover/flow";

export type EventVendorsImportState = { error?: string; result?: EventVendorsImportResult };

const MAX_BYTES = 1024 * 1024;

export async function importEventVendorsAction(_prev: EventVendorsImportState, formData: FormData): Promise<EventVendorsImportState> {
  const t = await getTranslations("EventVendorsImport");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId)) || !(await isModuleEnabled(appDatabase(), organizationId, "vendors"))) return { error: t("moduleUnavailable") };
  const eventId = String(formData.get("eventId") ?? "");
  const file = formData.get("file");
  if (!isValidId(eventId) || !(file instanceof File) || file.size === 0) return { error: t("fileMissing") };
  if (file.size > MAX_BYTES) return { error: t("rejected.too_large") };
  // Choix par ligne : « vendor-<rang> » (fiche du carnet ou « new »), « slot-<rang> » (ligne du
  // budget ou « new »), « skip » (rangs écartés).
  const choices: Record<number, Partial<EventVendorsImportChoice>> = {};
  for (const [key, value] of formData.entries()) {
    const match = /^(vendor|slot)-(\d{1,3})$/.exec(key);
    if (!match || typeof value !== "string" || !(value === "new" || isValidId(value))) continue;
    const line = Number(match[2]);
    choices[line] = { ...choices[line], [match[1] as "vendor" | "slot"]: value };
  }
  for (const value of formData.getAll("skip")) {
    const line = Number(value);
    if (Number.isInteger(line) && line > 0) choices[line] = { ...choices[line], skip: true };
  }
  const apply = formData.get("intent") === "apply" ? { confirmHeader: formData.get("confirmHeader") === "1" } : null;
  try {
    const result = await importEventVendors({ organizationId, userId: auth.user.id, eventId, bytes: new Uint8Array(await file.arrayBuffer()), choices, apply });
    if (result.status === "applied") {
      revalidatePath(`/events/${eventId}`);
      // Lot 71b (HUB-14) : ouvert depuis la page de reprise, il coche sa ligne (provisoire, paquet 71e).
      const takeoverId = String(formData.get("takeoverId") ?? "");
      if (isValidId(takeoverId)) {
        const user = { id: auth.user.id, role: auth.user.role, organizationId };
        if (await markTakeoverPdfStepDone({ organizationId, userId: auth.user.id, viewer: await taskListViewer({ user }) }, { takeoverId, kind: "event_vendors", eventId })) revalidatePath(`/reprise/${takeoverId}`);
      }
    }
    return { result };
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }
}
