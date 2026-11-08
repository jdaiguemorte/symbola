import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { appDatabase } from "@symbola/db/client";
import { getPlatformSettings } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/guards";
import { PlatformSettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const t = await getTranslations("AdminSettings");
  const tHelp = await getTranslations("Help");

  const db = appDatabase();
  const settings = await getPlatformSettings(db);

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("adminSettings.title")} body={tHelp("adminSettings.body")} />
      <PlatformSettingsForm
        franchiseThresholdServicesCents={settings.franchiseThresholdServicesCents}
        franchiseThresholdGoodsCents={settings.franchiseThresholdGoodsCents}
        importMaxMegabytes={Math.round(settings.importMaxBytes / (1024 * 1024))}
        importMaxRows={settings.importMaxRows}
        importDraftRetentionDays={settings.importDraftRetentionDays}
        importUndoRetentionDays={settings.importUndoRetentionDays}
        importMaxSheets={settings.importMaxSheets}
        privacyExportRetentionDays={settings.privacyExportRetentionDays}
      />
    </main>
  );
}
