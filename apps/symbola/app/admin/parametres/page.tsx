import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { getPlatformSettings } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/require-admin";
import { PlatformSettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const t = await getTranslations("AdminSettings");

  const { sql, db } = createAppConnection();
  let settings;
  try {
    settings = await getPlatformSettings(db);
  } finally {
    await sql.end();
  }

  return (
    <main>
      <h1>{t("title")}</h1>
      <PlatformSettingsForm
        franchiseThresholdServicesCents={settings.franchiseThresholdServicesCents}
        franchiseThresholdGoodsCents={settings.franchiseThresholdGoodsCents}
      />
    </main>
  );
}
