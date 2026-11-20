"use server";

// Lot 35c (RGP-11 ; décision D8 ; ADR 0100) — fermer et rouvrir l'espace : la Propriétaire, dans une
// session ouverte avec la double authentification, le nom de l'espace écrit pour confirmer (UX-07).
// Contrôles côté serveur (le service les refait).
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { requireOwner } from "@/lib/guards";
import {
  closeOrganization,
  OrganizationAlreadyClosedError,
  OrganizationClosureConfirmationError,
  OrganizationClosureForbiddenError,
  OrganizationClosureMfaRequiredError,
  OrganizationNotReopenableError,
  reopenOrganization,
} from "@/modules/hub/service";

export type ClosureState = { error?: string; message?: string };

function refusal(error: unknown, t: Awaited<ReturnType<typeof getTranslations>>): ClosureState | null {
  if (error instanceof OrganizationClosureForbiddenError) return { error: t("forbidden") };
  if (error instanceof OrganizationClosureMfaRequiredError) return { error: t("mfaRequired") };
  if (error instanceof OrganizationClosureConfirmationError) return { error: t("confirmationMismatch") };
  if (error instanceof OrganizationAlreadyClosedError) return { error: t("alreadyClosed") };
  if (error instanceof OrganizationNotReopenableError) return { error: t("notReopenable") };
  return null;
}

export async function closeOrganizationAction(_previous: ClosureState, formData: FormData): Promise<ClosureState> {
  const t = await getTranslations("OrganizationClosure");
  const owner = await requireOwner({ allowClosed: true, allowReadOnly: true });
  if (!owner) return { error: t("forbidden") };
  const confirmation = z.string().max(300).safeParse(formData.get("confirmation"));
  if (!confirmation.success) return { error: t("confirmationMismatch") };
  try {
    const closure = await closeOrganization(appDatabase(), {
      organizationId: owner.user.organizationId,
      userId: owner.user.id,
      mfaVerified: owner.user.mfaEnabled,
      confirmation: confirmation.data,
    });
    revalidatePath("/", "layout");
    return { message: t("closed", { date: formatDateTime(closure.deletionDueAt, (await getLocale()) as Locale) }) };
  } catch (error) {
    const refused = refusal(error, t);
    if (refused) return refused;
    throw error;
  }
}

export async function reopenOrganizationAction(_previous: ClosureState, _formData: FormData): Promise<ClosureState> {
  const t = await getTranslations("OrganizationClosure");
  const owner = await requireOwner({ allowClosed: true, allowReadOnly: true });
  if (!owner) return { error: t("forbidden") };
  try {
    await reopenOrganization(appDatabase(), { organizationId: owner.user.organizationId, userId: owner.user.id, mfaVerified: owner.user.mfaEnabled });
    revalidatePath("/", "layout");
    return { message: t("reopened") };
  } catch (error) {
    const refused = refusal(error, t);
    if (refused) return refused;
    throw error;
  }
}
