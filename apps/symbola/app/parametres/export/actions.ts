"use server";

// Lot 35a (HUB-13 ; décisions D4 et D5) — la Propriétaire demande l'export complet des données de
// son organisation : préparé en arrière-plan, un seul à la fois ; débit limité (chaque demande
// prépare une archive de toutes les données). Contrôles côté serveur : session, organisation,
// rôle (le service le vérifie aussi).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { requireOwner } from "@/lib/guards";
import { checkRateLimit, longestWait, rateLimitMessage } from "@/lib/rate-limit";
import { OrganizationExportForbiddenError, requestOrganizationExport } from "@/modules/hub/service";

export type RequestExportState = { error?: string; message?: string };

export async function requestOrganizationExportAction(_previous: RequestExportState, _formData: FormData): Promise<RequestExportState> {
  const t = await getTranslations("OrganizationExport");
  const owner = await requireOwner({ allowClosed: true, allowReadOnly: true });
  if (!owner) return { error: t("forbidden") };
  const organizationId = owner.user.organizationId;
  const wait = longestWait(await checkRateLimit("organizationExport", { account: organizationId }));
  if (wait !== null) return { error: await rateLimitMessage(wait) };
  try {
    const result = await requestOrganizationExport(appDatabase(), { organizationId, userId: owner.user.id });
    revalidatePath("/parametres/export");
    return { message: result.outcome === "requested" ? t("requested") : t("alreadyActive") };
  } catch (error) {
    if (error instanceof OrganizationExportForbiddenError) return { error: t("forbidden") };
    throw error;
  }
}
