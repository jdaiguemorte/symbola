import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { importStepHref } from "@/lib/import/wizard";
import { retryImportJobAction } from "../actions";
import { ImportHeader } from "../import-header";
import { JobProgress } from "../job-progress";
import { importStepContext, wantsAbandon } from "../step-context";

// IMP-01 — étape « fichier ». Lot 16 (IMP-11) : un import ouvert reprend là où
// il s'était arrêté (`nextImportStep`) ; seules des fiches PDF encore en
// lecture (lot 15, IMP-10) gardent cette étape à l'écran, avec l'avancement.
export default async function ImportDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { importId } = await params;
  const { wizard } = await importStepContext(importId);
  const query = await searchParams;
  if (wizard.steps[0]!.done && !wantsAbandon(query)) redirect(importStepHref(wizard.importId, wizard.next));

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const readJob = wizard.draft.jobs.find((job) => job.kind === "read_sheets");

  return (
    <main className="import-assistant">
      <ImportHeader wizard={wizard} current="file" abandon={wantsAbandon(query)} />
      <ScreenHelp title={tHelp("importFile.title")} body={tHelp("importFile.body")} />
      {readJob ? (
        <section aria-labelledby="import-reading" className="card">
          <h2 id="import-reading">{t("jobReadSheetsTitle")}</h2>
          <JobProgress label={t("jobReadSheets")} done={readJob.done} total={readJob.total} status={readJob.status} nextHref={`/import/${wizard.importId}`} />
          {readJob.status === "failed" ? (
            <form action={retryImportJobAction}>
              <p role="alert">{t("jobFailed")}</p>
              <input type="hidden" name="importId" value={wizard.importId} />
              <input type="hidden" name="jobId" value={readJob.id} />
              <button type="submit">{t("jobRetry")}</button>
            </form>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
