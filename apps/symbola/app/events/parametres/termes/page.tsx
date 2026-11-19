// Lot 53 (HUB-24 ; D8 ; ADR 0095) — « Termes des clients » : pour chaque type d'évènement, le terme qui
// désigne les clients, par langue, avec son genre et son nombre ; sans réglage, le terme du vocabulaire
// du type (ADR 0045).
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { listEventTypeVocabulary, suggestedClientTerms } from "@/modules/events/service";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isEventsModuleEnabled } from "../../module-access";
import { ClientTermForm } from "./client-term-form";

export default async function ClientTermsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("ClientTerms");
  if (!(await isEventsModuleEnabled(organizationId))) {
    const tEvents = await getTranslations("Events");
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{tEvents("moduleUnavailable")}</p>
      </main>
    );
  }
  const tHelp = await getTranslations("Help");
  await ensureEventTypes(organizationId, (await getLocale()) as Locale);
  const types = await listEventTypeVocabulary(organizationId);
  const suggestions = { fr: suggestedClientTerms("fr"), en: suggestedClientTerms("en") };
  const fallback = (audience: "couple" | "clients", locale: "fr" | "en") => suggestions[locale].find((term) => term.key === audience) ?? suggestions[locale][0]!;
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("clientTerms.title")} body={tHelp("clientTerms.body")} />
      <p>{t("intro")}</p>
      {types.map((type) => (
        <section key={type.eventTypeId} className="card" aria-labelledby={`type-${type.eventTypeId}`}>
          <h2 id={`type-${type.eventTypeId}`}>{type.label}</h2>
          {(["fr", "en"] as const).map((locale) => (
            <ClientTermForm key={locale} eventTypeId={type.eventTypeId} typeLabel={type.label} locale={locale} current={type.terms[locale]} fallback={fallback(type.audience, locale)} suggestions={suggestions[locale]} />
          ))}
        </section>
      ))}
    </main>
  );
}
