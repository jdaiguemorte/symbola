import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { getPrivacyPurge, PrivacyPurgeNotFoundError, type PrivacyPurgeView } from "@/modules/hub/service";
import { requireOwner } from "@/lib/guards";
import { retryPurgeAction } from "../actions";
import { ScreenHelp } from "@/app/screen-help";

// RGPD-05 — une purge validée : lignes purgées ou exclues (avec motif), sort
// des fiches et accusé de chaque module ; relance des modules en échec.
export default async function PurgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("purgeTitle")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const locale = (await getLocale()) as Locale;
  const db = appDatabase();
  let purge: PrivacyPurgeView;
  try {
    purge = await getPrivacyPurge(db, auth.user.organizationId, id.data);
  } catch (error) {
    if (error instanceof PrivacyPurgeNotFoundError) notFound();
    throw error;
  }
  const moduleName = (module: string) => (t.has(`module.${module}`) ? t(`module.${module}`) : module);
  const counts = new Map<string, number>();
  for (const item of purge.items) counts.set(`${item.module}|${item.kind}|${item.fate}`, (counts.get(`${item.module}|${item.kind}|${item.fate}`) ?? 0) + 1);

  return (
    <main>
      <p>
        <Link href="/rgpd/purge">{t("purgeBack")}</Link>
      </p>
      <h1>{t("purgeDetailTitle", { date: formatDateTime(purge.createdAt, locale) })}</h1>
      <ScreenHelp title={tHelp("privacyPurge.title")} body={tHelp("privacyPurge.body")} />
      <p role="status">{t(`purgeStatus.${purge.status}`)}</p>

      <section aria-labelledby="purge-lines">
        <h2 id="purge-lines">{t("purgeLinesTitle")}</h2>
        <ul>
          {purge.lines.map((line) => (
            <li key={line.key}>
              {t(`purgeRule.${line.rule}`)} — {t("purgeDueOn", { date: formatCalendarDate(line.dueOn, locale) })} —{" "}
              {line.outcome === "purged" ? t("purgeOutcomePurged") : t("purgeOutcomeExcluded", { reason: line.exclusionReason ?? "" })}
            </li>
          ))}
        </ul>
      </section>

      {purge.items.length > 0 ? (
        <section aria-labelledby="purge-acks">
          <h2 id="purge-acks">{t("proofAcksTitle")}</h2>
          <ul>
            {[...new Set(purge.items.map((item) => item.module))].map((module) => {
              const ack = purge.acks.find((candidate) => candidate.module === module);
              return (
                <li key={module}>
                  {ack?.status === "ok"
                    ? t("ackOk", { module: moduleName(module), date: formatDateTime(new Date(ack.at), locale), count: ack.count })
                    : t("ackFailed", { module: moduleName(module) })}
                </li>
              );
            })}
          </ul>
          {purge.status !== "completed" ? (
            <form action={retryPurgeAction}>
              <input type="hidden" name="purgeId" value={purge.id} />
              <button type="submit">{t("erasureRetry")}</button>
            </form>
          ) : null}
          <h2>{t("proofItemsTitle")}</h2>
          <ul>
            {[...counts].map(([key, count]) => {
              const [module, kind, fate] = key.split("|") as [string, string, string];
              return (
                <li key={key}>
                  {moduleName(module)} · {t.has(`kind.${kind}`) ? t(`kind.${kind}`) : kind} : {t(`fate.${fate}`)} ({count})
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
