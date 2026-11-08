import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getImportLimits, listImports, type ImportEntityType, type ImportLimits, type ImportSummary } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { availableImportEntityTypes } from "./access";
import { NewImportForm } from "./new-import-form";

// Lot 5 — import de données (PRD §7) : point d'entrée et journal des imports.
// Lot 14 (IMP-09) : les deux reprises depuis l'outil actuel, en premier.
// Lot 16 (IMP-11, ADR 0041) : « Que voulez-vous reprendre ? » en trois tuiles ;
// le choix détaillé des contenus n'apparaît que pour « Un autre fichier ».
const TAKEOVER_TYPES = ["vendors", "event_sheets"] as const;
const OTHER = "autre";

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
  const others = available.filter((type) => !(TAKEOVER_TYPES as readonly string[]).includes(type));
  const requested = (await searchParams).type;
  const chosen: ImportEntityType | typeof OTHER | null = requested === OTHER && others.length > 0 ? OTHER : (takeovers.find((type) => type === requested) ?? null);
  const formTypes: ImportEntityType[] = chosen === OTHER ? others : chosen ? [chosen] : [];
  const { sql, db } = createAppConnection();
  let journal: ImportSummary[];
  let limits: ImportLimits;
  try {
    [journal, limits] = await Promise.all([listImports(db, organizationId), getImportLimits(db)]);
  } finally {
    await sql.end();
  }
  const tiles = [
    ...takeovers.map((type) => ({ key: type as string, title: t(`takeover.${type}.title`), body: t(`takeover.${type}.what`) })),
    ...(others.length > 0 ? [{ key: OTHER, title: t("otherFileTitle"), body: t("otherFileBody") }] : []),
  ];

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("importFile.title")} body={tHelp("importFile.body")} />
      {available.length === 0 ? (
        <p>{t("noModuleAvailable")}</p>
      ) : (
        <section aria-labelledby="takeover-title" className="takeover">
          <h2 id="takeover-title">{t("startQuestion")}</h2>
          <nav aria-label={t("startQuestion")} className="import-tiles">
            {tiles.map((tile) => (
              <Link key={tile.key} href={`/import?type=${tile.key}#import-form`} className="import-tile" aria-current={chosen === tile.key ? "true" : undefined}>
                <span className="import-tile-title">{tile.title}</span>
                <span className="import-tile-body">{tile.body}</span>
              </Link>
            ))}
          </nav>
        </section>
      )}

      {chosen ? (
        <section aria-labelledby="import-form-title" className="card">
          <h2 id="import-form-title">{chosen === OTHER ? t("otherFileTitle") : t(`takeover.${chosen}.title`)}</h2>
          {chosen !== OTHER ? <p>{t(`takeover.${chosen}.how`)}</p> : null}
          {chosen === "event_sheets" ? (
            <p>
              <a href="/aide/exemples/fiche-evenement-exemple.pdf" download>
                {t("takeoverExampleSheet")}
              </a>
            </p>
          ) : null}
          <NewImportForm key={chosen} entityTypes={formTypes} defaultEntityType={formTypes.length === 1 ? formTypes[0]! : null} maxSizeLabel={formatFileSize(limits.maxBytes, locale)} maxSheets={limits.maxSheets} />
        </section>
      ) : null}

      <section aria-labelledby="import-journal">
        <h2 id="import-journal">{t("journalTitle")}</h2>
        {journal.length === 0 ? (
          <p>{t("journalEmpty")}</p>
        ) : (
          <div className="list-table-wrap" role="region" aria-label={t("journalTable")} tabIndex={0}>
            <table className="list-table">
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
                    <th scope="row">
                      {entry.status === "applied" || entry.status === "undone" ? <Link href={`/import/${entry.id}/journal`}>{entry.fileName}</Link> : entry.fileName}
                    </th>
                    <td>{t(`entityType.${entry.entityType}`)}</td>
                    <td>{entry.rowCount}</td>
                    <td>
                      {t(`status.${entry.status}`)}
                      {/* Lot 16 (IMP-11) : un brouillon reprend là où il s'était arrêté. */}
                      {entry.status === "draft" ? (
                        <>
                          {" · "}
                          <Link href={`/import/${entry.id}`} aria-label={t("resumeImportFor", { file: entry.fileName })}>
                            {t("resumeImport")}
                          </Link>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
