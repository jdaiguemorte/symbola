import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import { getImportLimits, listImports, type ImportLimits, type ImportSummary } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { availableImportEntityTypes } from "./access";
import { ImportSteps } from "./import-steps";
import { NewImportForm } from "./new-import-form";

// Lot 5 — import de données (PRD §7) : étape « fichier » et journal des
// imports de l'organisation.
export default async function ImportPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  const entityTypes = await availableImportEntityTypes(organizationId);
  const { sql, db } = createAppConnection();
  let journal: ImportSummary[];
  let limits: ImportLimits;
  try {
    [journal, limits] = await Promise.all([listImports(db, organizationId), getImportLimits(db)]);
  } finally {
    await sql.end();
  }

  return (
    <main>
      <h1>{t("title")}</h1>
      <HelpButton title={tHelp("importFile.title")} body={tHelp("importFile.body")} />
      <p>{t("intro")}</p>
      <ImportSteps current={0} />
      {entityTypes.length === 0 ? (
        <p>{t("noModuleAvailable")}</p>
      ) : (
        <NewImportForm entityTypes={entityTypes} maxSizeLabel={formatFileSize(limits.maxBytes, locale)} />
      )}

      <section aria-labelledby="import-journal">
        <h2 id="import-journal">{t("journalTitle")}</h2>
        {journal.length === 0 ? (
          <p>{t("journalEmpty")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t("journalDate")}</th>
                <th scope="col">{t("journalFile")}</th>
                <th scope="col">{t("journalEntityType")}</th>
                <th scope="col">{t("journalRows")}</th>
                <th scope="col">{t("journalStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {journal.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt, locale)}</td>
                  <td>
                    {entry.status === "draft" ? <Link href={`/import/${entry.id}`}>{entry.fileName}</Link> : entry.fileName}
                  </td>
                  <td>{t(`entityType.${entry.entityType}`)}</td>
                  <td>{entry.rowCount}</td>
                  <td>{t(`status.${entry.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
