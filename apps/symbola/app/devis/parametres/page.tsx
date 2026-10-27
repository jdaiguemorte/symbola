import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { getQuoteSettings } from "@/modules/quotes/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isQuotesModuleEnabled } from "../module-access";
import { QuoteSettingsForm } from "./quote-settings-form";

export default async function QuoteSettingsPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");

  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const settings = await getQuoteSettings(organizationId);
  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <HelpButton title={tHelp("quotesSettings.title")} body={tHelp("quotesSettings.body")} />
      <QuoteSettingsForm settings={settings} />
      <p>
        {t("vatRegimeInProfile")} <Link href="/parametres">{t("organizationSettingsLink")}</Link>
      </p>
    </main>
  );
}
