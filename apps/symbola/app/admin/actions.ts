"use server";

import { revalidatePath } from "next/cache";
import { createAppConnection } from "@symbola/db/client";
import { createOrganizationWithInvitation, setModuleEnabled, type ModuleKey } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/require-admin";

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
    return { error: "Le nom de l'organisation et l'e-mail du titulaire sont obligatoires." };
  }

  const { sql, db } = createAppConnection();
  try {
    await createOrganizationWithInvitation(db, {
      adminUserId: admin.userId,
      name,
      language,
      siret,
      titulaireEmail,
    });
  } finally {
    await sql.end();
  }

  return { success: true };
}

export async function toggleModuleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const moduleKey = String(formData.get("moduleKey") ?? "") as ModuleKey;
  const enabled = formData.get("enabled") === "true";

  const { sql, db } = createAppConnection();
  try {
    await setModuleEnabled(db, { adminUserId: admin.userId, organizationId, moduleKey, enabled });
  } finally {
    await sql.end();
  }

  revalidatePath("/admin");
}
