// Lot 49 (INV-01 à INV-04, INV-07, RGP-06 à RGP-08, RGP-18 ; partie G) — l'onglet « Invités » de la
// fiche de l'évènement : activation (analyse d'impact), suivi des réponses par temps fort, régimes
// comptés (nominatifs pour la titulaire seule), réglages des réponses, invitations après l'écran de
// contrôle, foyers et personnes, liens et QR codes, import, conservation et report de la purge.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { starterGuestRules } from "@symbola/starter-templates";
import type { GuestListFilter, GuestPersonView, HouseholdView } from "@symbola/contracts";
import { ScreenHelp } from "@/app/screen-help";
import {
  getDietTallies,
  getGuestEventSettings,
  getGuestEventSummary,
  getGuestModuleState,
  getGuestPurgeSchedule,
  listGuestImports,
  listHouseholdGroups,
  listHouseholds,
  listInvitationRecipients,
  listManualFollowUps,
} from "@/modules/guests/service";
import type { GuestsAccess } from "./access";
import {
  confirmImpactAction,
  issueGuestLinkAction,
  postponePurgeAction,
  recordAnswersAction,
  removeHouseholdAction,
  revokeGuestLinksAction,
  saveGuestSettingsAction,
  saveHouseholdAction,
  sendInvitationsAction,
  importGuestsAction,
  undoGuestImportAction,
} from "./actions";
import { ActivationForm, GuestLinkButton, GuestSettingsForm, HouseholdForm, ImportForm, InvitationsForm, PostponeForm, RecordAnswersForm } from "./guest-forms";


export type GuestsTabQuery = { cote?: string | undefined; groupe?: string | undefined; sansReponse?: string | undefined };

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function personName(person: Pick<GuestPersonView, "firstName" | "lastName">): string {
  return person.lastName ? `${person.firstName} ${person.lastName}` : person.firstName;
}

export async function GuestsTab({
  access,
  eventId,
  clients,
  locale,
  query,
  hrefFor,
}: {
  access: GuestsAccess;
  eventId: string;
  clients: { id: string; name: string }[];
  locale: Locale;
  query: GuestsTabQuery;
  hrefFor: (extra: Record<string, string>) => string;
}) {
  const t = await getTranslations("Guests.tab");
  const tHelp = await getTranslations("Help");
  const { organizationId } = access;
  const state = await getGuestModuleState(organizationId);
  if (!state.impactAssessmentConfirmedAt) {
    return (
      <section className="stack" aria-labelledby="guests-activation-title">
        <h2 id="guests-activation-title">{t("activationTitle")}</h2>
        <p>{t("activationBody")}</p>
        <ul>
          <li>{t("activationData")}</li>
          <li>{t("activationDiets")}</li>
          <li>{t("activationPurge")}</li>
        </ul>
        {access.owner ? <ActivationForm action={confirmImpactAction} assessmentUrl={starterGuestRules().impactAssessmentUrl} /> : <p role="note">{t("activationOwnerOnly")}</p>}
      </section>
    );
  }

  const filter: GuestListFilter = {
    ...(query.cote ? { side: query.cote } : {}),
    ...(query.groupe ? { groupId: query.groupe } : {}),
    ...(query.sansReponse === "1" ? { unanswered: true } : {}),
  };
  const [settings, summary, tallies, households, groups, imports, followUps, recipients, purge] = await Promise.all([
    getGuestEventSettings(organizationId, eventId),
    getGuestEventSummary(organizationId, eventId),
    getDietTallies(organizationId, eventId, locale),
    listHouseholds(organizationId, eventId, access.viewer, filter, locale),
    listHouseholdGroups(organizationId, eventId),
    listGuestImports(organizationId, eventId),
    listManualFollowUps(organizationId, eventId),
    listInvitationRecipients(organizationId, eventId),
    getGuestPurgeSchedule(organizationId, eventId),
  ]);
  const keyMoments = summary.tallies.map((tally) => ({ id: tally.keyMomentId, name: tally.name, date: tally.date }));
  const schedule = settings.responsesCloseOn ? settings.reminderDays.map((day) => formatCalendarDate(addDays(settings.responsesCloseOn!, -day), locale)) : [];
  const clientName = new Map(clients.map((client) => [client.id, client.name]));
  const filterLinks = [
    { key: "all", label: t("filterAll"), href: hrefFor({}), current: !query.cote && !query.groupe && query.sansReponse !== "1" },
    { key: "unanswered", label: t("filterUnanswered"), href: hrefFor({ sansReponse: "1" }), current: query.sansReponse === "1" },
    ...clients.map((client) => ({ key: client.id, label: t("filterSide", { name: client.name }), href: hrefFor({ cote: client.id }), current: query.cote === client.id })),
    { key: "both", label: t("filterBoth"), href: hrefFor({ cote: "both" }), current: query.cote === "both" },
    ...groups.map((group) => ({ key: group.id, label: group.label, href: hrefFor({ groupe: group.id }), current: query.groupe === group.id })),
  ];

  return (
    <div className="stack">
      <ScreenHelp title={tHelp("guests.title")} body={tHelp("guests.body")} />

      <section aria-labelledby="guests-summary-title" className="stack">
        <h2 id="guests-summary-title">{t("summaryTitle")}</h2>
        <p>{t("summaryLine", { households: summary.households, people: summary.people, answered: summary.answered, confirmed: summary.confirmed })}</p>
        {keyMoments.length === 0 ? (
          <p role="note">
            {t("noKeyMoments")} <Link href={hrefFor({ onglet: "apercu" })}>{t("noKeyMomentsLink")}</Link>
          </p>
        ) : (
          <div className="guest-tally">
            {summary.tallies.map((tally) => (
              <div key={tally.keyMomentId} className="card">
                <h3>{tally.name}</h3>
                <p className="muted">{formatCalendarDate(tally.date, locale)}</p>
                <p>{t("tally", { yes: tally.yes, no: tally.no, pending: tally.pending })}</p>
              </div>
            ))}
          </div>
        )}
        {settings.askDiet ? (
          <section aria-labelledby="guests-diets-title">
            <h3 id="guests-diets-title">{t("dietsTitle")}</h3>
            <p className="muted">{access.owner ? t("dietsOwner") : t("dietsMember")}</p>
            {tallies.every((tally) => tally.counts.length === 0) ? (
              <p>{t("dietsNone")}</p>
            ) : (
              tallies
                .filter((tally) => tally.counts.length > 0)
                .map((tally) => (
                  <div key={tally.keyMomentId}>
                    <h4>{tally.name}</h4>
                    <ul>
                      {tally.counts.map((count) => (
                        <li key={count.optionId}>{count.count !== null ? t("dietCount", { label: count.label, count: count.count }) : t("dietFewer", { label: count.label, threshold: count.fewerThan ?? 3 })}</li>
                      ))}
                    </ul>
                  </div>
                ))
            )}
          </section>
        ) : null}
      </section>

      <details>
        <summary>{t("settingsTitle")}</summary>
        <GuestSettingsForm action={saveGuestSettingsAction} eventId={eventId} settings={settings} />
      </details>

      <section aria-labelledby="guests-invitations-title" className="stack">
        <h2 id="guests-invitations-title">{t("invitationsTitle")}</h2>
        {settings.responsesCloseOn ? (
          <p>{t("closesOn", { date: formatCalendarDate(settings.responsesCloseOn, locale) })}</p>
        ) : (
          <p role="note">{t("closeOnRequired")}</p>
        )}
        <InvitationsForm action={sendInvitationsAction} eventId={eventId} count={recipients.length} schedule={schedule} />
        {followUps.length > 0 ? (
          <section aria-labelledby="guests-manual-title" className="stack">
            <h3 id="guests-manual-title">{t("manualTitle")}</h3>
            <p className="muted">{t("manualHelp")}</p>
            <ul className="plain-list">
              {followUps.map((followUp) => (
                <li key={followUp.householdId} className="guest-household">
                  <strong>{followUp.displayName}</strong>
                  {followUp.phone ? <a href={`tel:${followUp.phone.replace(/\s/g, "")}`}>{followUp.phone}</a> : null}
                  <GuestLinkButton action={issueGuestLinkAction} eventId={eventId} guestId={followUp.guestId} name={followUp.displayName} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>

      <section aria-labelledby="guests-list-title" className="stack">
        <h2 id="guests-list-title">{t("listTitle")}</h2>
        <nav aria-label={t("filters")} className="row-wrap">
          {filterLinks.map((link) => (
            <Link key={link.key} href={link.href} aria-current={link.current ? "true" : undefined} scroll={false}>
              {link.label}
            </Link>
          ))}
        </nav>
        <details>
          <summary>{t("addHousehold")}</summary>
          <HouseholdForm action={saveHouseholdAction} eventId={eventId} clients={clients} keyMoments={keyMoments} groups={groups.map((group) => group.label)} />
        </details>
        {households.length === 0 ? <p>{t("empty")}</p> : null}
        <ul className="plain-list stack">
          {households.map((household) => (
            <HouseholdItem key={household.id} household={household} eventId={eventId} clients={clients} clientName={clientName} keyMoments={keyMoments} groups={groups.map((group) => group.label)} locale={locale} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="guests-import-title" className="stack">
        <h2 id="guests-import-title">{t("importTitle")}</h2>
        <ImportForm action={importGuestsAction} eventId={eventId} />
        {imports.length > 0 ? (
          <ul>
            {imports.map((entry) => (
              <li key={entry.id}>
                {t("importEntry", { date: formatDateTime(new Date(entry.createdAt), locale), households: entry.households, people: entry.people, channel: entry.channel })}{" "}
                {entry.undoneAt ? (
                  <span className="muted">{t("importUndone")}</span>
                ) : (
                  <form action={undoGuestImportAction} className="inline">
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="importId" value={entry.id} />
                    <button type="submit">{t("importUndo")}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section id="purge" aria-labelledby="guests-purge-title" className="stack">
        <h2 id="guests-purge-title">{t("purgeTitle")}</h2>
        {purge.purgedAt ? (
          <p>{t("purged", { date: formatDateTime(new Date(purge.purgedAt), locale) })}</p>
        ) : purge.dietsDueOn && purge.allDueOn ? (
          <>
            <p>{purge.dietsPurgedAt ? t("dietsPurged") : t("dietsDue", { date: formatCalendarDate(purge.dietsDueOn, locale) })}</p>
            <p>{t("allDue", { date: formatCalendarDate(purge.allDueOn, locale) })}</p>
            {purge.postponement ? <p>{t("postponed", { date: formatCalendarDate(purge.postponement.until, locale), reason: purge.postponement.reason })}</p> : null}
            {purge.canPostpone && purge.latestPostponeOn ? <PostponeForm action={postponePurgeAction} eventId={eventId} latest={purge.latestPostponeOn} /> : null}
          </>
        ) : (
          <p>{t("purgeNoDate")}</p>
        )}
        <p className="muted">{t("purgeHelp")}</p>
      </section>
    </div>
  );
}

async function HouseholdItem({
  household,
  eventId,
  clients,
  clientName,
  keyMoments,
  groups,
  locale,
}: {
  household: HouseholdView;
  eventId: string;
  clients: { id: string; name: string }[];
  clientName: Map<string, string>;
  keyMoments: { id: string; name: string }[];
  groups: string[];
  locale: Locale;
}) {
  const t = await getTranslations("Guests.tab");
  const invited = keyMoments.filter((moment) => household.keyMomentIds === null || household.keyMomentIds.includes(moment.id));
  const side = household.side?.kind === "both" ? t("sideBoth") : household.side?.kind === "client" ? t("sideOf", { name: clientName.get(household.side.clientId) ?? "" }) : null;
  return (
    <li className="guest-household">
      <h3>{household.displayName}</h3>
      <p className="muted">
        {[side, household.groupLabel, household.answeredAt ? t("answered", { date: formatDateTime(new Date(household.answeredAt), locale) }) : t("notAnswered")].filter(Boolean).join(" · ")}
      </p>
      <ul className="guest-people">
        {household.people.map((person) => (
          <li key={person.id}>
            <strong>{personName(person)}</strong>
            {person.kind === "child" ? ` (${t("child")}${person.ageRange ? `, ${t(`age.${person.ageRange}`)}` : ""})` : null}
            {person.id === household.respondentGuestId ? ` · ${t("respondent")}` : null}
            {person.opposed ? ` · ${t("opposed")}` : null}
            <br />
            <span className="muted">
              {invited
                .map((moment) => {
                  const answer = person.answers.find((candidate) => candidate.keyMomentId === moment.id)?.attending;
                  return `${moment.name} : ${answer === true ? t("yes") : answer === false ? t("no") : t("pending")}`;
                })
                .join(" · ")}
            </span>
            {person.diet && person.diet.length > 0 ? (
              <>
                <br />
                <span>{t("diet", { diet: person.diet.join(", ") })}</span>
              </>
            ) : null}
            {person.kind === "adult" ? (
              <>
                <br />
                <span className="muted">{[person.email, person.phone].filter(Boolean).join(" · ") || t("noContact")}</span>
                <br />
                <span className="muted">{t(`linkStatus.${person.link.status}`)}</span>
                {person.kind === "adult" && !person.opposed && (person.email || person.phone) ? (
                  <GuestLinkButton action={issueGuestLinkAction} eventId={eventId} guestId={person.id} name={person.firstName} />
                ) : null}
                {person.link.status === "active" ? (
                  <form action={revokeGuestLinksAction} className="inline">
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="guestId" value={person.id} />
                    <button type="submit">{t("revoke", { name: person.firstName })}</button>
                  </form>
                ) : null}
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <RecordAnswersForm action={recordAnswersAction} eventId={eventId} household={household} keyMoments={keyMoments} />
      <details>
        <summary>{t("edit", { name: household.displayName })}</summary>
        <HouseholdForm action={saveHouseholdAction} eventId={eventId} household={household} clients={clients} keyMoments={keyMoments} groups={groups} />
      </details>
      <form action={removeHouseholdAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="householdId" value={household.id} />
        <button type="submit">{t("remove", { name: household.displayName })}</button>
      </form>
    </li>
  );
}
