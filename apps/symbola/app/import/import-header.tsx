// Lot 16 (IMP-11, ADR 0041) — en-tête commun des étapes de l'assistant
// d'import : titre, frise des étapes (résumé des étapes faites), et
// « Abandonner l'import », lien discret qui demande confirmation.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Stepper } from "@/app/ui/stepper";
import { importStepHref, type ImportStepKey, type ImportWizard } from "@/lib/import/wizard";
import { cancelImportAction } from "./actions";

export async function ImportHeader({ wizard, current, abandon }: { wizard: ImportWizard; current: ImportStepKey; abandon: boolean }) {
  const t = await getTranslations("Import");
  const here = importStepHref(wizard.importId, current);
  const steps = wizard.steps.map((step) => ({
    key: step.key,
    label: t(`wizardStep.${step.key}`),
    state: step.key === current ? ("current" as const) : step.done ? ("done" as const) : ("todo" as const),
    // L'étape « Fichier » ne se rouvre pas : on recommence un import.
    href: step.done && step.key !== "file" ? importStepHref(wizard.importId, step.key) : null,
    summary: step.done && step.summary ? t(`summary.${step.summary.key}`, step.summary.values) : null,
  }));
  return (
    <>
      <div className="import-head">
        <h1>{t("wizardTitle", { fileName: wizard.fileName })}</h1>
        <Link href={`${here}?abandon=1`} className="import-abandon" scroll={false}>
          {t("abandonLink")}
        </Link>
      </div>
      {abandon ? (
        <section className="import-abandon-confirm" aria-labelledby="abandon-title">
          <h2 id="abandon-title">{t("abandonTitle")}</h2>
          <p>{t("abandonBody")}</p>
          <div className="row-actions">
            <form action={cancelImportAction}>
              <input type="hidden" name="importId" value={wizard.importId} />
              <button type="submit">{t("abandonYes")}</button>
            </form>
            <Link href={here} scroll={false}>
              {t("abandonNo")}
            </Link>
          </div>
        </section>
      ) : null}
      <Stepper steps={steps} label={t("stepsLabel")} stateLabels={{ done: t("stepDone"), current: t("stepCurrent") }} />
    </>
  );
}
