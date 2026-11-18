// Lot 44 (CRM-02 ; D9 ; ADR 0084) — Paramètres › Étapes du pipeline : la liste de l'organisation,
// copiée des données de départ, que la titulaire renomme, complète, réordonne et réduit (une à dix).
// Une étape n'est qu'un repère à l'intérieur du statut Option : « Gagné » et « Perdu » n'en sont pas.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { listPipelineStages, PIPELINE_MAX_STAGES, PIPELINE_MIN_STAGES } from "@/modules/events/service";
import { requireOwner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isEventsModuleEnabled } from "../../module-access";
import { addStageAction, moveStageAction, removeStageAction, renameStageAction } from "./actions";

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
      <ol className="pipeline-stage-list">
        {stages.map((stage, index) => (
          <li key={stage.id} className="card stack">
            <form action={renameStageAction} className="row-wrap">
              <input type="hidden" name="stageId" value={stage.id} />
              <label>
                {t("stageLabel", { position: index + 1 })}
                <input type="text" name="label" required maxLength={60} defaultValue={stage.label} />
              </label>
              <button type="submit">{t("rename")}</button>
            </form>
            <p className="meta">{t("cards", { count: stage.cardCount })}</p>
            <div className="row-wrap">
              <form action={moveStageAction}>
                <input type="hidden" name="stageId" value={stage.id} />
                <input type="hidden" name="direction" value="up" />
                <button type="submit" className="button-ghost" disabled={index === 0} aria-label={t("upLabel", { stage: stage.label })}>
                  {t("up")}
                </button>
              </form>
              <form action={moveStageAction}>
                <input type="hidden" name="stageId" value={stage.id} />
                <input type="hidden" name="direction" value="down" />
                <button type="submit" className="button-ghost" disabled={index === stages.length - 1} aria-label={t("downLabel", { stage: stage.label })}>
                  {t("down")}
                </button>
              </form>
              {stages.length > PIPELINE_MIN_STAGES ? (
                <form action={removeStageAction} className="row-wrap">
                  <input type="hidden" name="stageId" value={stage.id} />
                  {stage.cardCount > 0 ? (
                    <label>
                      {t("destination")}
                      <select name="destinationId" required>
                        {stages
                          .filter((other) => other.id !== stage.id)
                          .map((other) => (
                            <option key={other.id} value={other.id}>
                              {other.label}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}
                  <button type="submit" className="button-ghost" aria-label={t("removeLabel", { stage: stage.label })}>
                    {t("remove")}
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {stages.length < PIPELINE_MAX_STAGES ? (
        <form action={addStageAction} className="row-wrap card">
          <label>
            {t("newStage")}
            <input type="text" name="label" required maxLength={60} />
          </label>
          <button type="submit" className="primary">
            {t("add")}
          </button>
        </form>
      ) : null}
    </main>
  );
}
