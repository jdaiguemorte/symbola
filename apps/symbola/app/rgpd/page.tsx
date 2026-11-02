import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import {
  listErasablePrivacyRequests,
  listExportablePrivacyRequests,
  listPrivacyErasures,
  listPrivacyExports,
  type PrivacyErasureView,
  type PrivacyExportView,
} from "@/modules/hub/service";
import type { ErasableRequest } from "./erasure-preview";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { SearchForm, type ExportableRequest } from "./search-form";

// RGPD-01 — module « Données personnelles » : recherche transverse d'une
// personne dans tous les modules souscrits ; RGPD-02 : export des fiches
// sélectionnées, et exports encore téléchargeables. Titulaire du compte
// seulement.
export default async function PrivacyPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (auth.user.role !== "owner") {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const { sql, db } = createAppConnection();
  let exportRequests: ExportableRequest[];
  let exports: PrivacyExportView[];
  let erasureRequests: ErasableRequest[];
  let erasures: PrivacyErasureView[];
  try {
    exportRequests = (await listExportablePrivacyRequests(db, auth.user.organizationId)).map((request) => ({
      id: request.id,
      label: `${request.personLabel} — ${t(`requestType.${request.type}`)}`,
    }));
    exports = await listPrivacyExports(db, auth.user.organizationId);
    erasureRequests = (await listErasablePrivacyRequests(db, auth.user.organizationId)).map((request) => ({ id: request.id, label: request.personLabel }));
    erasures = await listPrivacyErasures(db, auth.user.organizationId);
  } finally {
    await sql.end();
  }
  return (
    <main>
      <h1>{t("title")}</h1>
      <HelpButton title={tHelp("privacySearch.title")} body={tHelp("privacySearch.body")} />
      <p>
        <Link href="/rgpd/demandes">{t("requestsLink")}</Link> · <Link href="/rgpd/reglages">{t("settingsLink")}</Link>
      </p>
      <SearchForm exportRequests={exportRequests} erasureRequests={erasureRequests} />
      <section aria-labelledby="privacy-exports">
        <h2 id="privacy-exports">{t("exportsTitle")}</h2>
        <HelpButton title={tHelp("privacyExport.title")} body={tHelp("privacyExport.body")} />
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
        <HelpButton title={tHelp("privacyErasure.title")} body={tHelp("privacyErasure.body")} />
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
