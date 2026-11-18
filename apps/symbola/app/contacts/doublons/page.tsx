// Lot 45 (CRM-07 ; D4 ; ADR 0090) — Contacts › Doublons possibles : les paires de fiches qui ont la même
// adresse e-mail ou le même téléphone, détectées à la saisie et chaque nuit ; jamais fusionnées seules.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { listDuplicatePairs } from "@/modules/hub/service";
import { DismissPairButton } from "./dismiss-button";

export default async function ContactDuplicatesPage() {
  const auth = await requirePlanner();
  const t = await getTranslations("ContactDuplicates");
  const tHelp = await getTranslations("Help");
  const pairs = await listDuplicatePairs(auth.user.organizationId);
  return (
    <main className="stack">
      <Link href="/contacts" className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("contactDuplicates.title")} body={tHelp("contactDuplicates.body")} />
      {pairs.length === 0 ? (
        <p>{t("none")}</p>
      ) : (
        <ul className="plain-list stack">
          {pairs.map((pair) => (
            <li key={pair.id} className="card stack">
              <p>
                <Link href={`/contacts/${pair.first.id}`}>{pair.first.displayName}</Link> · <Link href={`/contacts/${pair.second.id}`}>{pair.second.displayName}</Link>
              </p>
              <p className="meta">{t(`reason.${pair.reason}`)}</p>
              <div className="row-wrap">
                <Link href={`/contacts/doublons/${pair.id}`} className="button-link button-link-primary">
                  {t("compare")}
                </Link>
                <DismissPairButton pairId={pair.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
