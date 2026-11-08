import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import {
  listErasablePrivacyRequests,
  listExportablePrivacyRequests,
  listPrivacyErasures,
  listPrivacyExports,
  type PrivacyErasureView,
  type PrivacyExportView,
} from "@/modules/hub/service";
import type { ErasableRequest } from "./erasure-preview";
import { requireOwner } from "@/lib/guards";
import { SearchForm, type ExportableRequest } from "./search-form";

// RGPD-01 — module « Données personnelles » : recherche transverse d'une
// personne dans tous les modules souscrits ; RGPD-02 : export des fiches
// sélectionnées, et exports encore téléchargeables. Titulaire du compte
// seulement.
export default async function PrivacyPage() {
  const auth = await requireOwner();

  const t = await getTranslations("Privacy");
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
  const db = appDatabase();
  const exportRequests: ExportableRequest[] = (await listExportablePrivacyRequests(db, auth.user.organizationId)).map((request) => ({
    id: request.id,
    label: `${request.personLabel} — ${t(`requestType.${request.type}`)}`,
  }));
  const exports: PrivacyExportView[] = await listPrivacyExports(db, auth.user.organizationId);
  const erasureRequests: ErasableRequest[] = (await listErasablePrivacyRequests(db, auth.user.organizationId)).map((request) => ({ id: request.id, label: request.personLabel }));
  const erasures: PrivacyErasureView[] = await listPrivacyErasures(db, auth.user.organizationId);
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("privacySearch.title")} body={tHelp("privacySearch.body")} />
      <p>
        <Link href="/rgpd/demandes">{t("requestsLink")}</Link> · <Link href="/rgpd/purge">{t("purgeLink")}</Link> · <Link href="/rgpd/reglages">{t("settingsLink")}</Link>
      </p>
      <SearchForm exportRequests={exportRequests} erasureRequests={erasureRequests} />
      <section aria-labelledby="privacy-exports">
        <h2 id="privacy-exports">{t("exportsTitle")}</h2>
        {/* Lot 16 (HUB-19) : un seul « ? » par écran ; l'aide des exports reste lisible ici. */}
        <p className="muted">{tHelp("privacyExport.body")}</p>
        {exports.length === 0 ? <p>{t("exportsEmpty")}</p> : null}
        <ul>
          {exports.map((item) => (
            <li key={item.id}>
              {t("exportSummary", { date: formatDateTime(item.createdAt, locale), count: item.recordCount })}
              {item.requestPersonLabel ? ` — ${t("exportForRequest", { person: item.requestPersonLabel })}` : ""}{" "}
              <small>{t("exportExpires", { date: formatDateTime(item.expiresAt, locale) })}</small>{" "}
              <a href={`/rgpd/exports/${item.id}/pdf`}>{t("downloadPdf")}</a> · <a href={`/rgpd/exports/${item.id}/archive`}>{t("downloadArchive")}</a>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="privacy-erasures">
        <h2 id="privacy-erasures">{t("erasuresTitle")}</h2>
        <ScreenHelp title={tHelp("privacyErasure.title")} body={tHelp("privacyErasure.body")} />
        {erasures.length === 0 ? <p>{t("erasuresEmpty")}</p> : null}
        <ul>
          {erasures.map((erasure) => (
            <li key={erasure.id}>
              <Link href={`/rgpd/oublis/${erasure.id}`}>
                {t("erasureSummary", { person: erasure.request.personLabel, date: formatDateTime(erasure.createdAt, locale) })}
              </Link>{" "}
              <small>({t(`erasureStatus.${erasure.status}`)})</small>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
