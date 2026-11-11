import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireOwner } from "@/lib/guards";
import { listLedgerEntries, listLedgerYears, verifyLedger } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "../../module-access";

type Query = { annee?: string; verifier?: string };

// Lot 23b (JUR-06, FAC-14, décision D7, ADR 0061) — archive comptable : par
// année, les écritures de la chaîne des pièces (CSV), la liste des originaux
// et la vérification de l'intégrité. Titulaire seulement.
export default async function LedgerArchivePage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requireOwner();
  const t = await getTranslations("LedgerArchive");
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
  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const years = await listLedgerYears(organizationId);
  const year = years.includes(Number(query.annee)) ? Number(query.annee) : years[0];
  const entries = year === undefined ? [] : await listLedgerEntries(organizationId, year);
  const originals = entries.filter((entry) => entry.kind === "invoice" || entry.kind === "credit_note");
  const verification = query.verifier === "1" ? await verifyLedger(organizationId) : null;

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("ledgerArchive.title")} body={tHelp("ledgerArchive.body")} />

      <section aria-labelledby="integrity-title" className="settings-block">
        <h2 id="integrity-title">{t("integrityTitle")}</h2>
        <p>{t("integrityIntro")}</p>
        <form method="get">
          {year !== undefined ? <input type="hidden" name="annee" value={year} /> : null}
          <input type="hidden" name="verifier" value="1" />
          <button type="submit">{t("verify")}</button>
        </form>
        {verification ? (
          <p role="status">
            {verification.ok
              ? t("verifiedOk", { count: verification.entries, hash: verification.lastHash?.slice(0, 16) ?? "—" })
              : t("verifiedKo", { count: verification.anomalies.length })}
          </p>
        ) : null}
        {verification && !verification.ok ? (
          <ul>
            {verification.anomalies.map((anomaly) => (
              <li key={`${anomaly.anomaly}-${anomaly.objectId}`}>
                {t(`anomalies.${anomaly.anomaly}`, { sequence: anomaly.sequence ?? "—", kind: t(`kinds.${anomaly.kind}`) })}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="years-title" className="settings-block">
        <h2 id="years-title">{t("yearsTitle")}</h2>
        {years.length === 0 ? (
          <p>{t("noEntries")}</p>
        ) : (
          <>
            <nav aria-label={t("yearsTitle")}>
              <ul className="row-wrap">
                {years.map((candidate) => (
                  <li key={candidate}>
                    <Link href={`/devis/parametres/archive?annee=${candidate}`} aria-current={candidate === year ? "page" : undefined}>
                      {candidate}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {year !== undefined ? (
              <p>
                {t("yearSummary", { year, count: entries.length })}{" "}
                <a href={`/devis/parametres/archive/${year}/ecritures`}>{t("downloadCsv", { year })}</a>
              </p>
            ) : null}
          </>
        )}
      </section>

      {originals.length > 0 ? (
        <section aria-labelledby="originals-title" className="settings-block">
          <h2 id="originals-title">{t("originalsTitle", { year: year ?? "" })}</h2>
          <div className="list-table-wrap" role="region" aria-labelledby="originals-title" tabIndex={0}>
            <table className="list-table">
              <thead>
                <tr>
                  <th scope="col">{t("columnNumber")}</th>
                  <th scope="col">{t("columnKind")}</th>
                  <th scope="col">{t("columnDate")}</th>
                  <th scope="col">{t("columnAmount")}</th>
                  <th scope="col">{t("columnOriginal")}</th>
                </tr>
              </thead>
              <tbody>
                {originals.map((entry) => (
                  <tr key={entry.sequence}>
                    <th scope="row">{entry.number}</th>
                    <td>{t(`kinds.${entry.kind}`)}</td>
                    <td className="num">{formatDateTime(entry.recordedAt, locale)}</td>
                    <td className="num">{entry.amountCents === null ? "—" : formatAmount(entry.amountCents, locale)}</td>
                    <td>
                      <a href={entry.kind === "invoice" ? `/devis/factures/${entry.objectId}/pdf` : `/devis/avoirs/${entry.objectId}/pdf`}>
                        {t("downloadOriginal", { number: entry.number ?? "" })}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
