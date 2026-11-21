// Lot 44 (CRM-02 ; D9 ; ADR 0084) — Paramètres › Étapes du pipeline : la liste de l'organisation,
// copiée des données de départ, que la titulaire renomme, complète, réordonne et réduit (une à dix).
// Une étape n'est qu'un repère à l'intérieur du statut Option : « Gagné » et « Perdu » n'en sont pas.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { listPipelineStages, PIPELINE_MAX_STAGES, PIPELINE_MIN_STAGES } from "@/modules/events/service";
import { requireOwner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isEventsModuleEnabled } from "../../module-access";
import { addStageAction } from "./actions";
import { StageList } from "./stage-list";

const REFUSALS = ["label", "too_many", "too_few", "not_found", "not_empty", "destination"] as const;

export default async function PipelineStagesSettingsPage({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const auth = await requireOwner();
  const t = await getTranslations("Pipeline.settings");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const stages = await listPipelineStages(organizationId, locale);
  const { refus } = await searchParams;
  const refusal = REFUSALS.find((reason) => reason === refus);

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("eventsPipelineStages.title")} body={tHelp("eventsPipelineStages.body")} />
      <p>{t("intro", { min: PIPELINE_MIN_STAGES, max: PIPELINE_MAX_STAGES })}</p>
      <p>
        <Link href="/events/pipeline">{t("back")}</Link>
      </p>
      {refusal ? <p role="alert">{t(`refusal.${refusal}`)}</p> : null}
      {/* Lot 62b (UX-13, D1) : tableau éditable, enregistré à la sortie du champ. */}
      <section className="card" aria-labelledby="pipeline-stages-title">
        <h2 id="pipeline-stages-title" className="sr-only">
          {t("tableLabel")}
        </h2>
        <StageList stages={stages.map((stage) => ({ id: stage.id, label: stage.label, cardCount: stage.cardCount }))} minimum={PIPELINE_MIN_STAGES} />
      </section>
      {stages.length < PIPELINE_MAX_STAGES ? (
        <section className="card" aria-labelledby="pipeline-stage-new">
          <h2 id="pipeline-stage-new">{t("newStage")}</h2>
          <form action={addStageAction} className="form-inline">
            <label>
              {t("newStageName")}
              <input type="text" name="label" required maxLength={60} />
            </label>
            <button type="submit">{t("add")}</button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
