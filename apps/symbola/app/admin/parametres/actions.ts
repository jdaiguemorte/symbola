"use server";

import { revalidatePath } from "next/cache";
import { createAppConnection } from "@symbola/db/client";
import { setPlatformSettings } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/require-admin";

export type PlatformSettingsFormState = { success?: boolean };

export async function savePlatformSettingsAction(
  _prevState: PlatformSettingsFormState,
  formData: FormData,
): Promise<PlatformSettingsFormState> {
  const admin = await requireAdmin();

  const servicesRaw = String(formData.get("franchiseThresholdServices") ?? "").trim();
  const goodsRaw = String(formData.get("franchiseThresholdGoods") ?? "").trim();
  // Saisie en euros, stockage en centimes entiers (CLAUDE.md §5).
  const franchiseThresholdServicesCents = servicesRaw ? Math.round(Number(servicesRaw) * 100) : null;
  const franchiseThresholdGoodsCents = goodsRaw ? Math.round(Number(goodsRaw) * 100) : null;

  const { sql, db } = createAppConnection();
  try {
    await setPlatformSettings(db, {
      adminUserId: admin.userId,
      franchiseThresholdServicesCents,
      franchiseThresholdGoodsCents,
    });
  } finally {
    await sql.end();
  }

  revalidatePath("/admin/parametres");
  return { success: true };
}
