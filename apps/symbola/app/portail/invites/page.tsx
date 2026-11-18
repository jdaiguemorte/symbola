// Lot 49 (INV-02, INV-04, RGP-07 ; D5, D8) — la rubrique « Invités » du portail du client : il
// ajoute ses invités, corrige, importe sa liste, suit les réponses et remet un lien (ou un QR code) à
// qui n'a pas d'adresse e-mail. Il ne voit jamais de régime nominatif : des nombres par temps fort,
// « moins de 3 » sous le seuil. Fermée par défaut (POR-10) ; sans elle, « indisponible ».
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { requireLink } from "@/lib/guards";
import { guestEventContextFor } from "./context";
import { getDietTallies, getGuestEventSummary, listHouseholdGroups, listHouseholds } from "@/modules/guests/service";
import { GuestLinkButton, HouseholdForm, ImportForm, RecordAnswersForm } from "@/app/events/[id]/invites/guest-forms";
import { LinkPrivacyNotice } from "../link-privacy-notice";
import { portalGuestsAccess } from "./access";
import { portalImportAction, portalIssueLinkAction, portalRecordAnswersAction, portalSaveHouseholdAction } from "./actions";

export default async function PortalGuestsPage() {
  const link = await requireLink("client");
  const t = await getTranslations("Guests.portal");
  const tTab = await getTranslations("Guests.tab");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const access = await portalGuestsAccess();
  if (!access) {
    return (
      <main className="portal">
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
        <p>
          <Link href="/portail">{t("back")}</Link>
        </p>
        <LinkPrivacyNotice organizationId={link.organizationId} />
      </main>
    );
  }
  const viewer = { kind: "client" as const, linkId: access.linkId };
  const [households, summary, tallies, groups, context] = await Promise.all([
    listHouseholds(access.organizationId, access.eventId, viewer, {}, locale),
    getGuestEventSummary(access.organizationId, access.eventId),
    getDietTallies(access.organizationId, access.eventId, locale),
    listHouseholdGroups(access.organizationId, access.eventId),
    guestEventContextFor(access.organizationId, access.eventId),
  ]);
  const keyMoments = summary.tallies.map((tally) => ({ id: tally.keyMomentId, name: tally.name }));
  const clients = context.clients;
  return (
    <main className="portal stack">
      <p>
        <Link href="/portail">{t("back")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("portalGuests.title")} body={tHelp("portalGuests.body")} />
      <section aria-labelledby="portal-guests-summary" className="stack">
        <h2 id="portal-guests-summary">{tTab("summaryTitle")}</h2>
        <p>{tTab("summaryLine", { households: summary.households, people: summary.people, answered: summary.answered, confirmed: summary.confirmed })}</p>
        <ul>
          {summary.tallies.map((tally) => (
            <li key={tally.keyMomentId}>
              <strong>{tally.name}</strong> ({formatCalendarDate(tally.date, locale)}) — {tTab("tally", { yes: tally.yes, no: tally.no, pending: tally.pending })}
            </li>
          ))}
        </ul>
        {tallies.some((tally) => tally.counts.length > 0) ? (
          <>
            <h3>{tTab("dietsTitle")}</h3>
            <p className="muted">{tTab("dietsMember")}</p>
            {tallies
              .filter((tally) => tally.counts.length > 0)
              .map((tally) => (
                <p key={tally.keyMomentId}>
                  <strong>{tally.name}</strong> :{" "}
                  {tally.counts.map((count) => (count.count !== null ? tTab("dietCount", { label: count.label, count: count.count }) : tTab("dietFewer", { label: count.label, threshold: count.fewerThan ?? 3 }))).join(" ; ")}
                </p>
              ))}
          </>
        ) : null}
      </section>

      <section aria-labelledby="portal-guests-add" className="stack">
        <h2 id="portal-guests-add">{tTab("addHousehold")}</h2>
        <HouseholdForm action={portalSaveHouseholdAction} eventId={access.eventId} clients={clients} keyMoments={keyMoments} groups={groups.map((group) => group.label)} />
      </section>

      <section aria-labelledby="portal-guests-import" className="stack">
        <h2 id="portal-guests-import">{tTab("importTitle")}</h2>
        <ImportForm action={portalImportAction} eventId={access.eventId} />
      </section>

      <section aria-labelledby="portal-guests-list" className="stack">
        <h2 id="portal-guests-list">{tTab("listTitle")}</h2>
        {households.length === 0 ? <p>{tTab("empty")}</p> : null}
        <ul className="plain-list stack">
          {households.map((household) => (
            <li key={household.id} className="guest-household">
              <h3>{household.displayName}</h3>
              <p className="muted">{household.answeredAt ? tTab("answeredShort") : tTab("notAnswered")}</p>
              <ul className="guest-people">
                {household.people.map((person) => (
                  <li key={person.id}>
                    {person.lastName ? `${person.firstName} ${person.lastName}` : person.firstName}
                    {person.kind === "child" ? ` (${tTab("child")})` : null}
                    {person.kind === "adult" && !person.opposed && (person.email || person.phone) ? (
                      <GuestLinkButton action={portalIssueLinkAction} eventId={access.eventId} guestId={person.id} name={person.firstName} />
                    ) : null}
                  </li>
                ))}
              </ul>
              <RecordAnswersForm action={portalRecordAnswersAction} eventId={access.eventId} household={household} keyMoments={keyMoments} />
              <details>
                <summary>{tTab("edit", { name: household.displayName })}</summary>
                <HouseholdForm action={portalSaveHouseholdAction} eventId={access.eventId} household={household} clients={clients} keyMoments={keyMoments} groups={groups.map((group) => group.label)} />
              </details>
            </li>
          ))}
        </ul>
      </section>
      <LinkPrivacyNotice organizationId={access.organizationId} />
    </main>
  );
}
