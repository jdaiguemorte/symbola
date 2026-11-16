import { getLocale, getTranslations } from "next-intl/server";
import { STORAGE_NATURES } from "@symbola/contracts";
import { formatDateTime, formatFileSize, formatMonth, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireOwner } from "@/lib/guards";
import { listStorageSnapshots } from "@/modules/hub/service";

// Lot 37b (DOC-12, décision D12 ; ADR 0071) — Paramètres › Stockage : le relevé mensuel du stockage
// de l'organisation, par nature (nombre de fichiers et volume), pris le premier du mois et gardé
// d'un mois sur l'autre. Titulaire du compte seulement. Des nombres, jamais un nom de fichier ; il
// alimentera le calcul des quotas (DOC-06).
export default async function StoragePage() {
  const auth = await requireOwner();
  const t = await getTranslations("Storage");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const snapshots = await listStorageSnapshots(auth.user.organizationId, 12);
  const latest = snapshots[0];
  // Un volume nul s'écrit tel quel (le format des tailles de fichier commence à 0,1 Ko).
  const volume = (bytes: number) => (bytes === 0 ? t("zeroVolume") : formatFileSize(bytes, locale));

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("storage.title")} body={tHelp("storage.body")} />
      {!latest ? (
        <p>{t("empty")}</p>
      ) : (
        <>
          <section className="card" aria-labelledby="storage-latest-title">
            <h2 id="storage-latest-title">{t("latestTitle", { month: formatMonth(latest.month, locale) })}</h2>
            <p className="muted">{t("takenAt", { date: formatDateTime(new Date(latest.takenAt), locale) })}</p>
            <div role="region" aria-label={t("latestTable")} tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t("nature")}</th>
                    <th scope="col" className="num">{t("files")}</th>
                    <th scope="col" className="num">{t("volume")}</th>
                  </tr>
                </thead>
                <tbody>
                  {STORAGE_NATURES.map((nature) => (
                    <tr key={nature}>
                      <th scope="row">
                        {t(`natures.${nature}`)}
                        <span className="muted"> — {t(`natureHints.${nature}`)}</span>
                      </th>
                      <td className="num">{latest.natures[nature].files}</td>
                      <td className="num">{volume(latest.natures[nature].bytes)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">{t("total")}</th>
                    <td className="num">{latest.files}</td>
                    <td className="num">{volume(latest.bytes)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
          <section aria-labelledby="storage-history-title">
            <h2 id="storage-history-title">{t("historyTitle")}</h2>
            <div role="region" aria-label={t("historyTable")} tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t("month")}</th>
                    <th scope="col" className="num">{t("files")}</th>
                    <th scope="col" className="num">{t("volume")}</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.month}>
                      <th scope="row">{formatMonth(snapshot.month, locale)}</th>
                      <td className="num">{snapshot.files}</td>
                      <td className="num">{volume(snapshot.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <p className="muted">{t("notCounted")}</p>
    </main>
  );
}
