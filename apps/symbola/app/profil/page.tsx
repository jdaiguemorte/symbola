import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { parseEnv } from "@symbola/env";
import { requireSignedIn } from "@/lib/guards";
import { eventNames, getEvent } from "@/modules/events/service";
import { listCalendarFeeds } from "@/modules/hub/service";
import { revokeCalendarAddressAction } from "../calendar-actions";
import { CalendarAddressForm } from "../calendar-address-form";
import { isEventsModuleEnabled } from "../events/module-access";
import { isAppointmentsModuleEnabled } from "@/modules/appointments/service";
import { SignOutEverywhereForm } from "../sign-out-everywhere-form";
import { LanguageForm } from "./language-form";
import { NamesForm } from "./names-form";
import { getUserNames } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";

export default async function ProfilePage() {
  const auth = await requireSignedIn();

  const t = await getTranslations("Profile");
  const tSignature = await getTranslations("MySignature");
  const tHelp = await getTranslations("Help");
  // Lot 33 (ADR 0067) : mot de passe, clés d'accès et double authentification dans le centre de
  // compte du fournisseur d'identité.
  const accountCenter = `${parseEnv(process.env).LOGTO_ENDPOINT.replace(/\/+$/, "")}/account/security`;
  // Lot 38b (HUB-29 ; D11) : Mon calendrier, pour une personne de l'équipe (module Évènements).
  const organizationId = auth.user.role !== "admin" ? auth.user.organizationId : null;
  // Lot 46 (RDV-04, HUB-29) : aussi avec le seul module Rendez-vous (son flux porte ses rendez-vous).
  const calendar = organizationId && ((await isEventsModuleEnabled(organizationId)) || (await isAppointmentsModuleEnabled(organizationId))) ? await listCalendarFeeds(organizationId, auth.user.id) : null;
  const personFeed = calendar?.find((feed) => feed.eventId === null) ?? null;
  const followed = calendar
    ? await Promise.all(
        calendar
          .filter((feed) => feed.eventId !== null)
          .map(async (feed) => {
            const event = await getEvent(organizationId!, feed.eventId!);
            return event ? { id: feed.id, eventId: event.id, names: eventNames(event.clients, event.name) } : null;
          }),
      )
    : [];
  const tCalendar = await getTranslations("Calendar");
  const locale = (await getLocale()) as Locale;

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("profile.title")} body={tHelp("profile.body")} />
      {/* Lot 70a (CHR-02 ; A1) : le nom sous lequel l'équipe voit la personne, pour une personne de l'équipe. */}
      {auth.user.role !== "admin" ? <NamesForm {...await getUserNames(appDatabase(), auth.user.id)} /> : null}
      <LanguageForm currentLanguage={auth.user.language ?? "fr"} />
      {/* Lot 66c (HUB-18 ; D5) : la signature des e-mails, pour une personne de l'équipe qui envoie. */}
      {auth.user.role === "owner" || auth.user.role === "member" ? (
        <section aria-labelledby="profile-signature-title">
          <h2 id="profile-signature-title">{tSignature("profileTitle")}</h2>
          <p>{tSignature("profileBody")}</p>
          <p>
            <Link href="/profil/signature">{tSignature("profileLink")}</Link>
          </p>
        </section>
      ) : null}
      <section aria-labelledby="profile-security-title">
        <h2 id="profile-security-title">{t("securityTitle")}</h2>
        <p>{t("securityBody")}</p>
        <p>
          <a href={accountCenter}>{t("securityLink")}</a>
        </p>
        {/* Lot 52 (HUB-05) : chaque session ouverte du compte, et sa déconnexion à distance. */}
        <p>
          <a href="/securite">{t("sessionsLink")}</a>
        </p>
      </section>
      {calendar ? (
        <section aria-labelledby="profile-calendar-title" className="stack">
          <h2 id="profile-calendar-title">{tCalendar("title")}</h2>
          <p>{tCalendar("intro")}</p>
          <div className="setting-row-head">
            <h3>{tCalendar("personTitle")}</h3>
            <span className={personFeed ? "badge badge-sauge" : "badge"}>{personFeed ? tCalendar("statusActive") : tCalendar("statusNone")}</span>
          </div>
          <p className="field-hint">{tCalendar("personHint")}</p>
          {/* Lot 64 (HUB-29 ; maquette M5) : l'abonnement affiche ; un outil de réservation ne le lit pas toujours. */}
          <p className="notice" role="note">
            <strong>{tCalendar("bookingToolTitle")}</strong> {tCalendar("bookingToolBody")}
          </p>
          <p>
            {personFeed
              ? tCalendar("active", {
                  date: formatDateTime(new Date(personFeed.createdAt), locale),
                  used: personFeed.lastUsedAt ? tCalendar("lastUsed", { date: formatDateTime(new Date(personFeed.lastUsedAt), locale) }) : tCalendar("neverUsed"),
                })
              : tCalendar("none")}
          </p>
          <CalendarAddressForm eventId={null} hasActive={personFeed !== null} labels={{ create: tCalendar("create"), renew: tCalendar("regenerate"), revoke: tCalendar("revoke"), form: tCalendar("personTitle") }} />
          <h3>{tCalendar("eventsTitle")}</h3>
          <p className="field-hint">{tCalendar("eventsHint")}</p>
          {followed.filter(Boolean).length === 0 ? (
            <p>{tCalendar("eventsNone")}</p>
          ) : (
            <ul className="plain-list">
              {followed.flatMap((entry) =>
                entry
                  ? [
                      <li key={entry.id} className="row-wrap">
                        <span>{tCalendar("eventLine", { event: entry.names })}</span>
                        <form action={revokeCalendarAddressAction}>
                          <input type="hidden" name="eventId" value={entry.eventId} />
                          <button type="submit" className="link-button">
                            {tCalendar("revokeEvent", { event: entry.names })}
                          </button>
                        </form>
                      </li>,
                    ]
                  : [],
              )}
            </ul>
          )}
        </section>
      ) : null}
      {/* Lot 24b (SEC-06) : déconnexion à distance. */}
      <SignOutEverywhereForm />
    </main>
  );
}
