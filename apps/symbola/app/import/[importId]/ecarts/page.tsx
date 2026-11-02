import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { getImportGapsView } from "@/lib/import/gaps";
import { isValidId } from "../../access";
import { ImportSteps } from "../../import-steps";
import { decideFreeColumnsAction } from "./actions";
import { reasonText } from "./reasons";

// IMP-04 — étape « écarts » : colonnes sans équivalent (champ libre ou
// ignorée) et lignes rejetées avec leur motif, téléchargeables en CSV.
export default async function ImportGapsPage({ params }: { params: Promise<{ importId: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const { importId } = await params;
  if (!isValidId(importId)) notFound();
  const view = await getImportGapsView(auth.user.organizationId, importId);
  if (!view) notFound();

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const translate = (key: string, values?: Record<string, string>) => t(key, values);
  const columnName = (header: string, columnIndex: number) => header || t("unnamedColumn", { number: columnIndex + 1 });

  return (
    <main>
      <h1>{t("gapsTitle", { fileName: view.fileName })}</h1>
      <HelpButton title={tHelp("importGaps.title")} body={tHelp("importGaps.body")} />
      <ImportSteps current={3} />

      <section aria-labelledby="gaps-columns">
        <h2 id="gaps-columns">{t("gapsColumnsTitle")}</h2>
        {view.columns.length === 0 ? (
          <p>{t("gapsNoColumns")}</p>
        ) : (
          <form action={decideFreeColumnsAction}>
            <input type="hidden" name="importId" value={view.importId} />
            <p>{t("gapsColumnsIntro")}</p>
            {view.columns.map((column) => {
              const name = columnName(column.header, column.columnIndex);
              return (
                <fieldset key={column.columnIndex}>
                  <legend>{name}</legend>
                  <p>{column.samples.length > 0 ? t("columnSamples", { samples: column.samples.join(" · ") }) : t("columnEmpty")}</p>
                  <label>
                    <input type="radio" name={`column-${column.columnIndex}`} value="keep" defaultChecked={column.decision === "keep"} required />
                    {t("gapsKeep")}
                  </label>
                  <label>
                    <input type="radio" name={`column-${column.columnIndex}`} value="ignore" defaultChecked={column.decision === "ignore"} />
                    {t("gapsIgnore")}
                  </label>
                  {column.decision === "undecided" ? <p>{t("gapsUndecided")}</p> : null}
                </fieldset>
              );
            })}
            <button type="submit">{t("gapsSaveColumns")}</button>
          </form>
        )}
      </section>

      <section aria-labelledby="gaps-rejected">
        <h2 id="gaps-rejected">{t("gapsRejectedTitle", { count: view.rejected.length })}</h2>
        {view.rejected.length === 0 ? (
          <p>{t("gapsNoRejected")}</p>
        ) : (
          <>
            <p>{t("gapsRejectedIntro", { count: view.rejected.length, total: view.rowCount })}</p>
            <ul>
              {view.rejected.map((row) => (
                <li key={row.rowIndex}>
                  {t("gapsRejectedRow", { line: row.lineNumber, reasons: row.reasons.map((reason) => reasonText(translate, reason)).join(" ; ") })}
                </li>
              ))}
            </ul>
            <p>
              <a href={`/import/${view.importId}/ecarts/csv`} download>
                {t("gapsDownloadCsv")}
              </a>
            </p>
          </>
        )}
      </section>

      <p>{t("nextStepsComing")}</p>
      <p>
        <Link href={`/import/${view.importId}`}>{t("backToDraft")}</Link>
      </p>
    </main>
  );
}
