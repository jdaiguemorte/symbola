"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { createOrganizationWithInvitation, setModuleEnabled, type ModuleKey } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/guards";

export type CreateOrganizationFormState = { error?: string; success?: boolean };

export async function createOrganizationAction(
  _prevState: CreateOrganizationFormState,
  formData: FormData,
): Promise<CreateOrganizationFormState> {
  const admin = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const language = formData.get("language") === "en" ? "en" : "fr";
  const siret = String(formData.get("siret") ?? "").trim() || null;
  const titulaireEmail = String(formData.get("titulaireEmail") ?? "").trim();

  if (!name || !titulaireEmail) {
    const t = await getTranslations("AdminOrganizationForm");
    return { error: t("missingFields") };
  }

  const db = appDatabase();
  await createOrganizationWithInvitation(db, {
    adminUserId: admin.userId,
    name,
    language,
    siret,
    titulaireEmail,
  });

  return { success: true };
}

export async function toggleModuleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const moduleKey = String(formData.get("moduleKey") ?? "") as ModuleKey;
  const enabled = formData.get("enabled") === "true";

  const db = appDatabase();
  await setModuleEnabled(db, { adminUserId: admin.userId, organizationId, moduleKey, enabled });

  revalidatePath("/admin/organisations");
}
