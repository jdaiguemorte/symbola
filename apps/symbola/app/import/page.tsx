import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getImportLimits, listImports, type ImportLimits, type ImportSummary } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { availableImportEntityTypes } from "./access";
import { ImportSteps } from "./import-steps";
import { NewImportForm } from "./new-import-form";

// Lot 5 — import de données (PRD §7) : étape « fichier » et journal des
// imports de l'organisation.
// Lot 14 (IMP-09) : les deux reprises depuis l'outil actuel, en premier.
const TAKEOVER_TYPES = ["vendors", "event_sheets"] as const;

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  const available = await availableImportEntityTypes(organizationId);
  const takeovers = TAKEOVER_TYPES.filter((type) => available.includes(type));
  const entityTypes = [...takeovers, ...available.filter((type) => !(TAKEOVER_TYPES as readonly string[]).includes(type))];
  const requested = (await searchParams).type;
  const preselected = entityTypes.find((type) => type === requested) ?? null;
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
      <ScreenHelp title={tHelp("importFile.title")} body={tHelp("importFile.body")} />
      <p>{t("intro")}</p>
      {takeovers.length > 0 ? (
        <section aria-labelledby="takeover-title" className="takeover">
          <h2 id="takeover-title">{t("takeoverTitle")}</h2>
          <p>{t("takeoverIntro")}</p>
          <div className="takeover-cards">
            {takeovers.map((type) => (
              <article key={type} className="card" aria-labelledby={`takeover-${type}`}>
                <h3 id={`takeover-${type}`}>{t(`takeover.${type}.title`)}</h3>
                <p>{t(`takeover.${type}.how`)}</p>
                <p className="muted">{t(`takeover.${type}.what`)}</p>
                <p>
                  <Link href={`/import?type=${type}#import-form`}>{t(`takeover.${type}.start`)}</Link>
                </p>
                {type === "event_sheets" ? (
                  <p>
                    <a href="/aide/exemples/fiche-evenement-exemple.pdf" download>
                      {t("takeoverExampleSheet")}
                    </a>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <ImportSteps current={0} />
      {entityTypes.length === 0 ? (
        <p>{t("noModuleAvailable")}</p>
      ) : (
        <NewImportForm
          key={preselected ?? "none"}
          entityTypes={entityTypes}
          defaultEntityType={preselected}
          maxSizeLabel={formatFileSize(limits.maxBytes, locale)}
          maxSheets={limits.maxSheets}
        />
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
                    {entry.status === "draft" ? (
                      <Link href={`/import/${entry.id}`}>{entry.fileName}</Link>
                    ) : entry.status === "applied" || entry.status === "undone" ? (
                      <Link href={`/import/${entry.id}/journal`}>{entry.fileName}</Link>
                    ) : (
                      entry.fileName
                    )}
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
