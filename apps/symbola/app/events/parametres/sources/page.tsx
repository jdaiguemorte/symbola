// Lot 13 (HUB-16) — rubrique « Sources et motifs » des Paramètres :
// sources de prospects (EVT-07) et motifs de perte (EVT-02).
import { getTranslations } from "next-intl/server";
import { listLossReasons, listProspectSources } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled } from "../../module-access";
import { ProspectSourceForm } from "../prospect-source-form";
import { LossReasonForm } from "../loss-reason-form";
import { LoadStarterListsForm } from "../starter-lists-form";

export default async function SourcesSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const [sources, reasons] = await Promise.all([listProspectSources(organizationId), listLossReasons(organizationId)]);

  return (
    <main>
      <h1>{t("sourcesReasonsTitle")}</h1>
      {sources.length === 0 || reasons.length === 0 ? (
        <section aria-labelledby="starter-lists-title" className="card">
          <h2 id="starter-lists-title">{t("starterListsTitle")}</h2>
          <p>{t("starterListsIntro")}</p>
          <LoadStarterListsForm />
        </section>
      ) : null}

      <h2>{t("sourcesTitle")}</h2>
      <p>{t("sourcesIntro")}</p>
      <ul className="chip-list" aria-label={t("sourcesTitle")}>
        {sources.map((source) => (
          <li key={source.id}>{source.label}</li>
        ))}
      </ul>
      <ProspectSourceForm />

      <h2>{t("lossReasonsTitle")}</h2>
      <p>{t("lossReasonsIntro")}</p>
      <ul className="chip-list" aria-label={t("lossReasonsTitle")}>
        {reasons.map((reason) => (
          <li key={reason.id}>
            {reason.label}
            {reason.isFreeText ? ` (${t("freeTextTag")})` : ""}
          </li>
        ))}
      </ul>
      <LossReasonForm />

    </main>
  );
}
