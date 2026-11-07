import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { listPrivacyPurges, type PrivacyPurgeView } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { listPurgeCandidates, type PurgeCandidate } from "@/lib/privacy/purge";
import { PurgeForm } from "./purge-form";

// RGPD-05 — purge mensuelle : liste des personnes et documents dont la durée
// de conservation est échue (réglages RGPD de l'organisation), à valider ;
// historique des purges. Titulaire seulement.
export default async function PurgePage() {
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
        <h1>{t("purgeTitle")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const candidates: PurgeCandidate[] = await listPurgeCandidates(auth.user.organizationId);
  const { sql, db } = createAppConnection();
  let purges: PrivacyPurgeView[];
  try {
    purges = await listPrivacyPurges(db, auth.user.organizationId);
  } finally {
    await sql.end();
  }
  // Une ligne exclue revient chaque mois, avec son dernier motif.
  const previousReasons = new Map<string, string>();
  for (const purge of [...purges].reverse()) {
    for (const line of purge.lines) {
      if (line.outcome === "excluded" && line.exclusionReason) previousReasons.set(line.key, line.exclusionReason);
    }
  }

  return (
    <main>
      <p>
        <Link href="/rgpd">{t("backToSearch")}</Link> · <Link href="/rgpd/reglages">{t("settingsLink")}</Link>
      </p>
      <h1>{t("purgeTitle")}</h1>
      <ScreenHelp title={tHelp("privacyPurge.title")} body={tHelp("privacyPurge.body")} />
      <p>{t("purgeIntro")}</p>
      {candidates.length === 0 ? (
        <p>{t("purgeNothing")}</p>
      ) : (
        <PurgeForm
          lines={candidates.map((candidate) => ({
            key: candidate.key,
            rule: candidate.rule,
            label: candidate.eventDate ? `${candidate.label} (${formatCalendarDate(candidate.eventDate, locale)})` : candidate.label,
            dueOn: formatCalendarDate(candidate.dueOn, locale),
            previousReason: previousReasons.get(candidate.key) ?? null,
          }))}
        />
      )}
      <section aria-labelledby="purge-history">
        <h2 id="purge-history">{t("purgeHistoryTitle")}</h2>
        {purges.length === 0 ? <p>{t("purgeHistoryEmpty")}</p> : null}
        <ul>
          {purges.map((purge) => (
            <li key={purge.id}>
              <Link href={`/rgpd/purge/${purge.id}`}>
                {t("purgeSummary", {
                  date: formatDateTime(purge.createdAt, locale),
                  purged: purge.lines.filter((line) => line.outcome === "purged").length,
                  excluded: purge.lines.filter((line) => line.outcome === "excluded").length,
                })}
              </Link>{" "}
              <small>({t(`purgeStatus.${purge.status}`)})</small>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
