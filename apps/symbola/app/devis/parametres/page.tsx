import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Banknote, CreditCard, Landmark, PenLine, Wallet, type LucideIcon } from "lucide-react";
import { isPreviousStarterInvoiceMentions, starterInvoiceMentions, starterLatePenalty, starterPaymentMethodKinds, starterProfessionalPaymentTerms } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { getQuoteSettings, listPaymentMethods } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { isQuotesModuleEnabled } from "../module-access";
import { setPaymentMethodAcceptedAction } from "./actions";
import { AddPaymentMethodForm, LoadStarterPaymentMethodsForm } from "./payment-method-forms";
import { QuoteSettingsForm } from "./quote-settings-form";

// Lot 21 (DEV-13) : l'icône d'un mode vient de sa correspondance avec un mode
// de départ (français ou anglais) ; un mode ajouté a une icône générique.
const PAYMENT_ICONS: Record<string, LucideIcon> = { bank_transfer: Landmark, card: CreditCard, cheque: PenLine, cash: Banknote };

function paymentIcon(label: string): LucideIcon {
  const key = label.trim().toLocaleLowerCase("fr");
  const kind = starterPaymentMethodKinds().find((candidate) => candidate.labels.some((known) => known.toLocaleLowerCase("fr") === key));
  return (kind && PAYMENT_ICONS[kind.key]) ?? Wallet;
}

export default async function QuoteSettingsPage() {
  const auth = await requirePlanner();
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

  const [settings, methods] = await Promise.all([getQuoteSettings(organizationId), listPaymentMethods(organizationId, { includeArchived: true })]);
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <ScreenHelp title={tHelp("quotesSettings.title")} body={tHelp("quotesSettings.body")} />
      <QuoteSettingsForm
        settings={settings}
        defaultMentions={starterInvoiceMentions(locale)}
        defaultProfessionalMentions={starterProfessionalPaymentTerms(locale)}
        rates={starterLatePenalty().rates.map((rate) => ({ key: rate.key, label: rate.label[locale] }))}
        previousStarterText={isPreviousStarterInvoiceMentions(settings.invoiceMentions)}
      />

      <section aria-labelledby="payment-methods-title">
        <h2 id="payment-methods-title">{t("paymentMethodsTitle")}</h2>
        <p className="muted">{t("paymentMethodsIntro")}</p>
        {methods.length === 0 ? (
          <>
            <p>{t("noPaymentMethods")}</p>
            <LoadStarterPaymentMethodsForm />
          </>
        ) : (
          <ul className="pay-grid">
            {methods.map((method) => {
              const Icon = paymentIcon(method.label);
              const accepted = !method.archived;
              return (
                <li key={method.id} className="pay-card" data-accepted={accepted ? "true" : "false"}>
                  <span className="pay-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="pay-text">
                    <span className="pay-name">{method.label}</span>
                    <span className="pay-state">{accepted ? t("paymentMethodAccepted") : t("paymentMethodNotAccepted")}</span>
                  </span>
                  <form action={setPaymentMethodAcceptedAction}>
                    <input type="hidden" name="paymentMethodId" value={method.id} />
                    <input type="hidden" name="accepted" value={accepted ? "false" : "true"} />
                    <button type="submit" role="switch" aria-checked={accepted} className="switch" aria-label={t("paymentMethodSwitch", { label: method.label })} />
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <AddPaymentMethodForm />
      </section>

      <p>
        {t("vatRegimeInProfile")} <Link href="/parametres">{t("organizationSettingsLink")}</Link>
      </p>
    </main>
  );
}
