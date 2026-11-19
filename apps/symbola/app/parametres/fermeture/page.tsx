import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { BACKUP_CYCLE_DAYS, closureSchedule, daysBeforeDeletion, getOrganizationClosure, getOrganizationName } from "@/modules/hub/service";
import { CloseOrganizationForm, ReopenOrganizationForm } from "./closure-forms";

// Lot 35c (RGP-11 ; décision D8 ; ADR 0100) — fermer l'espace : rappel de l'export, ce qui se passe,
// date de suppression, confirmation par le nom de l'espace (UX-07). Fermé, l'écran dit la date de
// suppression, propose l'export et la réouverture ; c'est le seul écran d'un espace fermé, avec
// l'export. Propriétaire seulement ; une Planner y apprend que l'espace est fermé.
export default async function OrganizationClosurePage() {
  const auth = await requirePlanner({ allowClosed: true });
  const t = await getTranslations("OrganizationClosure");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const db = appDatabase();
  const organizationId = auth.user.organizationId;
  const [closure, name] = await Promise.all([getOrganizationClosure(db, organizationId), getOrganizationName(db, organizationId)]);
  const owner = auth.user.role === "owner";

  if (!owner) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{closure ? t("closedForMember", { date: formatDateTime(closure.deletionDueAt, locale) }) : t("ownerOnly")}</p>
      </main>
    );
  }

  const exportLink = (
    <p>
      <a className="button-link" href="/parametres/export">
        {t("exportLink")}
      </a>
    </p>
  );

  if (closure) {
    return (
      <main>
        <PageHeader title={t("closedTitle")} subtitle={t("subtitle")} />
        <ScreenHelp title={tHelp("organizationClosure.title")} body={tHelp("organizationClosure.body")} />
        <p role="note">{t("closedSince", { closed: formatDateTime(closure.closedAt, locale), date: formatDateTime(closure.deletionDueAt, locale) })}</p>
        <p>{t("daysLeft", { days: daysBeforeDeletion(closure.deletionDueAt, new Date()) })}</p>
        <section aria-labelledby="closure-export">
          <h2 id="closure-export">{t("exportFirstTitle")}</h2>
          <p>{t("exportFirst")}</p>
          {exportLink}
        </section>
        <section aria-labelledby="closure-reopen">
          <h2 id="closure-reopen">{t("reopenTitle")}</h2>
          <p>{t("reopenBody")}</p>
          <ReopenOrganizationForm />
        </section>
      </main>
    );
  }

  const deletion = formatDateTime(closureSchedule(new Date()).deletionDueAt, locale);
  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("organizationClosure.title")} body={tHelp("organizationClosure.body")} />
      <p>{t("intro")}</p>
      <section aria-labelledby="closure-export">
        <h2 id="closure-export">{t("exportFirstTitle")}</h2>
        <p>{t("exportFirst")}</p>
        {exportLink}
      </section>
      <section aria-labelledby="closure-what">
        <h2 id="closure-what">{t("whatTitle")}</h2>
        <ul>
          <li>{t("whatClosed")}</li>
          <li>{t("whatNotice")}</li>
          <li>{t("whatErased", { date: deletion, days: BACKUP_CYCLE_DAYS })}</li>
        </ul>
      </section>
      <section aria-labelledby="closure-confirm">
        <h2 id="closure-confirm">{t("confirmTitle")}</h2>
        <CloseOrganizationForm organizationName={name} />
      </section>
    </main>
  );
}
