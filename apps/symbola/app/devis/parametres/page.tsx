import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { starterInvoiceMentions } from "@symbola/starter-templates";
import { HelpButton } from "@symbola/ui";
import { getQuoteSettings, listPaymentMethods } from "@/modules/quotes/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isQuotesModuleEnabled } from "../module-access";
import { archivePaymentMethodAction } from "./actions";
import { AddPaymentMethodForm, LoadStarterPaymentMethodsForm } from "./payment-method-forms";
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

  const [settings, methods] = await Promise.all([getQuoteSettings(organizationId), listPaymentMethods(organizationId)]);
  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <HelpButton title={tHelp("quotesSettings.title")} body={tHelp("quotesSettings.body")} />
      <QuoteSettingsForm settings={settings} defaultMentions={starterInvoiceMentions((await getLocale()) === "en" ? "en" : "fr")} />

      <h2>{t("paymentMethodsTitle")}</h2>
      {methods.length === 0 ? (
        <>
          <p>{t("noPaymentMethods")}</p>
          <LoadStarterPaymentMethodsForm />
        </>
      ) : null}
      <ul>
        {methods.map((method) => (
          <li key={method.id}>
            {method.label}
            <form action={archivePaymentMethodAction}>
              <input type="hidden" name="paymentMethodId" value={method.id} />
              <button type="submit">{t("archivePaymentMethod", { label: method.label })}</button>
            </form>
          </li>
        ))}
      </ul>
      <AddPaymentMethodForm />

      <p>
        {t("vatRegimeInProfile")} <Link href="/parametres">{t("organizationSettingsLink")}</Link>
      </p>
    </main>
  );
}
