"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { setPlatformSettings } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/require-admin";

export type PlatformSettingsFormState = { success?: boolean; error?: string };

// Le corps d'une Server Action est plafonné à 21 Mo (next.config.ts) : une
// limite d'import plus haute ne pourrait jamais être atteinte.
const IMPORT_MAX_MEGABYTES_CEILING = 20;

function positiveInteger(raw: FormDataEntryValue | null): number | null {
  const value = Number(String(raw ?? "").trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function savePlatformSettingsAction(
  _prevState: PlatformSettingsFormState,
  formData: FormData,
): Promise<PlatformSettingsFormState> {
  const admin = await requireAdmin();
  const t = await getTranslations("AdminSettings");

  const servicesRaw = String(formData.get("franchiseThresholdServices") ?? "").trim();
  const goodsRaw = String(formData.get("franchiseThresholdGoods") ?? "").trim();
  // Saisie en euros, stockage en centimes entiers (CLAUDE.md §5).
  const franchiseThresholdServicesCents = servicesRaw ? Math.round(Number(servicesRaw) * 100) : null;
  const franchiseThresholdGoodsCents = goodsRaw ? Math.round(Number(goodsRaw) * 100) : null;

  const importMaxMegabytes = positiveInteger(formData.get("importMaxMegabytes"));
  const importMaxRows = positiveInteger(formData.get("importMaxRows"));
  const importDraftRetentionDays = positiveInteger(formData.get("importDraftRetentionDays"));
  if (!importMaxMegabytes || importMaxMegabytes > IMPORT_MAX_MEGABYTES_CEILING || !importMaxRows || !importDraftRetentionDays) {
    return { error: t("invalidImportLimits") };
  }

  const { sql, db } = createAppConnection();
  try {
    await setPlatformSettings(db, {
      adminUserId: admin.userId,
      franchiseThresholdServicesCents,
      franchiseThresholdGoodsCents,
      importMaxBytes: importMaxMegabytes * 1024 * 1024,
      importMaxRows,
      importDraftRetentionDays,
    });
  } finally {
    await sql.end();
  }

  revalidatePath("/admin/parametres");
  return { success: true };
}
